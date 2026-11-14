import { useRef } from 'react';
import { unwrapAngle } from './geometry';

/** Keeps a continuous rotation value so CSS transitions never spin the long way round. */
export function useUnwrappedAngle(deg: number): number {
  const ref = useRef(deg);
  ref.current = unwrapAngle(ref.current, deg);
  return ref.current;
}
