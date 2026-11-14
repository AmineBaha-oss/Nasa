import { useRef, type MutableRefObject } from 'react';
import { unwrapAngle } from './geometry';

/**
 * Continuous rotation value so CSS transitions never spin the long way round.
 * Returns the ref itself: a drag handler can advance it imperatively (same frame as the pointer
 * event) and the next render reads the same value, so React and the DOM never disagree.
 */
export function useUnwrappedAngle(deg: number): MutableRefObject<number> {
  const ref = useRef(deg);
  ref.current = unwrapAngle(ref.current, deg);
  return ref;
}
