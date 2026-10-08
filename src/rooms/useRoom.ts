// Client side of listening rooms (server: workers/rooms/index.ts).
//
// useRoom(code) keeps a WebSocket to the room's Durable Object and, once the
// user has pressed "Start listening" (browsers need a gesture before audio can
// play), drives the shared global <audio> element from the room's clock:
// load the current song, seek when we drift more than ~1.5s, play/pause with
// the room. While joined, the player's next/prev/ended/play-pause are routed to
// the room through audioStore.setTransportOverride.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as audioStore from '../player/audioStore';
import { getToken } from '../comments';

export interface RoomSong {
  id: string;
  name: string;
  url: string;
  era?: string;
  tracker?: string;
  artist?: string;
  image?: string;
  extra?: string;
  addedBy: string;
}

export interface RoomMembers { users: { username: string; avatar: string | null; host: boolean }[]; guests: number }

export interface RoomSnapshot {
  code: string;
  name: string;
  hostId: string;
  hostName: string;
  isPublic: boolean;
  openQueue: boolean;
  openControl: boolean;
  queue: RoomSong[];
  index: number;
  playing: boolean;
  position: number;
  updatedAt: number;
  serverNow: number;
  members: RoomMembers;
}

export interface ChatMsg { id: string; user: string; avatar: string | null; text: string; at: number; system?: boolean }
export interface RoomYou { username: string; guest: boolean; isHost: boolean }
export type NewRoomSong = Omit<RoomSong, 'id' | 'addedBy'>;

// The rooms Worker is routed on the production zone at /api/rooms; a separate
// origin can be set for local development (VITE_ROOMS_ORIGIN=http://localhost:8791).
const ROOMS_ORIGIN: string = (import.meta as any).env?.VITE_ROOMS_ORIGIN || '';

export function roomsUrl(path: string): string {
  return `${ROOMS_ORIGIN}/api/rooms${path}`;
}

function wsUrl(code: string): string {
  const base = ROOMS_ORIGIN || window.location.origin;
  return `${base.replace(/^http/, 'ws')}/api/rooms/${code}/ws`;
}

const DRIFT_TOLERANCE_S = 1.5;
const SILENT_WAV = 'data:audio/wav;base64,UklGRmQGAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YUAGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

