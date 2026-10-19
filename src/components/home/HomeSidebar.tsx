import { useNavigate } from 'react-router-dom';
import { Home, Sparkles, ListMusic, Users, Headphones, BarChart3, Plus } from 'lucide-react';
import type { ArtistConfig } from '../../artists/types';
import { Img } from '../../utils';

const NAV: { href: string; label: string; Icon: typeof Home }[] = [
  { href: '/', label: 'Home', Icon: Home },
  { href: '/foryou', label: 'For You', Icon: Sparkles },
  { href: '/playlists', label: 'Playlists', Icon: ListMusic },
  { href: '/rooms', label: 'Listening Rooms', Icon: Users },
  { href: '/guess', label: 'Leakle', Icon: Headphones },
  { href: '/listening', label: 'Your Listening', Icon: BarChart3 },
];

// In-app link that keeps SPA navigation but still behaves like a real <a>
// (middle-click / cmd-click open a new tab).
export function SpaLink({ href, className, style, children, title, ariaCurrent }: {
  href: string; className?: string; style?: React.CSSProperties; children: React.ReactNode; title?: string; ariaCurrent?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <a
      href={href}
      title={title}
      aria-current={ariaCurrent ? 'page' : undefined}
      className={className}
      style={style}
      onClick={e => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(href);
      }}
    >
      {children}
    </a>
  );
}

export function HomeSidebar({ following, newCounts, onAddFollow }: {
  following: ArtistConfig[];
  newCounts: Record<string, number>;
  onAddFollow: () => void;
}) {
  return (
    <aside className="home-sidebar" aria-label="Main">
      <SpaLink href="/" className="home-logo" title="UNVAULTED">
        <img src="/logo.png" alt="UNVAULTED" style={{ width: 168, height: 'auto' }} />
      </SpaLink>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV.map(({ href, label, Icon }) => {
          const active = href === '/';
          return (
            <SpaLink key={href} href={href} ariaCurrent={active} className={`home-nav-link${active ? ' is-active' : ''}`}>
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </SpaLink>
          );
        })}
      </nav>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px' }}>
          <span className="home-eyebrow">Following</span>
          <button onClick={onAddFollow} aria-label="Follow an artist" className="home-icon-btn">
            <Plus size={14} />
          </button>
        </div>
        {following.length === 0 ? (
          <p style={{ padding: '4px 12px', fontSize: 13, lineHeight: 1.45, color: 'rgba(255,255,255,0.5)' }}>
            Star an artist below to pin them here and see their new leaks first.
          </p>
        ) : following.map(c => {
          const n = newCounts[c.slug] ?? 0;
          return (
            <SpaLink key={c.slug} href={`/${c.slug}`} className="home-nav-link">
              <span style={{ width: 30, height: 30, borderRadius: 7, overflow: 'hidden', flexShrink: 0, background: `${c.accentColor}33`, color: c.accentColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800 }}>
                {c.artistPhotoUrl
                  ? <Img w={64} src={c.artistPhotoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: c.photoObjectPosition ?? 'top center' }} />
                  : c.cardLetter}
              </span>
              <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.artistLabel}</span>
              {n > 0 && <span className="home-new-pill">{n} new</span>}
            </SpaLink>
          );
        })}
      </div>
    </aside>
  );
}
