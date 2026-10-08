import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SiDiscord, SiReddit, SiTiktok, SiX } from 'react-icons/si';
import { RefreshCw, LogIn, LogOut, User, X, ShieldCheck } from 'lucide-react';
import { ARTIST_LIST } from './artists/registry';
import type { ArtistConfig } from './artists/types';
import { useSettings, LOADING_SCREENS } from './SettingsContext';
import { Img } from './utils';
import { useHasActiveAudio } from './player/audioStore';
import { fetchGlobalVisitCounts, getUserVisitCounts, type VisitCounts } from './visits';
import { AlternateTrackerButton } from './components/AlternateTrackerButton';

type SortMode = 'featured' | 'az' | 'popular' | 'yours';
const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: 'featured', label: 'Featured' },
  { id: 'az', label: 'A–Z' },
  { id: 'popular', label: 'Most visited' },
  { id: 'yours', label: 'Your most visited' },
];

// Handles the Spotify PKCE OAuth callback that redirects back to unvaulted.cc/?code=...
// Exchanges the code for tokens and forwards them back to whichever tracker initiated the flow.
function useSpotifyCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const stateParam = params.get('state');
    if (!code || !stateParam) return;

    window.history.replaceState({}, '', window.location.pathname);

    let parsed: { v?: string; r?: string };
    try { parsed = JSON.parse(atob(stateParam)); } catch { return; }

    const codeVerifier = parsed.v;
    const returnTo = parsed.r;
    if (!codeVerifier || !returnTo) return;

    // Allow any tracker running on unvaulted.cc, plus legacy origins and local dev
    const ALLOWED = [
      'https://unvaulted.cc',
      'https://vaultgold.net',
      'https://yzyarchives.org',
      'https://yzy-gold.childsmax56.workers.dev',
      'https://vamp-gold.childsmax56.workers.dev',
      'https://kdot-gold.childsmax56.workers.dev',
      'https://drizzy-gold.childsmax56.workers.dev',
      'http://127.0.0.1:5173',
      'http://localhost:5173',
      'http://localhost:5183',
    ];
    if (!ALLOWED.some(o => returnTo.startsWith(o))) return;

    fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${window.location.origin}/`,
        client_id: 'c9bdd79bf657487d8973f4c1510523ea',
        code_verifier: codeVerifier,
      }),
    })
      .then(r => r.json())
      .then((data: { access_token?: string; refresh_token?: string; expires_in?: number }) => {
        if (!data.access_token) return;
        const hash = new URLSearchParams({
          spotify_access_token: data.access_token,
          spotify_refresh_token: data.refresh_token || '',
          spotify_expires_in: String(data.expires_in || 3600),
        });
        window.location.href = returnTo + '/#' + hash.toString();
      })
      .catch(() => {});
  }, []);
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
        background: on ? '#FFD700' : 'rgba(255,255,255,0.1)',
        position: 'relative', flexShrink: 0, transition: 'background 0.2s',
      }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 2, left: on ? 22 : 2, transition: 'left 0.2s',
      }} />
    </button>
  );
}

function LandingSettingsPanel({ onClose }: { onClose: () => void }) {
  const { settings, updateSettings, resetSettings } = useSettings();
  const [confirmReset, setConfirmReset] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');
  const [vgUser, setVgUser] = useState<VGUser | null>(getVGUser);
  const [showSignIn, setShowSignIn] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [loginVal, setLoginVal] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [authError, setAuthError] = useState('');
  const row: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 16px', background: '#111', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 12,
  };
  const label: React.CSSProperties = { fontSize: 14, fontWeight: 500, color: 'rgba(255,255,255,0.9)' };
  const sublabel: React.CSSProperties = { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 };

  const handleReset = () => {
    if (confirmReset) { resetSettings(); setConfirmReset(false); }
    else { setConfirmReset(true); setTimeout(() => setConfirmReset(false), 3000); }
  };

  const doSync = async () => {
    setSyncing(true);
    setSyncMsg('');
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { setSyncing(false); setSyncMsg('Sign in to sync'); return; }

    const meRes = await fetch(`${VG_API}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (!meRes.ok) { setSyncing(false); setSyncMsg('Sync failed'); return; }
    const me = await meRes.json();
    const linked = me.linked ?? {};

    const synced: string[] = [];
    const spotifyExpired = linked.spotify?.expires_at && Date.now() > linked.spotify.expires_at - 30 * 1000;
    if (linked.spotify?.access_token && !spotifyExpired) {
      localStorage.setItem('spotify_access_token', linked.spotify.access_token);
      localStorage.setItem('spotify_refresh_token', linked.spotify.refresh_token);
      localStorage.setItem('spotify_expires_at', String(linked.spotify.expires_at));
      synced.push('Spotify');
    } else if (linked.spotify && spotifyExpired) {
      setSyncing(false);
      setSyncMsg('Spotify session expired — re-link Spotify at unvaulted.cc/account');
      setTimeout(() => setSyncMsg(''), 6000);
      return;
    }
    if (linked.lastfm?.session_key) {
      localStorage.setItem('lastfm_session_key', linked.lastfm.session_key);
      if (linked.lastfm.username) localStorage.setItem('lastfm_username', linked.lastfm.username);
      synced.push('Last.fm');
    }

    const dataRes = await fetch(`${VG_API}/api/sync`, { headers: { Authorization: `Bearer ${token}` } });
    if (dataRes.ok) {
      const allData = await dataRes.json() as Record<string, {
        favorites: { songName: string; eraName: string; url: string }[];
        playlists: { id: string; name: string; cover?: string; songs: { songName: string; eraName: string; url: string }[] }[];
      }>;
      let totalFavs = 0;
      let totalPls = 0;
      for (const [trackerId, data] of Object.entries(allData)) {
        const prefix = TRACKER_PREFIXES[trackerId];
        if (!prefix) continue;
        localStorage.setItem(`${prefix}favorite_keys`, JSON.stringify(data.favorites ?? []));
        localStorage.setItem(`${prefix}playlists`, JSON.stringify(data.playlists ?? []));
        totalFavs += data.favorites?.length ?? 0;
        totalPls += data.playlists?.length ?? 0;
      }
      if (totalFavs > 0 || totalPls > 0) {
        synced.push(`${totalFavs} favorite${totalFavs !== 1 ? 's' : ''} & ${totalPls} playlist${totalPls !== 1 ? 's' : ''}`);
        window.dispatchEvent(new CustomEvent('vg-data-synced'));
      }
    }

    setSyncing(false);
    setSyncMsg(synced.length ? `Synced ${synced.join(' & ')}` : 'No services linked yet');
    setTimeout(() => setSyncMsg(''), 3000);
  };

  const doLogin = async () => {
    setAuthError('');
    const res = await fetch(`${VG_API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: loginVal, password }),
    });
    const data = await res.json();
    if (!res.ok) return setAuthError(data.error || 'Sign in failed');
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setVgUser(data.user);
    setShowSignIn(false);
  };

  const doRegister = async () => {
    setAuthError('');
    const res = await fetch(`${VG_API}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json();
    if (!res.ok) return setAuthError(data.error || 'Registration failed');
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setVgUser(data.user);
    setShowSignIn(false);
  };

  const doVGGoogle = () => {
    window.location.href = `${VG_API}/api/auth/google/connect?return_to=${encodeURIComponent(window.location.origin)}`;
  };

  const doVGSignOut = async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) await fetch(`${VG_API}/api/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setVgUser(null);
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100 }}
      />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 340, maxWidth: '90vw',
        background: '#0a0a0a', borderLeft: '1px solid rgba(255,255,255,0.08)',
        zIndex: 101, overflowY: 'auto', padding: '24px 20px',
        display: 'flex', flexDirection: 'column', gap: 12,
        fontFamily: "'Inter', system-ui, sans-serif",
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>Settings</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', fontSize: 20, lineHeight: 1 }}
          >✕</button>
        </div>

        <div style={row}>
          <div><div style={label}>Theme Color</div></div>
          <input
            type="color"
            value={settings.themeColor}
            onChange={e => updateSettings({ themeColor: e.target.value })}
            style={{ width: 36, height: 28, border: 'none', borderRadius: 6, cursor: 'pointer', background: 'none', padding: 0 }}
          />
        </div>

        <div style={row}>
          <div style={label}>Font Size</div>
          <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 4 }}>
            {(['small', 'medium', 'large'] as const).map(s => (
              <button
                key={s}
                onClick={() => updateSettings({ globalFontSize: s })}
                style={{
                  padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 500,
                  background: settings.globalFontSize === s ? '#FFD700' : 'transparent',
                  color: settings.globalFontSize === s ? '#000' : 'rgba(255,255,255,0.5)',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >{s[0].toUpperCase() + s.slice(1)}</button>
            ))}
          </div>
        </div>

        <div style={{ ...row, flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
          <div style={label}>Loading Screen</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, width: '100%' }}>
            {LOADING_SCREENS.map(s => (
              <button
                key={s.id}
                onClick={() => updateSettings({ loadingScreen: s.id })}
                style={{
                  padding: '4px 10px', borderRadius: 6, border: '1px solid',
                  borderColor: settings.loadingScreen === s.id ? '#FFD700' : 'rgba(255,255,255,0.1)',
                  background: settings.loadingScreen === s.id ? 'rgba(255,215,0,0.12)' : 'transparent',
                  color: settings.loadingScreen === s.id ? '#FFD700' : 'rgba(255,255,255,0.5)',
                  fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                }}
              >{s.label}</button>
            ))}
          </div>
        </div>

        <div style={row}>
          <div style={label}>Tags as Emojis</div>
          <Toggle on={settings.tagsAsEmojis} onToggle={() => updateSettings({ tagsAsEmojis: !settings.tagsAsEmojis })} />
        </div>

        <div style={row}>
          <div>
            <div style={label}>Startup Shuffle</div>
            <div style={sublabel}>Shuffle on first load</div>
          </div>
          <Toggle on={settings.startupShuffle} onToggle={() => updateSettings({ startupShuffle: !settings.startupShuffle })} />
        </div>

        <div style={row}>
          <div style={label}>Synced Lyrics Only</div>
          <Toggle on={settings.syncedLyricsOnly} onToggle={() => updateSettings({ syncedLyricsOnly: !settings.syncedLyricsOnly })} />
        </div>

        {vgUser ? (
          <>
            <div style={{ ...row, justifyContent: 'flex-start', gap: 10 }}>
              <User size={16} color="rgba(255,255,255,0.5)" />
              <div style={label}>Signed in as {vgUser.username}</div>
            </div>
            <button
              onClick={doSync}
              disabled={syncing}
              style={{
                marginTop: 8, padding: '12px 16px', borderRadius: 12, border: 'none',
                background: '#FFD700', color: '#000', fontSize: 14, fontWeight: 700,
                cursor: 'pointer', opacity: syncing ? 0.5 : 1, transition: 'opacity 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing...' : 'Sync Services'}
            </button>
            {syncMsg && (
              <p style={{ fontSize: 12, textAlign: 'center', color: syncMsg.includes('failed') ? '#ef4444' : '#4ade80', margin: 0 }}>
                {syncMsg}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  const token = localStorage.getItem(TOKEN_KEY);
                  const params = token && vgUser
                    ? `?vg_token=${encodeURIComponent(token)}&vg_user=${encodeURIComponent(JSON.stringify(vgUser))}`
                    : '';
                  window.open(`${VG_API}/account${params}`, '_blank');
                }}
                style={{
                  flex: 1, padding: '10px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)',
                  background: 'transparent', color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                Manage Account
              </button>
              <button
                onClick={doVGSignOut}
                style={{
                  padding: '10px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)',
                  background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                <LogOut size={13} />
              </button>
            </div>
          </>
        ) : (
          <div style={{ ...row, flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
            <div>
              <div style={label}>Sync Spotify & Last.fm</div>
              <div style={sublabel}>In order to gain access to Spotify and Last.fm, sign into your UNVAULTED account here.</div>
            </div>
            <button
              onClick={() => setShowSignIn(true)}
              style={{
                width: '100%', padding: '10px 16px', borderRadius: 10, border: 'none',
                background: '#FFD700', color: '#000', fontSize: 13, fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <LogIn size={14} /> Sign in to UNVAULTED
            </button>
          </div>
        )}

        <button
          onClick={handleReset}
          style={{
            marginTop: 8, padding: '12px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)',
            background: confirmReset ? 'rgba(239,68,68,0.15)' : 'transparent',
            color: confirmReset ? '#ef4444' : 'rgba(255,255,255,0.4)',
            fontSize: 14, fontWeight: 500, cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          {confirmReset ? 'Click again to confirm reset' : 'Reset All Settings'}
        </button>
      </div>

      {showSignIn && (
        <div
          onClick={() => setShowSignIn(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.8)',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14,
              width: '100%', maxWidth: 380, padding: 24,
              fontFamily: "'Inter', system-ui, sans-serif",
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>UNVAULTED Account</span>
              <button
                onClick={() => setShowSignIn(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              {(['login', 'register'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setAuthTab(t); setAuthError(''); }}
                  style={{
                    padding: '0 8px 10px', background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: 700, marginBottom: -1,
                    borderBottom: `2px solid ${authTab === t ? '#FFD700' : 'transparent'}`,
                    color: authTab === t ? '#FFD700' : 'rgba(255,255,255,0.4)',
                  }}
                >
                  {t === 'login' ? 'Sign In' : 'Create Account'}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {authTab === 'register' && (
                <div>
                  <input
                    placeholder="Choose a username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    autoComplete="username"
                    style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 13, outline: 'none' }}
                  />
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                    Your custom display name — 3–32 characters, letters, numbers, _ . -
                  </div>
                </div>
              )}
              {authTab === 'register' && (
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 13, outline: 'none' }}
                />
              )}
              {authTab === 'login' && (
                <input
                  placeholder="Username or email"
                  value={loginVal}
                  onChange={e => setLoginVal(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doLogin()}
                  autoComplete="username"
                  style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 13, outline: 'none' }}
                />
              )}
              <input
                type="password"
                placeholder={authTab === 'register' ? 'Password (min. 8 characters)' : 'Password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (authTab === 'login' ? doLogin() : doRegister())}
                autoComplete={authTab === 'login' ? 'current-password' : 'new-password'}
                style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', color: '#fff', fontSize: 13, outline: 'none' }}
              />

              <button
                onClick={authTab === 'login' ? doLogin : doRegister}
                style={{
                  width: '100%', padding: '11px 0', borderRadius: 8, border: 'none',
                  background: '#FFD700', color: '#000', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {authTab === 'login' ? <LogIn size={14} /> : <User size={14} />}
                {authTab === 'login' ? 'Sign In' : 'Create Account'}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>or</span>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
              </div>

              <button
                onClick={doVGGoogle}
                style={{
                  width: '100%', padding: '11px 0', borderRadius: 8, border: 'none',
                  background: '#fff', color: '#000', fontSize: 13, fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <GoogleIcon /> Continue with Google
              </button>

              {authError && <p style={{ fontSize: 12, color: '#ef4444', textAlign: 'center', margin: 0 }}>{authError}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function GearIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

const VG_API = 'https://unvaulted.cc';
const TOKEN_KEY = 'vg_token';
const USER_KEY = 'vg_user';

// slug → localStorage prefix for every tracker
const TRACKER_PREFIXES: Record<string, string> = {
  yzygold: 'yzygold_',
  vampgold: 'vampgold_',
  kdotgold: 'kdotgold_',
  drizzygold: 'drizzygold_',
  xgold: 'xgold_',
  twizzygold: 'twizzygold_',
  uzigold: 'uzigold_',
  pushagold: 'pushagold_',
  shadygold: 'shadygold_',
  cactigold: 'cactigold_',
  dregold: 'dregold_',
  luckigold: 'luckigold_',
};

interface VGUser { id: string; username: string; email: string; }

function getVGUser(): VGUser | null {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
}

function GoogleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/>
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
    </svg>
  );
}

function useVGAuth() {
  const [user, setUser] = useState<VGUser | null>(getVGUser);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('vg_token');
    const userRaw = params.get('vg_user');
    if (!token || !userRaw) return;
    window.history.replaceState({}, '', window.location.pathname);
    try {
      const vgUser = JSON.parse(decodeURIComponent(userRaw));
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(vgUser));
      setUser(vgUser);
    } catch {}
  }, []);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data?.vaultgold) return;
      if (e.data.vaultgold === 'signed_in' && e.data.token && e.data.user) {
        localStorage.setItem(TOKEN_KEY, e.data.token);
        localStorage.setItem(USER_KEY, JSON.stringify(e.data.user));
        setUser(e.data.user);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const signInWithGoogle = () => {
    window.location.href = `${VG_API}/api/auth/google/connect?return_to=${encodeURIComponent(window.location.origin)}`;
  };

  const signOut = () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) fetch(`${VG_API}/api/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  };

  const signIn = (token: string, vgUser: VGUser) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(vgUser));
    setUser(vgUser);
  };

  return { user, signIn, signInWithGoogle, signOut };
}

