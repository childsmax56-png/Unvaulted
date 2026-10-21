import { useEffect, useState } from 'react';
import { SiDiscord, SiReddit } from 'react-icons/si';

export const DISCORD_URL = 'https://discord.gg/GE5bMkTcV5';
export const REDDIT_URL = 'https://www.reddit.com/r/unvaulted/';

// One-time announcement shown on first visit after the Discord/Reddit move.
// Bump the key to show it again for a future announcement.
const DISMISS_KEY = 'vg_notice_community_moved_v1';

function wasDismissed(): boolean {
  try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
}

export function CommunityMovedNotice() {
  const [open, setOpen] = useState(() => !wasDismissed());

  const close = () => {
    setOpen(false);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* storage blocked */ }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  const linkStyle = { fontWeight: 600, textDecoration: 'underline' } as const;
  const buttonStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
    padding: '12px 16px', borderRadius: 12, textDecoration: 'none', fontSize: 14, fontWeight: 600,
  } as const;

  return (
    <div onClick={close} role="dialog" aria-modal="true" aria-labelledby="community-moved-title"
      style={{ position: 'fixed', inset: 0, zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}>
      <div onClick={e => e.stopPropagation()}
        style={{ position: 'relative', background: 'rgba(18,18,20,0.98)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 24, width: '100%', maxWidth: 420, color: '#fff', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <button onClick={close} aria-label="Close"
          style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', margin: 0 }}>Announcement</p>
        <h2 id="community-moved-title" style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>We've moved our community</h2>
        <p style={{ fontSize: 14, lineHeight: 1.55, color: 'rgba(255,255,255,0.8)', margin: 0 }}>
          Due to circumstances beyond our control, our previous Discord server was taken down.
          We've launched a new one, and we'd love for you to{' '}
          <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, color: '#7983F5' }}>join us there</a>.
        </p>
        <p style={{ fontSize: 14, lineHeight: 1.55, color: 'rgba(255,255,255,0.8)', margin: 0 }}>
          We've also lost access to the old Unvaulted subreddit following a staff member's departure,
          so we've created a new home at{' '}
          <a href={REDDIT_URL} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, color: '#FF6A33' }}>r/unvaulted</a>.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
          <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer"
            style={{ ...buttonStyle, background: 'rgba(88,101,242,0.18)', border: '1px solid rgba(88,101,242,0.3)', color: '#7983F5' }}>
            <SiDiscord style={{ width: 18, height: 18 }} /> Join the new Discord
          </a>
          <a href={REDDIT_URL} target="_blank" rel="noopener noreferrer"
            style={{ ...buttonStyle, background: 'rgba(255,69,0,0.15)', border: '1px solid rgba(255,69,0,0.28)', color: '#FF6A33' }}>
            <SiReddit style={{ width: 18, height: 18 }} /> Visit r/unvaulted
          </a>
          <button onClick={close}
            style={{ ...buttonStyle, background: 'none', border: 'none', color: 'rgba(255,255,255,0.55)', cursor: 'pointer', fontFamily: 'inherit' }}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
