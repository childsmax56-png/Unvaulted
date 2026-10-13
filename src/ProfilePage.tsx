// Public user profile at /u/:username (data: functions/api/users/[username].ts).
//
// Shows avatar, bio, join date and recent comments to everyone; listening
// stats, playlists and linked accounts only when the owner opted in. The owner
// sees every section (with a "Only you can see this" label on hidden ones) and
// an inline editor for bio + privacy switches (PATCH /api/auth/profile).
import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Lock, MessageCircle, Headphones, ListMusic, Link2, Play, Pencil, Check, X, Share2, Calendar } from 'lucide-react';
import { SiDiscord, SiReddit, SiLastdotfm, SiSpotify } from 'react-icons/si';
import { getToken } from './comments';
import { getArtistConfig } from './artists/registry';
import { eraArtwork } from './eraArtwork';
import * as audioStore from './player/audioStore';
import type { Song, Era } from './types';

const ACCENT = '#C9A224';

interface CommentItem { id: string; tracker: string; entryLabel: string | null; entryType: string | null; body: string; createdAt: number; isReply: number }
interface PlayItem { track: string; artist: string; eraName: string; artistSlug: string; plays?: number; playedAt?: number }
interface PlaylistSongItem { songName: string; eraName: string | null; url: string | null; tracker: string | null; image: string | null; artist: string | null }
interface Profile {
  username: string;
  avatarUrl: string | null;
  isSelf: boolean;
  private: boolean;
  privateToOthers?: boolean;
  bio?: string;
  joinedAt?: number | null;
  comments?: { count: number; recent: CommentItem[] };
  listening?: { days: number; plays: number; minutes: number; topTrackers: { artistSlug: string; plays: number }[]; topSongs: PlayItem[]; recent: PlayItem[]; listeningNow: PlayItem | null; hidden: boolean } | null;
  playlists?: { hidden: boolean; items: { id: string; name: string; cover: string | null; songCount: number; songs: PlaylistSongItem[] }[] } | null;
  linked?: { hidden: boolean; items: { service: string; username: string; avatarUrl: string | null; hidden: boolean }[] } | null;
}
interface Settings { bio: string; profilePublic: boolean; showListening: boolean; showPlaylists: boolean; showLinked: boolean; services: Record<string, boolean> }

