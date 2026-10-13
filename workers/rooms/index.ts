// UNVAULTED listening rooms — unvaulted.cc/api/rooms/*
//
// One Durable Object per room holds the shared queue, the playback clock
// (song + position + whether it's playing, stamped with server time), the
// member list and recent chat. Clients connect over WebSocket and drive their
// own <audio> from that clock (src/rooms/useRoom.ts), so everyone hears the
// same moment of the same song.
//
// This is its own Worker because Pages Functions can't host Durable Objects;
// its route takes precedence over the Pages app for /api/rooms/*.
//
//   POST /api/rooms                  { name, isPublic }  (Bearer token) → { code }
//   GET  /api/rooms                  live public rooms
//   GET  /api/rooms/:code            room summary
//   GET  /api/rooms/:code/ws         WebSocket (first message: { type: 'auth', token? })
import { DurableObject } from 'cloudflare:workers';

interface Env {
  DB: D1Database;
  ROOMS: DurableObjectNamespace<ListeningRoom>;
}

// ---- Shared types (mirrored in src/rooms/types.ts) -------------------------

export interface RoomSong {
  id: string;            // unique per queue entry
  name: string;
  url: string;           // raw tracker link; clients resolve the stream
  era?: string;
  tracker?: string;
  artist?: string;
  image?: string;
  extra?: string;
  addedBy: string;       // username
}

interface ChatMsg { id: string; user: string; avatar: string | null; text: string; at: number; system?: boolean }

interface RoomState {
  code: string;
  name: string;
  hostId: string;
  hostName: string;
  isPublic: boolean;
  openQueue: boolean;    // anyone signed in may add songs
  openControl: boolean;  // anyone signed in may play/pause/skip
  queue: RoomSong[];
  index: number;         // -1 = nothing playing
  playing: boolean;
  position: number;      // seconds into the current song at `updatedAt`
  updatedAt: number;
  createdAt: number;
  lastActive: number;
}

interface Member { uid: string | null; username: string; avatar: string | null; guest: boolean; lastChat: number }

const MAX_QUEUE = 300;
const MAX_CHAT = 100;
const IDLE_EXPIRY_MS = 6 * 3600_000;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...CORS } });

async function userFromToken(db: D1Database, token: string | null | undefined) {
  if (!token) return null;
  return db.prepare(
    `SELECT u.id, u.username, u.avatar_url FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > ?`
  ).bind(token, Date.now()).first<{ id: string; username: string; avatar_url: string | null }>()
    .catch(() => null);
}

