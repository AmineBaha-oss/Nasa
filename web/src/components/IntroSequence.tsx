import { useEffect, useState } from 'react';

const KEY = 'landerprint.intro.seen';

/** Whether the intro should play: once per browser session, never with reduced motion. */
export function shouldPlayIntro(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  try { return window.sessionStorage.getItem(KEY) !== '1'; } catch { return true; }
}

/** "T-3 2 1" countdown (600 ms) over the page; the dial draws itself underneath. Any key, click or Skip ends it. */
export function IntroSequence({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(3);
  useEffect(() => {
    const finish = () => { try { window.sessionStorage.setItem(KEY, '1'); } catch { /* storage unavailable */ } onDone(); };
    const timers = [window.setTimeout(() => setStep(2), 200), window.setTimeout(() => setStep(1), 400), window.setTimeout(finish, 600)];
    const skip = () => { timers.forEach(clearTimeout); finish(); };
    window.addEventListener('keydown', skip, { once: true });
    return () => { timers.forEach(clearTimeout); window.removeEventListener('keydown', skip); };
  }, [onDone]);
  return (
    <div className="lp-intro" role="status" aria-live="polite">
      <p className="lp-intro-count">T-{step}</p>
      <button type="button" className="lp-intro-skip" onClick={() => { try { window.sessionStorage.setItem(KEY, '1'); } catch { /* ignore */ } onDone(); }}>Skip intro</button>
    </div>
  );
}
