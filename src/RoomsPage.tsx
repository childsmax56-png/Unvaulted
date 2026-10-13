// /rooms — listening-room lobby: start a room or join a live one.
import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Home, Radio, Users, Loader2, ArrowRight } from 'lucide-react';
import { Img } from './utils';
import { getToken, isLoggedIn } from './comments';
import { roomsUrl } from './rooms/useRoom';

export const ROOM_ACCENT = '#22C55E';

interface LiveRoom { code: string; name: string; hostName: string; members: number; nowPlaying: string | null; nowImage: string | null }

export function RoomsPage() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<LiveRoom[] | null>(null);
  const [name, setName] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    document.title = 'Listening Rooms · unvaulted';
    const load = () => fetch(roomsUrl(''))
      .then((r) => (r.ok ? r.json() : { rooms: [] }))
      .then((d) => setRooms(d.rooms ?? []))
      .catch(() => setRooms([]));
    load();
    const t = window.setInterval(load, 20_000);
    return () => window.clearInterval(t);
  }, []);

  const create = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await fetch(roomsUrl(''), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ name, isPublic }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Could not create a room');
      navigate(`/rooms/${d.code}`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const code = joinCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

  return (
    <div className="min-h-screen bg-black text-white flex flex-col pb-32">
      <div className="sticky top-0 z-20 bg-black/90 backdrop-blur border-b border-white/10">
        <div className="flex items-center gap-3 px-4 md:px-8 py-4">
          <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm cursor-pointer" title="Home">
            <Home className="w-4 h-4" /> <span className="hidden sm:inline">Home</span>
          </button>
          <span className="text-lg md:text-xl font-black tracking-tight ml-1">LISTENING<span style={{ color: ROOM_ACCENT }}>ROOMS</span></span>
        </div>
      </div>

      <div className="w-full max-w-3xl mx-auto px-4 md:px-6 pt-6 flex flex-col gap-6">
        <p className="text-sm text-white/55 max-w-xl">
          Listen to unreleased music together. Everyone in a room hears the same song at the same moment, with a shared queue and chat.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex flex-col gap-3">
            <div className="font-bold text-sm flex items-center gap-2"><Radio className="w-4 h-4" style={{ color: ROOM_ACCENT }} /> Start a room</div>
            {isLoggedIn() ? (
              <>
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Room name (optional)"
                  className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-white/30" />
                <label className="flex items-center gap-2 text-xs text-white/60 cursor-pointer">
                  <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
                  List it publicly so anyone can find it
                </label>
                <button onClick={create} disabled={busy}
                  className="px-4 py-2 rounded-lg text-sm font-bold text-black cursor-pointer disabled:opacity-50" style={{ background: ROOM_ACCENT }}>
                  {busy ? 'Starting…' : 'Start room'}
                </button>
                {err && <p className="text-xs text-red-300">{err}</p>}
              </>
            ) : (
              <p className="text-sm text-white/50"><a href="/account.html" className="underline text-white/80">Sign in</a> to start a room. Anyone can join one to listen.</p>
            )}
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex flex-col gap-3">
            <div className="font-bold text-sm flex items-center gap-2"><ArrowRight className="w-4 h-4" style={{ color: ROOM_ACCENT }} /> Join with a code</div>
            <input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} maxLength={8} placeholder="e.g. K7Q2MX"
              onKeyDown={(e) => { if (e.key === 'Enter' && code.length === 6) navigate(`/rooms/${code}`); }}
              className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm uppercase tracking-widest outline-none focus:border-white/30" />
            <button onClick={() => navigate(`/rooms/${code}`)} disabled={code.length !== 6}
              className="px-4 py-2 rounded-lg text-sm font-bold bg-white/10 hover:bg-white/15 cursor-pointer disabled:opacity-40">
              Join
            </button>
          </div>
        </div>

        <section>
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-white/35 mb-2">Live now</h2>
          {rooms === null ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-white/30" /></div>
          ) : rooms.length === 0 ? (
            <p className="text-sm text-white/40 py-6">No public rooms right now. Start one!</p>
          ) : (
            <div className="flex flex-col gap-1">
              {rooms.map((r) => (
                <Link key={r.code} to={`/rooms/${r.code}`} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5">
                  {r.nowImage
                    ? <Img src={r.nowImage} w={96} alt="" className="w-11 h-11 rounded-lg object-cover bg-white/5" />
                    : <div className="w-11 h-11 rounded-lg bg-white/5 flex items-center justify-center"><Radio className="w-5 h-5 text-white/30" /></div>}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm truncate">{r.name}</div>
                    <div className="text-xs text-white/45 truncate">{r.nowPlaying ? `♪ ${r.nowPlaying}` : `Hosted by ${r.hostName}`}</div>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-white/50"><Users className="w-3.5 h-3.5" />{r.members}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
