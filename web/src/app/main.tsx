import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './shell.css';

function App() {
  return <main><p className="eyebrow">LANDERPRINT · RESEARCH PROTOTYPE</p>
    <h1>Lunar Landing Site Navigator</h1>
    <p>Compare lunar sites, dates and spacecraft headings.</p>
    <section aria-labelledby="status"><h2 id="status">Awaiting validated science data</h2>
      <dl><dt>Sun / Earth ephemeris</dt><dd>Unknown — independent verification pending</dd>
      <dt>Terrain coverage</dt><dd>Unknown — local NASA rasters not loaded</dd>
      <dt>Hardware configuration</dt><dd>Awaiting team-approved parameters</dd></dl>
    </section><p>No mission predictions are available. This educational prototype does not certify landing safety.</p>
    <a href="https://ssd.jpl.nasa.gov/horizons/">Planned astronomical source: NASA JPL Horizons</a>
  </main>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