// Whether the signed-in user is a site moderator (owner or yeditsgold admin),
// which unlocks the Admin button linking to /admin.
function useIsAdmin(user: VGUser | null): boolean {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!user || !token) { setIsAdmin(false); return; }
    let cancelled = false;
    fetch('/api/yeditsgold-admin-check', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }),
    })
      .then(r => r.ok ? r.json() : {})
      .then((d: { admin?: boolean }) => { if (!cancelled) setIsAdmin(!!d.admin); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user]);
  return isAdmin;
}

// ─── Card components ──────────────────────────────────────────────────────────

type CardVariant = 'featured' | 'medium' | 'small';

const VARIANT_ASPECT: Record<CardVariant, string> = { featured: '1/1', medium: '1/1', small: '1/1' };
const VARIANT_LOGO_HEIGHT_PX: Record<CardVariant, number> = { featured: 260, medium: 160, small: 100 };
const VARIANT_RADIUS: Record<CardVariant, number> = { featured: 14, medium: 14, small: 10 };
const LOGO_HEIGHT: Record<CardVariant, number> = { featured: 38, medium: 28, small: 20 };
const NAME_SIZE: Record<CardVariant, number> = { featured: 18, medium: 14, small: 11 };
const ARTIST_SIZE: Record<CardVariant, number> = { featured: 12, medium: 11, small: 9 };
const CARD_PADDING: Record<CardVariant, string> = { featured: '24px 16px 14px', medium: '20px 12px 10px', small: '14px 10px 8px' };
const LOGO_PADDING: Record<CardVariant, string> = { featured: '18px', medium: '14px', small: '10px' };