function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function timeAgo(ts: number): string {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function trackerName(slug: string): string {
  const c = getArtistConfig(slug);
  return c?.artistLabel || c?.SITE_NAME || slug;
}

function Avatar({ url, name, size }: { url: string | null; name: string; size: number }) {
  const [ok, setOk] = useState(true);
  return url && ok ? (
    <img src={url} alt={name} onError={() => setOk(false)} style={{ width: size, height: size }} className="rounded-full object-cover shrink-0 border-2 border-[#C9A224]/60" />
  ) : (
    <div style={{ width: size, height: size, fontSize: size * 0.4 }} className="rounded-full shrink-0 flex items-center justify-center font-extrabold bg-[#C9A224]/15 text-[#C9A224] border-2 border-[#C9A224]/60">
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  );
}

function Section({ icon, title, hidden, children, right }: { icon: React.ReactNode; title: string; hidden?: boolean; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[#C9A224]">{icon}</span>
        <h2 className="text-sm font-bold uppercase tracking-wider text-white/80">{title}</h2>
        {hidden && (
          <span className="ml-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-white/40 border border-white/10 rounded px-1.5 py-0.5">
            <Lock className="w-3 h-3" /> Only you can see this
          </span>
        )}
        <div className="ml-auto">{right}</div>
      </div>
      {children}
    </section>
  );
}

const SERVICE_META: Record<string, { label: string; icon: React.ReactNode; color: string; href: (u: string) => string | null }> = {
  discord: { label: 'Discord', icon: <SiDiscord />, color: '#5865F2', href: () => null },
  reddit: { label: 'Reddit', icon: <SiReddit />, color: '#FF4500', href: u => `https://www.reddit.com/user/${encodeURIComponent(u)}` },
  lastfm: { label: 'Last.fm', icon: <SiLastdotfm />, color: '#D51007', href: u => `https://www.last.fm/user/${encodeURIComponent(u)}` },
  spotify: { label: 'Spotify', icon: <SiSpotify />, color: '#1DB954', href: () => null },
};

function playlistSongToSong(entry: PlaylistSongItem): Song {
  const art = (entry.tracker ? eraArtwork(entry.tracker, entry.eraName || '') : undefined) || entry.image || undefined;
  const era: Era = { name: entry.eraName || '', image: art, data: {} };
  return { name: entry.songName, url: entry.url || '', image: art, extra: entry.eraName || undefined, realEra: era, artist: entry.artist } as unknown as Song;
}

function playPlaylist(songs: PlaylistSongItem[], start: number) {
  const list = songs.filter(s => s.url).map(playlistSongToSong);
  const startSong = songs[start];
  const idx = Math.max(0, list.findIndex(s => s.name === startSong?.songName && s.url === startSong?.url));
  if (list.length) void audioStore.playSongList(list, idx, (list[idx] as any).realEra as Era);
}

export function ProfilePage() {
  const { username = '' } = useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'notfound' | 'error'>('loading');
  const [editing, setEditing] = useState(false);
  const [openPlaylist, setOpenPlaylist] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(username)}`, { headers: authHeaders() });
      if (res.status === 404) { setStatus('notfound'); return; }
      if (!res.ok) throw new Error();
      setProfile(await res.json());
      setStatus('ok');
    } catch {
      setStatus('error');
    }
  }, [username]);

  useEffect(() => { setStatus('loading'); load(); }, [load]);
  useEffect(() => { if (profile) document.title = `${profile.username} · UNVAULTED`; }, [profile]);

  const share = async () => {
    const url = `${location.origin}/u/${encodeURIComponent(profile?.username || username)}`;
    try {
      if (navigator.share) await navigator.share({ title: `${profile?.username} on UNVAULTED`, url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    } catch { /* cancelled */ }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-3xl mx-auto px-4 pt-6 pb-32">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-white/50 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Home
        </Link>

        {status === 'loading' && <p className="text-white/40 mt-16 text-center">Loading profile…</p>}
        {status === 'notfound' && (
          <div className="mt-16 text-center">
            <p className="text-xl font-bold">No user named “{username}”</p>
            <p className="text-white/40 mt-2 text-sm">Check the spelling, or they may have changed their username.</p>
          </div>
        )}
        {status === 'error' && (
          <div className="mt-16 text-center">
            <p className="text-white/60">Couldn't load this profile.</p>
            <button onClick={load} className="mt-3 text-sm text-[#C9A224] hover:underline cursor-pointer">Try again</button>
          </div>
        )}

        {status === 'ok' && profile && (
          <>
            {/* Header */}
            <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-5">
              <Avatar url={profile.avatarUrl} name={profile.username} size={96} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-3xl font-extrabold tracking-tight break-all">{profile.username}</h1>
                  {profile.listening?.listeningNow && (
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2.5 py-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Listening now
                    </span>
                  )}
                </div>
                {!profile.private && (
                  <div className="flex items-center gap-3 mt-1.5 text-sm text-white/45 flex-wrap">
                    {profile.joinedAt && (
                      <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> Joined {new Date(profile.joinedAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
                    )}
                    <span className="flex items-center gap-1"><MessageCircle className="w-3.5 h-3.5" /> {profile.comments?.count ?? 0} comment{profile.comments?.count === 1 ? '' : 's'}</span>
                  </div>
                )}
                {profile.bio && <p className="mt-3 text-white/80 whitespace-pre-wrap break-words leading-relaxed">{profile.bio}</p>}
              </div>
              <div className="flex gap-2 sm:self-start">
                <button onClick={share} className="flex items-center gap-1.5 px-3.5 h-9 rounded-full bg-white/5 hover:bg-white/10 text-sm text-white/70 hover:text-white transition-colors cursor-pointer">
                  {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />} {copied ? 'Copied' : 'Share'}
                </button>
                {profile.isSelf && (
                  <button onClick={() => setEditing(e => !e)} className="flex items-center gap-1.5 px-3.5 h-9 rounded-full bg-[#C9A224]/15 hover:bg-[#C9A224]/25 text-sm font-semibold text-[#C9A224] transition-colors cursor-pointer">
                    <Pencil className="w-4 h-4" /> Edit profile
                  </button>
                )}
              </div>
            </div>

            {profile.isSelf && profile.privateToOthers && !editing && (
              <div className="mt-5 flex items-center gap-2 text-sm text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
                <Lock className="w-4 h-4 shrink-0" /> Your profile is private — other people only see your name and picture.
              </div>
            )}

            {profile.isSelf && editing && (
              <ProfileEditor onClose={() => setEditing(false)} onSaved={() => { setEditing(false); load(); }} />
            )}

            {profile.private ? (
              <div className="mt-10 text-center text-white/50">
                <Lock className="w-6 h-6 mx-auto mb-2 text-white/30" />
                This profile is private.
              </div>
            ) : (
              <div className="mt-8 flex flex-col gap-4">
                {profile.listening && (
                  <Section icon={<Headphones className="w-4 h-4" />} title="Listening" hidden={profile.listening.hidden && profile.isSelf}>
                    {profile.listening.plays === 0 && profile.listening.recent.length === 0 ? (
                      <p className="text-sm text-white/40">No plays yet.</p>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-3 mb-5">
                          <Stat label={`Plays · last ${profile.listening.days} days`} value={profile.listening.plays.toLocaleString()} />
                          <Stat label="Minutes listened" value={profile.listening.minutes.toLocaleString()} />
                        </div>
                        {profile.listening.topTrackers.length > 0 && (
                          <div className="mb-5">
                            <h3 className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-2">Top artists</h3>
                            <div className="flex flex-wrap gap-2">
                              {profile.listening.topTrackers.map(t => (
                                <Link key={t.artistSlug} to={`/${t.artistSlug}/`} className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-white/5 hover:bg-white/10 transition-colors">
                                  <TrackerThumb slug={t.artistSlug} />
                                  <span className="text-sm font-medium">{trackerName(t.artistSlug)}</span>
                                  <span className="text-xs text-white/40">{t.plays}</span>
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="grid sm:grid-cols-2 gap-5">
                          {profile.listening.topSongs.length > 0 && (
                            <PlayList title="Top songs" items={profile.listening.topSongs} right={i => `${i.plays} play${i.plays === 1 ? '' : 's'}`} />
                          )}
                          {profile.listening.recent.length > 0 && (
                            <PlayList title="Recently played" items={profile.listening.recent} right={i => (i.playedAt ? timeAgo(i.playedAt) : '')} />
                          )}
                        </div>
                      </>
                    )}
                  </Section>
                )}

                {profile.playlists && (
                  <Section icon={<ListMusic className="w-4 h-4" />} title="Playlists" hidden={profile.playlists.hidden && profile.isSelf}>
                    {profile.playlists.items.length === 0 ? <p className="text-sm text-white/40">No playlists yet.</p> : (
                      <div className="flex flex-col gap-2">
                        {profile.playlists.items.map(pl => {
                          const open = openPlaylist === pl.id;
                          const cover = pl.cover || pl.songs.map(s => (s.tracker ? eraArtwork(s.tracker, s.eraName || '') : undefined) || s.image).find(Boolean);
                          return (
                            <div key={pl.id} className="rounded-xl bg-white/[0.03] border border-white/5">
                              <div className="flex items-center gap-3 p-2.5 cursor-pointer hover:bg-white/5 rounded-xl" onClick={() => setOpenPlaylist(open ? null : pl.id)}>
                                <div className="w-12 h-12 rounded-lg bg-white/5 overflow-hidden shrink-0 flex items-center justify-center">
                                  {cover ? <img src={cover} alt="" className="w-full h-full object-cover" /> : <ListMusic className="w-5 h-5 text-white/30" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold truncate">{pl.name}</div>
                                  <div className="text-xs text-white/40">{pl.songCount} song{pl.songCount === 1 ? '' : 's'}</div>
                                </div>
                                {pl.songs.some(s => s.url) && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); playPlaylist(pl.songs, 0); }}
                                    className="w-9 h-9 rounded-full bg-[#C9A224] text-black flex items-center justify-center hover:scale-105 transition-transform cursor-pointer"
                                    title="Play"
                                  >
                                    <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
                                  </button>
                                )}
                              </div>
                              {open && (
                                <div className="px-2.5 pb-2.5">
                                  {pl.songs.map((s, i) => (
                                    <button
                                      key={i}
                                      disabled={!s.url}
                                      onClick={() => playPlaylist(pl.songs, i)}
                                      className="w-full flex items-center gap-3 px-2 py-1.5 rounded-md text-left hover:bg-white/5 disabled:opacity-40 disabled:cursor-default cursor-pointer"
                                    >
                                      <span className="w-6 text-xs text-white/30 font-mono">{i + 1}</span>
                                      <span className="flex-1 min-w-0">
                                        <span className="block text-sm truncate">{s.songName}</span>
                                        <span className="block text-xs text-white/40 truncate">{[s.tracker ? trackerName(s.tracker) : s.artist, s.eraName].filter(Boolean).join(' · ')}</span>
                                      </span>
                                    </button>
                                  ))}
                                  {pl.songCount > pl.songs.length && <p className="text-xs text-white/30 px-2 pt-1">+{pl.songCount - pl.songs.length} more</p>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </Section>
                )}

                {profile.linked && profile.linked.items.length > 0 && (
                  <Section icon={<Link2 className="w-4 h-4" />} title="Elsewhere" hidden={profile.linked.hidden && profile.isSelf}>
                    <div className="flex flex-wrap gap-2">
                      {profile.linked.items.map(l => {
                        const meta = SERVICE_META[l.service];
                        if (!meta) return null;
                        const href = meta.href(l.username);
                        const inner = (
                          <>
                            <span style={{ color: meta.color }} className="text-base">{meta.icon}</span>
                            <span className="text-sm font-medium">{l.username}</span>
                            <span className="text-xs text-white/35">{meta.label}</span>
                            {l.hidden && profile.isSelf && <Lock className="w-3 h-3 text-white/30" />}
                          </>
                        );
                        const cls = 'flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/5';
                        return href
                          ? <a key={l.service} href={href} target="_blank" rel="noopener noreferrer" className={`${cls} hover:bg-white/10 transition-colors`}>{inner}</a>
                          : <div key={l.service} className={cls}>{inner}</div>;
                      })}
                    </div>
                  </Section>
                )}

                <Section icon={<MessageCircle className="w-4 h-4" />} title="Recent comments">
                  {!profile.comments?.recent.length ? <p className="text-sm text-white/40">No comments yet.</p> : (
                    <div className="flex flex-col divide-y divide-white/5">
                      {profile.comments.recent.map(c => (
                        <div key={c.id} className="py-3 first:pt-0 last:pb-0">
                          <div className="flex items-center gap-2 text-xs text-white/40 mb-1 flex-wrap">
                            <Link to={`/${c.tracker}/`} className="font-semibold text-white/60 hover:text-[#C9A224]">{trackerName(c.tracker)}</Link>
                            {c.entryLabel && <><span>·</span><span className="truncate max-w-[16rem]">{c.isReply ? 'replied on ' : 'on '}<span className="text-white/60">{c.entryLabel}</span></span></>}
                            <span>·</span><span>{timeAgo(c.createdAt)}</span>
                          </div>
                          <p className="text-sm text-white/85 whitespace-pre-wrap break-words">{c.body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/[0.04] px-4 py-3">
      <div className="text-2xl font-extrabold" style={{ color: ACCENT }}>{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-white/40 mt-0.5">{label}</div>
    </div>
  );
}

function TrackerThumb({ slug }: { slug: string }) {
  const c = getArtistConfig(slug);
  const src = c?.artistPhotoUrl || c?.logoUrl;
  return src
    ? <img src={src} alt="" className="w-7 h-7 rounded-full object-cover" style={{ objectPosition: c?.photoObjectPosition || 'top center' }} />
    : <span className="w-7 h-7 rounded-full bg-white/10" />;
}

function PlayList({ title, items, right }: { title: string; items: PlayItem[]; right: (i: PlayItem) => string }) {
  return (
    <div>
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-white/40 mb-2">{title}</h3>
      <div className="flex flex-col gap-1">
        {items.map((s, i) => {
          const art = s.artistSlug ? eraArtwork(s.artistSlug, s.eraName) : undefined;
          return (
            <div key={i} className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded bg-white/5 overflow-hidden shrink-0">{art && <img src={art} alt="" className="w-full h-full object-cover" />}</div>
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{s.track}</div>
                <div className="text-xs text-white/40 truncate">{[s.artist || (s.artistSlug && trackerName(s.artistSlug)), s.eraName].filter(Boolean).join(' · ')}</div>
              </div>
              <span className="text-xs text-white/35 shrink-0">{right(s)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProfileEditor({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/auth/profile', { headers: authHeaders() })
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(setS)
      .catch(() => setError('Could not load your settings — try signing in again.'));
  }, []);

  const save = async () => {
    if (!s) return;
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(s),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Save failed');
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const linkedServices = s ? Object.keys(s.services).filter(k => SERVICE_META[k]) : [];

  return (
    <div className="mt-6 bg-white/[0.04] border border-[#C9A224]/25 rounded-2xl p-5">
      <div className="flex items-center mb-4">
        <h2 className="font-bold">Edit profile</h2>
        <button onClick={onClose} className="ml-auto p-1 text-white/40 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
      </div>
      {!s ? <p className="text-sm text-white/40">{error || 'Loading…'}</p> : (
        <>
          <label className="block text-xs font-semibold uppercase tracking-wider text-white/50 mb-1.5">Bio</label>
          <textarea
            value={s.bio}
            maxLength={300}
            rows={3}
            onChange={e => setS({ ...s, bio: e.target.value })}
            placeholder="Favourite era, most-wanted leak, anything…"
            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#C9A224]/60 resize-none"
          />
          <div className="text-right text-[11px] text-white/30">{s.bio.length}/300</div>

          <div className="mt-3 flex flex-col divide-y divide-white/5">
            <ToggleRow label="Public profile" hint="Off: others only see your name and picture." on={s.profilePublic} onChange={v => setS({ ...s, profilePublic: v })} />
            <ToggleRow label="Show listening stats" hint="Plays, top artists and songs, recently played, and “Listening now”." on={s.showListening} onChange={v => setS({ ...s, showListening: v })} disabled={!s.profilePublic} />
            <ToggleRow label="Show playlists" hint="Others can see and play your playlists." on={s.showPlaylists} onChange={v => setS({ ...s, showPlaylists: v })} disabled={!s.profilePublic} />
            <ToggleRow label="Show linked accounts" hint={linkedServices.length ? 'Choose which ones below.' : 'Link Discord, Reddit, Last.fm or Spotify on the account page.'} on={s.showLinked} onChange={v => setS({ ...s, showLinked: v })} disabled={!s.profilePublic} />
            {s.showLinked && s.profilePublic && linkedServices.map(k => (
              <ToggleRow key={k} indent label={SERVICE_META[k].label} on={s.services[k]} onChange={v => setS({ ...s, services: { ...s.services, [k]: v } })} />
            ))}
          </div>

          {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
          <div className="flex items-center gap-3 mt-4">
            <button onClick={save} disabled={saving} className="px-5 h-9 rounded-full bg-[#C9A224] text-black text-sm font-bold hover:brightness-110 disabled:opacity-60 cursor-pointer">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <a href="/account.html" className="text-sm text-white/50 hover:text-white">Change photo or linked accounts →</a>
          </div>
        </>
      )}
    </div>
  );
}

function ToggleRow({ label, hint, on, onChange, disabled, indent }: { label: string; hint?: string; on: boolean; onChange: (v: boolean) => void; disabled?: boolean; indent?: boolean }) {
  return (
    <div className={`flex items-center gap-4 py-3 ${indent ? 'pl-5' : ''} ${disabled ? 'opacity-40' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-white/40 mt-0.5">{hint}</div>}
      </div>
      <button
        role="switch"
        aria-checked={on}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!on)}
        className={`relative w-10 h-6 rounded-full transition-colors shrink-0 cursor-pointer disabled:cursor-default ${on ? 'bg-[#C9A224]' : 'bg-white/15'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}