let tableReady = false;
async function ensureRoomTable(db: D1Database) {
  if (tableReady) return;
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS listening_rooms (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      host_name TEXT NOT NULL,
      is_public INTEGER NOT NULL,
      members INTEGER NOT NULL DEFAULT 0,
      now_playing TEXT,
      now_image TEXT,
      updated_at INTEGER NOT NULL
    )`
  ).run();
  tableReady = true;
}

function clean(s: unknown, max: number): string {
  return String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

// ---- Durable Object ----------------------------------------------------------

export class ListeningRoom extends DurableObject<Env> {
  private room: RoomState | null = null;
  private chat: ChatMsg[] = [];
  private loaded = false;

  private async load() {
    if (this.loaded) return;
    this.room = (await this.ctx.storage.get<RoomState>('room')) ?? null;
    this.chat = (await this.ctx.storage.get<ChatMsg[]>('chat')) ?? [];
    this.loaded = true;
  }

  private async save() {
    if (!this.room) return;
    this.room.lastActive = Date.now();
    await this.ctx.storage.put('room', this.room);
    await this.ctx.storage.setAlarm(Date.now() + IDLE_EXPIRY_MS);
  }

  private members(): Member[] {
    return this.ctx.getWebSockets().map((ws) => ws.deserializeAttachment() as Member).filter(Boolean);
  }

  private publicMembers() {
    // One entry per signed-in user (multiple tabs collapse), guests counted.
    const seen = new Map<string, { username: string; avatar: string | null; host: boolean }>();
    let guests = 0;
    for (const m of this.members()) {
      if (m.guest) { guests++; continue; }
      seen.set(m.uid!, { username: m.username, avatar: m.avatar, host: m.uid === this.room?.hostId });
    }
    return { users: [...seen.values()], guests };
  }

  private snapshot() {
    return { ...this.room!, serverNow: Date.now(), members: this.publicMembers() };
  }

  private broadcast(msg: unknown, except?: WebSocket) {
    const data = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      try { ws.send(data); } catch { /* closing */ }
    }
  }

  private async syncListing() {
    if (!this.room) return;
    const r = this.room;
    const cur = r.queue[r.index];
    const { users, guests } = this.publicMembers();
    try {
      await ensureRoomTable(this.env.DB);
      await this.env.DB.prepare(
        `INSERT INTO listening_rooms (code, name, host_name, is_public, members, now_playing, now_image, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(code) DO UPDATE SET name = excluded.name, is_public = excluded.is_public, members = excluded.members,
           now_playing = excluded.now_playing, now_image = excluded.now_image, updated_at = excluded.updated_at`
      ).bind(r.code, r.name, r.hostName, r.isPublic ? 1 : 0, users.length + guests,
        cur ? `${cur.name}${cur.artist ? ` — ${cur.artist}` : ''}` : null, cur?.image ?? null, Date.now()).run();
    } catch { /* listing is best-effort */ }
  }

  private async pushState() {
    await this.save();
    this.broadcast({ type: 'state', room: this.snapshot() });
    this.ctx.waitUntil(this.syncListing());
  }

  private async addChat(msg: ChatMsg) {
    this.chat.push(msg);
    if (this.chat.length > MAX_CHAT) this.chat = this.chat.slice(-MAX_CHAT);
    await this.ctx.storage.put('chat', this.chat);
    this.broadcast({ type: 'chat', msg });
  }

  private system(text: string) {
    return this.addChat({ id: crypto.randomUUID(), user: '', avatar: null, text, at: Date.now(), system: true });
  }

  // Position of the current song right now.
  private livePosition(): number {
    const r = this.room!;
    return r.playing ? r.position + (Date.now() - r.updatedAt) / 1000 : r.position;
  }

  private setPlayback(index: number, playing: boolean, position = 0) {
    const r = this.room!;
    r.index = index;
    r.playing = playing && index >= 0;
    r.position = Math.max(0, position);
    r.updatedAt = Date.now();
  }

  private hostConnected(): boolean {
    return this.members().some((m) => m.uid && m.uid === this.room!.hostId);
  }

  private canControl(m: Member): boolean {
    const r = this.room!;
    if (m.guest) return false;
    return m.uid === r.hostId || r.openControl || !this.hostConnected();
  }

  private canQueue(m: Member): boolean {
    return !m.guest && (m.uid === this.room!.hostId || this.room!.openQueue);
  }

  // --- HTTP (from the Worker) ---

  async fetch(request: Request): Promise<Response> {
    await this.load();
    const url = new URL(request.url);

    if (url.pathname === '/init' && request.method === 'POST') {
      if (this.room) return json({ error: 'exists' }, 409);
      const body = await request.json() as { code: string; name: string; isPublic: boolean; hostId: string; hostName: string };
      const now = Date.now();
      this.room = {
        code: body.code, name: body.name, hostId: body.hostId, hostName: body.hostName,
        isPublic: body.isPublic, openQueue: true, openControl: false,
        queue: [], index: -1, playing: false, position: 0, updatedAt: now, createdAt: now, lastActive: now,
      };
      await this.save();
      await this.syncListing();
      return json({ ok: true });
    }

    if (!this.room) return json({ error: 'Room not found' }, 404);

    if (url.pathname === '/summary') {
      const r = this.room;
      const cur = r.queue[r.index];
      return json({
        code: r.code, name: r.name, hostName: r.hostName, isPublic: r.isPublic,
        members: this.publicMembers(), nowPlaying: cur ?? null, queueLength: r.queue.length,
      });
    }

    if (url.pathname === '/ws') {
      if (request.headers.get('Upgrade') !== 'websocket') return json({ error: 'Expected WebSocket' }, 426);
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      const guestName = `guest-${Math.random().toString(36).slice(2, 6)}`;
      server.serializeAttachment({ uid: null, username: guestName, avatar: null, guest: true, lastChat: 0 } satisfies Member);
      return new Response(null, { status: 101, webSocket: client });
    }
    return json({ error: 'Not found' }, 404);
  }

  // --- WebSocket (hibernation API) ---

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    await this.load();
    if (!this.room || typeof raw !== 'string' || raw.length > 20_000) return;
    let msg: any;
    try { msg = JSON.parse(raw); } catch { return; }
    const me = ws.deserializeAttachment() as Member;
    const r = this.room;
    const err = (message: string) => ws.send(JSON.stringify({ type: 'error', message }));

    switch (msg.type) {
      case 'auth': {
        const user = await userFromToken(this.env.DB, typeof msg.token === 'string' ? msg.token : null);
        const wasGuest = me.guest;
        const next: Member = user
          ? { uid: user.id, username: user.username, avatar: user.avatar_url, guest: false, lastChat: 0 }
          : me;
        ws.serializeAttachment(next);
        ws.send(JSON.stringify({
          type: 'hello',
          you: { username: next.username, guest: next.guest, isHost: next.uid === r.hostId },
          room: this.snapshot(),
          chat: this.chat.slice(-50),
        }));
        // Announce signed-in arrivals once per user (other tabs stay quiet).
        if (user && wasGuest && this.members().filter((m) => m.uid === user.id).length === 1) {
          await this.system(`${user.username} joined`);
        }
        this.broadcast({ type: 'presence', members: this.publicMembers() }, ws);
        this.ctx.waitUntil(this.syncListing());
        return;
      }

      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', serverNow: Date.now(), t: msg.t }));
        return;

      case 'chat': {
        if (me.guest) return err('Sign in to chat');
        const text = clean(msg.text, 300);
        if (!text) return;
        const now = Date.now();
        if (now - me.lastChat < 700) return err('Slow down a little');
        ws.serializeAttachment({ ...me, lastChat: now });
        await this.addChat({ id: crypto.randomUUID(), user: me.username, avatar: me.avatar, text, at: now });
        return;
      }

      case 'add': {
        if (!this.canQueue(me)) return err(me.guest ? 'Sign in to add songs' : 'Only the host can add songs right now');
        const songs: any[] = Array.isArray(msg.songs) ? msg.songs : [msg.song];
        let added = 0;
        for (const s of songs.slice(0, 100)) {
          if (r.queue.length >= MAX_QUEUE) break;
          const url = clean(s?.url, 1000);
          const name = clean(s?.name, 200);
          if (!name || !/^(https?:\/\/|\/)/.test(url)) continue;
          r.queue.push({
            id: crypto.randomUUID(), name, url,
            era: clean(s.era, 200) || undefined, tracker: clean(s.tracker, 40) || undefined,
            artist: clean(s.artist, 120) || undefined, extra: clean(s.extra, 300) || undefined,
            image: /^https?:\/\//.test(String(s.image ?? '')) || String(s.image ?? '').startsWith('/') ? clean(s.image, 1000) : undefined,
            addedBy: me.username,
          });
          added++;
        }
        if (!added) return err(r.queue.length >= MAX_QUEUE ? 'The queue is full' : 'Nothing playable to add');
        // Idle room (nothing queued yet, or the queue ran out) → start the first new song.
        if (r.index === -1) this.setPlayback(r.queue.length - added, true);
        await this.pushState();
        if (added > 1) await this.system(`${me.username} added ${added} songs`);
        return;
      }

      case 'remove': {
        const i = r.queue.findIndex((s) => s.id === msg.id);
        if (i === -1) return;
        if (!this.canControl(me) && r.queue[i].addedBy !== me.username) return err('You can only remove songs you added');
        r.queue.splice(i, 1);
        if (i < r.index) r.index--;
        else if (i === r.index) {
          if (r.index >= r.queue.length) this.setPlayback(-1, false);
          else this.setPlayback(r.index, r.playing);
        }
        await this.pushState();
        return;
      }

      case 'move': {
        if (!this.canControl(me)) return err('Only the host can reorder');
        const from = r.queue.findIndex((s) => s.id === msg.id);
        const to = Math.max(0, Math.min(r.queue.length - 1, Number(msg.to)));
        if (from === -1 || Number.isNaN(to) || from === to) return;
        const curId = r.queue[r.index]?.id;
        const [s] = r.queue.splice(from, 1);
        r.queue.splice(to, 0, s);
        if (curId) r.index = r.queue.findIndex((x) => x.id === curId);
        await this.pushState();
        return;
      }

      case 'play': case 'pause': case 'seek': case 'next': case 'prev': case 'jump': {
        if (!this.canControl(me)) return err('Only the host controls playback');
        if (r.index === -1 && msg.type !== 'jump') {
          if (r.queue.length && msg.type === 'play') this.setPlayback(0, true);
          else return;
        } else if (msg.type === 'play') this.setPlayback(r.index, true, this.livePosition());
        else if (msg.type === 'pause') this.setPlayback(r.index, false, this.livePosition());
        else if (msg.type === 'seek') this.setPlayback(r.index, r.playing, Number(msg.position) || 0);
        else if (msg.type === 'next') {
          if (r.index + 1 < r.queue.length) this.setPlayback(r.index + 1, true);
          else this.setPlayback(-1, false);
        } else if (msg.type === 'prev') {
          if (this.livePosition() > 5 || r.index === 0) this.setPlayback(r.index, r.playing, 0);
          else this.setPlayback(r.index - 1, true);
        } else if (msg.type === 'jump') {
          const i = r.queue.findIndex((s) => s.id === msg.id);
          if (i === -1) return;
          this.setPlayback(i, true);
        }
        await this.pushState();
        return;
      }

      case 'ended': {
        // Every client reports the end of the song; only the first report for
        // the current entry advances (anyone may, so a host on a locked phone
        // can't stall the room).
        const cur = r.queue[r.index];
        if (!cur || cur.id !== msg.id) return;
        if (this.livePosition() < 5) return; // stale report from a client that was behind
        if (r.index + 1 < r.queue.length) this.setPlayback(r.index + 1, true);
        else this.setPlayback(-1, false);
        await this.pushState();
        return;
      }

      case 'skip-broken': {
        // A client couldn't load this song's stream. Advance so the room isn't stuck.
        const cur = r.queue[r.index];
        if (!cur || cur.id !== msg.id || this.livePosition() > 15) return;
        if (r.index + 1 < r.queue.length) this.setPlayback(r.index + 1, true);
        else this.setPlayback(-1, false);
        await this.pushState();
        await this.system(`Skipped “${cur.name}” — it couldn’t be played`);
        return;
      }

      case 'settings': {
        if (me.uid !== r.hostId) return err('Only the host can change settings');
        if (typeof msg.openQueue === 'boolean') r.openQueue = msg.openQueue;
        if (typeof msg.openControl === 'boolean') r.openControl = msg.openControl;
        if (typeof msg.isPublic === 'boolean') r.isPublic = msg.isPublic;
        if (typeof msg.name === 'string' && clean(msg.name, 60)) r.name = clean(msg.name, 60);
        await this.pushState();
        return;
      }
    }
  }

  async webSocketClose(ws: WebSocket) {
    await this.load();
    const me = ws.deserializeAttachment() as Member | null;
    try { ws.close(); } catch { /* already closed */ }
    if (!this.room) return;
    this.broadcast({ type: 'presence', members: this.publicMembers() }, ws);
    if (me && !me.guest && !this.members().some((m) => m !== me && m.uid === me.uid)) {
      await this.system(`${me.username} left`);
    }
    this.ctx.waitUntil(this.syncListing());
  }

  async webSocketError(ws: WebSocket) {
    await this.webSocketClose(ws);
  }

  async alarm() {
    await this.load();
    if (!this.room) return;
    if (this.ctx.getWebSockets().length > 0 || Date.now() - this.room.lastActive < IDLE_EXPIRY_MS - 60_000) {
      await this.ctx.storage.setAlarm(Date.now() + IDLE_EXPIRY_MS);
      return;
    }
    const code = this.room.code;
    await this.ctx.storage.deleteAll();
    this.room = null;
    this.chat = [];
    try { await this.env.DB.prepare('DELETE FROM listening_rooms WHERE code = ?').bind(code).run(); } catch { /* ignore */ }
  }
}

// ---- Worker entry ------------------------------------------------------------

function newCode(): string {
  const b = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(b, (x) => CODE_ALPHABET[x % CODE_ALPHABET.length]).join('');
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const parts = url.pathname.replace(/^\/api\/rooms\/?/, '').split('/').filter(Boolean);

    if (parts.length === 0) {
      await ensureRoomTable(env.DB);
      if (request.method === 'GET') {
        const rows = await env.DB.prepare(
          `SELECT code, name, host_name AS hostName, members, now_playing AS nowPlaying, now_image AS nowImage, updated_at AS updatedAt
             FROM listening_rooms WHERE is_public = 1 AND members > 0 AND updated_at > ?
            ORDER BY members DESC, updated_at DESC LIMIT 30`
        ).bind(Date.now() - IDLE_EXPIRY_MS).all();
        return json({ rooms: rows.results });
      }
      if (request.method === 'POST') {
        const auth = request.headers.get('Authorization');
        const user = await userFromToken(env.DB, auth?.startsWith('Bearer ') ? auth.slice(7) : null);
        if (!user) return json({ error: 'Sign in to start a room' }, 401);
        const body = await request.json().catch(() => ({})) as { name?: string; isPublic?: boolean };
        const name = clean(body.name, 60) || `${user.username}'s room`;
        for (let attempt = 0; attempt < 5; attempt++) {
          const code = newCode();
          const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
          const res = await stub.fetch('https://room/init', {
            method: 'POST',
            body: JSON.stringify({ code, name, isPublic: body.isPublic !== false, hostId: user.id, hostName: user.username }),
          });
          if (res.ok) return json({ code });
        }
        return json({ error: 'Could not create a room, try again' }, 500);
      }
      return json({ error: 'Method not allowed' }, 405);
    }

    const code = parts[0].toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) return json({ error: 'Room not found' }, 404);
    const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
    if (parts[1] === 'ws') return stub.fetch(new Request('https://room/ws', request));
    if (parts.length === 1 && request.method === 'GET') return stub.fetch('https://room/summary');
    return json({ error: 'Not found' }, 404);
  },
};