const FAVORITES_KEY = 'vg_favorite_artists';
function useFavoriteArtists() {
  const [favorites, setFavorites] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]'); } catch { return []; }
  });
  const toggleFavorite = (slug: string) => {
    setFavorites(prev => {
      const next = prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug];
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      return next;
    });
  };
  return { favorites, toggleFavorite };
}

function FavoriteButton({ active, onToggle }: { active: boolean; onToggle: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onToggle}
      aria-label={active ? 'Unfavorite artist' : 'Favorite artist'}
      style={{
        position: 'absolute', top: 6, left: 6, zIndex: 2,
        width: 22, height: 22, borderRadius: 6, border: 'none', cursor: 'pointer',
        background: active ? 'rgba(201,162,36,0.25)' : 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.15s',
      }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill={active ? '#C9A224' : 'none'} stroke={active ? '#C9A224' : 'rgba(255,255,255,0.6)'} strokeWidth="2">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </button>
  );
}

function EditorialArtistCard({ config, showPhoto, variant, isFavorite, onToggleFavorite }: {
  config: ArtistConfig;
  showPhoto: boolean;
  variant: CardVariant;
  isFavorite?: boolean;
  onToggleFavorite?: (slug: string) => void;
}) {
  const navigate = useNavigate();
  const accent = config.accentColor;
  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleFavorite?.(config.slug);
  };
  const photoUrl = showPhoto && config.artistPhotoUrl ? config.artistPhotoUrl : null;
  const aspectRatio = VARIANT_ASPECT[variant];
  const borderRadius = VARIANT_RADIUS[variant];

  const onEnter = (e: React.MouseEvent<HTMLDivElement>) => {
    e.currentTarget.style.borderColor = `${accent}66`;
    e.currentTarget.style.transform = 'translateY(-2px)';
  };
  const onLeave = (e: React.MouseEvent<HTMLDivElement>, base: string) => {
    e.currentTarget.style.borderColor = base;
    e.currentTarget.style.transform = '';
  };

  if (photoUrl) {
    return (
      <div
        onClick={() => navigate(`/${config.slug}`)}
        onMouseEnter={onEnter}
        onMouseLeave={e => onLeave(e, 'transparent')}
        style={{
          position: 'relative', borderRadius, overflow: 'hidden', cursor: 'pointer',
          aspectRatio, border: '1px solid transparent', background: '#111',
          transition: 'border-color 0.2s, transform 0.15s',
        }}
      >
        <Img w={400}
          src={photoUrl}
          alt={config.artistLabel}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: config.photoObjectPosition ?? 'top center' }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.2) 55%, transparent 100%)' }} />
        {!config.alternateTrackers?.length && (
          <div style={{ position: 'absolute', top: 10, right: 10, width: 7, height: 7, borderRadius: '50%', background: accent }} />
        )}
        {onToggleFavorite && <FavoriteButton active={!!isFavorite} onToggle={handleToggleFavorite} />}
        <AlternateTrackerButton config={config} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: CARD_PADDING[variant] }}>
          {variant === 'featured' && (
            <div style={{ display: 'inline-block', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', background: 'rgba(201,162,36,0.25)', color: '#C9A224', padding: '2px 7px', borderRadius: 4, marginBottom: 6 }}>Featured</div>
          )}
          <div style={{ fontSize: NAME_SIZE[variant], fontWeight: 800, color: '#fff', letterSpacing: '-0.01em', lineHeight: 1.1 }}>{config.artistLabel}</div>
        </div>
      </div>
    );
  }

  // Text-only fallback (no photo)
  const baseBorder = variant === 'featured' ? `${accent}30` : 'rgba(255,255,255,0.07)';
  return (
    <div
      onClick={() => navigate(`/${config.slug}`)}
      onMouseEnter={onEnter}
      onMouseLeave={e => onLeave(e, baseBorder)}
      style={{
        position: 'relative', borderRadius, overflow: 'hidden', cursor: 'pointer',
        minHeight: VARIANT_LOGO_HEIGHT_PX[variant], background: variant === 'featured' ? `${accent}0a` : '#0f0f0f',
        border: `1px solid ${baseBorder}`,
        padding: LOGO_PADDING[variant],
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        transition: 'border-color 0.2s, transform 0.15s',
      }}
    >
      {onToggleFavorite && <FavoriteButton active={!!isFavorite} onToggle={handleToggleFavorite} />}
      <AlternateTrackerButton config={config} />
      <div>
        {variant === 'featured' && (
          <div style={{ display: 'inline-block', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', background: `${accent}20`, color: accent, padding: '2px 7px', borderRadius: 4, marginBottom: 10 }}>Featured</div>
        )}
        <div style={{ fontSize: NAME_SIZE[variant], fontWeight: 900, color: accent, letterSpacing: '-0.02em' }}>{config.artistLabel}</div>
      </div>
    </div>
  );
}

function ExternalSmallCard({ href, label, logoSrc, logoAlt, accent, photoSrc, variant = 'small' }: {
  href: string; label: string; logoSrc: string; logoAlt: string; accent: string; photoSrc?: string; variant?: CardVariant;
}) {
  const onEnter = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.currentTarget.style.borderColor = `${accent}66`;
    e.currentTarget.style.transform = 'translateY(-2px)';
  };
  const onLeave = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.currentTarget.style.borderColor = photoSrc ? 'transparent' : 'rgba(255,255,255,0.07)';
    e.currentTarget.style.transform = '';
  };

  if (photoSrc) {
    return (
      <a
        href={href} target="_blank" rel="noopener noreferrer"
        onMouseEnter={onEnter} onMouseLeave={onLeave}
        style={{
          position: 'relative', borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
          aspectRatio: '1/1', border: '1px solid transparent', background: '#111',
          display: 'block', textDecoration: 'none',
          transition: 'border-color 0.2s, transform 0.15s',
        }}
      >
        <Img w={400} src={photoSrc} alt={label} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.2) 55%, transparent 100%)' }} />
        <div style={{ position: 'absolute', top: 10, right: 10, width: 7, height: 7, borderRadius: '50%', background: accent }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 10px 8px' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#fff', lineHeight: 1.1 }}>{label}</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{logoAlt}</div>
        </div>
      </a>
    );
  }

  return (
    <a
      href={href} target="_blank" rel="noopener noreferrer"
      onMouseEnter={onEnter} onMouseLeave={onLeave}
      style={{
        position: 'relative', borderRadius: VARIANT_RADIUS[variant], overflow: 'hidden', cursor: 'pointer',
        minHeight: VARIANT_LOGO_HEIGHT_PX[variant], background: '#0f0f0f',
        border: '1px solid rgba(255,255,255,0.07)',
        padding: LOGO_PADDING.small,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        textDecoration: 'none',
        transition: 'border-color 0.2s, transform 0.15s',
      }}
    >
      <img
        src={logoSrc} alt={logoAlt}
        style={{ display: 'block', height: LOGO_HEIGHT.small, width: 'auto', maxWidth: '100%', objectFit: 'contain', objectPosition: 'left center' }}
        onError={e => {
          const img = e.currentTarget;
          img.style.display = 'none';
          const fb = img.nextElementSibling as HTMLElement;
          if (fb) fb.style.display = 'block';
        }}
      />
      <div style={{ display: 'none', fontSize: 13, fontWeight: 900, color: accent }}>{logoAlt}</div>
      <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: `${accent}aa` }}>{label}</div>
    </a>
  );
}

