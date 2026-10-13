import { useEffect, useState } from 'react';

// Share card for the Listening page. The image is the public profile's share
// card (/og/card.png, rendered by workers/og-image), so it only shows stats
// when the profile and its listening section are public — offer to flip both.
interface Props { username: string; accent: string }

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem('vg_token');
  return t ? { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

export function ShareStatsCard({ username, accent }: Props) {
  const [isPublic, setIsPublic] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [imgOk, setImgOk] = useState(true);
  const [bust, setBust] = useState(0);

  const profilePath = `/u/${encodeURIComponent(username)}`;
  const link = `${location.origin}${profilePath}`;
  const img = `/og/card.png?path=${encodeURIComponent(profilePath)}${bust ? `&b=${bust}` : ''}`;

  useEffect(() => {
    fetch('/api/auth/profile', { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => setIsPublic(!!s && !!s.profilePublic && !!s.showListening))
      .catch(() => setIsPublic(null));
  }, []);

  const makePublic = async () => {
    setBusy(true);
    const res = await fetch('/api/auth/profile', {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ profilePublic: true, showListening: true }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) { setIsPublic(true); setBust(Date.now()); setImgOk(true); }
  };

  const share = async () => {
    try {
      if (navigator.share) { await navigator.share({ title: `${username}'s listening on UNVAULTED`, url: link }); return; }
      await navigator.clipboard.writeText(link);
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    } catch { /* cancelled */ }
  };

  const btn: React.CSSProperties = { padding: '10px 18px', borderRadius: 10, fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
      {imgOk && (
        <img
          src={img}
          alt="Your share card"
          onError={() => setImgOk(false)}
          style={{ width: '100%', maxWidth: 600, aspectRatio: '1200 / 630', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}
        />
      )}
      {isPublic === false && (
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
          Your listening is private, so shared links only show your name.{' '}
          <button onClick={makePublic} disabled={busy} style={{ background: 'none', border: 'none', padding: 0, color: accent, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
            {busy ? 'Saving…' : 'Make my profile & listening public'}
          </button>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={share} style={{ ...btn, background: accent, color: '#0a0a0a' }}>{copied ? 'Link copied!' : 'Share link'}</button>
        {imgOk && (
          <a href={img} download={`${username}-unvaulted.png`} style={{ ...btn, background: 'rgba(255,255,255,0.08)', color: '#fff' }}>Download image</a>
        )}
      </div>
    </div>
  );
}
