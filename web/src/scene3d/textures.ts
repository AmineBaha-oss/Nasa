import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';

/** Procedural, decorative surface textures. Generated once in the browser; no image assets are shipped. */
const cache = new Map<string, Texture>();

function canvasTexture(key: string, size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void, srgb = true): Texture | null {
  const hit = cache.get(key);
  if (hit) return hit;
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  draw(ctx, size);
  const t = new CanvasTexture(canvas);
  if (srgb) t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(key, t);
  return t;
}

/** Photovoltaic cell grid: dark blue cells, thin busbars, a lighter frame. */
export function solarCellTexture(): Texture | null {
  return canvasTexture('cells', 512, (ctx, s) => {
    ctx.fillStyle = '#c9ced6';
    ctx.fillRect(0, 0, s, s);
    const margin = s * 0.035, n = 8, gap = s * 0.008;
    const cell = (s - 2 * margin - gap * (n - 1)) / n;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const x = margin + c * (cell + gap), y = margin + r * (cell + gap);
        const g = ctx.createLinearGradient(x, y, x + cell, y + cell);
        g.addColorStop(0, '#152c50');
        g.addColorStop(1, '#09172e');
        ctx.fillStyle = g;
        ctx.fillRect(x, y, cell, cell);
        ctx.strokeStyle = 'rgba(150,175,220,.35)';
        ctx.lineWidth = 1;
        for (let k = 1; k < 3; k++) {
          ctx.beginPath();
          ctx.moveTo(x + (cell * k) / 3, y);
          ctx.lineTo(x + (cell * k) / 3, y + cell);
          ctx.stroke();
        }
      }
    }
  });
}

/**
 * Tileable regolith grain: three octaves of wrapped value noise plus small crater pits.
 * Used as a colour multiplier and bump map on the terrain; decorative, not derived from the DEM.
 */
export function regolithTexture(): Texture | null {
  const t = canvasTexture('regolith', 512, (ctx, s) => {
    let seed = 11;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const octave = (cells: number) => {
      const g = Array.from({ length: cells * cells }, rand);
      const at = (x: number, y: number) => g[((y % cells + cells) % cells) * cells + ((x % cells + cells) % cells)];
      return (px: number, py: number) => {
        const fx = (px / s) * cells, fy = (py / s) * cells;
        const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
        const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
        return a + (b - a) * sy;
      };
    };
    const o1 = octave(6), o2 = octave(24), o3 = octave(96);
    const img = ctx.createImageData(s, s);
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const v = 0.5 * o1(x, y) + 0.3 * o2(x, y) + 0.2 * o3(x, y) + (rand() - 0.5) * 0.12;
        const c = Math.max(0, Math.min(255, 150 + v * 100));
        const i = (y * s + x) * 4;
        img.data[i] = c; img.data[i + 1] = c; img.data[i + 2] = c; img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    for (let k = 0; k < 28; k++) {
      const r = 3 + rand() ** 3 * 26, cx = rand() * s, cy = rand() * s;
      for (const [ox, oy] of [[0, 0], [s, 0], [-s, 0], [0, s], [0, -s]]) {
        const g = ctx.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, r);
        g.addColorStop(0, 'rgba(0,0,0,.18)');
        g.addColorStop(0.75, 'rgba(0,0,0,.06)');
        g.addColorStop(0.9, 'rgba(255,255,255,.1)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx + ox, cy + oy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });
  if (t) t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

/** Crinkled multilayer-insulation foil: brightness noise used as a colour map on the gold body. */
export function foilTexture(): Texture | null {
  const t = canvasTexture('foil', 256, (ctx, s) => {
    ctx.fillStyle = '#c8a25a';
    ctx.fillRect(0, 0, s, s);
    let seed = 7;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 260; i++) {
      const x = rand() * s, y = rand() * s, w = 10 + rand() * 40, h = 6 + rand() * 26;
      ctx.fillStyle = rand() > 0.5 ? `rgba(255,236,180,${0.025 + rand() * 0.065})` : `rgba(90,60,20,${0.025 + rand() * 0.06})`;
      ctx.beginPath();
      ctx.ellipse(x, y, w, h, rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  if (t) { t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(2, 1); }
  return t;
}