function BigLinkCard({ href, accent, badge, titleMain, titleAccent, subtitle, watermark }: {
  href: string; accent: string; badge: string; titleMain: string; titleAccent: string; subtitle: string; watermark: string;
}) {
  return (
    <a
      href={href}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '28px 28px 24px',
        background: '#0f0f0f',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 16,
        textDecoration: 'none',
        color: '#fff',
        overflow: 'hidden',
        minHeight: 140,
        transition: 'border-color 0.2s, transform 0.15s, box-shadow 0.2s',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.borderColor = `${accent}66`;
        el.style.transform = 'translateY(-3px)';
        el.style.boxShadow = `0 16px 48px rgba(0,0,0,0.5)`;
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.borderColor = 'rgba(255,255,255,0.06)';
        el.style.transform = '';
        el.style.boxShadow = '';
      }}
    >
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ display: 'inline-block', fontSize: 10, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: accent, background: `${accent}1a`, border: `1px solid ${accent}33`, borderRadius: 4, padding: '3px 8px', marginBottom: 14 }}>{badge}</div>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.1 }}>{titleMain} <span style={{ color: accent }}>{titleAccent}</span></div>
      </div>
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 24 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{subtitle}</span>
        <div style={{ width: 28, height: 28, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 12 12" fill="none" strokeWidth="1.5" style={{ width: 12, height: 12, stroke: 'rgba(255,255,255,0.45)' }}><path d="M2 10L10 2M10 2H4M10 2v6" /></svg>
        </div>
      </div>
      <div style={{ position: 'absolute', right: -8, bottom: -16, fontSize: 120, fontWeight: 900, letterSpacing: '-0.05em', color: 'rgba(255,255,255,0.025)', lineHeight: 1, pointerEvents: 'none', userSelect: 'none' }}>{watermark}</div>
    </a>
  );
}

