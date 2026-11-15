import type { Status } from '../contracts';

/** Same status colours as web/src/styles/navigator.css so 2D and 3D read alike. */
export const PALETTE = {
  space: '#03050a', paper: '#eceae4', regolith: '#8f8b83', regolithDark: '#34322e', sun: '#ffb547', sunLight: '#fff0dc',
  fill: '#9db4dc', earth: '#5cc8ff', signal: '#ff6a3d',
  pass: '#3dd68c', caution: '#f0a43a', fail: '#ff5d55', unknown: '#9aa1ab',
  cell: '#14254a', cellLine: '#3a5a92', frame: '#c9ced6', foil: '#d9ad55', foilDark: '#8a6a2c', deck: '#e8eaee',
  wall: '#191814', wallTop: '#3a372f',
} as const;

export function statusColour(status: Status | null | undefined): string {
  switch (status) {
    case 'pass': return PALETTE.pass;
    case 'fail': return PALETTE.fail;
    case 'unknown': case null: case undefined: return PALETTE.unknown;
    default: { const never: never = status; return never; }
  }
}