export function useRoom(code: string) {
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed' | 'notfound'>('connecting');
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [you, setYou] = useState<RoomYou | null>(null);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [localPaused, setLocalPaused] = useState(false);
  const [broken, setBroken] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const roomRef = useRef<RoomSnapshot | null>(null);
  const youRef = useRef<RoomYou | null>(null);
  const offsetRef = useRef(0);           // serverNow - Date.now()
  const loadedIdRef = useRef<string | null>(null);
  const loadingRef = useRef<string | null>(null);
  const localPausedRef = useRef(false);
  const listeningRef = useRef(false);

  roomRef.current = room;
  youRef.current = you;
  localPausedRef.current = localPaused;
  listeningRef.current = listening;

  const send = useCallback((msg: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  // --- Connection -------------------------------------------------------------
  useEffect(() => {
    let stopped = false;
    let retry = 0;
    let pingTimer: number | undefined;
    let retryTimer: number | undefined;

    const applyRoom = (r: RoomSnapshot) => {
      offsetRef.current = r.serverNow - Date.now();
      setRoom(r);
    };

    const connect = () => {
      setStatus('connecting');
      const ws = new WebSocket(wsUrl(code));
      wsRef.current = ws;
      ws.onopen = () => {
        retry = 0;
        ws.send(JSON.stringify({ type: 'auth', token: getToken() }));
        pingTimer = window.setInterval(() => ws.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: 'ping', t: Date.now() })), 20_000);
      };
      ws.onmessage = (ev) => {
        let msg: any;
        try { msg = JSON.parse(ev.data); } catch { return; }
        switch (msg.type) {
          case 'hello':
            setStatus('open');
            setYou(msg.you);
            setChat(msg.chat ?? []);
            applyRoom(msg.room);
            break;
          case 'state': applyRoom(msg.room); break;
          case 'presence': setRoom((r) => (r ? { ...r, members: msg.members } : r)); break;
          case 'chat': setChat((c) => [...c.slice(-199), msg.msg]); break;
          case 'pong': {
            const rtt = Date.now() - msg.t;
            offsetRef.current = msg.serverNow + rtt / 2 - Date.now();
            break;
          }
          case 'error':
            setError(msg.message);
            window.setTimeout(() => setError(null), 3500);
            break;
        }
      };
      ws.onclose = (ev) => {
        window.clearInterval(pingTimer);
        if (stopped) return;
        // The DO upgrade fails (no 101) for a room that doesn't exist.
        if (ev.code === 1006 && retry >= 2 && !roomRef.current) { setStatus('notfound'); return; }
        setStatus('closed');
        retry++;
        retryTimer = window.setTimeout(connect, Math.min(15_000, 500 * 2 ** retry));
      };
    };

    // Check the room exists before opening a socket.
    fetch(roomsUrl(`/${code}`))
      .then((r) => { if (stopped) return; if (r.status === 404) setStatus('notfound'); else connect(); })
      .catch(() => { if (!stopped) connect(); });

    return () => {
      stopped = true;
      window.clearInterval(pingTimer);
      window.clearTimeout(retryTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [code]);

  const current = room && room.index >= 0 ? room.queue[room.index] ?? null : null;

  const canControl = !!room && !!you && !you.guest
    && (you.isHost || room.openControl || !room.members.users.some((u) => u.host));
  const canQueue = !!room && !!you && !you.guest && (you.isHost || room.openQueue);

  // --- Transport override ------------------------------------------------------
  useEffect(() => {
    if (!listening) return;
    return audioStore.setTransportOverride({
      onEnded: () => {
        // Only the room's own song finishing counts (not the silent unlock clip
        // or a song that failed to load).
        const cur = roomRef.current && roomRef.current.queue[roomRef.current.index];
        const a = audioStore.getAudioEl();
        if (cur && loadedIdRef.current === cur.id && a && !a.src.startsWith('data:') && a.currentTime > 3) {
          send({ type: 'ended', id: cur.id });
        }
      },
      onNext: () => send({ type: 'next' }),
      onPrev: () => send({ type: 'prev' }),
      onPlayPause: (play) => {
        const r = roomRef.current;
        const y = youRef.current;
        const control = !!r && !!y && !y.guest && (y.isHost || r.openControl || !r.members.users.some((u) => u.host));
        if (control) send({ type: play ? 'play' : 'pause' });
        else setLocalPaused(!play); // listeners can only pause their own speakers
      },
    });
  }, [listening, send]);

  // Leaving the room page stops room playback.
  useEffect(() => () => {
    if (listeningRef.current) audioStore.getAudioEl()?.pause();
  }, []);

  // --- Sync loop -----------------------------------------------------------------
  const targetPosition = useCallback((r: RoomSnapshot) => {
    if (!r.playing) return r.position;
    return r.position + (Date.now() + offsetRef.current - r.updatedAt) / 1000;
  }, []);

  const sync = useCallback(async () => {
    const r = roomRef.current;
    if (!listeningRef.current || !r) return;
    const a = audioStore.getAudioEl();
    if (!a) return;
    const cur = r.index >= 0 ? r.queue[r.index] : null;

    if (!cur) {
      if (!a.paused) a.pause();
      loadedIdRef.current = null;
      return;
    }

    if (loadedIdRef.current !== cur.id) {
      if (loadingRef.current === cur.id) return;
      loadingRef.current = cur.id;
      setBroken(null);
      if (!audioStore.isDirectlyPlayableAudio(cur.url)) {
        setBroken(cur.id);
        send({ type: 'skip-broken', id: cur.id });
        loadingRef.current = null;
        return;
      }
      let stream = '';
      try { stream = await audioStore.resolveStreamUrl(cur.url); } catch { /* handled below */ }
      if (loadingRef.current !== cur.id) return; // superseded while resolving
      loadingRef.current = null;
      if (!stream) { setBroken(cur.id); send({ type: 'skip-broken', id: cur.id }); return; }
      const song: any = { name: cur.name, extra: cur.extra, url: cur.url, urls: [cur.url], image: cur.image, artist: cur.artist };
      const era: any = { name: cur.era || '', image: cur.image, data: {} };
      song.realEra = era;
      loadedIdRef.current = cur.id;
      audioStore.playAudioStream({
        song, era, streamUrl: stream, playlist: [song], index: 0,
        autoPlay: false, artwork: cur.image || '', artistLabel: cur.artist || r.name,
      });
      const latest = roomRef.current;
      if (latest) audioStore.setTimeToRestore(Math.max(0, targetPosition(latest)));
    }

    const shouldPlay = r.playing && !localPausedRef.current;
    if (a.readyState >= 1) {
      const target = targetPosition(r);
      const dur = isFinite(a.duration) ? a.duration : Infinity;
      if (target < dur - 0.5 && Math.abs(a.currentTime - target) > DRIFT_TOLERANCE_S) a.currentTime = target;
    }
    if (shouldPlay && a.paused) audioStore.rawPlay();
    if (!shouldPlay && !a.paused) a.pause();
  }, [send, targetPosition]);

  useEffect(() => { void sync(); }, [room, listening, localPaused, sync]);
  useEffect(() => {
    if (!listening) return;
    const t = window.setInterval(() => void sync(), 1000);
    const a = audioStore.getAudioEl();
    const onError = () => {
      const r = roomRef.current;
      const cur = r && r.queue[r.index];
      if (cur && loadedIdRef.current === cur.id) { setBroken(cur.id); send({ type: 'skip-broken', id: cur.id }); }
    };
    a?.addEventListener('error', onError);
    return () => { window.clearInterval(t); a?.removeEventListener('error', onError); };
  }, [listening, sync, send]);

  const startListening = useCallback(() => {
    // Called from a click: unlock audio playback for this page.
    // iOS only lets an <audio> element play after it has played inside a user
    // gesture, so play a 0.1s silent clip right here in the click.
    const a = audioStore.getAudioEl();
    if (a) { a.src = SILENT_WAV; a.play().catch(() => {}); }
    loadedIdRef.current = null;
    setLocalPaused(false);
    setListening(true);
  }, []);

  return {
    status, room, you, chat, error, current, canControl, canQueue,
    listening, startListening, localPaused, setLocalPaused, broken,
    send,
    addSongs: (songs: NewRoomSong[]) => send({ type: 'add', songs }),
    targetPosition: () => (roomRef.current ? targetPosition(roomRef.current) : 0),
  };
}
