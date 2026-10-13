// /rooms/:code — a listening room: shared now-playing + queue + chat.
// Sync/transport lives in src/rooms/useRoom.ts; server in workers/rooms.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Home, Play, Pause, SkipBack, SkipForward, Users, Link2, Check, Loader2, Radio, X, Search,
  ListMusic, Send, Settings2, Headphones, VolumeX, AlertTriangle,
} from 'lucide-react';
import { ARTIST_LIST, getArtistConfig } from './artists/registry';
import { Img } from './utils';
import { useAudioState, isDirectlyPlayableAudio } from './player/audioStore';
import { useGlobalPlaylists } from './GlobalPlaylistContext';
import { useRoom, type NewRoomSong, type ChatMsg } from './rooms/useRoom';
import { ROOM_ACCENT } from './RoomsPage';

function fmt(t: number): string {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ---- Add songs ---------------------------------------------------------------

interface CatalogSong extends NewRoomSong { key: string }
const catalogCache = new Map<string, Promise<CatalogSong[]>>();

function loadCatalog(slug: string): Promise<CatalogSong[]> {
  let p = catalogCache.get(slug);
  if (!p) {
    const cfg = getArtistConfig(slug);
    p = fetch(`/api/${slug}/a`)
      .then((r) => (r.ok ? r.json() : { eras: {} }))
      .then((d: { eras?: Record<string, any> }) => {
        const out: CatalogSong[] = [];
        for (const era of Object.values(d.eras ?? {})) {
          const maps = cfg?.ERA_MAPPINGS ?? {};
          const mk = Object.keys(maps).find((k) => k.toLowerCase() === String(era.name).toLowerCase());
          const eraName = mk ? maps[mk] : era.name;
          const image = cfg?.CUSTOM_IMAGES?.[eraName] || era.image || cfg?.logoUrl;
          for (const bucket of Object.values(era.data ?? {})) {
            if (!Array.isArray(bucket)) continue;
            for (const s of bucket) {
              const url = s.url || s.urls?.[0] || '';
              if (!s.name || !url || !isDirectlyPlayableAudio(url)) continue;
              out.push({
                key: `${eraName}|${s.name}|${url}`, name: s.name, url, extra: s.extra, era: eraName, tracker: slug,
                artist: cfg?.getArtistName?.(eraName) || cfg?.artistLabel, image,
              });
            }
          }
        }
        return out;
      })
      .catch(() => []);
    catalogCache.set(slug, p);
  }
  return p;
}

function AddSongs({ onAdd, onClose }: { onAdd: (songs: NewRoomSong[]) => void; onClose: () => void }) {
  const [tab, setTab] = useState<'search' | 'playlists'>('search');
  const trackers = useMemo(() => ARTIST_LIST.filter((a) => !a.hidden), []);
  const [slug, setSlug] = useState(trackers[0]?.slug ?? '');
  const [q, setQ] = useState('');
  const [songs, setSongs] = useState<CatalogSong[] | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const { playlists } = useGlobalPlaylists();

  useEffect(() => {
    if (!slug) return;
    setSongs(null);
    let live = true;
    loadCatalog(slug).then((s) => { if (live) setSongs(s); });
    return () => { live = false; };
  }, [slug]);

  const results = useMemo(() => {
    if (!songs) return [];
    const needle = q.trim().toLowerCase();
    const list = needle
      ? songs.filter((s) => s.name.toLowerCase().includes(needle) || (s.era ?? '').toLowerCase().includes(needle) || (s.extra ?? '').toLowerCase().includes(needle))
      : songs;
    return list.slice(0, 60);
  }, [songs, q]);

  const add = (s: CatalogSong) => {
    const { key: _k, ...song } = s;
    onAdd([song]);
    setAdded((p) => new Set(p).add(s.key));
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-950 flex flex-col max-h-[70vh]">
      <div className="flex items-center gap-1 p-2 border-b border-white/10">
        {(['search', 'playlists'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer ${tab === t ? 'bg-white text-black' : 'text-white/60 hover:bg-white/10'}`}>
            {t === 'search' ? 'Search a tracker' : 'My playlists'}
          </button>
        ))}
        <button onClick={onClose} className="ml-auto p-1.5 rounded-full hover:bg-white/10 text-white/50 cursor-pointer" title="Close"><X className="w-4 h-4" /></button>
      </div>
      {tab === 'search' ? (
        <>
          <div className="flex gap-2 p-2">
            <select value={slug} onChange={(e) => setSlug(e.target.value)}
              className="bg-black/50 border border-white/10 rounded-lg px-2 py-2 text-xs max-w-[45%]">
              {trackers.map((a) => <option key={a.slug} value={a.slug}>{a.artistLabel}</option>)}
            </select>
            <div className="flex-1 flex items-center gap-2 bg-black/50 border border-white/10 rounded-lg px-2">
              <Search className="w-3.5 h-3.5 text-white/40" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Song or era…" autoFocus
                className="flex-1 bg-transparent py-2 text-xs outline-none min-w-0" />
            </div>
          </div>
          <div className="overflow-y-auto px-1 pb-2">
            {songs === null ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-white/30" /></div>
            ) : results.length === 0 ? (
              <p className="text-xs text-white/40 text-center py-8">No playable songs found.</p>
            ) : results.map((s) => (
              <button key={s.key} onClick={() => add(s)} disabled={added.has(s.key)}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5 text-left cursor-pointer disabled:opacity-50">
                <Img src={s.image} w={64} alt="" className="w-8 h-8 rounded object-cover bg-white/5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold truncate">{s.name}</div>
                  <div className="text-[11px] text-white/40 truncate">{s.era}</div>
                </div>
                <span className="text-[11px] font-bold shrink-0" style={{ color: added.has(s.key) ? undefined : ROOM_ACCENT }}>
                  {added.has(s.key) ? 'Added' : '+ Add'}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <div className="overflow-y-auto p-2 flex flex-col gap-1">
          {playlists.filter((p) => p.songs.length > 0).length === 0 && <p className="text-xs text-white/40 text-center py-8">You have no playlists yet.</p>}
          {playlists.filter((p) => p.songs.length > 0).map((p) => {
            const playable = p.songs.filter((s) => s.url && isDirectlyPlayableAudio(s.url));
            return (
              <div key={p.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-white/5">
                <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center shrink-0"><ListMusic className="w-4 h-4 text-white/40" /></div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold truncate">{p.name}</div>
                  <div className="text-[11px] text-white/40">{playable.length} playable song{playable.length === 1 ? '' : 's'}</div>
                </div>
                <button disabled={!playable.length || added.has(`pl:${p.id}`)}
                  onClick={() => {
                    onAdd(playable.map((s) => ({ name: s.songName, url: s.url, era: s.eraName, tracker: s.tracker, artist: s.artist, image: s.image })));
                    setAdded((x) => new Set(x).add(`pl:${p.id}`));
                  }}
                  className="text-[11px] font-bold cursor-pointer disabled:opacity-40" style={{ color: ROOM_ACCENT }}>
                  {added.has(`pl:${p.id}`) ? 'Queued' : 'Queue all'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---- Chat --------------------------------------------------------------------

function Chat({ chat, canChat, onSend }: { chat: ChatMsg[]; canChat: boolean; onSend: (t: string) => void }) {
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }); }, [chat.length]);
  const submit = () => { const t = text.trim(); if (!t) return; onSend(t); setText(''); };
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] flex flex-col h-[420px] lg:h-full min-h-0">
      <div className="px-4 py-2.5 border-b border-white/10 text-[11px] font-bold uppercase tracking-wider text-white/40">Chat</div>
      <div className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-1.5 min-h-0">
        {chat.length === 0 && <p className="text-xs text-white/30 text-center py-6">Say hi 👋</p>}
        {chat.map((m) => m.system ? (
          <div key={m.id} className="text-[11px] text-white/35 text-center">{m.text}</div>
        ) : (
          <div key={m.id} className="flex gap-2 items-start">
            {m.avatar
              ? <img src={m.avatar} alt="" className="w-6 h-6 rounded-full object-cover shrink-0 mt-0.5" />
              : <div className="w-6 h-6 rounded-full bg-white/10 shrink-0 mt-0.5 flex items-center justify-center text-[10px] font-bold">{m.user[0]?.toUpperCase()}</div>}
            <div className="min-w-0 text-sm leading-snug break-words">
              <span className="font-semibold text-white/80 mr-1.5">{m.user}</span>
              <span className="text-white/75">{m.text}</span>
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="p-2 border-t border-white/10">
        {canChat ? (
          <div className="flex gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="Message"
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
              className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-white/30" />
            <button onClick={submit} className="px-3 rounded-lg bg-white/10 hover:bg-white/15 cursor-pointer" title="Send"><Send className="w-4 h-4" /></button>
          </div>
        ) : (
          <p className="text-xs text-white/40 text-center py-1.5"><a href="/account.html" className="underline text-white/70">Sign in</a> to chat and add songs</p>
        )}
      </div>
    </div>
  );
}

// ---- Page --------------------------------------------------------------------

export function RoomPage() {
  const navigate = useNavigate();
  const code = (useParams<{ code: string }>().code || '').toUpperCase();
  const r = useRoom(code);
  const audio = useAudioState();
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => { document.title = r.room ? `${r.room.name} · Listening Room` : 'Listening Room · unvaulted'; }, [r.room?.name]);
  // Re-render the clock for listeners who haven't started audio yet.
  useEffect(() => { const t = window.setInterval(() => tick((n) => n + 1), 1000); return () => window.clearInterval(t); }, []);

  const share = async () => {
    const url = `${location.origin}/rooms/${code}`;
    try {
      if (navigator.share) { await navigator.share({ title: r.room?.name || 'Listening room', url }); return; }
      await navigator.clipboard.writeText(url);
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    } catch { /* cancelled */ }
  };

  if (r.status === 'notfound') {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-3 px-6 text-center">
        <Radio className="w-8 h-8 text-white/20" />
        <p className="text-white/60">This room doesn’t exist or has closed.</p>
        <button onClick={() => navigate('/rooms')} className="text-sm underline text-white/70 cursor-pointer">See live rooms</button>
      </div>
    );
  }

  const room = r.room;
  const cur = r.current;
  const usingLocalClock = r.listening && audio.currentSong && audio.duration > 0;
  const pos = usingLocalClock ? audio.currentTime : r.targetPosition();
  const dur = usingLocalClock ? audio.duration : 0;
  // index -1 with a queue = everything has played (the room went idle).
  const upNext = room && room.index >= 0 ? room.queue.slice(room.index + 1) : [];
  const played = room ? (room.index >= 0 ? room.queue.slice(0, room.index) : room.queue) : [];

  return (
    <div className="min-h-screen bg-black text-white flex flex-col pb-32" style={{ ['--theme-color' as any]: ROOM_ACCENT }}>
      <div className="sticky top-0 z-20 bg-black/90 backdrop-blur border-b border-white/10">
        <div className="flex items-center gap-3 px-4 md:px-8 py-3">
          <button onClick={() => navigate('/rooms')} className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm cursor-pointer" title="All rooms">
            <Home className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="font-black tracking-tight truncate">{room?.name ?? 'Listening room'}</div>
            <div className="text-[11px] text-white/40 flex items-center gap-2">
              <span className="tracking-widest">{code}</span>
              {room && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{room.members.users.length + room.members.guests}</span>}
              {r.status !== 'open' && <span className="text-amber-300">{r.status === 'connecting' ? 'connecting…' : 'reconnecting…'}</span>}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {r.you?.isHost && (
              <button onClick={() => setShowSettings((v) => !v)} className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/60 cursor-pointer" title="Room settings">
                <Settings2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={share} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-black cursor-pointer" style={{ background: ROOM_ACCENT }}>
              {copied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />} {copied ? 'Copied' : 'Invite'}
            </button>
          </div>
        </div>
        {showSettings && room && (
          <div className="px-4 md:px-8 pb-3 flex flex-wrap gap-4 text-xs text-white/70">
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={room.openQueue} onChange={(e) => r.send({ type: 'settings', openQueue: e.target.checked })} /> Anyone can add songs</label>
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={room.openControl} onChange={(e) => r.send({ type: 'settings', openControl: e.target.checked })} /> Anyone can play / skip</label>
            <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={room.isPublic} onChange={(e) => r.send({ type: 'settings', isPublic: e.target.checked })} /> Listed publicly</label>
          </div>
        )}
      </div>

      {!room ? (
        <div className="flex justify-center py-32"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>
      ) : (
        <div className="w-full max-w-6xl mx-auto px-4 md:px-6 pt-6 grid gap-6 lg:grid-cols-[1fr_360px] lg:h-[calc(100vh-180px)]">
          <div className="flex flex-col gap-5 min-h-0 lg:overflow-y-auto lg:pr-1">
            {/* Now playing */}
            <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-end">
              <div className="w-56 h-56 sm:w-48 sm:h-48 rounded-2xl bg-white/5 overflow-hidden shrink-0 flex items-center justify-center shadow-2xl">
                {cur?.image ? <Img src={cur.image} w={400} eager alt="" className="w-full h-full object-cover" /> : <Radio className="w-12 h-12 text-white/15" />}
              </div>
              <div className="min-w-0 flex-1 w-full text-center sm:text-left">
                <div className="text-[11px] font-bold uppercase tracking-wider" style={{ color: ROOM_ACCENT }}>
                  {cur ? (room.playing ? 'Now playing' : 'Paused') : 'Nothing playing'}
                </div>
                <div className="text-2xl md:text-3xl font-black leading-tight mt-1 break-words">{cur?.name ?? 'Add a song to get started'}</div>
                {cur && <div className="text-sm text-white/50 mt-1 truncate">{[cur.artist, cur.era].filter(Boolean).join(' · ')} · added by {cur.addedBy}</div>}
                {r.broken === cur?.id && cur && (
                  <div className="text-xs text-amber-300 mt-2 flex items-center gap-1 justify-center sm:justify-start"><AlertTriangle className="w-3.5 h-3.5" /> This song couldn’t be played, so it’s being skipped</div>
                )}
              </div>
            </div>

            {cur && (
              <div className="flex flex-col gap-1">
                <input type="range" min={0} max={dur || Math.max(pos, 1)} step={0.5} value={Math.min(pos, dur || pos)} disabled={!r.canControl || !dur}
                  onChange={(e) => r.send({ type: 'seek', position: Number(e.target.value) })}
                  className="w-full accent-[var(--theme-color)] disabled:opacity-60" />
                <div className="flex justify-between text-[11px] text-white/40 tabular-nums"><span>{fmt(pos)}</span><span>{dur ? fmt(dur) : '--:--'}</span></div>
              </div>
            )}

            <div className="flex items-center justify-center sm:justify-start gap-3 flex-wrap">
              {!r.listening ? (
                <button onClick={r.startListening} className="flex items-center gap-2 px-5 py-3 rounded-full font-bold text-black cursor-pointer" style={{ background: ROOM_ACCENT }}>
                  <Headphones className="w-5 h-5" /> Start listening
                </button>
              ) : (
                <>
                  <button onClick={() => r.send({ type: 'prev' })} disabled={!r.canControl} className="p-3 rounded-full bg-white/5 hover:bg-white/10 cursor-pointer disabled:opacity-30" title="Previous"><SkipBack className="w-5 h-5" /></button>
                  {r.canControl ? (
                    <button onClick={() => r.send({ type: room.playing ? 'pause' : 'play' })} className="p-4 rounded-full text-black cursor-pointer" style={{ background: ROOM_ACCENT }} title={room.playing ? 'Pause for everyone' : 'Play for everyone'}>
                      {room.playing ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                    </button>
                  ) : (
                    <button onClick={() => r.setLocalPaused(!r.localPaused)} className="flex items-center gap-2 px-4 py-3 rounded-full bg-white/10 hover:bg-white/15 text-sm font-semibold cursor-pointer" title="Only affects you">
                      {r.localPaused ? <><Headphones className="w-4 h-4" /> Resume</> : <><VolumeX className="w-4 h-4" /> Mute for me</>}
                    </button>
                  )}
                  <button onClick={() => r.send({ type: 'next' })} disabled={!r.canControl} className="p-3 rounded-full bg-white/5 hover:bg-white/10 cursor-pointer disabled:opacity-30" title="Skip"><SkipForward className="w-5 h-5" /></button>
                </>
              )}
              {r.canQueue && (
                <button onClick={() => setAdding((v) => !v)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-white/10 hover:bg-white/15 text-sm font-semibold cursor-pointer">
                  <ListMusic className="w-4 h-4" /> Add songs
                </button>
              )}
            </div>
            {!r.canControl && r.you && !r.you.guest && r.listening && (
              <p className="text-[11px] text-white/35 text-center sm:text-left">The host controls playback. Your pause only mutes it for you.</p>
            )}

            {adding && <AddSongs onAdd={r.addSongs} onClose={() => setAdding(false)} />}

            {/* Members */}
            <div className="flex items-center gap-2 flex-wrap">
              {room.members.users.map((u) => (
                <span key={u.username} className="flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full bg-white/5 text-xs text-white/75">
                  {u.avatar ? <img src={u.avatar} alt="" className="w-5 h-5 rounded-full object-cover" /> : <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold">{u.username[0]?.toUpperCase()}</span>}
                  {u.username}{u.host && <span className="text-[10px] font-bold" style={{ color: ROOM_ACCENT }}>HOST</span>}
                </span>
              ))}
              {room.members.guests > 0 && <span className="text-xs text-white/40">+ {room.members.guests} guest{room.members.guests === 1 ? '' : 's'}</span>}
            </div>

            {/* Queue */}
            <section>
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-white/35 mb-1">Up next · {upNext.length}</h2>
              {upNext.length === 0 && <p className="text-xs text-white/30 py-3">The queue is empty.</p>}
              {upNext.map((s) => (
                <div key={s.id} className="group flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-white/5">
                  <Img src={s.image} w={64} alt="" className="w-9 h-9 rounded object-cover bg-white/5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">{s.name}</div>
                    <div className="text-[11px] text-white/40 truncate">{[s.artist, s.era].filter(Boolean).join(' · ')} · {s.addedBy}</div>
                  </div>
                  {r.canControl && (
                    <button onClick={() => r.send({ type: 'jump', id: s.id })} className="p-1.5 rounded text-white/30 hover:text-white hover:bg-white/10 cursor-pointer" title="Play now"><Play className="w-3.5 h-3.5" /></button>
                  )}
                  {(r.canControl || s.addedBy === r.you?.username) && (
                    <button onClick={() => r.send({ type: 'remove', id: s.id })} className="p-1.5 rounded text-white/30 hover:text-red-300 hover:bg-white/10 cursor-pointer" title="Remove"><X className="w-3.5 h-3.5" /></button>
                  )}
                </div>
              ))}
              {played.length > 0 && (
                <details className="pt-2">
                  <summary className="text-[11px] text-white/30 cursor-pointer select-none">{played.length} song{played.length === 1 ? '' : 's'} played</summary>
                  {played.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 px-2 py-1 rounded-lg hover:bg-white/5 opacity-60">
                      <div className="min-w-0 flex-1 text-xs truncate">{s.name}</div>
                      {r.canControl && (
                        <button onClick={() => r.send({ type: 'jump', id: s.id })} className="p-1 rounded text-white/40 hover:text-white cursor-pointer" title="Play again"><Play className="w-3 h-3" /></button>
                      )}
                    </div>
                  ))}
                </details>
              )}
            </section>
          </div>

          <Chat chat={r.chat} canChat={!!r.you && !r.you.guest} onSend={(text) => r.send({ type: 'chat', text })} />
        </div>
      )}

      {r.error && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-neutral-900 border border-white/10 text-sm text-white/85 shadow-xl">{r.error}</div>
      )}
    </div>
  );
}