const SHEET_URLS: Record<string, string> = {
  yzygold:    'https://docs.google.com/spreadsheets/d/12nGHPPh5dVTfLuBLVQYzC3QgPxKfvp-jgCoNccvEasM/edit?gid=199908479#gid=199908479',
  yegold:     'https://docs.google.com/spreadsheets/d/1shKl9S-r5d1vgzYGSEyWflyyn0LS_AKJ7Ydjsczbb0Y/edit?gid=34972268#gid=34972268',
  yelolgold:  'https://docs.google.com/spreadsheets/d/1wQ0WC0U9q10fLWpy9CO8YR128eE8msGXqtZI8_cNyTA/edit?gid=199908479#gid=199908479',
  vampgold:   'https://docs.google.com/spreadsheets/d/1Irtfvymu26CShYowLMMfD-rM0o9CJqE6-BBSlYsAaF4/edit?gid=0#gid=0',
  wolfgold:   'https://docs.google.com/spreadsheets/d/19GJTNp7PxK1OtyVBmGelZSMm5i8Fy82EGtcFdIkBpsY/edit?gid=1246511510#gid=1246511510',
  drizzygold: 'https://docs.google.com/spreadsheets/d/1v55XAPLzw1iuWxH1OQKajCIYPhW2BXcLoV4mXDZ55DI/edit?gid=755606328#gid=755606328',
  frankgold:  'https://franktracker.net/',
  xgold:      'https://docs.google.com/spreadsheets/d/1wKq7lSERmXYutRFxipNbFFc-DUdqhVXWWlFnqkzwRFA/edit?usp=sharing',
  cactigold:  'https://docs.google.com/spreadsheets/d/1gJqbQrb3dIWF-PLMsKkNUrftpQb8zxsZFDAIpSvT5Fo/edit?gid=846204501#gid=846204501',
  kdotgold:   'https://docs.google.com/spreadsheets/d/1i4OQglDHiiqMDthqfUFPutGmpZzK7n63LaoWApqhQXI/edit?gid=1169728352#gid=1169728352',
  twizzygold: 'https://docs.google.com/spreadsheets/d/1FUzAZyTCgFTVxQ--qbCAS2bUk4dsAw6ASxwjURPHbyI',
  uzigold:    'https://docs.google.com/spreadsheets/d/1zqqdIds1iwnx4lh29iF1IlraeuqfGhxH9qLNlWOnryo/edit?gid=1160569231#gid=1160569231',
  dregold:    'https://docs.google.com/spreadsheets/d/10_QK8xP-WCdrfO6RaIkhdDtYUXaM966e6D1xWD__iIo/edit?gid=1520634709#gid=1520634709',
  pushagold:  'https://docs.google.com/spreadsheets/d/1bZ66RGgo5i_RorCtSTh4xX2tXwag2R-Zu3MsEGzrp1A/edit?gid=44489322#gid=44489322',
  juicegold:  'https://docs.google.com/spreadsheets/d/1tD3ytt5wPx4zfcefXi5ATeYhIiDaugWjMS46nZrP568/edit?gid=0#gid=0',
  shadygold:  'https://docs.google.com/spreadsheets/d/1x9tTOOqH5WpKOoptdQzABSN_x8oZbMgzIGlGH9w1IKA/edit?gid=1792554832#gid=1792554832',
  aapgold:    'https://docs.google.com/spreadsheets/d/1rbt_VyQyHEfVRv_XmVBNrwMyF0uMx7FF-1T8-N0wf0E/edit?gid=1701548408#gid=1701548408',
  sosagold:   'https://docs.google.com/spreadsheets/d/1oDE9gTnEG7ufPQIOMjLTegfI47qtgNCxngmxxHZL4qA/edit#gid=1792554832',
  dongold:    'https://docs.google.com/spreadsheets/d/1qsO4SuzzB17d5orqbKWHsaQsRdk0lzTSF9rV2FwQf-Q/edit?gid=1535277716#gid=1535277716',
  luckigold:  'https://docs.google.com/spreadsheets/d/1zoRNpy7Lvr-JzPqtQLLWRVVDbgKygpBaDf4cC-Lt6k4/edit#gid=306146520',
  mfgold:     'https://docs.google.com/spreadsheets/u/1/d/1zEbzMVXFXzuY4wLdPvdQA23lb3RwCSOKqWtHsllXNk8/edit?usp=drivesdk',
  mjgold:     'https://docs.google.com/spreadsheets/d/1i59TKrIZ1OvFFPJFuOMw1VXlvyzaVOH0Wb0vVJp9BTw/edit#gid=1792554832',
  slimegold:  'https://docs.google.com/spreadsheets/d/12zc2reK5y8XP6SQhv1ujQtiG9VpJy7yDWwDuE-S-wpc/edit?gid=0#gid=0',
  colegold:   'https://docs.google.com/spreadsheets/d/1hjMtB-acUEpXYkR6TWQVeVoUzSLrAVIdy1lMoM6aFFw/edit',
  fiftygold:  'https://docs.google.com/spreadsheets/d/1UBHQ067bIEDH3TapHIt3MCdwDNRe30Qv0VdBP9JLgFM/edit?gid=1520634709#gid=1520634709',
  keemgold:   'https://docs.google.com/spreadsheets/d/1_SNZQS-AAXVleukgKlraegaozkLOu8WMHbUwmPm61hc/edit',
  denzelgold: 'https://docs.google.com/spreadsheets/d/1Pyi72FNT6KWuQE3g4BmIDCV26HMfKFcE650Duyia43o/edit?gid=788157788#gid=788157788',
  lonelygold: 'https://docs.google.com/spreadsheets/d/1J16EyxHqZD4m0VZ6g6SoY_1GC21TU7P2kk9FeteSKvE/edit?gid=2018221909#gid=2018221909',
  jojigold:   'https://docs.google.com/spreadsheets/d/1FPlWbXnx94y5FODJ2qniLf0BzViNSAmj6Xdfw1ZNwQ4/edit#gid=766670282',
  teccagold:  'https://docs.google.com/spreadsheets/d/15UwihAVwPeS6eIE1FE1J6v7xiBYFkculVrzhMSIcEew/edit?gid=0#gid=0',
  macgold:    'https://docs.google.com/spreadsheets/d/17TycQCSpIm-6DyWId4ve8fVaM7Ewg3lgV1DDNRwauh0/edit?gid=1466156873#gid=1466156873',
  smokegold:  'https://docs.google.com/spreadsheets/d/1-Kd8molYeR1WpmWR81DqmSCGng3g-AVmZfgd752kh3M/edit#gid=0',
  futuregold: 'https://docs.google.com/spreadsheets/d/1OGAthACjwPcq3vHIVTAoaT8blFXjyBLtVcP0m5u80-U/edit',
  gorillazgold: 'https://docs.google.com/spreadsheets/d/1jauTeMKDULPud0hGD-gPeD-HM70HiBSedrLyOyAqUh0/edit?gid=339324838#gid=339324838',
  cudigold:   'https://docs.google.com/spreadsheets/d/1fj9HcbyLbu5NGwJzbl1lExQud3FNKv-JUU6NY4OKM9Y/edit',
  rihannagold: 'https://docs.google.com/spreadsheets/d/1HMqjw55sCPUGyI_UBc-JcO881FHzUTX08NvQY9oa61k/edit',
  jayzgold:   'https://docs.google.com/spreadsheets/d/18GwItf2M92QimNMAbUCfFsxCkiHlkf8DPJPLWHAcoxQ/edit?gid=1202580443#gid=1202580443',
  kengold:    'https://docs.google.com/spreadsheets/d/1OARID98xCqRaBr8gyQCvI3aD4jKQDGgtedyRaiP_pyo/edit?gid=1367980602#gid=1367980602',
  szagold:        'https://docs.google.com/spreadsheets/d/1mPq6ZvoQ1_kWqIH9JS8I2VbBb8WboFYyeMP2yqjtz7s/edit',
  ushergold:      'https://docs.google.com/spreadsheets/d/10b5EFPYc5Qhn3A7arsruyeVOYdU4Ab9TuQqELV9joa8/edit',
  wutanggold:     'https://docs.google.com/spreadsheets/d/1dA2h1kQffOmUUeCy6YMu8IYdGGqnhnWuabKdK7emyyU/edit?gid=1275210512#gid=1275210512',
  clipsegold:     'https://docs.google.com/spreadsheets/d/1XUtY5ris3U5R9sRBTOQdTxTNhvCbmjNAQbmLHGHTMGQ/edit?gid=1520634709#gid=1520634709',
  daxgold:        'https://docs.google.com/spreadsheets/d/1t1IuCgKrx3QjCt9CLrcu3FqA32qGAF8TeQjhCQHO4AY/edit?gid=199908479#gid=199908479',
  deathgripsgold: 'https://docs.google.com/spreadsheets/d/1Eh-9UyWUtyEpi_ELEhq5pD41ivFJHuQcvz2wFR2ml9g/edit?gid=0#gid=0',
  delasoulgold:   'https://docs.google.com/spreadsheets/d/19KA4hq1j8sVhTEt4gqWWn6Potw9N_IGGJ2bwgZeVYHI/edit?gid=1493533867#gid=1493533867',
  premiergold:    'https://docs.google.com/spreadsheets/d/1RaAzCb3IAg0FZas9dsAMqU785xw1sDYIvx3-SVFEVsY/edit?gid=306146520#gid=306146520',
  dmxgold:        'https://docs.google.com/spreadsheets/d/101y0kCIzwGoT0YmGHIchehUpO7tzAdjXSZZVRrEobOg/edit?gid=1792554832#gid=1792554832',
  dualipagold:    'https://docs.google.com/spreadsheets/d/1gi_foSEziQ48hTlq8hBqIwZCHz6hma1rYXr8qykBq6c/edit?gid=698378858#gid=698378858',
  earlgold:       'https://docs.google.com/spreadsheets/d/1EKEnvdiwSudiPJSePPzfCXIQ_W-AYeAIY6_r-a12bdM/edit?gid=793972257#gid=793972257',
  olivertreegold: 'https://docs.google.com/spreadsheets/d/1rhvQ9F8VRAj-jOyTLsvhORsVCyvcMRXJuGoDR1-z4jY/edit?gid=1170668970#gid=1170668970',
  fiviogold:      'https://docs.google.com/spreadsheets/d/1K8WDS6pL7uOPvf7j78Om5kO1k0-h-beqMZaXpMAUy74/edit?gid=0#gid=0',
  jpegmafiagold:  'https://docs.google.com/spreadsheets/d/1IhfNqEOtwczA6JH52gv2feerMqlJEbaDV4bxaIr7gkI/edit?gid=2012820373#gid=2012820373',
  migosgold:      'https://docs.google.com/spreadsheets/d/1MgVRlGs5DL7keB_I6YPEj4FYLOHb8DVJbxN5-h6yxOE/edit?gid=335484962#gid=335484962',
  nbayoungboygold: 'https://docs.google.com/spreadsheets/d/1-eJxsD-YciRGsQ6367NQ8zKdVJKEq8pirJPcwncgSwg/edit?gid=0#gid=0',
  vincegold:      'https://docs.google.com/spreadsheets/d/1_NjFkevi7tbhqAGHSfgaEsKrzRgvPePUeCLv0GG2GgU/edit?gid=306146520#gid=306146520',
  xzibitgold:     'https://docs.google.com/spreadsheets/d/1EVBoDCk8uZ5ft1wRpTsqJlHxfdYDnFVbbD5bRMR6qpw/edit?gid=1520634709#gid=1520634709',
  thundercatgold: 'https://docs.google.com/spreadsheets/d/1KN1eE89gaCsf8Lh_mnjxjfrz7HNQd7V833uxMPibZkU/edit?gid=321437127#gid=321437127',
  aaliyahgold:    'https://docs.google.com/spreadsheets/d/1QJR4Ku4Si5kLUL1P_vi9hCkkjDQvDWqafWiYc1v_Z8E/edit',
  antclemonsgold: 'https://docs.google.com/spreadsheets/d/11Ta0gixhRv9uUq-_O9nID_rjUf3oembw57f2sblMP3k/edit?gid=1295931150#gid=1295931150',
  badbunnygold:   'https://docs.google.com/spreadsheets/d/1O5RFNuOF4-K7xWCYMRQXy3Y_WkYOWu6o9zClsw8lPi4/edit?gid=1545615123#gid=1545615123',
  chancegold:     'https://docs.google.com/spreadsheets/d/1GdfybfLFKseuArE_Mz9iO4AatmAYWIKahn_vwGR-nTc/edit?gid=997745212#gid=997745212',
  gambinogold:    'https://docs.google.com/spreadsheets/d/1eyBjj7qPxIT_P93RaSPZf5hTJemGi5jMqSJF777OsdE/edit?gid=1792554832#gid=1792554832',
  chrisbrowngold: 'https://docs.google.com/spreadsheets/d/1o2M9juqyzh7EUCHm0ApKx0XSnGda6ZiM1kGrOp0EfMM/edit?gid=883120125#gid=883120125',
  coldplaygold:   'https://docs.google.com/spreadsheets/d/1i4xfiqtONMps_FL9n_2O5UmpKKio6HUCh5y6zQniyPk/edit',
  daftpunkgold:   'https://docs.google.com/spreadsheets/d/1ua9PA27-_LdSddNcU5i4PsvrzI7NMLalsOsXlDTsjuw/edit',
  dannybrowngold: 'https://docs.google.com/spreadsheets/d/1ybtg3wbiB63eHKGv8_ZFek3qQIoRbB8DUYAWObfeDZI/edit',
  doechiigold:    'https://docs.google.com/spreadsheets/d/1P2inSuDEuS_kp45qDAXJpb_hmj__Lj409bytyp4xiw8/edit',
  gibbsgold:      'https://docs.google.com/spreadsheets/d/1CCe1DI9VIp0J4MQyTsdMuOriZ9ucmCVMw6nS9j8e4N0/edit',
  gunnagold:      'https://docs.google.com/spreadsheets/d/1P_BA-CIy05lDl9j1H06awxNqvXYJcD-KeBPVdgTO7Eo/edit?gid=1630289126#gid=1630289126',
  icecubegold:    'https://docs.google.com/spreadsheets/d/1bsNrVejh4H27uafX6jpnllbAuiVqRnDUMegKdTYAFQA/edit?gid=1360798347#gid=1360798347',
  jamesblakegold: 'https://docs.google.com/spreadsheets/d/1_bPMUWLNzeMY0CtVEE3PHkuCsZL80wnA-6joAUfx7p4/edit?gid=2092886681#gid=2092886681',
  lauryngold:     'https://docs.google.com/spreadsheets/d/1mq4kMsy_ntvh-yI3i2YsriW_PgFRXeaJWg5nS1v-5mU/edit?gid=1520634709#gid=1520634709',
  nasgold:        'https://docs.google.com/spreadsheets/d/1TnALmkQdRX_spdUMLLamizAZYD3rERO_iGGzCqD-A6M/edit',
  stevelacygold:  'https://docs.google.com/spreadsheets/d/1xqnIw0wymufIjKfoaXGDC-KAVuF81S5quMCCX7lYQyc/edit?gid=944094987#gid=944094987',
  trippiegold:    'https://docs.google.com/spreadsheets/d/1hZdGFBZmukWGH4IlnH0NJvphwEct2XEMJT_moTFhTvc/edit?gid=1555572772#gid=1555572772',
  weekndgold:     'https://docs.google.com/spreadsheets/d/1luU-KL_vKt72goUpSO2F0qMvXyqaT_q8VwYNjPeLgTg/edit?gid=766670282#gid=766670282',
  westsidegold:   'https://docs.google.com/spreadsheets/d/1_dFPF4tSdIuwRUj_UXUFz5qeNVJm-9lCl3zhIGXt0wI/edit?gid=514066493#gid=514066493',
  tydollagold:    'https://docs.google.com/spreadsheets/d/11Kk3Mi8iiFmXEFV8vzcmTrnjcMkfgImABCavXhC4D48/edit?gid=2000110692#gid=2000110692',
  d4vdgold:       'https://docs.google.com/spreadsheets/d/1N6_EyCC6AM_cpFkIJivCN0kWzEwJRev7vQCmFAChnjk/edit?gid=1194098099#gid=1194098099',
};

