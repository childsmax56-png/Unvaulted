import { useState, useEffect, useCallback } from 'react';
import { LogIn, LogOut, RefreshCw, ExternalLink, User, X } from 'lucide-react';
import { SiSpotify, SiLastdotfm } from 'react-icons/si';
import { activeConfig } from '../artists/activeConfig';
import { applyLinkedServices, startSpotifyAccountLink, type LinkedServices } from '../accountServices';

const API = 'https://unvaulted.cc';
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
type VGLinked = LinkedServices;

function getToken() { return localStorage.getItem(TOKEN_KEY); }
function getUser(): VGUser | null {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
}
function setSession(token: string, user: VGUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function VaultGoldSection({ matchesSearch }: { matchesSearch: (s: string) => boolean }) {
  const [user, setUser] = useState<VGUser | null>(getUser);
  const [linked, setLinked] = useState<VGLinked | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [loginVal, setLoginVal] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const loadLinked = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    const res = await fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { if (res.status === 401) { clearSession(); setUser(null); } return; }
    const data = await res.json();
    setLinked(data.linked ?? null);
  }, []);

  useEffect(() => { if (user) loadLinked(); }, [user, loadLinked]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('vg_spotify_linked') === '1') {
      window.history.replaceState({}, '', window.location.pathname);
      loadLinked();
    }
  }, []);

  // Listen for postMessage from Google popup
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data?.vaultgold) return;
      if (e.data.vaultgold === 'signed_in' && e.data.token && e.data.user) {
        setSession(e.data.token, e.data.user);
        setUser(e.data.user);
        setShowModal(false);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // Pick up sign-in that happened in another tab (e.g. landing page)
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === USER_KEY) {
        const u = getUser();
        setUser(u);
        if (!u) setLinked(null);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const doLogin = async () => {
    setError('');
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: loginVal, password }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error || 'Sign in failed');
    setSession(data.token, data.user);
    setUser(data.user);
    setShowModal(false);
  };

  const doRegister = async () => {
    setError('');
    const res = await fetch(`${API}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error || 'Registration failed');
    setSession(data.token, data.user);
    setUser(data.user);
    setShowModal(false);
  };

  const doSignOut = async () => {
    const token = getToken();
    if (token) await fetch(`${API}/api/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    clearSession();
    setUser(null);
    setLinked(null);
  };

  const doGoogle = () => {
    window.location.href = `${API}/api/auth/google/connect?return_to=${encodeURIComponent(window.location.origin)}`;
  };

  const doLinkSpotify = startSpotifyAccountLink;

  const doSync = async () => {
    setSyncing(true);
    setSyncMsg('');
    const token = getToken();
    if (!token) { setSyncing(false); return; }

    const res = await fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) { setSyncing(false); setSyncMsg('Sync failed'); return; }
    const data = await res.json();
    const l: VGLinked = data.linked ?? {};
    setLinked(l);

    const { synced, spotifyExpired } = applyLinkedServices(l);
    if (spotifyExpired) {
      setSyncing(false);
      setSyncMsg('Spotify session expired — re-link Spotify at unvaulted.cc/account');
      setTimeout(() => setSyncMsg(''), 6000);
      return;
    }

    // Pull favorites + playlists for ALL trackers in one call
    const dataRes = await fetch(`${API}/api/sync`, {
      headers: { Authorization: `Bearer ${token}` },
    });
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
    if (synced.some(s => s !== 'data')) window.dispatchEvent(new CustomEvent('vg-synced'));
    setTimeout(() => setSyncMsg(''), 3000);
  };

  if (!matchesSearch('unvaulted account sign in spotify lastfm sync services xgold xxxtentacion cactigold travis scott tracker')) return null;

  return (
    <>
      <div className="border border-white/5 rounded-2xl p-2 bg-[#0a0a0a]">
        <div className="text-center py-8">
          <h3 className="text-xl font-bold text-white mb-1">
            VAULT<span style={{ color: 'var(--theme-color)' }}>gold</span> Account
          </h3>
          <p className="text-sm text-white/50">
            {user ? `Signed in as ${user.username}` : 'Sign in to sync Spotify & Last.fm across all trackers'}
          </p>
        </div>

        {user ? (
          <div className="space-y-2 pb-2">
            {/* Spotify status */}
            <div className="flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-xl">
              <div className="flex items-center gap-3">
                <SiSpotify className="w-5 h-5 text-[#1DB954]" />
                <div>
                  <span className="text-sm font-medium text-white/90">Spotify</span>
                  {linked?.spotify?.username && (
                    <p className="text-xs text-[#1DB954]">{linked.spotify.username}</p>
                  )}
                  {linked && !linked.spotify && (
                    <p className="text-xs text-white/40">Not linked</p>
                  )}
                </div>
              </div>
              {linked && !linked.spotify
                ? <button onClick={doLinkSpotify} className="text-xs font-medium py-1 px-3 rounded-lg bg-[#1DB954]/10 hover:bg-[#1DB954]/20 text-[#1DB954] transition-colors cursor-pointer">Link</button>
                : <div className="w-2 h-2 rounded-full bg-[#1DB954]" />
              }
            </div>

            {/* Last.fm status */}
            <div className="flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-xl">
              <div className="flex items-center gap-3">
                <SiLastdotfm className="w-5 h-5 text-[#d51007]" />
                <div>
                  <span className="text-sm font-medium text-white/90">Last.fm</span>
                  {linked?.lastfm?.username && (
                    <p className="text-xs text-[#d51007]">{linked.lastfm.username}</p>
                  )}
                  {linked && !linked.lastfm && (
                    <p className="text-xs text-white/40">Not linked — connect at unvaulted.cc/account</p>
                  )}
                </div>
              </div>
              <div className={`w-2 h-2 rounded-full ${linked?.lastfm ? 'bg-[#d51007]' : 'bg-white/20'}`} />
            </div>

            {/* Sync + actions */}
            <div className="flex items-center gap-2 p-4 bg-[#111] border border-white/5 rounded-xl">
              <button
                onClick={doSync}
                disabled={syncing}
                className="flex-1 flex items-center justify-center gap-2 text-xs font-bold py-2 px-4 rounded-lg bg-[var(--theme-color)] text-black hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing...' : 'Sync Services'}
              </button>
              <button
                onClick={() => {
                  const token = getToken();
                  const u = user;
                  const params = token && u
                    ? `?vg_token=${encodeURIComponent(token)}&vg_user=${encodeURIComponent(JSON.stringify(u))}`
                    : '';
                  window.location.href = `${API}/account${params}`;
                }}
                className="flex items-center gap-1.5 text-xs font-medium py-2 px-3 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Manage
              </button>
              <button
                onClick={doSignOut}
                className="flex items-center gap-1.5 text-xs font-medium py-2 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/60 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>

            {syncMsg && (
              <p className={`text-xs text-center pb-1 ${syncMsg.includes('failed') ? 'text-red-400' : 'text-green-400'}`}>
                {syncMsg}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2 pb-2">
            <div className="p-4 bg-[#111] border border-white/5 rounded-xl">
              <button
                onClick={() => setShowModal(true)}
                className="w-full flex items-center justify-center gap-2 text-xs font-bold py-2.5 px-4 rounded-lg bg-[var(--theme-color)] text-black hover:opacity-90 transition-opacity cursor-pointer"
              >
                <User className="w-3.5 h-3.5" />
                Sign in to UNVAULTED
              </button>
              <button
                onClick={doGoogle}
                className="w-full mt-2 flex items-center justify-center gap-2 text-xs font-bold py-2.5 px-4 rounded-lg bg-white text-black hover:opacity-90 transition-opacity cursor-pointer"
              >
                <svg width="14" height="14" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/></svg>
                Continue with Google
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Other Trackers */}
      <div className="border border-white/5 rounded-2xl p-2 bg-[#0a0a0a]">
        <div className="px-3 pt-4 pb-2 space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-white/30 mb-3">Other Trackers</p>
          <a
            href="https://xgold.pages.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 bg-[#111] border border-white/5 rounded-xl hover:bg-white/5 transition-colors"
          >
            <span className="text-sm font-semibold text-white/80">X<span style={{ color: 'var(--theme-color)' }}>gold</span></span>
            <ExternalLink className="w-3.5 h-3.5 text-white/30" />
          </a>
          <a
            href="https://cactigold.pages.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 bg-[#111] border border-green-600/50 rounded-xl hover:bg-green-600/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <img src="/CG-01.png" alt="CACTIgold" className="w-6 h-6 object-contain rounded" />
              <span className="text-sm font-semibold text-white/80">CACTI<span style={{ color: '#4ade80' }}>gold</span></span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-green-600/50" />
          </a>
          <a
            href="https://docs.google.com/spreadsheets/d/1CMwzf-YO7yoNr5d-dsAOGFfHnYfGwXSFh1glniNlrck/edit?gid=1246511510#gid=1246511510"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 bg-[#111] border border-red-500/50 rounded-xl hover:bg-red-500/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <img src="/WG-01.png" alt="WOLFgold" className="w-6 h-6 object-contain rounded" />
              <span className="text-sm font-semibold text-white/80">WOLF<span style={{ color: '#ef4444' }}>gold</span></span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-red-500/50" />
          </a>
          <a
            href="https://docs.google.com/spreadsheets/d/1tD3ytt5wPx4zfcefXi5ATeYhIiDaugWjMS46nZrP568/edit?gid=0#gid=0"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3 bg-[#111] border border-red-500/50 rounded-xl hover:bg-red-500/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <img src="/JG-01.png" alt="Juicegold" className="w-6 h-6 object-contain rounded" />
              <span className="text-sm font-semibold text-white/80">Juice<span style={{ color: '#ef4444' }}>gold</span></span>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-red-500/50" />
          </a>
        </div>
      </div>

      {/* Sign-in modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-[#111] border border-white/10 rounded-xl w-full max-w-sm p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-white">
                VAULT<span style={{ color: 'var(--theme-color)' }}>gold</span> Account
              </h3>
              <button onClick={() => setShowModal(false)} className="text-white/40 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex gap-1 mb-5 border-b border-white/10 pb-0">
              {(['login', 'register'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setError(''); }}
                  className={`pb-3 px-2 text-xs font-bold border-b-2 transition-colors cursor-pointer ${tab === t ? 'border-[var(--theme-color)] text-[var(--theme-color)]' : 'border-transparent text-white/40 hover:text-white/70'}`}
                  style={{ marginBottom: '-1px' }}
                >
                  {t === 'login' ? 'Sign In' : 'Create Account'}
                </button>
              ))}
            </div>

            {tab === 'login' ? (
              <div className="space-y-3">
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[var(--theme-color)] transition-colors"
                  placeholder="Username or email"
                  value={loginVal}
                  onChange={e => setLoginVal(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doLogin()}
                  autoComplete="username"
                />
                <input
                  type="password"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[var(--theme-color)] transition-colors"
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doLogin()}
                  autoComplete="current-password"
                />
                <button
                  onClick={doLogin}
                  className="w-full py-2.5 rounded-lg bg-[var(--theme-color)] text-black text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-2"
                >
                  <LogIn className="w-3.5 h-3.5" /> Sign In
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <input
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[var(--theme-color)] transition-colors"
                    placeholder="Choose a username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    autoComplete="username"
                  />
                  <p className="text-[11px] text-white/40 mt-1">
                    Your custom display name — 3–32 characters, letters, numbers, _ . -
                  </p>
                </div>
                <input
                  type="email"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[var(--theme-color)] transition-colors"
                  placeholder="Email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                />
                <input
                  type="password"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[var(--theme-color)] transition-colors"
                  placeholder="Password (min. 8 characters)"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <button
                  onClick={doRegister}
                  className="w-full py-2.5 rounded-lg bg-[var(--theme-color)] text-black text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer flex items-center justify-center gap-2"
                >
                  <User className="w-3.5 h-3.5" /> Create Account
                </button>
              </div>
            )}

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs text-white/30">or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>

            <button
              onClick={doGoogle}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white text-black text-xs font-bold hover:opacity-90 transition-opacity cursor-pointer"
            >
              <svg width="14" height="14" viewBox="0 0 18 18"><path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/><path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"/><path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/><path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/></svg>
              Continue with Google
            </button>

            {error && <p className="text-xs text-red-400 mt-3 text-center">{error}</p>}
          </div>
        </div>
      )}
    </>
  );
}
