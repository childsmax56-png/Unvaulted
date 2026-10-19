import { useMemo } from 'react';
import { ARTIST_LIST } from '../../artists/registry';
import type { ArtistConfig } from '../../artists/types';
import { getListeningHistory } from '../../history';
import { createSlug, Img } from '../../utils';
import { timeAgo } from '../../alerts';
import { SpaLink } from './HomeSidebar';

interface ResumeItem {
  config: ArtistConfig;
  era: string;
  lastSong: string;
  lastPlayed: number;
  art: string;
}

const norm = (s: string) => s.toLowerCase().trim();

// History rows only carry the era name + a parsed artist string, so resolve
// them back to a tracker: the era must exist on that tracker, and when several
// trackers share an era name, prefer the one whose artist matches.
function resolveTracker(eraName: string, artist: string): ArtistConfig | null {
  const era = norm(eraName);
  const candidates = ARTIST_LIST.filter(c =>
    !c.hidden && Object.keys(c.ALBUM_RELEASE_DATES).some(k => norm(k) === era),
  );
  if (candidates.length <= 1) return candidates[0] ?? null;
  const a = norm(artist);
  return candidates.find(c => a.includes(norm(c.artistLabel))) ?? candidates[0];
}

function useResumeItems(limit: number): ResumeItem[] {
  return useMemo(() => {
    const seen = new Set<string>();
    const out: ResumeItem[] = [];
    const history = [...getListeningHistory()].sort((x, y) => y.lastPlayed - x.lastPlayed);
    for (const h of history) {
      const config = resolveTracker(h.eraName, h.artist);
      if (!config) continue;
      const key = `${config.slug}|${norm(h.eraName)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const era = Object.keys(config.ALBUM_RELEASE_DATES).find(k => norm(k) === norm(h.eraName)) ?? h.eraName;
      out.push({ config, era, lastSong: h.songName, lastPlayed: h.lastPlayed, art: config.CUSTOM_IMAGES[era] || h.albumArt });
      if (out.length >= limit) break;
    }
    return out;
  }, [limit]);
}

export function ContinueListening() {
  const items = useResumeItems(8);
  if (items.length === 0) return null;

  return (
    <section className="home-section">
      <div className="home-section-head">
        <h2 className="home-h2">Pick up where you left off</h2>
        <SpaLink href="/listening" className="home-head-link">Your listening</SpaLink>
      </div>
      <div className="home-resume-grid">
        {items.map(it => (
          <SpaLink
            key={`${it.config.slug}-${it.era}`}
            href={`/${it.config.slug}/album/${createSlug(it.era)}`}
            className="home-card home-resume-card"
          >
            <span className="home-resume-art" style={{ background: `${it.config.accentColor}33` }}>
              {it.art && <Img w={128} src={it.art} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
              <span className="home-ellipsis" style={{ fontSize: 15, fontWeight: 600 }}>{it.era}</span>
              <span className="home-ellipsis" style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>{it.config.artistLabel}</span>
              <span className="home-ellipsis" style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                {it.lastSong} · {timeAgo(it.lastPlayed)}
              </span>
            </span>
          </SpaLink>
        ))}
      </div>
    </section>
  );
}
