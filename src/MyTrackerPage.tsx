import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { pillowsStreamUrl } from './player/audioStore';

const VG_API = 'https://unvaulted.cc';
const STORAGE_KEY = 'vg_my_tracker_url';
const TOKEN_KEY = 'vg_token';

function getToken() { return localStorage.getItem(TOKEN_KEY); }

interface Song {
  name: string;
  extra: string;
  notes: string;
  availableLength: string;
  quality: string;
  trackLength: string;
  url: string;
  urls: string[];
}

interface Era {
  name: string;
  songs: Song[];
}

interface SavedTracker {
  id: number;
  url: string;
  label: string | null;
  added_at: string;
}

function getSheetExportUrl(input: string): string | null {
  const m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  if (!m) return null;
  const id = m[1];
  const gm = input.match(/[#&?]gid=(\d+)/);
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gm ? `&gid=${gm[1]}` : ''}`;
}

function parseSheetToEras(rows: Record<string, string>[]): Era[] {
  if (!rows.length) return [];
  const nameKey = Object.keys(rows[0]).find(k => k.startsWith('Name')) || 'Name';
  const eraMap: Record<string, Era> = {};
  const eraOrder: string[] = [];
  for (const row of rows) {
    const rawEra = (row['Era'] || '').trim();
    const rawName = (row[nameKey] || '').trim();
    if (!rawEra || !rawName || rawEra.includes('\n')) continue;
    if (!eraMap[rawEra]) {
      eraMap[rawEra] = { name: rawEra, songs: [] };
      eraOrder.push(rawEra);
    }
    const nl = rawName.indexOf('\n');
    const name = nl === -1 ? rawName : rawName.substring(0, nl).trim();
    const extra = nl === -1 ? '' : rawName.substring(nl).trim().replace(/^\n+/, '');
    const rawUrl = (row['Link(s)'] || '').trim();
    const links = rawUrl.split('\n').map(l => l.trim()).filter(Boolean);
    eraMap[rawEra].songs.push({
      name,
      extra,
      notes: row['Notes'] || '',
      availableLength: row['Available Length'] || '',
      quality: row['Quality'] || '',
      trackLength: row['Track Length'] || '',
      url: links[0] || '',
      urls: links,
    });
  }
  return eraOrder.map(n => eraMap[n]);
}

function relativeDate(isoStr: string): string {
  const d = new Date(isoStr.replace(' ', 'T') + 'Z');
  if (isNaN(d.getTime())) return isoStr;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)} mo ago`;
}

function sheetIdFromUrl(url: string): string {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : url;
}

function isPillowcase(url: string) { return url && url.includes('pillows.su/f/'); }
function isTempImgur(url: string) { return url && url.includes('imgur.gg/f/'); }
function isGoogleDrive(url: string) { return url && url.includes('drive.google.com'); }

function driveFileId(url: string): string | null {
  const m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

async function getStreamUrl(url: string): Promise<string | null> {
  if (isPillowcase(url)) {
    const id = url.split('/f/')[1];
    return id ? pillowsStreamUrl(id) : null;
  }
  if (isTempImgur(url)) {
    const tid = url.split('/f/')[1];
    const host = new URL(url).host;
    try {
      const r = await fetch(`https://${host}/api/file/${tid}`);
      if (!r.ok) return null;
      const data = await r.json();
      if (!data?.cdnUrl) return null;
      const t = data.type || '', name = data.name || '';
      if (t.includes('zip') || name.toLowerCase().endsWith('.zip')) return null;
      if (t.includes('image') || /\.(jpg|jpeg|png|gif|webp)$/i.test(name)) return null;
      return data.cdnUrl;
    } catch { return null; }
  }
  if (isGoogleDrive(url)) {
    const id = driveFileId(url);
    return id ? `https://drive.google.com/uc?export=download&id=${id}` : null;
  }
  if (url.includes('i.imgur.com')) {
    return url;
  }
  return null;
}

function formatTime(s: number): string {
  if (!isFinite(s) || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? '0' : ''}${sec}`;
}

// ── Sub-components ──────────────────────────────────────────────────────────

function EraGrid({ eras, onSelect }: { eras: Era[]; onSelect: (era: Era) => void }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {eras.length} era{eras.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 14 }}>
        {eras.map((era, i) => (
          <EraCard key={i} era={era} onClick={() => onSelect(era)} />
        ))}
      </div>
    </div>
  );
}

function EraCard({ era, onClick }: { era: Era; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        background: '#0f0f0f',
        border: `1px solid ${hovered ? 'rgba(201,162,36,0.35)' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 12,
        padding: '18px 16px 14px',
        cursor: 'pointer',
        transition: 'border-color 0.2s, transform 0.15s, box-shadow 0.2s',
        transform: hovered ? 'translateY(-2px)' : '',
        boxShadow: hovered ? '0 10px 32px rgba(0,0,0,0.4)' : '',
        overflow: 'hidden',
      }}
    >
      {hovered && (
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 0% 100%, rgba(201,162,36,0.15), transparent 70%)', borderRadius: 'inherit', pointerEvents: 'none' }} />
      )}
      <div style={{ position: 'relative', fontSize: 14, fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.01em', marginBottom: 6 }}>{era.name}</div>
      <div style={{ position: 'relative', fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>
        {era.songs.length} song{era.songs.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

function EraDetail({
  era,
  onBack,
  currentPlayKey,
  isPlaying,
  onPlay,
}: {
  era: Era;
  onBack: () => void;
  currentPlayKey: string | null;
  isPlaying: boolean;
  onPlay: (song: Song, eraName: string) => void;
}) {
  const [openNotes, setOpenNotes] = useState<Set<number>>(new Set());

  function toggleNotes(i: number) {
    setOpenNotes(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28 }}>
        <button
          onClick={onBack}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', flexShrink: 0 }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M10 3L5 8l5 5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em' }}>{era.name}</div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2, fontWeight: 500 }}>{era.songs.length} song{era.songs.length !== 1 ? 's' : ''}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {era.songs.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: 13 }}>No songs in this era</div>
        ) : era.songs.map((song, i) => {
          const playable = isPillowcase(song.url) || isTempImgur(song.url) || isGoogleDrive(song.url) || (song.url && song.url.includes('i.imgur.com'));
          const hasUrl = song.url && !/^n\/?a$/i.test(song.url.trim());
          const hasNotes = !!(song.notes && song.notes.trim());
          const playKey = `${era.name}||${song.name}`;
          const isActive = currentPlayKey === playKey && isPlaying;
          const notesOpen = openNotes.has(i);

          return (
            <div key={i}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 10, background: '#0f0f0f', border: '1px solid transparent', transition: 'border-color 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'transparent')}
              >
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', fontWeight: 600, width: 20, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.name}</div>
                  {song.extra && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.extra}</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {song.availableLength && (
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 4, background: 'rgba(201,162,36,0.1)', border: '1px solid rgba(201,162,36,0.2)', color: '#C9A224', whiteSpace: 'nowrap' }}>{song.availableLength}</span>
                  )}
                  {song.quality && (
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 4, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>{song.quality}</span>
                  )}
                  {hasNotes && (
                    <button
                      onClick={() => toggleNotes(i)}
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: notesOpen ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${notesOpen ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)'}`, color: notesOpen ? '#fff' : 'rgba(255,255,255,0.3)', cursor: 'pointer', flexShrink: 0 }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="1" width="10" height="10" rx="1.5" /><path d="M3 4h6M3 6.5h4" strokeLinecap="round" /></svg>
                    </button>
                  )}
                  {playable ? (
                    <button
                      onClick={() => onPlay(song, era.name)}
                      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: isActive ? '#C9A224' : 'rgba(201,162,36,0.1)', border: `1px solid ${isActive ? '#C9A224' : 'rgba(201,162,36,0.25)'}`, color: isActive ? '#000' : '#C9A224', cursor: 'pointer', flexShrink: 0, transition: 'background 0.15s, border-color 0.15s' }}
                    >
                      {isActive
                        ? <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="1" width="4" height="14" rx="1" /><rect x="10" y="1" width="4" height="14" rx="1" /></svg>
                        : <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M3 2l11 6-11 6V2z" /></svg>
                      }
                    </button>
                  ) : hasUrl ? (
                    <a href={song.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)', textDecoration: 'none', flexShrink: 0 }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 10L10 2M10 2H4M10 2v6" /></svg>
                    </a>
                  ) : (
                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, color: 'rgba(255,255,255,0.15)', flexShrink: 0 }}>
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 1l10 10M11 1L1 11" strokeLinecap="round" /></svg>
                    </span>
                  )}
                </div>
              </div>
              {hasNotes && notesOpen && (
                <div style={{ padding: '10px 14px 12px 48px', fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  {song.notes.trim()}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniPlayer({
  songName,
  eraName,
  audioRef,
  onClose,
}: {
  songName: string;
  eraName: string;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  onClose: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => setCurrent(audio.currentTime);
    const onDur = () => setDuration(audio.duration);
    const onEnded = () => { setPlaying(false); setCurrent(0); };
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('durationchange', onDur);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('durationchange', onDur);
      audio.removeEventListener('ended', onEnded);
    };
  }, [audioRef]);

  function togglePlay() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  }

  function seekClick(e: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || !audio.duration || !barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
  }

  const pct = duration ? (current / duration) * 100 : 0;

  return (
    <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, background: 'rgba(10,10,10,0.96)', borderTop: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(16px)', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
      <button onClick={togglePlay} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '50%', background: '#C9A224', border: 'none', color: '#000', cursor: 'pointer', flexShrink: 0 }}>
        {playing
          ? <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="2" width="4" height="12" rx="1" /><rect x="9" y="2" width="4" height="12" rx="1" /></svg>
          : <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M4 3.5l9 4.5-9 4.5V3.5z" /></svg>
        }
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{songName}</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{eraName}</div>
      </div>
      <div style={{ flex: 1, maxWidth: 300, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div ref={barRef} onClick={seekClick} style={{ width: '100%', height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2, cursor: 'pointer', position: 'relative' }}>
          <div style={{ height: '100%', background: '#C9A224', borderRadius: 2, width: `${pct}%` }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>
          <span>{formatTime(current)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
      <button onClick={onClose} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 6, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', flexShrink: 0 }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 1l10 10M11 1L1 11" strokeLinecap="round" /></svg>
      </button>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export function MyTrackerPage() {
  const navigate = useNavigate();
  const [urlInput, setUrlInput] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const [status, setStatus] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'error' | 'done'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [eras, setEras] = useState<Era[]>([]);
  const [selectedEra, setSelectedEra] = useState<Era | null>(null);
  const [savedTrackers, setSavedTrackers] = useState<SavedTracker[]>([]);
  const [currentPlayKey, setCurrentPlayKey] = useState<string | null>(null);
  const [playerSong, setPlayerSong] = useState<{ name: string; era: string } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!audioRef.current) audioRef.current = new Audio();
    const savedUrl = localStorage.getItem(STORAGE_KEY);
    if (savedUrl) loadSheet(savedUrl);
    else setLoadState('idle');
    if (getToken()) loadTrackerHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function showStatus(msg: string, type: 'ok' | 'err') {
    setStatus({ msg, type });
    setTimeout(() => setStatus(null), 3500);
  }

  async function loadSheet(url: string) {
    const exportUrl = getSheetExportUrl(url);
    if (!exportUrl) {
      setLoadState('error');
      setErrorMsg('Invalid Google Sheets URL. Make sure it starts with https://docs.google.com/spreadsheets/d/…');
      return;
    }
    setLoadState('loading');
    try {
      const r = await fetch(`/api/sheets-proxy?url=${encodeURIComponent(exportUrl)}`);
      if (!r.ok) throw new Error(String(r.status));
      const rows = await r.json();
      const parsed = parseSheetToEras(Array.isArray(rows) ? rows : []);
      setEras(parsed);
      setLoadState(parsed.length ? 'done' : 'error');
      if (!parsed.length) setErrorMsg('No data found. Make sure your sheet has Era and Name columns with at least one song row, and is shared publicly.');
      else saveToHistory(url);
    } catch {
      setLoadState('error');
      setErrorMsg('Failed to load sheet. Make sure it\'s shared publicly ("Anyone with link can view") and the URL is correct.');
    }
  }

  function handleLoad() {
    const url = urlInput.trim();
    if (!url) return;
    localStorage.setItem(STORAGE_KEY, url);
    setSelectedEra(null);
    loadSheet(url);
    saveToAccount(url);
  }

  function handleClear() {
    localStorage.removeItem(STORAGE_KEY);
    setUrlInput('');
    setEras([]);
    setSelectedEra(null);
    setLoadState('idle');
  }

  function saveToAccount(url: string) {
    const token = getToken();
    if (!token) return;
    fetch(`${VG_API}/api/auth/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ customTrackerUrl: url }),
    })
      .then(r => showStatus(r.ok ? 'Saved to UNVAULTED account' : 'Saved locally', r.ok ? 'ok' : 'err'))
      .catch(() => showStatus('Saved locally', 'ok'));
  }

  function loadTrackerHistory() {
    const token = getToken();
    if (!token) return;
    fetch(`${VG_API}/api/auth/trackers`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then((list: SavedTracker[]) => setSavedTrackers(list))
      .catch(() => {});
  }

  function saveToHistory(url: string) {
    const token = getToken();
    if (!token) return;
    fetch(`${VG_API}/api/auth/trackers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ url }),
    })
      .then(r => { if (r.ok) loadTrackerHistory(); })
      .catch(() => {});
  }

  function removeFromHistory(id: number) {
    const token = getToken();
    if (!token) return;
    fetch(`${VG_API}/api/auth/trackers/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(() => loadTrackerHistory())
      .catch(() => {});
  }

  async function playSong(song: Song, eraName: string) {
    const playKey = `${eraName}||${song.name}`;
    const audio = audioRef.current!;
    if (currentPlayKey === playKey && audio.src) {
      if (audio.paused) audio.play().catch(() => {});
      else audio.pause();
      return;
    }
    setCurrentPlayKey(playKey);
    setPlayerSong({ name: song.name, era: eraName });
    const streamUrl = await getStreamUrl(song.url);
    if (!streamUrl) {
      setCurrentPlayKey(null);
      setPlayerSong(null);
      window.open(song.url, '_blank');
      return;
    }
    audio.src = streamUrl;
    audio.play().catch(e => { if (e.name !== 'AbortError') console.error('Audio play failed', e); });
  }

  function closePlayer() {
    const audio = audioRef.current;
    if (audio) { audio.pause(); audio.src = ''; }
    setCurrentPlayKey(null);
    setPlayerSong(null);
  }

  const hasUrl = !!localStorage.getItem(STORAGE_KEY);

  return (
    <div style={{ minHeight: '100vh', background: '#050505', color: '#fff', fontFamily: "'Inter', system-ui, sans-serif", display: 'flex', flexDirection: 'column', paddingBottom: playerSong ? 80 : 0, paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Nav */}
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 28px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <a href="/" onClick={e => { e.preventDefault(); navigate('/'); }} style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <img src="/logo.png" alt="UNVAULTED" style={{ height: 36, width: 'auto' }} />
          <span style={{ color: 'rgba(255,255,255,0.15)', fontSize: 18, fontWeight: 300 }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#C9A224' }}>My Tracker</span>
        </a>
        <a href="/account" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: '#0f0f0f', color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', cursor: 'pointer', textDecoration: 'none' }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="5" r="3" /><path d="M2 14c0-3.314 2.686-5 6-5s6 1.686 6 5" /></svg>
          Account
        </a>
      </nav>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '40px 28px 80px', maxWidth: 960, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>

        {/* URL input section */}
        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 6 }}>
            My <span style={{ color: '#C9A224' }}>Tracker</span>
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 20, lineHeight: 1.6 }}>
            Link a public Google Sheet to build your own tracker. Your sheet needs columns:{' '}
            {['Era', 'Name', 'Notes', 'Available Length', 'Quality', 'Link(s)'].map((col, i) => (
              <span key={col}><code style={{ fontFamily: "'SF Mono', 'Fira Code', monospace", fontSize: 12, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '1px 6px', color: 'rgba(255,255,255,0.7)' }}>{col}</code>{i < 5 ? ', ' : '.'}</span>
            ))}{' '}Share the sheet publicly before linking.
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', flexWrap: 'wrap' }}>
            <input
              type="text"
              placeholder="https://docs.google.com/spreadsheets/d/..."
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleLoad(); }}
              style={{ flex: 1, minWidth: 0, background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '11px 16px', fontSize: 13, fontFamily: 'inherit', color: '#fff', outline: 'none' }}
              onFocus={e => (e.target.style.borderColor = '#C9A224')}
              onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.06)')}
            />
            <button
              onClick={handleLoad}
              disabled={loadState === 'loading'}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 18px', borderRadius: 10, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', letterSpacing: '0.05em', textTransform: 'uppercase', cursor: loadState === 'loading' ? 'default' : 'pointer', border: 'none', background: '#C9A224', color: '#000', opacity: loadState === 'loading' ? 0.4 : 1 }}
            >
              Load
            </button>
            {hasUrl && (
              <button
                onClick={() => loadSheet(localStorage.getItem(STORAGE_KEY)!)}
                title="Refresh"
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.06)', background: '#0f0f0f', color: 'rgba(255,255,255,0.45)' }}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M13.5 2.5A7 7 0 1 0 14 8" strokeLinecap="round" /><path d="M14 2.5V6h-3.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            )}
            {hasUrl && (
              <button
                onClick={handleClear}
                title="Clear"
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '11px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.06)', background: '#0f0f0f', color: 'rgba(255,255,255,0.3)' }}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3l10 10M13 3L3 13" strokeLinecap="round" /></svg>
              </button>
            )}
          </div>
          {status && (
            <div style={{ marginTop: 10, fontSize: 12, fontWeight: 500, color: status.type === 'ok' ? '#68d391' : '#fc8181' }}>{status.msg}</div>
          )}
        </div>

        {/* Saved trackers */}
        {savedTrackers.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>Saved Trackers</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {savedTrackers.map(t => {
                const sid = sheetIdFromUrl(t.url);
                const display = t.label || (sid.length > 22 ? sid.slice(0, 22) + '…' : sid);
                return (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: '#0f0f0f', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10 }}>
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#C9A224" strokeWidth="1.4" style={{ flexShrink: 0, opacity: 0.65 }}><path d="M3 1h7l3 3v11H3V1z" strokeLinejoin="round" /><path d="M10 1v3h3M5 8h6M5 11h4" strokeLinecap="round" /></svg>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: "'SF Mono', 'Fira Code', monospace", color: 'rgba(255,255,255,0.75)' }}>{display}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{relativeDate(t.added_at)}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => { setUrlInput(t.url); localStorage.setItem(STORAGE_KEY, t.url); setSelectedEra(null); loadSheet(t.url); }}
                        style={{ padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.06)', background: '#0f0f0f', color: 'rgba(255,255,255,0.45)', letterSpacing: '0.05em', textTransform: 'uppercase' }}
                      >
                        Load
                      </button>
                      <button
                        onClick={() => removeFromHistory(t.id)}
                        title="Remove"
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 6, background: 'transparent', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.2)', cursor: 'pointer', flexShrink: 0 }}
                      >
                        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 1l10 10M11 1L1 11" strokeLinecap="round" /></svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Content */}
        {loadState === 'idle' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', textAlign: 'center' }}>
            <svg style={{ width: 52, height: 52, marginBottom: 20, opacity: 0.15 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>No tracker linked</h3>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.18)', maxWidth: 360, lineHeight: 1.6 }}>Create a Google Sheet with Era and Name columns, share it publicly, then paste the URL above.</p>
          </div>
        )}
        {loadState === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 24px' }}>
            <div style={{ width: 28, height: 28, border: '2.5px solid rgba(201,162,36,0.2)', borderTopColor: '#C9A224', borderRadius: '50%', animation: 'spin 0.7s linear infinite', marginBottom: 16 }} />
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>Loading tracker…</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
        {loadState === 'error' && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px 18px', background: 'rgba(229,62,62,0.08)', border: '1px solid rgba(229,62,62,0.2)', borderRadius: 12, marginBottom: 24 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#fc8181" strokeWidth="1.5" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="8" cy="8" r="7" /><path d="M8 5v3.5M8 11v.5" strokeLinecap="round" /></svg>
            <p style={{ fontSize: 13, color: '#fc8181', lineHeight: 1.5 }}>{errorMsg}</p>
          </div>
        )}
        {loadState === 'done' && !selectedEra && (
          <EraGrid eras={eras} onSelect={setSelectedEra} />
        )}
        {loadState === 'done' && selectedEra && (
          <EraDetail
            era={selectedEra}
            onBack={() => setSelectedEra(null)}
            currentPlayKey={currentPlayKey}
            isPlaying={!audioRef.current?.paused}
            onPlay={playSong}
          />
        )}
      </div>

      {/* Mini player */}
      {playerSong && (
        <MiniPlayer
          songName={playerSong.name}
          eraName={playerSong.era}
          audioRef={audioRef}
          onClose={closePlayer}
        />
      )}
    </div>
  );
}
