import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, X, ShieldCheck, KeyRound } from 'lucide-react';
import { YeditsAdminPanel } from './components/YeditsAdminPanel';
import { YEditsView, type ClaimInfo } from './components/YEditsView';
import { PlayerBar } from './components/PlayerBar';
import { FullScreenPlayer } from './components/FullScreenPlayer';
import { PlaylistProvider } from './PlaylistContext';
import type { Song, Era } from './types';

const ACCENT = '#FFD700';

interface VGUser { id: string; username: string; email: string; }

function getVGUser(): VGUser | null {
  try { return JSON.parse(localStorage.getItem('vg_user') || 'null'); } catch { return null; }
}
function getVGToken(): string | null { return localStorage.getItem('vg_token'); }

// ─── Claim Modal ──────────────────────────────────────────────────────────────

function ClaimModal({ profileName, onClose }: { profileName: string; onClose: () => void }) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  const submit = async () => {
    const token = getVGToken();
    if (!token) { setMsg('You need to sign in first.'); setStatus('error'); return; }
    setStatus('loading');
    try {
      const res = await fetch('/api/yeditsgold-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, profileName }),
      });
      const ct = res.headers.get('content-type') ?? '';
      const data = ct.includes('application/json')
        ? await res.json() as { ok?: boolean; message?: string; error?: string }
        : { error: `Server error ${res.status}` };
      if (!res.ok) { setMsg(data.error ?? 'Something went wrong.'); setStatus('error'); }
      else { setMsg(data.message ?? 'Claim submitted!'); setStatus('success'); }
    } catch (err) {
      setMsg(`Error: ${err instanceof Error ? err.message : String(err)}`);
      setStatus('error');
    }
  };

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <div onClick={e => e.stopPropagation()} style={{ background: '#111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 28, maxWidth: 380, width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Claim Profile</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', display: 'flex' }}><X size={18} /></button>
        </div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginBottom: 20 }}>
          Claim <strong style={{ color: '#fff' }}>{profileName}</strong> to get ownership of all projects under this name. Your request will be reviewed before it's approved.
        </p>
        {msg && (
          <p style={{ fontSize: 13, marginBottom: 16, color: status === 'error' ? '#f87171' : '#4ade80' }}>{msg}</p>
        )}
        {status !== 'success' && (
          <button
            onClick={submit}
            disabled={status === 'loading'}
            style={{
              width: '100%', padding: '11px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: ACCENT, color: '#000', fontSize: 14, fontWeight: 700,
              opacity: status === 'loading' ? 0.6 : 1,
            }}
          >
            {status === 'loading' ? 'Submitting…' : 'Submit Claim'}
          </button>
        )}
        {status === 'success' && (
          <button onClick={onClose} style={{ width: '100%', padding: '11px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Close
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Redeem Key Modal ─────────────────────────────────────────────────────────

function RedeemKeyModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redeem = async () => {
    const token = getVGToken();
    if (!token || !key.trim()) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/yeditsgold-admin-keys', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ key: key.trim() }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (data.ok) { onSuccess(); }
      else { setError(data.error ?? 'Failed to redeem key'); }
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 28, width: 380, maxWidth: '90vw' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <KeyRound size={16} style={{ color: ACCENT }} />
            <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Redeem Admin Key</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', display: 'flex' }}><X size={16} /></button>
        </div>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 16 }}>Enter the one-time key you received from the site owner.</p>
        <input
          value={key}
          onChange={e => setKey(e.target.value)}
          placeholder="XXXXXX-XXXXXX-XXXXXX-XXXXXX"
          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: '#161616', border: `1px solid ${error ? '#f87171' : 'rgba(255,255,255,0.1)'}`, color: '#fff', fontSize: 14, fontFamily: 'monospace', letterSpacing: '0.05em', outline: 'none', boxSizing: 'border-box' }}
          onFocus={e => { e.currentTarget.style.borderColor = `${ACCENT}55`; }}
          onBlur={e => { e.currentTarget.style.borderColor = error ? '#f87171' : 'rgba(255,255,255,0.1)'; }}
          onKeyDown={e => { if (e.key === 'Enter') redeem(); }}
        />
        {error && <p style={{ fontSize: 12, color: '#f87171', marginTop: 8 }}>{error}</p>}
        <button
          onClick={redeem}
          disabled={loading || !key.trim()}
          style={{ marginTop: 16, width: '100%', padding: '11px 0', borderRadius: 10, border: 'none', cursor: loading || !key.trim() ? 'default' : 'pointer', background: ACCENT, color: '#000', fontSize: 14, fontWeight: 700, opacity: loading || !key.trim() ? 0.5 : 1 }}
        >
          {loading ? 'Redeeming…' : 'Redeem Key'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function YEditsGoldPage() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [currentEra, setCurrentEra] = useState<Era | null>(null);
  const [queue, setQueue] = useState<Song[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [showFullScreen, setShowFullScreen] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [claims, setClaims] = useState<Record<string, ClaimInfo>>({});
  const [claimTarget, setClaimTarget] = useState<string | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showRedeem, setShowRedeem] = useState(false);
  const [vgUser, setVgUser] = useState<VGUser | null>(getVGUser);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    const sync = () => setVgUser(getVGUser());
    window.addEventListener('storage', sync);
    window.addEventListener('vg-synced', sync);
    return () => { window.removeEventListener('storage', sync); window.removeEventListener('vg-synced', sync); };
  }, []);

  useEffect(() => {
    const token = getVGToken();
    if (!token) { setIsAdmin(false); setIsOwner(false); return; }
    fetch('/api/yeditsgold-admin-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(r => r.ok ? r.json() : { admin: false, owner: false })
      .then((d: { admin?: boolean; owner?: boolean }) => {
        setIsAdmin(!!d.admin);
        setIsOwner(!!d.owner);
      })
      .catch(() => { setIsAdmin(false); setIsOwner(false); });
  }, [vgUser]);

  const fetchClaims = useCallback(async () => {
    try {
      const res = await fetch('/api/yeditsgold-claims');
      if (res.ok) setClaims(await res.json());
    } catch {}
  }, []);

  useEffect(() => { fetchClaims(); }, [fetchClaims]);

  // Audio sync
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentSong?.url) return;
    audio.src = currentSong.url;
    audio.volume = volume;
    audio.load();
    audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
  }, [currentSong]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(audio.duration || 0);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('loadedmetadata', onMeta);
    audio.addEventListener('durationchange', onMeta);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('loadedmetadata', onMeta);
      audio.removeEventListener('durationchange', onMeta);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) { audio.play().catch(() => setIsPlaying(false)); }
    else { audio.pause(); }
  }, [isPlaying]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      const idx = queue.findIndex(s => s.url === currentSong?.url);
      if (idx !== -1 && idx < queue.length - 1) { setCurrentSong(queue[idx + 1]); }
      else { setIsPlaying(false); }
    };
    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, [queue, currentSong]);

  const handlePlaySong = useCallback((song: Song, era: Era, contextTracks: Song[]) => {
    setCurrentEra(era);
    setQueue(contextTracks);
    if (currentSong?.url === song.url) { setIsPlaying(p => !p); }
    else { setCurrentSong(song); }
  }, [currentSong]);

  const handleClose = () => {
    audioRef.current?.pause();
    setIsPlaying(false);
    setCurrentSong(null);
    setCurrentEra(null);
    setQueue([]);
    setShowFullScreen(false);
  };

  const handlePrev = () => {
    const idx = queue.findIndex(s => s.url === currentSong?.url);
    if (idx > 0) setCurrentSong(queue[idx - 1]);
  };

  const handleNext = () => {
    const idx = queue.findIndex(s => s.url === currentSong?.url);
    if (idx !== -1 && idx < queue.length - 1) setCurrentSong(queue[idx + 1]);
  };

  const handleSeek = (t: number) => {
    if (audioRef.current) audioRef.current.currentTime = t;
    setCurrentTime(t);
  };

  const handleVolume = (v: number) => {
    if (audioRef.current) audioRef.current.volume = v;
    setVolume(v);
  };

  return (
    <PlaylistProvider>
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: "'Inter', system-ui, sans-serif", WebkitFontSmoothing: 'antialiased', paddingBottom: currentSong ? 90 : 0, paddingTop: 'env(safe-area-inset-top)' }}>
      <audio ref={audioRef} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '20px 24px 0', maxWidth: 1200, margin: '0 auto' }}>
        <button
          onClick={() => navigate('/')}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}
          onMouseEnter={e => { const b = e.currentTarget; b.style.background = 'rgba(255,255,255,0.12)'; b.style.color = '#fff'; }}
          onMouseLeave={e => { const b = e.currentTarget; b.style.background = 'rgba(255,255,255,0.06)'; b.style.color = 'rgba(255,255,255,0.6)'; }}
        >
          <ArrowLeft size={15} />
        </button>

        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1 }}>
            yedits<span style={{ color: ACCENT }}>gold</span>
          </h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>Community fan-edit projects</p>
        </div>

        {isAdmin && (
          <button
            onClick={() => setShowAdmin(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: `1px solid ${ACCENT}33`, background: `${ACCENT}10`, color: ACCENT, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            <ShieldCheck size={13} /> Admin
          </button>
        )}
        {vgUser && !isAdmin && (
          <button
            onClick={() => setShowRedeem(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            <KeyRound size={13} /> Key
          </button>
        )}

        <input
          type="text"
          placeholder="Search…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ padding: '8px 14px', borderRadius: 8, width: 200, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 13, outline: 'none' }}
          onFocus={e => { e.currentTarget.style.borderColor = `${ACCENT}55`; }}
          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
        />
      </div>

      <YEditsView
        searchQuery={searchQuery}
        onPlaySong={handlePlaySong}
        currentSong={currentSong}
        isPlaying={isPlaying}
        claims={claims}
        onClaim={setClaimTarget}
        isAdmin={isAdmin}
      />

      {currentSong && (
        <PlayerBar
          currentSong={currentSong}
          era={currentEra}
          isPlaying={isPlaying}
          togglePlay={() => setIsPlaying(p => !p)}
          onFullScreen={() => setShowFullScreen(true)}
          onClose={handleClose}
          currentTime={currentTime}
          duration={duration}
          onSeek={handleSeek}
          volume={volume}
          onVolumeChange={handleVolume}
          onPrev={handlePrev}
          onNext={handleNext}
          allowDownload={false}
        />
      )}

      {showFullScreen && currentSong && (
        <FullScreenPlayer
          currentSong={currentSong}
          era={currentEra}
          isPlaying={isPlaying}
          togglePlay={() => setIsPlaying(p => !p)}
          onClose={() => setShowFullScreen(false)}
          currentTime={currentTime}
          duration={duration}
          onSeek={handleSeek}
          audioRef={audioRef as React.RefObject<HTMLAudioElement>}
          onPrev={handlePrev}
          onNext={handleNext}
          volume={volume}
          onVolumeChange={handleVolume}
          playlist={queue}
          currentSongIndex={queue.findIndex(s => s.url === currentSong.url)}
          onPlaySong={i => setCurrentSong(queue[i])}
        />
      )}

      {claimTarget && (
        <ClaimModal profileName={claimTarget} onClose={() => setClaimTarget(null)} />
      )}

      {showAdmin && (
        <YeditsAdminPanel onClose={() => setShowAdmin(false)} onRefreshClaims={fetchClaims} isOwner={isOwner} />
      )}

      {showRedeem && (
        <RedeemKeyModal onClose={() => setShowRedeem(false)} onSuccess={() => { setShowRedeem(false); window.location.reload(); }} />
      )}
    </div>
    </PlaylistProvider>
  );
}