function ShareButton({ url, accent }: { url: string; accent?: string }) {
  const [copied, setCopied] = useState(false);
  const color = accent ?? 'rgba(255,255,255,0.4)';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <button
      onClick={handleClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        padding: '7px 10px', borderRadius: 8,
        background: copied ? `${color}18` : 'rgba(255,255,255,0.04)',
        border: `1px solid ${copied ? `${color}44` : 'rgba(255,255,255,0.08)'}`,
        color: copied ? color : 'rgba(255,255,255,0.45)',
        fontSize: 11, fontWeight: 600, letterSpacing: '0.04em',
        cursor: 'pointer', transition: 'background 0.15s, color 0.15s, border-color 0.15s',
        flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => {
        if (copied) return;
        const el = e.currentTarget;
        el.style.background = `${color}18`;
        el.style.borderColor = `${color}44`;
        el.style.color = color;
      }}
      onMouseLeave={e => {
        if (copied) return;
        const el = e.currentTarget;
        el.style.background = 'rgba(255,255,255,0.04)';
        el.style.borderColor = 'rgba(255,255,255,0.08)';
        el.style.color = 'rgba(255,255,255,0.45)';
      }}
    >
      {copied ? (
        <>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Copied!
        </>
      ) : (
        <>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          Share
        </>
      )}
    </button>
  );
}

function SheetButton({ href, accent }: { href: string; accent?: string }) {
  const color = accent ?? 'rgba(255,255,255,0.4)';
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        padding: '7px 10px', borderRadius: 8,
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
        color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 600,
        letterSpacing: '0.04em', textDecoration: 'none', flex: 1,
        minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap',
        transition: 'background 0.15s, color 0.15s, border-color 0.15s',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget;
        el.style.background = `${color}18`;
        el.style.borderColor = `${color}44`;
        el.style.color = color;
      }}
      onMouseLeave={e => {
        const el = e.currentTarget;
        el.style.background = 'rgba(255,255,255,0.04)';
        el.style.borderColor = 'rgba(255,255,255,0.08)';
        el.style.color = 'rgba(255,255,255,0.45)';
      }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
      </svg>
      Spreadsheet
    </a>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const authInputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px',
  color: '#fff', fontSize: 13, outline: 'none',
};

