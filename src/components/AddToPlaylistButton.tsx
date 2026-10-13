import { useState, useRef, useEffect } from 'react';
import { Plus, Check, ListMusic } from 'lucide-react';
import { useGlobalPlaylists } from '../GlobalPlaylistContext';
import { activeConfig } from '../artists/activeConfig';
import { getArtistConfig } from '../artists/registry';
import { eraArtwork } from '../eraArtwork';
import { Song, PlaylistSong } from '../types';

interface Props {
  song: Song;
  eraName: string;
  url: string;
  isCurrentlyPlaying?: boolean;
  // Source tracker slug when rendered outside that tracker (e.g. /producers).
  // Defaults to the active tracker.
  tracker?: string;
}

export function AddToPlaylistButton({ song, eraName, url, isCurrentlyPlaying, tracker }: Props) {
  const { playlists, addToPlaylist, createPlaylist } = useGlobalPlaylists();
  const [open, setOpen] = useState(false);

  // Capture the source tracker + display artwork/artist so this song is
  // playable/renderable from the global (cross-tracker) playlist.
  const buildEntry = (): PlaylistSong => {
    const cfg = (tracker && getArtistConfig(tracker)) || activeConfig;
    const cleanSong = { ...song };
    delete (cleanSong as any).realEra;
    return {
      songName: song.name,
      eraName,
      url,
      song: cleanSong,
      tracker: cfg.slug,
      image: eraArtwork(cfg.slug, eraName) || song.image || cfg.logoUrl,
      artist: cfg.getArtistName(eraName),
    };
  };
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setNewName('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (creating && inputRef.current) inputRef.current.focus();
  }, [creating]);

  const handleAdd = (e: React.MouseEvent, playlistId: string) => {
    e.stopPropagation();
    addToPlaylist(playlistId, buildEntry());
    setOpen(false);
  };

  const handleCreate = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (!newName.trim()) return;
    const id = createPlaylist(newName.trim());
    addToPlaylist(id, buildEntry());
    setNewName('');
    setCreating(false);
    setOpen(false);
  };

  // The Favorites list is read-only (managed by the heart button) — exclude it
  // from the "add to playlist" menu.
  const targetPlaylists = playlists.filter(p => !p.readonly);
  const isInAnyPlaylist = targetPlaylists.some(p => p.songs.some(s => s.songName === song.name && s.url === url));

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className={`p-1 rounded transition-all cursor-pointer ${
          isInAnyPlaylist
            ? 'text-[var(--theme-color)]/70 hover:text-[var(--theme-color)] hover:bg-[var(--theme-color)]/20'
            : isCurrentlyPlaying
              ? 'text-[var(--theme-color)]/30 hover:text-[var(--theme-color)] hover:bg-[var(--theme-color)]/20'
              : 'text-white/20 hover:text-white hover:bg-white/10'
        }`}
        title="Add to Playlist"
      >
        <ListMusic className="w-3.5 h-3.5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpen(false); setCreating(false); setNewName(''); }} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl min-w-[200px] overflow-hidden">
            {targetPlaylists.length === 0 && !creating && (
              <div className="px-4 py-2 text-xs text-white/40">No playlists yet</div>
            )}
            {targetPlaylists.map(p => {
              const inPlaylist = p.songs.some(s => s.songName === song.name && s.url === url);
              return (
                <button
                  key={p.id}
                  onClick={(e) => handleAdd(e, p.id)}
                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left text-white/80 hover:bg-white/5 transition-colors"
                >
                  <Check className={`w-3.5 h-3.5 shrink-0 ${inPlaylist ? 'text-[var(--theme-color)]' : 'opacity-0'}`} />
                  <span className="truncate">{p.name}</span>
                </button>
              );
            })}
            {creating ? (
              <div className="p-2 border-t border-white/10" onClick={e => e.stopPropagation()}>
                <input
                  ref={inputRef}
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleCreate(e);
                    if (e.key === 'Escape') { setCreating(false); setNewName(''); }
                  }}
                  placeholder="Playlist name..."
                  className="w-full bg-white/10 border border-white/20 rounded px-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-white/40"
                />
                <div className="flex gap-2 mt-1.5">
                  <button
                    onClick={handleCreate}
                    className="flex-1 text-xs py-1 rounded bg-[var(--theme-color)]/20 text-[var(--theme-color)] hover:bg-[var(--theme-color)]/30 transition-colors"
                  >
                    Create
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setCreating(false); setNewName(''); }}
                    className="flex-1 text-xs py-1 rounded bg-white/5 text-white/50 hover:bg-white/10 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); setCreating(true); }}
                className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left text-white/50 hover:text-white hover:bg-white/5 transition-colors ${targetPlaylists.length > 0 ? 'border-t border-white/10' : ''}`}
              >
                <Plus className="w-3.5 h-3.5" />
                New playlist...
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
