import { History, Mic2, Archive, Trophy, Hammer, FileSpreadsheet, Scissors, Download } from 'lucide-react';
import { SpaLink } from './HomeSidebar';

const TILES: { href: string; title: string; body: string; Icon: typeof History; external?: boolean }[] = [
  { href: '/changes', title: 'Tracker changelog', body: 'Every new song & link, with alerts.', Icon: History },
  { href: '/producers', title: 'Producers & features', body: 'Every credit, across every artist.', Icon: Mic2 },
  { href: '/archive', title: 'Tracker archive', body: 'Old copies, the Leaktionary, templates.', Icon: Archive },
  { href: '/tierlist', title: 'Tier list', body: 'Rank songs from any artist.', Icon: Trophy },
  { href: '/community', title: 'Build a tracker', body: 'Create one & browse community trackers.', Icon: Hammer },
  { href: '/my-tracker', title: 'My tracker', body: 'Link your own Google Sheet.', Icon: FileSpreadsheet },
  { href: '/yeditsgold', title: 'YEdits', body: 'Browse fan edits.', Icon: Scissors },
  { href: '/download', title: 'Get the app', body: 'Desktop & mobile apps.', Icon: Download },
];

export function ExploreTiles() {
  return (
    <section className="home-section" style={{ minWidth: 0 }}>
      <div className="home-section-head">
        <h2 className="home-h2">Explore</h2>
      </div>
      <div className="home-explore-grid">
        {TILES.map(({ href, title, body, Icon }) => (
          <SpaLink key={href} href={href} className="home-card home-explore-tile">
            <span className="home-explore-icon"><Icon size={18} aria-hidden="true" /></span>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
            <span style={{ fontSize: 13, lineHeight: 1.4, color: 'rgba(255,255,255,0.6)' }}>{body}</span>
          </SpaLink>
        ))}
      </div>
    </section>
  );
}
