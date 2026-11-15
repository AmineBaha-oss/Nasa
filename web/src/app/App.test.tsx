import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App, LoadProblems, MissionView } from './App';

describe('app shell (no science data)', () => {
  it('starts in a loading state that makes no prediction', () => {
    const html = renderToStaticMarkup(<App />);
    expect(html).toContain('Loading processed science data');
    expect(html).toContain('does not certify landing safety');
  });

  it('shows why nothing loaded instead of an empty navigator', () => {
    const html = renderToStaticMarkup(<MissionView data={{ datasets: [], terrainBySite: new Map(), problems: ['site-1_window-a.json: HTTP 404'] }} />);
    expect(html).toContain('No valid science data');
    expect(html).toContain('site-1_window-a.json: HTTP 404');
    expect(html).not.toContain('lp-page');
  });

  it('lists file problems and renders nothing when there are none', () => {
    expect(renderToStaticMarkup(<LoadProblems problems={[]} />)).toBe('');
    expect(renderToStaticMarkup(<LoadProblems problems={['a', 'b']} />)).toContain('2 data file issues');
  });
});
