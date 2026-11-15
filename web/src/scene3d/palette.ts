import type { Status } from '../contracts';

/** Same colours as web/src/styles/navigator.css so 2D and 3D read alike. */
export const PALETTE = {
  space: '#05070b', paper: '#eceae4', regolith: '#8a8578', sun: '#ffb547', earth: '#4fc3f7', signal: '#fc3d21',
  pass: '#3dd68c', caution: '#f0a43a', fail: '#ff5d55', unknown: '#9aa1ab',
  panel: '#1c3157', foil: '#c9a24a', wall: '#0b0f16',
} as const;

export function statusColour(status: Status | null | undefined): string {
  switch (status) {
    case 'pass': return PALETTE.pass;
    case 'fail': return PALETTE.fail;
    case 'unknown': case null: case undefined: return PALETTE.unknown;
    default: { const never: never = status; return never; }
  }
}