function AuthModal({ onGoogle, onSignedIn, onClose }: {
  onGoogle: () => void;
  onSignedIn: (token: string, user: VGUser) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [loginVal, setLoginVal] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const switchTab = (t: 'login' | 'register') => { setTab(t); setError(''); };

  const submit = async () => {
    if (busy) return;
    setError('');
    if (tab === 'register' && !agreed) return setError('Please agree to the Terms of Service and Privacy Policy');
    setBusy(true);
    try {
      const res = await fetch(`${VG_API}/api/auth/${tab}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tab === 'login' ? { login: loginVal, password } : { username, email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error || (tab === 'login' ? 'Sign in failed' : 'Registration failed'));
      onSignedIn(data.token, data.user);
      onClose();
    } catch {
      setError('Network error — please try again');
    } finally {
      setBusy(false);
    }
  };

  const google = () => {
    if (!agreed) return setError('Please agree to the Terms of Service and Privacy Policy');
    onClose();
    onGoogle();
  };

  const onEnter = (e: React.KeyboardEvent) => { if (e.key === 'Enter') submit(); };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative', background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14,
          padding: '24px 24px 20px', maxWidth: 400, width: '100%',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)' }}
        >
          <X size={16} />
        </button>
        <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 700, color: '#fff' }}>
          {tab === 'login' ? 'Sign in to UNVAULTED' : 'Create your account'}
        </h2>
        <p style={{ margin: '0 0 18px', fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
          Track your vault rankings, sync favorites and playlists, and claim your profile.
        </p>

        <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          {(['login', 'register'] as const).map(t => (
            <button
              key={t}
              onClick={() => switchTab(t)}
              style={{
                padding: '0 8px 10px', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 700, marginBottom: -1,
                borderBottom: `2px solid ${tab === t ? '#C9A224' : 'transparent'}`,
                color: tab === t ? '#C9A224' : 'rgba(255,255,255,0.4)',
              }}
            >
              {t === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tab === 'login' ? (
            <input
              placeholder="Username or email"
              value={loginVal}
              onChange={e => setLoginVal(e.target.value)}
              onKeyDown={onEnter}
              autoComplete="username"
              autoFocus
              style={authInputStyle}
            />
          ) : (
            <>
              <div>
                <input
                  placeholder="Choose a username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  onKeyDown={onEnter}
                  autoComplete="username"
                  autoFocus
                  style={authInputStyle}
                />
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                  3–32 characters, letters, numbers, _ . -
                </div>
              </div>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={onEnter}
                autoComplete="email"
                style={authInputStyle}
              />
            </>
          )}
          <input
            type="password"
            placeholder={tab === 'register' ? 'Password (min. 8 characters)' : 'Password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={onEnter}
            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            style={authInputStyle}
          />

          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', margin: '2px 0' }}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              style={{ marginTop: 2, accentColor: '#C9A224', width: 15, height: 15, flexShrink: 0 }}
            />
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
              I agree to the{' '}
              <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: '#C9A224', textDecoration: 'underline' }}>Terms of Service</a>
              {' '}and{' '}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#C9A224', textDecoration: 'underline' }}>Privacy Policy</a>
            </span>
          </label>

          <button
            onClick={submit}
            disabled={busy}
            style={{
              width: '100%', padding: '11px 0', borderRadius: 10,
              background: 'rgba(201,162,36,0.15)', color: '#C9A224',
              border: '1px solid rgba(201,162,36,0.3)',
              fontSize: 14, fontWeight: 600, letterSpacing: '0.04em',
              cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {tab === 'login' ? <LogIn size={14} /> : <User size={14} />}
            {busy ? 'Please wait…' : tab === 'login' ? 'Sign In' : 'Create Account'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
          </div>

          <button
            onClick={google}
            style={{
              width: '100%', padding: '11px 0', borderRadius: 10, border: 'none',
              background: '#fff', color: '#000', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <GoogleIcon /> Continue with Google
          </button>

          {error && <p style={{ fontSize: 12, color: '#ef4444', textAlign: 'center', margin: 0 }}>{error}</p>}

          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textAlign: 'center', margin: '4px 0 0' }}>
            {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => switchTab(tab === 'login' ? 'register' : 'login')}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#C9A224', fontSize: 12, fontWeight: 600 }}
            >
              {tab === 'login' ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export function LandingPage() {
  useSpotifyCallback();
  const [showSettings, setShowSettings] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [showConsent, setShowConsent] = useState(false);
  const [socialOpen, setSocialOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('featured');
  const [globalVisits, setGlobalVisits] = useState<VisitCounts>({});
  const [userVisits] = useState<VisitCounts>(getUserVisitCounts);
  const { settings } = useSettings();
  const showPhotos = true;
  const { user, signIn, signInWithGoogle, signOut } = useVGAuth();
  const isAdmin = useIsAdmin(user);
  const { favorites, toggleFavorite } = useFavoriteArtists();
  const isFavorite = (slug: string) => favorites.includes(slug);

  const query = searchQuery.trim().toLowerCase();
  const matchesQuery = (c: ArtistConfig) => {
    if (!query) return true;
    // Hidden (easter-egg) artists never match their own name/slug — they only
    // surface when the typed query contains one of their secret passphrases.
    if (c.hidden)
      return (c.searchAliases ?? []).some(a => query.includes(a.toLowerCase()));
    return (
      c.artistLabel.toLowerCase().includes(query) ||
      c.SITE_NAME.toLowerCase().includes(query) ||
      c.slug.toLowerCase().includes(query)
    );
  };

  // Search includes hidden (easter-egg) artists so typing "d4vd" surfaces them;
  // the grid below is built from the visible-only list.
  const searchResults = query
    ? ARTIST_LIST.filter(matchesQuery).sort((a, b) => Number(isFavorite(b.slug)) - Number(isFavorite(a.slug)))
    : null;

  // Load global visit counts once, but only when a sort that needs them is
  // first selected (keeps the default view request-free).
  const [visitsLoaded, setVisitsLoaded] = useState(false);
  useEffect(() => {
    if (sortMode !== 'popular' || visitsLoaded) return;
    setVisitsLoaded(true);
    fetchGlobalVisitCounts().then(setGlobalVisits);
  }, [sortMode, visitsLoaded]);

  const gridList = ARTIST_LIST.filter(c => !c.hidden);

  const favoriteConfigs = gridList.filter(c => isFavorite(c.slug));

  // Sorted flat list for the non-featured sort modes. A stable sort keeps the
  // original (featured) order as the tiebreaker for equal keys.
  const sortedList = (() => {
    if (sortMode === 'az') {
      return [...gridList].sort((a, b) => a.artistLabel.localeCompare(b.artistLabel));
    }
    if (sortMode === 'popular') {
      return [...gridList].sort((a, b) => (globalVisits[b.slug] ?? 0) - (globalVisits[a.slug] ?? 0));
    }
    if (sortMode === 'yours') {
      return [...gridList].sort((a, b) => (userVisits[b.slug] ?? 0) - (userVisits[a.slug] ?? 0));
    }
    return gridList;
  })();

  const featured = gridList[0];
  // Pinned 2×2 next to the featured card: Carti, Tyler, A$AP Rocky, Drake
  const topRight = gridList.slice(1, 5);
  const smallArtists = gridList.slice(5);
  const allSmall = smallArtists.map(c => ({ type: 'artist' as const, config: c }));
  const INITIAL_SMALL = 4;
  const visibleSmall = showAll ? allSmall : allSmall.slice(0, INITIAL_SMALL);
  const hiddenCount = allSmall.length - INITIAL_SMALL;

  return (
    <>
    <div style={{
      minHeight: '100vh',
      background: '#050505',
      color: '#fff',
      fontFamily: "'Inter', system-ui, sans-serif",
      WebkitFontSmoothing: 'antialiased',
      padding: '16px 24px 48px',
      // iOS PWA (standalone) renders behind the status bar / Dynamic Island because of
      // viewport-fit=cover + apple-mobile-web-app-status-bar-style=black-translucent.
      // Offset the top so the header (logo, gear, game buttons) stays reachable.
      paddingTop: 'max(16px, calc(env(safe-area-inset-top) + 8px))',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      {showSettings && <LandingSettingsPanel onClose={() => setShowSettings(false)} />}
      {showConsent && <AuthModal onGoogle={signInWithGoogle} onSignedIn={signIn} onClose={() => setShowConsent(false)} />}

      <header style={{ textAlign: 'center', marginBottom: 40, width: '100%', maxWidth: 900, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <a
              href="/guess"
              title="Play Leakle"
              style={{
                background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.35)',
                borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: '#FFD700',
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700,
                textDecoration: 'none', transition: 'background 0.15s', flexShrink: 0,
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,215,0,0.18)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,215,0,0.08)'; }}
            >
              🎧 <span className="game-btn-label">Leakle</span>
            </a>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '8px', cursor: 'pointer', color: 'rgba(255,255,255,0.5)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s, color 0.15s', flexShrink: 0,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.5)'; }}
          >
            <GearIcon />
          </button>
        </div>
        <img
          src="/logo.png"
          alt="UNVAULTED"
          style={{ height: 'auto', width: 'clamp(160px, 28vw, 280px)' }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      </header>

      <main style={{ width: '100%', maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ position: 'relative', width: '100%' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search artists..."
            style={{
              width: '100%', padding: '11px 14px 11px 38px', borderRadius: 10,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff', fontSize: 14, fontFamily: 'inherit', outline: 'none',
            }}
          />
        </div>

        {!query && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
            {SORT_OPTIONS.map(opt => {
              const active = sortMode === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setSortMode(opt.id)}
                  style={{
                    padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, letterSpacing: '0.02em',
                    border: '1px solid',
                    borderColor: active ? 'rgba(255,215,0,0.5)' : 'rgba(255,255,255,0.1)',
                    background: active ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.04)',
                    color: active ? '#FFD700' : 'rgba(255,255,255,0.55)',
                    transition: 'all 0.15s',
                  }}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}

        {!query && sortMode === 'featured' && favoriteConfigs.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Favorites</span>
            <div className="grid-small">
              {favoriteConfigs.map(config => (
                <div key={config.slug} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <EditorialArtistCard config={config} showPhoto={showPhotos} variant="small" isFavorite={isFavorite(config.slug)} onToggleFavorite={toggleFavorite} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    {SHEET_URLS[config.slug] && <SheetButton href={SHEET_URLS[config.slug]} accent={config.accentColor} />}
                    <ShareButton url={`${window.location.origin}/${config.slug}`} accent={config.accentColor} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {query ? (
          <div className="grid-small">
            {searchResults!.length === 0 ? (
              <span style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '24px 0', fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>No artists found</span>
            ) : (
              searchResults!.map(config => (
                <div key={config.slug} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <EditorialArtistCard config={config} showPhoto={showPhotos} variant="small" isFavorite={isFavorite(config.slug)} onToggleFavorite={toggleFavorite} />
                  <div style={{ display: 'flex', gap: 6 }}>
                    {SHEET_URLS[config.slug] && <SheetButton href={SHEET_URLS[config.slug]} accent={config.accentColor} />}
                    <ShareButton url={`${window.location.origin}/${config.slug}`} accent={config.accentColor} />
                  </div>
                </div>
              ))
            )}
          </div>
        ) : sortMode !== 'featured' ? (
          <div className="grid-small">
            {sortedList.map(config => (
              <div key={config.slug} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <EditorialArtistCard config={config} showPhoto={showPhotos} variant="small" isFavorite={isFavorite(config.slug)} onToggleFavorite={toggleFavorite} />
                <div style={{ display: 'flex', gap: 6 }}>
                  {SHEET_URLS[config.slug] && <SheetButton href={SHEET_URLS[config.slug]} accent={config.accentColor} />}
                  <ShareButton url={`${window.location.origin}/${config.slug}`} accent={config.accentColor} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Featured on the left, 2×2 grid of pinned cards on the right */}
            <div className="grid-top">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <EditorialArtistCard config={featured} showPhoto={showPhotos} variant="featured" isFavorite={isFavorite(featured.slug)} onToggleFavorite={toggleFavorite} />
                <div style={{ display: 'flex', gap: 6 }}>
                  {SHEET_URLS[featured.slug] && <SheetButton href={SHEET_URLS[featured.slug]} accent={featured.accentColor} />}
                  <ShareButton url={`${window.location.origin}/${featured.slug}`} accent={featured.accentColor} />
                </div>
              </div>
              <div className="grid-pinned">
                {topRight.map(config => (
                  <div key={config.slug} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <EditorialArtistCard config={config} showPhoto={showPhotos} variant="medium" isFavorite={isFavorite(config.slug)} onToggleFavorite={toggleFavorite} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      {SHEET_URLS[config.slug] && <SheetButton href={SHEET_URLS[config.slug]} accent={config.accentColor} />}
                      <ShareButton url={`${window.location.origin}/${config.slug}`} accent={config.accentColor} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Row 2+: remaining artists in a 4-col grid, collapsible */}
            <div className="grid-small">
              {visibleSmall.map(item =>
                item.type === 'artist' ? (
                  <div key={item.config.slug} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <EditorialArtistCard config={item.config} showPhoto={showPhotos} variant="small" isFavorite={isFavorite(item.config.slug)} onToggleFavorite={toggleFavorite} />
                    <div style={{ display: 'flex', gap: 6 }}>
                      {SHEET_URLS[item.config.slug] && <SheetButton href={SHEET_URLS[item.config.slug]} accent={item.config.accentColor} />}
                      <ShareButton url={`${window.location.origin}/${item.config.slug}`} accent={item.config.accentColor} />
                    </div>
                  </div>
                ) : (
                  <div key={item.logoAlt} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <ExternalSmallCard
                      href={item.href}
                      label={item.label}
                      logoSrc={item.logoSrc}
                      logoAlt={item.logoAlt}
                      accent={item.accent}
                      photoSrc={showPhotos ? item.photo : undefined}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <SheetButton href={item.href} accent={item.accent} />
                      <ShareButton url={item.href} accent={item.accent} />
                    </div>
                  </div>
                )
              )}
            </div>

            {hiddenCount > 0 && (
              <button
                onClick={() => setShowAll(v => !v)}
                style={{
                  alignSelf: 'center', padding: '10px 24px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: 600,
                  letterSpacing: '0.04em', cursor: 'pointer',
                  transition: 'background 0.15s, color 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => { const b = e.currentTarget; b.style.background = 'rgba(255,255,255,0.08)'; b.style.color = '#fff'; b.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                onMouseLeave={e => { const b = e.currentTarget; b.style.background = 'rgba(255,255,255,0.04)'; b.style.color = 'rgba(255,255,255,0.5)'; b.style.borderColor = 'rgba(255,255,255,0.1)'; }}
              >
                {showAll ? 'Show less' : `Show ${hiddenCount} more trackers`}
              </button>
            )}
          </>
        )}
      </main>

      <div style={{ width: '100%', maxWidth: 900, marginTop: 8, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
        <BigLinkCard
          href="/my-tracker"
          accent="#C9A224"
          badge="Custom"
          titleMain="MY"
          titleAccent="TRACKER"
          subtitle="Link your own Google Sheet"
          watermark="MTR"
        />
        <BigLinkCard
          href="/community"
          accent="#22C55E"
          badge="New"
          titleMain="BUILD A"
          titleAccent="TRACKER"
          subtitle="Create your own & browse community trackers"
          watermark="CT"
        />
        <BigLinkCard
          href="/yeditsgold"
          accent="#FFD700"
          badge="Edits"
          titleMain="YEDITS"
          titleAccent="GOLD"
          subtitle="Browse fan edits"
          watermark="YE"
        />
        <BigLinkCard
          href="/playlists"
          accent="#F43F5E"
          badge="Music"
          titleMain="YOUR"
          titleAccent="PLAYLISTS"
          subtitle="Favorites & custom playlists from every tracker"
          watermark="PL"
        />
        <BigLinkCard
          href="/tierlist"
          accent="#FF5C8A"
          badge="Rank"
          titleMain="TIER"
          titleAccent="LIST"
          subtitle="Rank songs from any artist"
          watermark="TL"
        />
        <BigLinkCard
          href="/foryou"
          accent="#7C5CFF"
          badge="New"
          titleMain="FOR"
          titleAccent="YOU"
          subtitle="A feed picked from what you play"
          watermark="FY"
        />
        <BigLinkCard
          href="/listening"
          accent="#7C5CFF"
          badge="Stats"
          titleMain="YOUR"
          titleAccent="LISTENING"
          subtitle="See your play stats"
          watermark="ST"
        />
        <BigLinkCard
          href="/download"
          accent="#4F9DFF"
          badge="App"
          titleMain="DOWNLOAD"
          titleAccent="APP"
          subtitle="Desktop & mobile apps"
          watermark="APP"
        />
      </div>

      <div style={{ width: '100%', maxWidth: 900, marginTop: 24, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={() => setSocialOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', cursor: 'pointer' }}>
          Community
        </button>
        {socialOpen && (
          <div onClick={() => setSocialOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
            <div onClick={e => e.stopPropagation()}
              style={{ position: 'relative', background: 'rgba(18,18,20,0.97)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 24, display: 'flex', flexDirection: 'column', gap: 12, width: 280 }}>
              <button onClick={() => setSocialOpen(false)}
                style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', margin: 0 }}>Community</p>
              <a href="https://discord.gg/ZE5gHFYYGy" target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, background: 'rgba(88,101,242,0.15)', border: '1px solid rgba(88,101,242,0.25)', color: '#5865F2', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
                <SiDiscord style={{ width: 18, height: 18 }} /> Discord
              </a>
              <a href="https://www.reddit.com/r/2YZY2GOLD/" target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, background: 'rgba(255,69,0,0.15)', border: '1px solid rgba(255,69,0,0.25)', color: '#FF4500', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
                <SiReddit style={{ width: 18, height: 18 }} /> Reddit
              </a>
              <a href="https://www.tiktok.com/@vault.gold" target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
                <SiTiktok style={{ width: 18, height: 18 }} /> TikTok
              </a>
              <a href="https://x.com/unvaultedcc" target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 12, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
                <SiX style={{ width: 18, height: 18 }} /> X (Twitter)
              </a>
            </div>
          </div>
        )}
        {user ? (
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <a
              href={`/u/${encodeURIComponent(user.username)}`}
              title="View your public profile"
              style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 600, textDecoration: 'none', padding: '10px 4px' }}
            >
              {user.username}
            </a>
            {isAdmin && (
              <a
                href="/admin"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 10, background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.3)', color: '#60a5fa', fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', textDecoration: 'none' }}
              >
                <ShieldCheck size={14} /> Admin
              </a>
            )}
            <button
              onClick={signOut}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, background: 'rgba(201,162,36,0.12)', border: '1px solid rgba(201,162,36,0.3)', color: '#C9A224', fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', cursor: 'pointer' }}
            >
              Sign Out
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowConsent(true)}
            style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontSize: 13, fontWeight: 600, letterSpacing: '0.04em', cursor: 'pointer' }}
          >
            <LogIn size={14} /> Sign In
          </button>
        )}
      </div>

      <footer style={{ marginTop: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          © 2026 UNVAULTED
        </span>
      </footer>

      <style>{`
        .grid-top {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 8px;
        }
        .grid-pinned {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 8px;
        }
        .grid-small {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }
        @media (max-width: 600px) {
          .grid-top { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
          .grid-top > *:first-child { grid-column: 1 / -1; }
          .grid-top > *:last-child { grid-column: 1 / -1; }
          .grid-small { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>
    </div>
    </>
  );
}
