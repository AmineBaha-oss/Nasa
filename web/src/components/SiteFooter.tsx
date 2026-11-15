const TEAM = [
  'Mir Faiyazur Rahman',
  'Francisco Tuozzo',
  'Amine Baha',
  'Tamim Afghanyar',
  'Emmanuel Kouassi',
];

export function SiteFooter() {
  return (
    <footer className="lp-footer" aria-label="Project and team">
      <div className="lp-footer-intro">
        <div className="lp-footer-brand">
          <img src={`${import.meta.env.BASE_URL}icons/icon-192.png`} alt="" width="40" height="40" />
          <span>LANDERPRINT</span>
        </div>
        <p>Lunar site, date &amp; heading explorer.</p>
        <p className="lp-footer-event">Built for NASA Space Apps Challenge 2026.</p>
      </div>
      <nav className="lp-footer-links" aria-label="Project links">
        <a className="lp-footer-github" href="https://github.com/AmineBaha-oss/Nasa" target="_blank" rel="noopener noreferrer">
          View on GitHub <span aria-hidden="true">↗</span><span className="lp-footer-sr"> (opens in a new tab)</span>
        </a>
        <a href="https://github.com/AmineBaha-oss/Nasa/blob/main/README.md" target="_blank" rel="noopener noreferrer">About the project<span className="lp-footer-sr"> (opens in a new tab)</span></a>
        <a href="https://github.com/AmineBaha-oss/Nasa/blob/main/science/SOURCES.md" target="_blank" rel="noopener noreferrer">Data &amp; sources<span className="lp-footer-sr"> (opens in a new tab)</span></a>
      </nav>
      <div className="lp-footer-team">
        <p>Built by</p>
        <ul>{TEAM.map(name => <li key={name}>{name}</li>)}</ul>
      </div>
      <p className="lp-footer-note">Educational research prototype. Not NASA-endorsed or flight certified.</p>
    </footer>
  );
}
