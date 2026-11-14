interface Props {
  /** Already formatted text, e.g. "030°" or "-1.2°". Digits roll, other characters stay put. */
  text: string;
  /** Roll digits to their new value. Leave false for continuous input (drag, slider, keys). */
  animate?: boolean;
  className?: string;
}

const DIGITS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** Odometer-style readout. Screen readers get the plain text; the rolling columns are aria-hidden. */
export function Odometer({ text, animate = false, className }: Props) {
  const chars = [...text];
  return (
    <span className={className ? `lp-odo ${className}` : 'lp-odo'}>
      <span className="lp-visually-hidden">{text}</span>
      <span aria-hidden="true" className="lp-odo-row">
        {chars.map((c, i) => {
          const key = chars.length - i; // keyed from the right so columns keep identity when width changes
          if (!/\d/.test(c)) return <span key={key} className="lp-odo-char">{c}</span>;
          return (
            <span key={key} className="lp-odo-col">
              <span className={animate ? 'lp-odo-strip is-animated' : 'lp-odo-strip'} style={{ transform: `translateY(${-Number(c) * 10}%)` }}>
                {DIGITS.map(d => <span key={d}>{d}</span>)}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}
