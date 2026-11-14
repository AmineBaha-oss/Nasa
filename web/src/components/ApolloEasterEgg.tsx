import { useEffect, useState } from 'react';

const WORD = 'apollo';

// Original ASCII sketch of a free-return-style trace. Illustrative only, not mission data.
const TRACE = String.raw`
   EARTH
     ( )_
      \  '-._
       \     '-.__      TLI
        \         '--.__
         '-.             '--.__        LOI
            '-._               '-.__   .--.
                '--.___             '-(    ) MOON
                       '---.____      '--'
                                '-----'
   FREE-RETURN TRACE  //  illustrative sketch, not mission data`;

/** Typing "apollo" (outside form fields) shows a vintage mission trace for 3 seconds. */
export function ApolloEasterEgg() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    let buffer = '', timer = 0;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      if (e.key.length !== 1) return;
      buffer = (buffer + e.key.toLowerCase()).slice(-WORD.length);
      if (buffer === WORD) { setVisible(true); window.clearTimeout(timer); timer = window.setTimeout(() => setVisible(false), 3000); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); window.clearTimeout(timer); };
  }, []);
  if (!visible) return null;
  return <pre className="lp-apollo" role="status" aria-label="Apollo-style free-return trace, illustrative">{TRACE}</pre>;
}
