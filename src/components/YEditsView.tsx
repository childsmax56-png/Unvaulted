import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Play, Volume2, Download, Loader2, FlipHorizontal2, Upload, X, Trash2, ImagePlus, Plus, Pencil, Share2, RefreshCw, FileEdit, Music2, Link, PackageOpen, ListOrdered, ArrowUp, ArrowDown, GripVertical } from 'lucide-react';
import { useState, useEffect, useMemo, useRef } from 'react';
import JSZip from 'jszip';
import { Song, Era } from '../types';
import { ARTIST_LIST } from '../artists/registry';
import { LABEL_GROUPS, LABEL_NAME, ALBUMS as LABEL_ALBUMS } from '../labelContent';
import { Img, sanitizeFilename, runWithConcurrencyLimit } from '../utils';
import { useDownloadManager } from '../DownloadManagerContext';

interface VGUser { id: string; username: string; email: string; }

const AUDIO_EXTS = /\.(mp3|m4a|wav|ogg|flac|aac)$/i;

// File-picker `accept` for audio inputs. A bare `accept="audio/*"` breaks song
// selection on mobile: Android's system audio picker only surfaces
// MediaStore-indexed music (Downloads/Files are unreachable), and iOS greys out
// audio files whose MIME type isn't recognised — which is common for .mp3/.wav/
// .flac saved in Files. Listing explicit extensions forces the general document
// picker, so users can actually pick their tracks. Keep `audio/*` first so
// desktop still filters sensibly.
const AUDIO_ACCEPT = 'audio/*,.mp3,.m4a,.wav,.ogg,.flac,.aac,.opus,.aiff,.aif,.wma,.alac';
const IMAGE_EXTS = /\.(png|jpe?g|gif|webp)$/i;
const BACK_COVER_FILE = /back\s*cover/i;

// Creator profile that is always pinned first in the Creators row and given a
// persistent blue glow. Matched exactly (case-sensitive) so the "Unvaulted
// Records" profile is pinned and the all-caps "UNVAULTED Records" label is not.
const PINNED_CREATOR = 'Unvaulted Records';
const isPinnedCreator = (name: string) => name === PINNED_CREATOR;

interface AlbumMeta {
  sourceArtist?: string;
  sourceEra?: string;
  description?: string;
  samplyUrl?: string;
  untitledUrl?: string;
  allowDownload?: boolean;
  songs?: Record<string, { displayName?: string; notes?: string }>;
  // Explicit track order, as a list of R2 filenames. Tracks not listed here
  // (e.g. newly added ones) fall to the end in their natural order.
  trackOrder?: string[];
}

// Derives the R2 filename for a song from its /api/yedits-file URL.
function songFilename(song: Song): string {
  if (!song.url) return '';
  const key = decodeURIComponent(song.url.replace('/api/yedits-file?key=', ''));
  return key.split('/').pop() ?? '';
}

// Reorders songs to match an explicit list of filenames; unlisted tracks keep
// their natural order after the listed ones (Array.sort is stable).
function applyTrackOrder(songs: Song[], order: string[]): Song[] {
  const idx = new Map(order.map((f, i) => [f, i]));
  return [...songs].sort((a, b) => {
    const ia = idx.get(songFilename(a)) ?? Number.MAX_SAFE_INTEGER;
    const ib = idx.get(songFilename(b)) ?? Number.MAX_SAFE_INTEGER;
    return ia - ib;
  });
}

export interface YEditsGroup {
  folderPath: string;
  displayName: string;
  parentName: string;
  imageUrl?: string;
  backCoverUrl?: string;
  songs: Song[];
  // Set for curated label content injected client-side (not backed by R2).
  // These render like any group but expose no owner/upload/delete controls.
  readOnly?: boolean;
  untitledUrl?: string;
}

function parseGroups(keys: string[]): YEditsGroup[] {
  const folderMap = new Map<string, { imageKey?: string; backCoverKey?: string; audioKeys: string[] }>();

  for (const key of keys) {
    const lastSlash = key.lastIndexOf('/');
    if (lastSlash === -1) continue;
    const folderPath = key.substring(0, lastSlash);
    const filename = key.substring(lastSlash + 1);
    if (!filename) continue;
    // Skip metadata sidecar
    if (filename === '_metadata.json') continue;

    if (!folderMap.has(folderPath)) {
      folderMap.set(folderPath, { audioKeys: [] });
    }
    const entry = folderMap.get(folderPath)!;
    if (AUDIO_EXTS.test(filename)) {
      entry.audioKeys.push(key);
    } else if (IMAGE_EXTS.test(filename)) {
      if (BACK_COVER_FILE.test(filename)) {
        entry.backCoverKey = key;
      } else {
        entry.imageKey = key;
      }
    }
  }

  return Array.from(folderMap.entries())
    .filter(([, { audioKeys }]) => audioKeys.length > 0)
    .map(([folderPath, { imageKey, backCoverKey, audioKeys }]) => {
      const parts = folderPath.split('/');
      const displayName = parts[parts.length - 1].trim() || folderPath;
      const parentName = parts.length > 1 ? parts[0].trim() : '';
      const imageUrl = imageKey
        ? `/api/yedits-file?key=${encodeURIComponent(imageKey)}`
        : undefined;
      const backCoverUrl = backCoverKey
        ? `/api/yedits-file?key=${encodeURIComponent(backCoverKey)}`
        : undefined;
      const songs: Song[] = audioKeys.map(key => ({
        name: key.split('/').pop()!.replace(/\.[^.]+$/, ''),
        url: `/api/yedits-file?key=${encodeURIComponent(key)}`,
      }));
      return { folderPath, displayName, parentName, imageUrl, backCoverUrl, songs };
    });
}

function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/\(interlude\)/gi, 'int')
    .replace(/\(intro\)/gi, 'intro')
    .replace(/\(outro\)/gi, 'outro')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function collapseTitle(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function applyTracklistOrder(songs: Song[], tracklistText: string): Song[] {
  const lines = tracklistText
    .split('\n')
    .map(l => l.replace(/^\s*\d+[\.\)]\s*/, '').trim())
    .filter(Boolean);

  const remaining = [...songs];
  const ordered: Song[] = [];
  for (const line of lines) {
    const normLine = normalizeTitle(line);
    const colLine = collapseTitle(line);

    let idx = remaining.findIndex(s => normalizeTitle(s.name) === normLine);
    if (idx === -1) idx = remaining.findIndex(s => {
      const n = normalizeTitle(s.name);
      return n.includes(normLine) || normLine.includes(n);
    });
    if (idx === -1) idx = remaining.findIndex(s => {
      const c = collapseTitle(s.name);
      return c === colLine || c.includes(colLine) || colLine.includes(c);
    });

    if (idx !== -1) {
      const song = remaining.splice(idx, 1)[0];
      ordered.push({ ...song, name: line });
    }
  }
  return [...ordered, ...remaining];
}

function getVGToken(): string | null {
  return localStorage.getItem('vg_token');
}

interface ArtistSelectProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

function ArtistSelect({ value, onChange, disabled }: ArtistSelectProps) {
  const isOther = value !== '' && !ARTIST_LIST.some(a => a.artistLabel === value);
  const [customVal, setCustomVal] = useState(isOther ? value : '');
  const selectVal = isOther ? '__other__' : value;

  const handleSelect = (v: string) => {
    if (v === '__other__') {
      onChange(customVal || '');
    } else {
      onChange(v);
    }
  };

  return (
    <div className="space-y-2">
      <select
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[var(--theme-color)] transition-colors"
        value={selectVal}
        onChange={e => handleSelect(e.target.value)}
        disabled={disabled}
      >
        <option value="">None / Original</option>
        {ARTIST_LIST.filter(a => !a.hidden).map(a => (
          <option key={a.slug} value={a.artistLabel}>{a.artistLabel}</option>
        ))}
        <option value="__other__">Other…</option>
      </select>
      {(selectVal === '__other__') && (
        <input
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[var(--theme-color)] transition-colors"
          placeholder="Enter artist name…"
          value={customVal}
          onChange={e => { setCustomVal(e.target.value); onChange(e.target.value); }}
          disabled={disabled}
        />
      )}
    </div>
  );
}


function EraSelect({ artistLabel, value, onChange, disabled }: { artistLabel: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const artistConfig = ARTIST_LIST.find(a => a.artistLabel === artistLabel);
  const eras = artistConfig ? Object.keys(artistConfig.ALBUM_RELEASE_DATES) : [];
  const isOther = value !== '' && !eras.includes(value);
  const [customVal, setCustomVal] = useState(isOther ? value : '');
  const selectVal = isOther ? '__other__' : value;

  if (eras.length === 0) {
    return (
      <input
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[var(--theme-color)] transition-colors"
        placeholder="Era / album name…"
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
      />
    );
  }

  return (
    <div className="space-y-2">
      <select
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[var(--theme-color)] transition-colors"
        value={selectVal}
        onChange={e => {
          if (e.target.value === '__other__') { onChange(customVal || ''); }
          else { onChange(e.target.value); }
        }}
        disabled={disabled}
      >
        <option value="">Select era…</option>
        {eras.map(era => <option key={era} value={era}>{era}</option>)}
        <option value="__other__">Other…</option>
      </select>
      {selectVal === '__other__' && (
        <input
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[var(--theme-color)] transition-colors"
          placeholder="Era / album name…"
          value={customVal}
          onChange={e => { setCustomVal(e.target.value); onChange(e.target.value); }}
          disabled={disabled}
        />
      )}
    </div>
  );
}

export interface ClaimInfo { userId: string; username: string; }

interface YEditsViewProps {
  searchQuery: string;
  onPlaySong: (song: Song, era: Era, contextTracks: Song[]) => void;
  currentSong?: Song | null;
  isPlaying?: boolean;
  claims?: Record<string, ClaimInfo>;
  onClaim?: (profileName: string) => void;
  isAdmin?: boolean;
}

export function YEditsView({ searchQuery, onPlaySong, currentSong, isPlaying, claims = {}, onClaim, isAdmin = false }: YEditsViewProps) {
  const { startJob, updateJob, startItem, finishItem, finishJob } = useDownloadManager();
  const [keys, setKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<YEditsGroup | null>(null);
  const [selectedCreator, setSelectedCreator] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState(false);
  const [showBackCover, setShowBackCover] = useState(false);
  const [tracklistOverrides, setTracklistOverrides] = useState<Map<string, Song[]>>(new Map());

  const [albumMeta, setAlbumMeta] = useState<Record<string, AlbumMeta>>({});

  const [vgUser, setVgUser] = useState<VGUser | null>(() => {
    try { return JSON.parse(localStorage.getItem('vg_user') || 'null'); } catch { return null; }
  });
  const [showUpload, setShowUpload] = useState(false);
  const [uploadCreator, setUploadCreator] = useState('');
  const [uploadAlbum, setUploadAlbum] = useState('');
  const [uploadCover, setUploadCover] = useState<File | null>(null);
  const [uploadTracks, setUploadTracks] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, { pct: number; status: 'pending' | 'uploading' | 'done' | 'error' }>>({});
  const [uploadResult, setUploadResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const tracksInputRef = useRef<HTMLInputElement>(null);

  // Upload metadata fields
  const [uploadSourceArtist, setUploadSourceArtist] = useState('');
  const [uploadSourceEra, setUploadSourceEra] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadSamplyUrl, setUploadSamplyUrl] = useState('');
  const [uploadUntitledUrl, setUploadUntitledUrl] = useState('');
  const [uploadAllowDownload, setUploadAllowDownload] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<YEditsGroup | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteResult, setDeleteResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // one-time migration of the built-in UNVAULTED Records catalog into R2
  const [migrating, setMigrating] = useState(false);
  const [migrateStatus, setMigrateStatus] = useState('');
  const [migrateResult, setMigrateResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // per-song delete
  const [deleteSongKey, setDeleteSongKey] = useState<string | null>(null);
  const [deletingSong, setDeletingSong] = useState(false);
  const [deleteSongResult, setDeleteSongResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // add tracks to existing album
  const [showAddTracks, setShowAddTracks] = useState(false);
  const [addTrackFiles, setAddTrackFiles] = useState<File[]>([]);
  const [addingTracks, setAddingTracks] = useState(false);
  const [addTracksProgress, setAddTracksProgress] = useState<Record<string, { pct: number; status: 'pending' | 'uploading' | 'done' | 'error' }>>({});
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [addTracksResult, setAddTracksResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const addTracksInputRef = useRef<HTMLInputElement>(null);

  // change cover art
  const [showChangeCover, setShowChangeCover] = useState(false);
  const [newCoverFile, setNewCoverFile] = useState<File | null>(null);
  const [changingCover, setChangingCover] = useState(false);
  const [changeCoverResult, setChangeCoverResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const changeCoverInputRef = useRef<HTMLInputElement>(null);

  // edit project info modal
  const [showEditMeta, setShowEditMeta] = useState(false);
  const [editMetaProjectName, setEditMetaProjectName] = useState('');
  const [editMetaCreditedArtist, setEditMetaCreditedArtist] = useState('');
  const [editMetaSourceArtist, setEditMetaSourceArtist] = useState('');
  const [editMetaSourceEra, setEditMetaSourceEra] = useState('');
  const [editMetaDescription, setEditMetaDescription] = useState('');
  const [editMetaSamplyUrl, setEditMetaSamplyUrl] = useState('');
  const [editMetaUntitledUrl, setEditMetaUntitledUrl] = useState('');
  const [editMetaAllowDownload, setEditMetaAllowDownload] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);
  const [saveMetaResult, setSaveMetaResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // per-song actions
  const [renamingSongKey, setRenamingSongKey] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renamingInProgress, setRenamingInProgress] = useState(false);
  const [renameResult, setRenameResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const [replacingSongKey, setReplacingSongKey] = useState<string | null>(null);
  const replaceFileRef = useRef<HTMLInputElement>(null);
  const [replacingInProgress, setReplacingInProgress] = useState(false);

  const [notesSongKey, setNotesSongKey] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // reorder tracks
  const [reorderMode, setReorderMode] = useState(false);
  const [orderDraft, setOrderDraft] = useState<Song[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [orderResult, setOrderResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // collaborators
  const [collaborators, setCollaborators] = useState<Record<string, string[]>>({});
  const [showCollaborators, setShowCollaborators] = useState(false);
  const [newCollaborator, setNewCollaborator] = useState('');
  const [collaboratorsBusy, setCollaboratorsBusy] = useState(false);
  const [collaboratorsResult, setCollaboratorsResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    fetch('/api/yedits')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() as Promise<string[]>; })
      .then(data => { setKeys(data); setLoading(false); })
      .catch(err => { setError(err.message ?? 'Failed to load'); setLoading(false); });
  }, []);

  useEffect(() => {
    const sync = () => {
      try { setVgUser(JSON.parse(localStorage.getItem('vg_user') || 'null')); } catch { setVgUser(null); }
    };
    window.addEventListener('storage', sync);
    window.addEventListener('vg-synced', sync);
    return () => { window.removeEventListener('storage', sync); window.removeEventListener('vg-synced', sync); };
  }, []);

  // Fetch metadata when opening an album, and clear song selection
  useEffect(() => {
    setSelectedSongs(new Set());
    setSelectMode(false);
    setReorderMode(false);
    setOrderResult(null);
    if (!selectedGroup || selectedGroup.readOnly) return;
    const fp = selectedGroup.folderPath;
    fetch(`/api/yedits-metadata?key=${encodeURIComponent(fp)}`)
      .then(r => r.ok ? r.json() as Promise<AlbumMeta> : Promise.resolve({} as AlbumMeta))
      .then(meta => setAlbumMeta(prev => ({ ...prev, [fp]: meta })))
      .catch(() => {});
  }, [selectedGroup]);

  // Fetch collaborators for the selected album's profile
  useEffect(() => {
    setCollaboratorsResult(null);
    setNewCollaborator('');
    if (!selectedGroup?.parentName || selectedGroup.readOnly) return;
    const profile = selectedGroup.parentName;
    fetch(`/api/yedits-collaborators?profile=${encodeURIComponent(profile)}`)
      .then(r => r.ok ? r.json() as Promise<{ collaborators?: string[] }> : Promise.resolve({} as { collaborators?: string[] }))
      .then(data => setCollaborators(prev => ({ ...prev, [profile]: data.collaborators ?? [] })))
      .catch(() => {});
  }, [selectedGroup?.parentName]);

  const refreshCollaborators = async (profile: string) => {
    try {
      const res = await fetch(`/api/yedits-collaborators?profile=${encodeURIComponent(profile)}`);
      if (res.ok) {
        const data = await res.json() as { collaborators?: string[] };
        setCollaborators(prev => ({ ...prev, [profile]: data.collaborators ?? [] }));
      }
    } catch {}
  };

  const addCollaborator = async (profile: string) => {
    const token = getVGToken();
    const username = newCollaborator.trim();
    if (!token || !username) return;
    setCollaboratorsBusy(true);
    setCollaboratorsResult(null);
    try {
      const res = await fetch('/api/yedits-collaborators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, profileName: profile, username }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setNewCollaborator('');
        setCollaboratorsResult({ ok: true, msg: `Added ${username}` });
        await refreshCollaborators(profile);
      } else {
        setCollaboratorsResult({ ok: false, msg: data.error ?? 'Failed to add collaborator' });
      }
    } catch {
      setCollaboratorsResult({ ok: false, msg: 'Network error' });
    } finally {
      setCollaboratorsBusy(false);
    }
  };

  const removeCollaborator = async (profile: string, username: string) => {
    const token = getVGToken();
    if (!token) return;
    setCollaboratorsBusy(true);
    setCollaboratorsResult(null);
    try {
      const res = await fetch('/api/yedits-collaborators', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, profileName: profile, username }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        await refreshCollaborators(profile);
      } else {
        setCollaboratorsResult({ ok: false, msg: data.error ?? 'Failed to remove collaborator' });
      }
    } catch {
      setCollaboratorsResult({ ok: false, msg: 'Network error' });
    } finally {
      setCollaboratorsBusy(false);
    }
  };

  const openUpload = () => {
    setUploadCreator(vgUser?.username ?? '');
    setUploadAlbum('');
    setUploadCover(null);
    setUploadTracks([]);
    setUploadResult(null);
    setUploadSourceArtist('');
    setUploadSourceEra('');
    setUploadDescription('');
    setUploadSamplyUrl('');
    setUploadUntitledUrl('');
    setUploadAllowDownload(false);
    setShowUpload(true);
  };

  // PUTs a single file to a presigned URL via XHR (fetch() doesn't expose
  // upload progress events), reporting percent complete as it goes.
  const putWithProgress = (url: string, file: File, contentType: string, onPct: (pct: number) => void): Promise<void> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url);
      xhr.setRequestHeader('Content-Type', contentType);
      xhr.upload.onprogress = e => {
        if (e.lengthComputable) onPct(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(`Failed to upload ${file.name} (HTTP ${xhr.status})`));
      };
      xhr.onerror = () => reject(new Error(`Network error uploading ${file.name}`));
      xhr.send(file);
    });
  };

  // Presigns direct-to-R2 PUT URLs for the given files, then uploads each
  // one straight to R2 (bypassing the Worker's request-body size limit).
  // Files upload with limited concurrency, reporting per-file progress.
  const uploadFilesDirect = async (
    token: string,
    creator: string,
    album: string,
    cover: File | null,
    tracks: File[],
    onProgress?: (fileName: string, pct: number, status: 'uploading' | 'done' | 'error') => void
  ): Promise<{ uploaded: string[]; folderPath: string }> => {
    const presignRes = await fetch('/api/yedits-presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        creator,
        album,
        cover: cover ? { name: cover.name, type: cover.type, size: cover.size } : undefined,
        tracks: tracks.map(t => ({ name: t.name, type: t.type, size: t.size })),
      }),
    });
    const presignData = await presignRes.json() as {
      uploads?: { field: 'cover' | 'track'; name: string; key: string; url: string; contentType: string }[];
      folderPath?: string;
      error?: string;
    };
    if (!presignRes.ok || !presignData.uploads) {
      throw new Error(presignData.error ?? 'Failed to prepare upload');
    }

    const fileByName = new Map<string, File>();
    if (cover) fileByName.set(`cover:${cover.name}`, cover);
    for (const t of tracks) fileByName.set(`track:${t.name}`, t);

    const uploaded: string[] = [];
    const errors: string[] = [];
    const CONCURRENCY = 3;
    const queue = [...presignData.uploads];

    const worker = async () => {
      while (queue.length > 0) {
        const u = queue.shift();
        if (!u) break;
        const file = fileByName.get(`${u.field}:${u.name}`);
        if (!file) continue;
        try {
          onProgress?.(file.name, 0, 'uploading');
          await putWithProgress(u.url, file, u.contentType, pct => onProgress?.(file.name, pct, 'uploading'));
          onProgress?.(file.name, 100, 'done');
          uploaded.push(u.key);
        } catch (err) {
          onProgress?.(file.name, 0, 'error');
          errors.push(err instanceof Error ? err.message : `Failed to upload ${file.name}`);
        }
      }
    };

    await Promise.all(Array.from({ length: CONCURRENCY }, worker));

    if (errors.length > 0) throw new Error(errors.join('; '));

    return { uploaded, folderPath: presignData.folderPath ?? '' };
  };

  const doUpload = async () => {
    const token = getVGToken();
    if (!token || !uploadCreator.trim() || !uploadAlbum.trim() || uploadTracks.length === 0) return;
    setUploading(true);
    setUploadResult(null);
    setUploadProgress(Object.fromEntries(
      [...(uploadCover ? [uploadCover] : []), ...uploadTracks].map(f => [f.name, { pct: 0, status: 'pending' as const }])
    ));
    try {
      const creator = uploadCreator.trim();
      const album = uploadAlbum.trim();
      const { uploaded, folderPath } = await uploadFilesDirect(
        token, creator, album, uploadCover, uploadTracks,
        (fileName, pct, status) => setUploadProgress(prev => ({ ...prev, [fileName]: { pct, status } }))
      );

      const finalizeRes = await fetch('/api/yedits-upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          creator,
          album,
          sourceArtist: uploadSourceArtist || undefined,
          sourceEra: uploadSourceEra || undefined,
          description: uploadDescription || undefined,
          samplyUrl: uploadSamplyUrl || undefined,
          untitledUrl: uploadUntitledUrl || undefined,
          allowDownload: uploadAllowDownload,
        }),
      });
      const finalizeData = await finalizeRes.json() as { folderPath?: string; error?: string };
      if (!finalizeRes.ok) {
        setUploadResult({ ok: false, msg: finalizeData.error ?? 'Upload failed' });
        return;
      }

      setUploadResult({ ok: true, msg: `Uploaded ${uploaded.length} file(s)!` });
      const freshKeys = await fetch('/api/yedits', { cache: 'no-store' })
        .then(r => r.json() as Promise<string[]>)
        .catch(() => null);
      if (freshKeys) setKeys(freshKeys);
      // Fetch metadata for the new album
      const fp = finalizeData.folderPath || folderPath;
      if (fp) {
        fetch(`/api/yedits-metadata?key=${encodeURIComponent(fp)}`)
          .then(r => r.ok ? r.json() as Promise<AlbumMeta> : Promise.resolve({} as AlbumMeta))
          .then(meta => setAlbumMeta(prev => ({ ...prev, [fp]: meta })))
          .catch(() => {});
      }
    } catch (err) {
      setUploadResult({ ok: false, msg: err instanceof Error ? err.message : 'Network error' });
    } finally {
      setUploading(false);
    }
  };

  const doDelete = async (group: YEditsGroup) => {
    const token = getVGToken();
    if (!token) return;
    setDeleting(true);
    setDeleteResult(null);
    try {
      const res = await fetch('/api/yedits-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, folderPath: group.folderPath }),
      });
      const data = await res.json() as { deleted?: string[]; error?: string };
      if (!res.ok) {
        setDeleteResult({ ok: false, msg: data.error ?? 'Delete failed' });
      } else {
        setDeleteResult({ ok: true, msg: `Deleted ${data.deleted?.length ?? 0} file(s)` });
        fetch('/api/yedits', { cache: 'no-store' })
          .then(r => r.json() as Promise<string[]>)
          .then(d => { setKeys(d); setDeleteTarget(null); setSelectedGroup(null); })
          .catch(() => setDeleteTarget(null));
      }
    } catch {
      setDeleteResult({ ok: false, msg: 'Network error' });
    } finally {
      setDeleting(false);
    }
  };

  // Copies the built-in UNVAULTED Records catalog (static files under /public)
  // into the R2 uploads bucket so the albums become normal, fully editable
  // yeditsgold projects. Reuses the standard presign → direct-upload flow, then
  // writes per-track titles/credits via the metadata sidecar. Idempotent:
  // albums already present in the bucket are skipped.
  const doMigrateLabel = async () => {
    const token = getVGToken();
    if (!token) return;
    setMigrating(true);
    setMigrateResult(null);

    const sanitizeSeg = (s: string) =>
      s.replace(/[/\\<>:"|?*\x00-\x1f]/g, '').replace(/\s+/g, ' ').trim() || 'untitled';
    const extOf = (path: string) => {
      const base = path.split('/').pop() ?? '';
      const dot = base.lastIndexOf('.');
      return dot > -1 ? base.slice(dot + 1).toLowerCase() : '';
    };
    const typeFor = (ext: string) =>
      ({ mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac',
         png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' } as Record<string, string>)[ext] || 'application/octet-stream';

    // Shape the raw catalog into a uniform import list. Singles are managed
    // directly in the bucket, so they're intentionally excluded here.
    const importAlbums = LABEL_ALBUMS.map(a => ({
      title: a.title,
      cover: a.cover as string | undefined,
      streamUrl: a.streamUrl as string | undefined,
      tracks: a.tracks.map(t => ({ n: t.n, title: t.title, artist: t.artist, src: t.src })),
    })).filter(a => a.tracks.length > 0);

    const labelDir = sanitizeSeg(LABEL_NAME);
    let done = 0, skipped = 0, failed = 0;

    for (const album of importAlbums) {
      const albumDir = sanitizeSeg(album.title);
      if (keys.some(k => k.startsWith(`${labelDir}/${albumDir}/`))) { skipped++; continue; }

      setMigrateStatus(`Importing “${album.title}”…`);
      try {
        const trackFiles: File[] = [];
        const songsMeta: Record<string, { displayName?: string; notes?: string }> = {};
        for (const t of album.tracks) {
          const res = await fetch(t.src);
          if (!res.ok) throw new Error(`Missing file for “${t.title}”`);
          const ext = extOf(t.src) || 'mp3';
          const blob = await res.blob();
          const filename = `${String(t.n).padStart(2, '0')} ${sanitizeSeg(t.src.split('/').pop()!.replace(/\.[^.]+$/, ''))}.${ext}`;
          trackFiles.push(new File([blob], filename, { type: blob.type || typeFor(ext) }));
          songsMeta[filename] = { displayName: t.title, notes: t.artist || undefined };
        }

        let coverFile: File | null = null;
        if (album.cover) {
          const cRes = await fetch(album.cover);
          if (cRes.ok) {
            const ext = extOf(album.cover) || 'jpg';
            const cBlob = await cRes.blob();
            coverFile = new File([cBlob], `cover.${ext}`, { type: cBlob.type || typeFor(ext) });
          }
        }

        const { folderPath } = await uploadFilesDirect(token, LABEL_NAME, album.title, coverFile, trackFiles);

        await fetch('/api/yedits-metadata', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            folderPath: folderPath || `${labelDir}/${albumDir}`,
            meta: { untitledUrl: album.streamUrl || undefined, allowDownload: true, songs: songsMeta },
          }),
        });
        done++;
      } catch {
        failed++;
      }
    }

    setMigrateStatus('');
    const fresh = await fetch('/api/yedits', { cache: 'no-store' })
      .then(r => r.json() as Promise<string[]>)
      .catch(() => null);
    if (fresh) setKeys(fresh);
    setMigrating(false);
    setMigrateResult({
      ok: failed === 0,
      msg: failed === 0
        ? `Imported ${done} album${done !== 1 ? 's' : ''}${skipped ? `, ${skipped} already in bucket` : ''}. They're now editable.`
        : `Imported ${done}, ${failed} failed${skipped ? `, ${skipped} skipped` : ''}.`,
    });
  };

  const doDeleteSong = async (key: string) => {
    const token = getVGToken();
    if (!token) return;
    setDeletingSong(true);
    setDeleteSongResult(null);
    try {
      const res = await fetch('/api/yedits-delete-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, key }),
      });
      const data = await res.json() as { deleted?: string; error?: string };
      if (!res.ok) {
        setDeleteSongResult({ ok: false, msg: data.error ?? 'Delete failed' });
      } else {
        setDeleteSongResult({ ok: true, msg: 'Track deleted' });
        const fresh = await fetch('/api/yedits', { cache: 'no-store' }).then(r => r.json() as Promise<string[]>);
        setKeys(fresh);
        setTimeout(() => { setDeleteSongKey(null); setDeleteSongResult(null); }, 900);
      }
    } catch {
      setDeleteSongResult({ ok: false, msg: 'Network error' });
    } finally {
      setDeletingSong(false);
    }
  };

  const doAddTracks = async (group: YEditsGroup) => {
    const token = getVGToken();
    if (!token || addTrackFiles.length === 0) return;
    setAddingTracks(true);
    setAddTracksResult(null);
    setAddTracksProgress(Object.fromEntries(addTrackFiles.map(f => [f.name, { pct: 0, status: 'pending' as const }])));
    try {
      const { uploaded } = await uploadFilesDirect(
        token, group.parentName, group.displayName, null, addTrackFiles,
        (fileName, pct, status) => setAddTracksProgress(prev => ({ ...prev, [fileName]: { pct, status } }))
      );
      setAddTracksResult({ ok: true, msg: `Added ${uploaded.length} track(s)!` });
      const fresh = await fetch('/api/yedits', { cache: 'no-store' }).then(r => r.json() as Promise<string[]>);
      setKeys(fresh);
      const updatedGroups = parseGroups(fresh);
      const refreshed = updatedGroups.find(g => g.folderPath === group.folderPath);
      if (refreshed) setSelectedGroup(refreshed);
      setAddTrackFiles([]);
      setTimeout(() => { setShowAddTracks(false); setAddTracksResult(null); }, 1200);
    } catch (err) {
      setAddTracksResult({ ok: false, msg: err instanceof Error ? err.message : 'Network error' });
    } finally {
      setAddingTracks(false);
    }
  };

  const doChangeCover = async (group: YEditsGroup) => {
    const token = getVGToken();
    if (!token || !newCoverFile) return;
    setChangingCover(true);
    setChangeCoverResult(null);
    try {
      await uploadFilesDirect(token, group.parentName, group.displayName, newCoverFile, []);
      setChangeCoverResult({ ok: true, msg: 'Cover updated!' });
      const fresh = await fetch('/api/yedits', { cache: 'no-store' }).then(r => r.json() as Promise<string[]>);
      setKeys(fresh);
      setNewCoverFile(null);
      setTimeout(() => { setShowChangeCover(false); setChangeCoverResult(null); }, 1200);
    } catch (err) {
      setChangeCoverResult({ ok: false, msg: err instanceof Error ? err.message : 'Network error' });
    } finally {
      setChangingCover(false);
    }
  };

  const openEditMeta = (group: YEditsGroup) => {
    const meta = albumMeta[group.folderPath] ?? {};
    setEditMetaProjectName(group.displayName);
    setEditMetaCreditedArtist(group.parentName);
    setEditMetaSourceArtist(meta.sourceArtist ?? '');
    setEditMetaSourceEra(meta.sourceEra ?? '');
    setEditMetaDescription(meta.description ?? '');
    setEditMetaSamplyUrl(meta.samplyUrl ?? '');
    setEditMetaUntitledUrl(meta.untitledUrl ?? '');
    setEditMetaAllowDownload(meta.allowDownload ?? false);
    setSaveMetaResult(null);
    setShowEditMeta(true);
  };

  const doSaveMeta = async (group: YEditsGroup) => {
    const token = getVGToken();
    if (!token) return;
    setSavingMeta(true);
    setSaveMetaResult(null);

    let targetFolderPath = group.folderPath;

    // Move the album folder in R2 if the project name or credited artist
    // changed. A single re-credit call handles both (creator = folder segment 0,
    // name = segment 1).
    const trimmedName = editMetaProjectName.trim() || group.displayName;
    const trimmedCreditedArtist = editMetaCreditedArtist.trim() || group.parentName;
    if (trimmedName !== group.displayName || trimmedCreditedArtist !== group.parentName) {
      try {
        const moveRes = await fetch('/api/yedits-recredit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, oldFolderPath: group.folderPath, newCreator: trimmedCreditedArtist, newName: trimmedName }),
        });
        // Parse defensively — an HTML error page would otherwise throw here and
        // get reported as a misleading "network error".
        const raw = await moveRes.text();
        let moveData: { ok?: boolean; folderPath?: string; error?: string } = {};
        try { moveData = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON body */ }
        if (!moveRes.ok) {
          setSaveMetaResult({ ok: false, msg: moveData.error ?? `Update failed (HTTP ${moveRes.status})` });
          setSavingMeta(false);
          return;
        }
        targetFolderPath = moveData.folderPath ?? targetFolderPath;
      } catch (err) {
        setSaveMetaResult({ ok: false, msg: err instanceof Error ? `Update failed: ${err.message}` : 'Update failed' });
        setSavingMeta(false);
        return;
      }
    }

    const existingMeta = albumMeta[group.folderPath] ?? {};
    const meta: AlbumMeta = {
      ...existingMeta,
      sourceArtist: editMetaSourceArtist || undefined,
      sourceEra: editMetaSourceEra || undefined,
      description: editMetaDescription || undefined,
      samplyUrl: editMetaSamplyUrl || undefined,
      untitledUrl: editMetaUntitledUrl || undefined,
      allowDownload: editMetaAllowDownload,
    };
    try {
      const res = await fetch('/api/yedits-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, folderPath: targetFolderPath, meta }),
      });
      const data = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok) {
        setSaveMetaResult({ ok: false, msg: data.error ?? 'Save failed' });
      } else {
        // Refresh keys and update selectedGroup to the new folder path
        const fresh = await fetch('/api/yedits', { cache: 'no-store' }).then(r => r.json() as Promise<string[]>);
        setKeys(fresh);
        const updatedGroups = parseGroups(fresh);
        const refreshed = updatedGroups.find(g => g.folderPath === targetFolderPath);
        if (refreshed) setSelectedGroup(refreshed);
        setAlbumMeta(prev => ({ ...prev, [targetFolderPath]: meta }));
        setSaveMetaResult({ ok: true, msg: 'Saved!' });
        setTimeout(() => { setShowEditMeta(false); setSaveMetaResult(null); }, 900);
      }
    } catch {
      setSaveMetaResult({ ok: false, msg: 'Network error' });
    } finally {
      setSavingMeta(false);
    }
  };

  const doRenameSong = async (group: YEditsGroup) => {
    const token = getVGToken();
    if (!token || !renamingSongKey || !renameValue.trim()) return;
    setRenamingInProgress(true);
    setRenameResult(null);
    try {
      const res = await fetch('/api/yedits-rename-song', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, oldKey: renamingSongKey, newFilename: renameValue.trim() }),
      });
      const data = await res.json() as { ok?: boolean; newKey?: string; error?: string };
      if (!res.ok) {
        setRenameResult({ ok: false, msg: data.error ?? 'Rename failed' });
      } else {
        setRenameResult({ ok: true, msg: 'Renamed!' });
        const fresh = await fetch('/api/yedits', { cache: 'no-store' }).then(r => r.json() as Promise<string[]>);
        setKeys(fresh);
        setTimeout(() => { setRenamingSongKey(null); setRenameResult(null); }, 700);
      }
    } catch {
      setRenameResult({ ok: false, msg: 'Network error' });
    } finally {
      setRenamingInProgress(false);
    }
  };

  const doReplaceSong = async (group: YEditsGroup, key: string, file: File) => {
    const token = getVGToken();
    if (!token) return;
    setReplacingInProgress(true);
    try {
      const res = await fetch('/api/yedits-replace-song', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, key, contentType: file.type }),
      });
      const data = await res.json() as { url?: string; contentType?: string; error?: string };
      if (res.ok && data.url) {
        await fetch(data.url, {
          method: 'PUT',
          headers: { 'Content-Type': data.contentType ?? (file.type || 'audio/mpeg') },
          body: file,
        });
      }
    } catch {
      // silent
    } finally {
      setReplacingInProgress(false);
      setReplacingSongKey(null);
    }
  };

  const doSaveNotes = async (group: YEditsGroup, filename: string) => {
    const token = getVGToken();
    if (!token) return;
    setSavingNotes(true);
    const existingMeta = albumMeta[group.folderPath] ?? {};
    const meta: AlbumMeta = {
      ...existingMeta,
      songs: {
        ...(existingMeta.songs ?? {}),
        [filename]: {
          ...(existingMeta.songs?.[filename] ?? {}),
          notes: notesValue,
        },
      },
    };
    try {
      const res = await fetch('/api/yedits-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, folderPath: group.folderPath, meta }),
      });
      if (res.ok) {
        setAlbumMeta(prev => ({ ...prev, [group.folderPath]: meta }));
        setTimeout(() => { setNotesSongKey(null); }, 500);
      }
    } catch {
      // silent
    } finally {
      setSavingNotes(false);
    }
  };

  const doSaveOrder = async (group: YEditsGroup) => {
    const token = getVGToken();
    if (!token) return;
    setSavingOrder(true);
    setOrderResult(null);
    const trackOrder = orderDraft.map(songFilename).filter(Boolean);
    const existingMeta = albumMeta[group.folderPath] ?? {};
    const meta: AlbumMeta = { ...existingMeta, trackOrder };
    try {
      const res = await fetch('/api/yedits-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, folderPath: group.folderPath, meta }),
      });
      if (res.ok) {
        setAlbumMeta(prev => ({ ...prev, [group.folderPath]: meta }));
        setOrderResult({ ok: true, msg: 'Order saved' });
        setTimeout(() => { setReorderMode(false); setOrderResult(null); }, 800);
      } else {
        const raw = await res.text();
        let data: { error?: string } = {};
        try { data = raw ? JSON.parse(raw) : {}; } catch { /* non-JSON */ }
        setOrderResult({ ok: false, msg: data.error ?? `Save failed (HTTP ${res.status})` });
      }
    } catch (err) {
      setOrderResult({ ok: false, msg: err instanceof Error ? `Save failed: ${err.message}` : 'Save failed' });
    } finally {
      setSavingOrder(false);
    }
  };

  const groups = useMemo(() => {
    const r2Groups = parseGroups(keys);
    // Once a label album has been migrated into the bucket, hide the built-in
    // read-only copy so it doesn't show twice (matched by artist + album name).
    const migrated = new Set(r2Groups.map(g => `${g.parentName.toLowerCase()}|||${g.displayName.toLowerCase()}`));
    const labels = LABEL_GROUPS.filter(g => !migrated.has(`${g.parentName.toLowerCase()}|||${g.displayName.toLowerCase()}`));
    return [...labels, ...r2Groups];
  }, [keys]);
  const existingCreators = useMemo(() =>
    [...new Set(groups.map(g => g.parentName).filter(Boolean))].sort((a, b) => a.localeCompare(b))
  , [groups]);

  useEffect(() => {
    fetch('/api/yedits-tracklists')
      .then(r => { if (!r.ok) throw new Error(); return r.json() as Promise<Record<string, string>>; })
      .then(data => {
        const groupsBySongKey = new Map(groups.map(g => [g.folderPath, g.songs]));
        const map = new Map<string, Song[]>();
        for (const [folderPath, text] of Object.entries(data)) {
          const songs = groupsBySongKey.get(folderPath);
          if (songs) map.set(folderPath, applyTracklistOrder(songs, text));
        }
        setTracklistOverrides(map);
      })
      .catch(() => {});
  }, [groups]);

  const creators = useMemo(() => {
    const map = new Map<string, { albumCount: number; previewImage?: string }>();
    for (const g of groups) {
      if (!g.parentName) continue;
      const existing = map.get(g.parentName);
      map.set(g.parentName, {
        albumCount: (existing?.albumCount ?? 0) + 1,
        previewImage: existing?.previewImage ?? g.imageUrl,
      });
    }
    return Array.from(map.entries())
      .map(([name, info]) => ({ name, ...info }))
      // Always surface the Unvaulted Records profile first.
      .sort((a, b) => (isPinnedCreator(a.name) ? -1 : 0) - (isPinnedCreator(b.name) ? -1 : 0));
  }, [groups]);

  const filteredGroups = useMemo(() => {
    const byCreator = selectedCreator
      ? groups.filter(g => g.parentName === selectedCreator)
      : groups;
    if (!searchQuery.trim()) return byCreator;
    const q = searchQuery.toLowerCase();
    return byCreator.filter(g =>
      g.displayName.toLowerCase().includes(q) || g.parentName.toLowerCase().includes(q)
    );
  }, [groups, selectedCreator, searchQuery]);

  const filteredSongs = useMemo(() => {
    if (!selectedGroup) return [];
    // An explicit saved track order (admin-set) wins over the legacy tracklist
    // text override and the natural R2 order.
    const order = albumMeta[selectedGroup.folderPath]?.trackOrder;
    let songs = order && order.length
      ? applyTrackOrder(selectedGroup.songs, order)
      : tracklistOverrides.get(selectedGroup.folderPath) ?? selectedGroup.songs;
    if (!searchQuery.trim()) return songs;
    const q = searchQuery.toLowerCase();
    return songs.filter(s => s.name.toLowerCase().includes(q));
  }, [selectedGroup, searchQuery, tracklistOverrides, albumMeta]);

  if (loading) {
    return (
      <motion.div key="yedits-loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="flex items-center justify-center h-64 text-white/40">
        <Loader2 className="w-6 h-6 animate-spin mr-3" />
        <span className="text-sm">Loading yedits…</span>
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div key="yedits-error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="flex items-center justify-center h-64 text-white/40 text-sm">
        Failed to load: {error}
      </motion.div>
    );
  }

  const doZipDownload = async (songs: Song[], albumName: string, songsMeta: AlbumMeta['songs']) => {
    setZipping(true);
    const jobId = startJob(albumName, songs.length);
    try {
      const zip = new JSZip();
      await runWithConcurrencyLimit(songs, async (song) => {
        if (!song.url) return;
        const res = await fetch(song.url, { signal: AbortSignal.timeout(30000) });
        if (!res.ok) return;
        const blob = await res.blob();
        const songKey = decodeURIComponent(song.url.replace('/api/yedits-file?key=', ''));
        const filename = songKey.split('/').pop() ?? song.name;
        const displayName = songsMeta?.[filename]?.displayName;
        const finalName = displayName ? `${displayName}${filename.substring(filename.lastIndexOf('.'))}` : filename;
        zip.file(sanitizeFilename(finalName), blob);
      }, 4, 2, (completed, total) => updateJob(jobId, completed, total), (song) => startItem(jobId, song.name), (song) => finishItem(jobId, song.name));
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${albumName}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      finishJob(jobId, 'done');
    } catch (err) {
      finishJob(jobId, 'error');
      throw err;
    } finally {
      setZipping(false);
    }
  };

  const doDeleteSelected = async (group: YEditsGroup) => {
    const token = getVGToken();
    if (!token || selectedSongs.size === 0) return;
    setDeletingSelected(true);
    try {
      await Promise.all(
        Array.from(selectedSongs).map(url => {
          const key = decodeURIComponent(url.replace('/api/yedits-file?key=', ''));
          return fetch('/api/yedits-delete-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, key }),
          });
        })
      );
      const fresh = await fetch('/api/yedits', { cache: 'no-store' }).then(r => r.json() as Promise<string[]>);
      setKeys(fresh);
      const updatedGroups = parseGroups(fresh);
      const refreshed = updatedGroups.find(g => g.folderPath === group.folderPath);
      if (refreshed) setSelectedGroup(refreshed);
      else setSelectedGroup(null);
      setSelectedSongs(new Set());
      setSelectMode(false);
    } finally {
      setDeletingSelected(false);
    }
  };

  // DETAIL VIEW
  if (selectedGroup) {
    const savedOrder = albumMeta[selectedGroup.folderPath]?.trackOrder;
    const orderedSongs = savedOrder && savedOrder.length
      ? applyTrackOrder(selectedGroup.songs, savedOrder)
      : tracklistOverrides.get(selectedGroup.folderPath) ?? selectedGroup.songs;
    const era: Era = {
      name: selectedGroup.displayName,
      image: selectedGroup.imageUrl,
      data: { Yedits: orderedSongs },
    };
    const activeCoverUrl = showBackCover ? selectedGroup.backCoverUrl : selectedGroup.imageUrl;
    const hasBackCover = !!selectedGroup.backCoverUrl;
    const claimEntry = claims[selectedGroup.parentName];
    const isRootOwner = !!vgUser && selectedGroup.parentName.toLowerCase() === vgUser.username.toLowerCase();
    const profileCollaborators = collaborators[selectedGroup.parentName] ?? [];
    const isCollaborator = !!vgUser && profileCollaborators.some(u => u.toLowerCase() === vgUser.username.toLowerCase());
    const isOwner = !selectedGroup.readOnly && (isAdmin || isRootOwner || (!!vgUser && claimEntry?.userId === vgUser.id) || isCollaborator);
    const meta: AlbumMeta = selectedGroup.readOnly
      ? { untitledUrl: selectedGroup.untitledUrl, allowDownload: true }
      : albumMeta[selectedGroup.folderPath] ?? {};

    return (
      <>
        {typeof document !== 'undefined' && createPortal(
          <AnimatePresence>
            {zoomedImage && activeCoverUrl && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setZoomedImage(false)}
                className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out backdrop-blur-sm"
              >
                <Img w={1200} eager src={activeCoverUrl} alt={selectedGroup.displayName}
                  className="max-w-full max-h-full object-contain shadow-2xl rounded-md" />
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

        <motion.div
          key={`yedits-detail-${selectedGroup.folderPath}`}
          initial={{ opacity: 0, filter: 'blur(10px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, filter: 'blur(10px)' }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="absolute inset-0 z-10 bg-[#0a0a0a] overflow-y-auto pb-64"
        >
          <div className="p-6 md:p-8 flex flex-col md:flex-row items-start gap-6 md:gap-8 border-b border-white/5 bg-white/5">
            <button
              onClick={() => { setSelectedGroup(null); setZoomedImage(false); setShowBackCover(false); }}
              className="cursor-pointer mt-1 flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="relative shrink-0">
              <div
                className={`w-32 h-32 md:w-48 md:h-48 rounded-md overflow-hidden bg-white/5 shadow-xl ${activeCoverUrl ? 'cursor-pointer' : ''}`}
                onClick={() => { if (activeCoverUrl) setZoomedImage(true); }}
                title={activeCoverUrl ? 'Click to zoom' : undefined}
              >
                {activeCoverUrl ? (
                  <Img w={500} eager src={activeCoverUrl} alt={selectedGroup.displayName} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-white/20 text-center p-4">
                    {selectedGroup.displayName}
                  </div>
                )}
              </div>
              {hasBackCover && (
                <button
                  onClick={() => setShowBackCover(v => !v)}
                  className="absolute bottom-2 right-2 flex items-center justify-center w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 text-white/70 hover:text-white transition-colors backdrop-blur-sm"
                  title={showBackCover ? 'Show front cover' : 'Show back cover'}
                >
                  <FlipHorizontal2 className="w-3.5 h-3.5" />
                </button>
              )}
              {isOwner && (
                <button
                  onClick={() => { setNewCoverFile(null); setChangeCoverResult(null); setShowChangeCover(true); }}
                  className="absolute top-2 left-2 flex items-center gap-1 px-2 h-7 rounded-full bg-black/70 hover:bg-[var(--theme-color)]/80 text-white/80 hover:text-white backdrop-blur-sm cursor-pointer transition-colors text-[10px] font-semibold shadow-lg"
                  title="Change cover art"
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  {activeCoverUrl ? 'Edit' : 'Add'} cover
                </button>
              )}
            </div>

            <div className="flex flex-col justify-end h-full py-2 flex-1 min-w-0">
              {selectedGroup.parentName && (
                <p className="text-[var(--theme-color)] text-sm font-semibold uppercase tracking-widest mb-2">
                  {selectedGroup.parentName}
                </p>
              )}
              <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight">
                {selectedGroup.displayName}
              </h1>

              {/* Source artist / era */}
              {(meta.sourceArtist || meta.sourceEra) && (
                <p className="text-white/50 text-sm mt-1">
                  {[meta.sourceArtist, meta.sourceEra].filter(Boolean).join(' — ')}
                </p>
              )}

              {/* Description */}
              {meta.description && (
                <p className="text-white/40 text-sm mt-2 max-w-xl leading-relaxed">
                  {meta.description}
                </p>
              )}

              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-[var(--theme-color)]/10 text-[var(--theme-color)] border border-[var(--theme-color)]/20">
                  Yedit Affiliates
                </span>
                <p className="text-white/40 text-sm">
                  {selectedGroup.songs.length} track{selectedGroup.songs.length !== 1 ? 's' : ''}
                </p>

                {/* Streaming links */}
                {meta.samplyUrl && (
                  <a
                    href={meta.samplyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="flex items-center gap-1 text-xs font-bold py-1 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white border border-white/10 transition-colors"
                    title="Open on Samply"
                  >
                    <Music2 className="w-3 h-3" />
                    Samply
                  </a>
                )}
                {meta.untitledUrl && (
                  <a
                    href={meta.untitledUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="flex items-center gap-1 text-xs font-bold py-1 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white border border-white/10 transition-colors"
                    title="Open on Untitled"
                  >
                    <Link className="w-3 h-3" />
                    Untitled
                  </a>
                )}

                {(meta.allowDownload !== false || isOwner) && (
                  <button
                    onClick={() => {
                      setSelectMode(m => !m);
                      setSelectedSongs(new Set());
                    }}
                    className={`flex items-center gap-1.5 text-xs font-bold py-1 px-3 rounded-lg border transition-colors cursor-pointer ${selectMode ? 'bg-[var(--theme-color)]/20 text-[var(--theme-color)] border-[var(--theme-color)]/30' : 'bg-white/5 hover:bg-white/10 text-white/50 hover:text-white border-white/10'}`}
                  >
                    {selectMode ? 'Cancel' : 'Select'}
                  </button>
                )}

                {selectMode && selectedSongs.size > 0 && (
                  <>
                    {meta.allowDownload !== false && (
                      <button
                        onClick={() => {
                          const songs = filteredSongs.filter(s => s.url && selectedSongs.has(s.url));
                          doZipDownload(songs, selectedGroup.displayName, meta.songs);
                        }}
                        disabled={zipping}
                        className="flex items-center gap-1.5 text-xs font-bold py-1 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition-colors cursor-pointer disabled:opacity-40"
                      >
                        {zipping ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                        Download ({selectedSongs.size})
                      </button>
                    )}
                    {isOwner && (
                      <button
                        onClick={() => doDeleteSelected(selectedGroup)}
                        disabled={deletingSelected}
                        className="flex items-center gap-1.5 text-xs font-bold py-1 px-3 rounded-lg bg-red-600/10 hover:bg-red-600/20 text-red-400 border border-red-600/20 transition-colors cursor-pointer disabled:opacity-40"
                      >
                        {deletingSelected ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        Delete ({selectedSongs.size})
                      </button>
                    )}
                  </>
                )}

                {!selectMode && meta.allowDownload !== false && (
                  <button
                    onClick={() => doZipDownload(filteredSongs, selectedGroup.displayName, meta.songs)}
                    disabled={zipping}
                    className="flex items-center gap-1.5 text-xs font-bold py-1 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white border border-white/10 transition-colors cursor-pointer disabled:opacity-40"
                  >
                    {zipping ? <Loader2 className="w-3 h-3 animate-spin" /> : <PackageOpen className="w-3 h-3" />}
                    Download All
                  </button>
                )}

                {isOwner && (
                  <>
                    <button
                      onClick={() => { setAddTrackFiles([]); setAddTracksResult(null); setShowAddTracks(true); }}
                      className="flex items-center gap-1.5 text-xs font-bold py-1 px-3 rounded-lg bg-[var(--theme-color)]/10 hover:bg-[var(--theme-color)]/20 text-[var(--theme-color)] border border-[var(--theme-color)]/20 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      Add Tracks
                    </button>
                    <button
                      onClick={() => openEditMeta(selectedGroup)}
                      className="flex items-center gap-1.5 text-xs font-bold py-1 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white border border-white/10 transition-colors cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" />
                      Edit Info
                    </button>
                    <button
                      onClick={() => {
                        setOrderResult(null);
                        setOrderDraft(orderedSongs);
                        setSelectMode(false);
                        setReorderMode(m => !m);
                      }}
                      className={`flex items-center gap-1.5 text-xs font-bold py-1 px-3 rounded-lg border transition-colors cursor-pointer ${reorderMode ? 'bg-[var(--theme-color)]/20 text-[var(--theme-color)] border-[var(--theme-color)]/30' : 'bg-white/5 hover:bg-white/10 text-white/50 hover:text-white border-white/10'}`}
                    >
                      <ListOrdered className="w-3 h-3" />
                      {reorderMode ? 'Cancel' : 'Reorder'}
                    </button>
                    <button
                      onClick={() => { setCollaboratorsResult(null); setNewCollaborator(''); setShowCollaborators(true); }}
                      className="flex items-center gap-1.5 text-xs font-bold py-1 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-white/50 hover:text-white border border-white/10 transition-colors cursor-pointer"
                    >
                      <Share2 className="w-3 h-3" />
                      Collaborators
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="px-6 md:px-8 mt-8 max-w-6xl mx-auto">
            <div className="flex flex-col">
              <div className="hidden sm:flex items-center px-4 py-2 text-xs font-semibold text-white/40 uppercase tracking-wider border-b border-white/5 mb-2">
                <div className="w-8">#</div>
                <div className="flex-1">Title</div>
                <div className={isOwner ? 'w-20' : 'w-10'}></div>
              </div>

              {reorderMode ? (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="text-xs text-white/40">Drag rows or use the arrows to reorder, then save.</span>
                    <div className="flex-1" />
                    {orderResult && <span className={`text-xs ${orderResult.ok ? 'text-green-400' : 'text-red-400'}`}>{orderResult.msg}</span>}
                    <button
                      onClick={() => { setReorderMode(false); setOrderResult(null); }}
                      disabled={savingOrder}
                      className="text-xs font-bold py-1 px-3 rounded-lg border border-white/10 text-white/60 hover:bg-white/5 disabled:opacity-40 cursor-pointer"
                    >Cancel</button>
                    <button
                      onClick={() => doSaveOrder(selectedGroup)}
                      disabled={savingOrder}
                      className="flex items-center gap-1.5 text-xs font-bold py-1 px-3 rounded-lg bg-[var(--theme-color)] text-black hover:opacity-90 disabled:opacity-40 cursor-pointer"
                    >
                      {savingOrder ? <Loader2 className="w-3 h-3 animate-spin" /> : <ListOrdered className="w-3 h-3" />}
                      Save order
                    </button>
                  </div>
                  {orderDraft.map((song, i) => {
                    const fn = songFilename(song);
                    const dName = meta.songs?.[fn]?.displayName || song.name;
                    return (
                      <div
                        key={song.url || i}
                        draggable={!savingOrder}
                        onDragStart={() => setDragIndex(i)}
                        onDragEnd={() => setDragIndex(null)}
                        onDragOver={e => {
                          e.preventDefault();
                          if (dragIndex === null || dragIndex === i) return;
                          setOrderDraft(prev => {
                            const n = [...prev];
                            const [it] = n.splice(dragIndex, 1);
                            n.splice(i, 0, it);
                            return n;
                          });
                          setDragIndex(i);
                        }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md border transition-colors cursor-grab active:cursor-grabbing ${dragIndex === i ? 'border-[var(--theme-color)]/40 bg-[var(--theme-color)]/10' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}
                      >
                        <GripVertical className="w-4 h-4 text-white/30 shrink-0" />
                        <span className="w-6 text-xs font-mono text-white/40 shrink-0">{i + 1}</span>
                        <span className="flex-1 text-sm text-white truncate">{dName}</span>
                        <button
                          onClick={() => setOrderDraft(prev => { if (i <= 0) return prev; const n = [...prev]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })}
                          disabled={i === 0}
                          className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-white/50 hover:text-white disabled:opacity-20 disabled:cursor-default cursor-pointer"
                          title="Move up"
                        ><ArrowUp className="w-3.5 h-3.5" /></button>
                        <button
                          onClick={() => setOrderDraft(prev => { if (i >= prev.length - 1) return prev; const n = [...prev]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n; })}
                          disabled={i === orderDraft.length - 1}
                          className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-white/50 hover:text-white disabled:opacity-20 disabled:cursor-default cursor-pointer"
                          title="Move down"
                        ><ArrowDown className="w-3.5 h-3.5" /></button>
                      </div>
                    );
                  })}
                </div>
              ) : filteredSongs.map((song, i) => {
                const isCurrentSong = currentSong?.url === song.url;
                const isCurrentPlaying = isCurrentSong && isPlaying;
                // Get the R2 key from the URL
                const songKey = song.url ? decodeURIComponent(song.url.replace('/api/yedits-file?key=', '')) : '';
                const filename = songKey.split('/').pop() ?? '';
                const songMeta = meta.songs?.[filename];
                const displayName = songMeta?.displayName || song.name;
                const isRenaming = renamingSongKey === songKey;
                const isNotes = notesSongKey === songKey;
                const isReplacing = replacingSongKey === songKey;

                const isSelected = !!song.url && selectedSongs.has(song.url);

                return (
                  <div key={song.url} className="flex flex-col">
                    <div
                      onClick={() => {
                        if (selectMode && song.url) {
                          setSelectedSongs(prev => {
                            const next = new Set(prev);
                            if (next.has(song.url!)) next.delete(song.url!);
                            else next.add(song.url!);
                            return next;
                          });
                        } else if (!isRenaming && !isNotes) {
                          onPlaySong(song, era, filteredSongs);
                        }
                      }}
                      className={`group flex items-center px-4 py-2.5 rounded-md transition-colors cursor-pointer hover:bg-white/5 ${isCurrentSong && !selectMode ? 'bg-white/5' : ''} ${isSelected ? 'bg-[var(--theme-color)]/10' : ''}`}
                    >
                      {selectMode && song.url && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          onClick={e => e.stopPropagation()}
                          className="mr-2 w-3.5 h-3.5 accent-[var(--theme-color)] shrink-0 cursor-pointer"
                        />
                      )}
                      <div className={`w-8 text-sm font-mono flex items-center ${isCurrentSong ? 'text-[var(--theme-color)]' : 'text-white/40 group-hover:text-white'}`}>
                        <span className="group-hover:hidden">
                          {isCurrentSong
                            ? <Volume2 className={`w-4 h-4 ${isCurrentPlaying ? 'animate-pulse' : ''}`} />
                            : (i + 1)}
                        </span>
                        <Play className="w-4 h-4 hidden group-hover:block" />
                      </div>

                      <div className="flex-1 min-w-0 pr-4">
                        <div className={`font-medium truncate ${isCurrentSong ? 'text-[var(--theme-color)]' : 'text-white'}`}>
                          {displayName}
                        </div>
                        {songMeta?.notes && (
                          <div className="text-xs text-white/30 truncate">{songMeta.notes}</div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {(meta.allowDownload !== false) && (
                          <a
                            href={song.url}
                            download
                            onClick={e => e.stopPropagation()}
                            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/40 hover:text-white/80"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        )}
                        {isOwner && song.url && (
                          <>
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                // Copy direct URL to clipboard
                                navigator.clipboard.writeText(window.location.origin + song.url!).catch(() => {});
                              }}
                              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors cursor-pointer"
                              title="Copy link"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                setDeleteSongResult(null);
                                setDeleteSongKey(songKey);
                              }}
                              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-600/30 text-white/40 hover:text-red-400 transition-colors cursor-pointer"
                              title="Delete track"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Owner action row */}
                    {isOwner && !selectMode && (
                      <div className="flex items-center gap-2 px-4 pb-2 ml-8">
                        {/* Rename */}
                        {isRenaming ? (
                          <div className="flex items-center gap-1.5 flex-1" onClick={e => e.stopPropagation()}>
                            <input
                              autoFocus
                              className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-0.5 text-xs text-white outline-none focus:border-[var(--theme-color)]"
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') doRenameSong(selectedGroup);
                                if (e.key === 'Escape') { setRenamingSongKey(null); setRenameResult(null); }
                              }}
                            />
                            <button
                              onClick={() => doRenameSong(selectedGroup)}
                              disabled={renamingInProgress}
                              className="text-xs px-2 py-0.5 rounded bg-[var(--theme-color)]/20 text-[var(--theme-color)] hover:bg-[var(--theme-color)]/30 disabled:opacity-40 cursor-pointer"
                            >
                              {renamingInProgress ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                            </button>
                            <button
                              onClick={() => { setRenamingSongKey(null); setRenameResult(null); }}
                              className="text-white/30 hover:text-white cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                            {renameResult && (
                              <span className={`text-[10px] ${renameResult.ok ? 'text-green-400' : 'text-red-400'}`}>{renameResult.msg}</span>
                            )}
                          </div>
                        ) : (
                          <button
                            onClick={e => { e.stopPropagation(); setRenameValue(filename); setRenamingSongKey(songKey); setRenameResult(null); }}
                            className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 transition-colors cursor-pointer"
                            title="Rename"
                          >
                            <FileEdit className="w-3 h-3" />
                            Rename
                          </button>
                        )}

                        {/* Replace */}
                        {!isRenaming && (
                          <>
                            <span className="text-white/10">·</span>
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                setReplacingSongKey(songKey);
                                replaceFileRef.current?.click();
                              }}
                              disabled={replacingInProgress && isReplacing}
                              className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 transition-colors cursor-pointer disabled:opacity-40"
                              title="Replace file"
                            >
                              {replacingInProgress && isReplacing
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <RefreshCw className="w-3 h-3" />}
                              Replace
                            </button>
                          </>
                        )}

                        {/* Notes */}
                        {!isRenaming && (
                          <>
                            <span className="text-white/10">·</span>
                            {isNotes ? (
                              <div className="flex items-center gap-1.5 flex-1" onClick={e => e.stopPropagation()}>
                                <textarea
                                  autoFocus
                                  rows={2}
                                  className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-0.5 text-xs text-white outline-none focus:border-[var(--theme-color)] resize-none"
                                  value={notesValue}
                                  onChange={e => setNotesValue(e.target.value)}
                                  placeholder="Add notes…"
                                />
                                <button
                                  onClick={() => doSaveNotes(selectedGroup, filename)}
                                  disabled={savingNotes}
                                  className="text-xs px-2 py-0.5 rounded bg-[var(--theme-color)]/20 text-[var(--theme-color)] hover:bg-[var(--theme-color)]/30 disabled:opacity-40 cursor-pointer"
                                >
                                  {savingNotes ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save'}
                                </button>
                                <button
                                  onClick={() => setNotesSongKey(null)}
                                  className="text-white/30 hover:text-white cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={e => { e.stopPropagation(); setNotesValue(songMeta?.notes ?? ''); setNotesSongKey(songKey); }}
                                className="flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 transition-colors cursor-pointer"
                                title="Add notes"
                              >
                                <Pencil className="w-3 h-3" />
                                Notes
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>

        {/* Hidden replace file input */}
        <input
          ref={replaceFileRef}
          type="file"
          accept={AUDIO_ACCEPT}
          className="hidden"
          onChange={e => {
            const f = e.target.files?.[0];
            if (f && replacingSongKey) doReplaceSong(selectedGroup, replacingSongKey, f);
            e.target.value = '';
          }}
        />

        {/* Delete song confirm modal */}
        {deleteSongKey && typeof document !== 'undefined' && createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => { if (!deletingSong) { setDeleteSongKey(null); setDeleteSongResult(null); } }}
          >
            <div className="bg-[#111] border border-white/10 rounded-xl w-full max-w-sm p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-white">Delete Track</h3>
                <button onClick={() => { if (!deletingSong) { setDeleteSongKey(null); setDeleteSongResult(null); } }} className="text-white/40 hover:text-white cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-white/60 mb-1">
                Delete <span className="text-white font-semibold">{deleteSongKey.split('/').pop()?.replace(/\.[^.]+$/, '')}</span>?
              </p>
              <p className="text-xs text-white/30 mb-5">This cannot be undone.</p>
              {deleteSongResult && (
                <p className={`text-xs text-center mb-3 ${deleteSongResult.ok ? 'text-green-400' : 'text-red-400'}`}>{deleteSongResult.msg}</p>
              )}
              <div className="flex gap-3">
                <button
                  onClick={() => { if (!deletingSong) { setDeleteSongKey(null); setDeleteSongResult(null); } }}
                  disabled={deletingSong}
                  className="flex-1 py-2 rounded-lg border border-white/10 text-white/60 text-xs font-bold hover:bg-white/5 disabled:opacity-40 transition-colors cursor-pointer"
                >Cancel</button>
                <button
                  onClick={() => doDeleteSong(deleteSongKey)}
                  disabled={deletingSong}
                  className="flex-1 py-2 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-500 disabled:opacity-40 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {deletingSong ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Deleting…</> : <><Trash2 className="w-3.5 h-3.5" /> Delete</>}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Add tracks modal */}
        {showAddTracks && typeof document !== 'undefined' && createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => { if (!addingTracks) { setShowAddTracks(false); setAddTrackFiles([]); setAddTracksResult(null); } }}
          >
            <div className="bg-[#111] border border-white/10 rounded-xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-bold text-white">Add Tracks</h3>
                <button onClick={() => { if (!addingTracks) { setShowAddTracks(false); setAddTrackFiles([]); setAddTracksResult(null); } }} className="text-white/40 hover:text-white cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-white/40 mb-4">Adding to <span className="text-white/70">{selectedGroup.displayName}</span></p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Audio Files</label>
                  <div
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm cursor-pointer hover:bg-white/8 transition-colors"
                    onClick={() => !addingTracks && addTracksInputRef.current?.click()}
                  >
                    {addTrackFiles.length > 0
                      ? <span className="text-white/80">{addTrackFiles.length} file{addTrackFiles.length !== 1 ? 's' : ''} selected — click to add more</span>
                      : <span className="text-white/40">Choose audio files…</span>}
                  </div>
                  <input ref={addTracksInputRef} type="file" accept={AUDIO_ACCEPT} multiple className="hidden"
                    onChange={e => {
                      const files = Array.from(e.target.files ?? []);
                      e.target.value = '';
                      if (files.length) setAddTrackFiles(prev => [...prev, ...files]);
                    }} />
                  {addTrackFiles.length > 0 && (
                    <ul className="mt-1 space-y-1 max-h-40 overflow-y-auto">
                      {addTrackFiles.map((f, idx) => {
                        const prog = addTracksProgress[f.name];
                        return (
                          <li key={idx} className="px-1">
                            <div className="flex items-center gap-2 text-xs text-white/60">
                              <span className="flex-1 truncate">{f.name}</span>
                              {prog?.status === 'done' && <span className="text-green-400 text-[10px] shrink-0">Done</span>}
                              {prog?.status === 'error' && <span className="text-red-400 text-[10px] shrink-0">Failed</span>}
                              {prog?.status === 'uploading' && <span className="text-white/40 text-[10px] shrink-0">{prog.pct}%</span>}
                              {!addingTracks && (
                                <button
                                  type="button"
                                  onClick={() => setAddTrackFiles(prev => prev.filter((_, i) => i !== idx))}
                                  className="text-white/30 hover:text-white/70 shrink-0 cursor-pointer"
                                ><X className="w-3 h-3" /></button>
                              )}
                            </div>
                            {addingTracks && prog && (
                              <div className="h-1 w-full bg-white/10 rounded-full mt-1 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${prog.status === 'error' ? 'bg-red-400' : 'bg-[var(--theme-color)]'}`}
                                  style={{ width: `${prog.status === 'done' ? 100 : prog.pct}%` }}
                                />
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
                {addTracksResult && (
                  <p className={`text-xs text-center ${addTracksResult.ok ? 'text-green-400' : 'text-red-400'}`}>{addTracksResult.msg}</p>
                )}
                <button
                  onClick={() => doAddTracks(selectedGroup)}
                  disabled={addingTracks || addTrackFiles.length === 0}
                  className="w-full py-2.5 rounded-lg bg-[var(--theme-color)] text-black text-xs font-bold hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer flex items-center justify-center gap-2"
                >
                  {addingTracks ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</> : <><Upload className="w-3.5 h-3.5" /> Upload Tracks</>}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Change cover modal */}
        {showChangeCover && typeof document !== 'undefined' && createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => { if (!changingCover) { setShowChangeCover(false); setNewCoverFile(null); setChangeCoverResult(null); } }}
          >
            <div className="bg-[#111] border border-white/10 rounded-xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-bold text-white">Change Cover Art</h3>
                <button onClick={() => { if (!changingCover) { setShowChangeCover(false); setNewCoverFile(null); setChangeCoverResult(null); } }} className="text-white/40 hover:text-white cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-white/40 mb-1 block">New Cover Image</label>
                  <div
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm cursor-pointer hover:bg-white/8 transition-colors flex items-center gap-2"
                    onClick={() => !changingCover && changeCoverInputRef.current?.click()}
                  >
                    {newCoverFile
                      ? <span className="text-white/80 truncate">{newCoverFile.name}</span>
                      : <span className="text-white/40">Choose image…</span>}
                  </div>
                  <input ref={changeCoverInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => setNewCoverFile(e.target.files?.[0] ?? null)} />
                </div>
                {changeCoverResult && (
                  <p className={`text-xs text-center ${changeCoverResult.ok ? 'text-green-400' : 'text-red-400'}`}>{changeCoverResult.msg}</p>
                )}
                <button
                  onClick={() => doChangeCover(selectedGroup)}
                  disabled={changingCover || !newCoverFile}
                  className="w-full py-2.5 rounded-lg bg-[var(--theme-color)] text-black text-xs font-bold hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer flex items-center justify-center gap-2"
                >
                  {changingCover ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</> : <><ImagePlus className="w-3.5 h-3.5" /> Update Cover</>}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Manage Collaborators modal */}
        {showCollaborators && typeof document !== 'undefined' && createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => { if (!collaboratorsBusy) setShowCollaborators(false); }}
          >
            <div className="bg-[#111] border border-white/10 rounded-xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-bold text-white">Collaborators</h3>
                <button onClick={() => { if (!collaboratorsBusy) setShowCollaborators(false); }} className="text-white/40 hover:text-white cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <p className="text-xs text-white/40">
                  Collaborators can edit, rename, and delete tracks on {selectedGroup.parentName}'s projects.
                </p>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {(collaborators[selectedGroup.parentName] ?? []).length === 0 ? (
                    <p className="text-xs text-white/30">No collaborators yet.</p>
                  ) : (
                    (collaborators[selectedGroup.parentName] ?? []).map(name => (
                      <div key={name} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                        <span className="text-sm text-white/80">{name}</span>
                        <button
                          onClick={() => removeCollaborator(selectedGroup.parentName, name)}
                          disabled={collaboratorsBusy}
                          className="text-white/30 hover:text-red-400 transition-colors cursor-pointer disabled:opacity-40"
                          title="Remove collaborator"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[var(--theme-color)] transition-colors"
                    placeholder="Username"
                    value={newCollaborator}
                    onChange={e => setNewCollaborator(e.target.value)}
                    disabled={collaboratorsBusy}
                    onKeyDown={e => { if (e.key === 'Enter') addCollaborator(selectedGroup.parentName); }}
                  />
                  <button
                    onClick={() => addCollaborator(selectedGroup.parentName)}
                    disabled={collaboratorsBusy || !newCollaborator.trim()}
                    className="px-4 rounded-lg bg-[var(--theme-color)] text-black text-xs font-bold hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer flex items-center justify-center"
                  >
                    {collaboratorsBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  </button>
                </div>
                {collaboratorsResult && (
                  <p className={`text-xs text-center ${collaboratorsResult.ok ? 'text-green-400' : 'text-red-400'}`}>{collaboratorsResult.msg}</p>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

        {/* Edit Project Info modal */}
        {showEditMeta && typeof document !== 'undefined' && createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => { if (!savingMeta) { setShowEditMeta(false); setSaveMetaResult(null); } }}
          >
            <div className="bg-[#111] border border-white/10 rounded-xl w-full max-w-md p-6 shadow-2xl overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-bold text-white">Edit Project Info</h3>
                <button onClick={() => { if (!savingMeta) { setShowEditMeta(false); setSaveMetaResult(null); } }} className="text-white/40 hover:text-white cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Project Name</label>
                  <input
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[var(--theme-color)] transition-colors"
                    placeholder="Project name…"
                    value={editMetaProjectName}
                    onChange={e => setEditMetaProjectName(e.target.value)}
                    disabled={savingMeta}
                  />
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Credited Artist</label>
                  <input
                    list="yedits-creator-list"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[var(--theme-color)] transition-colors"
                    placeholder="Artist this album is credited to…"
                    value={editMetaCreditedArtist}
                    onChange={e => setEditMetaCreditedArtist(e.target.value)}
                    disabled={savingMeta}
                  />
                  <datalist id="yedits-creator-list">
                    {existingCreators.map(name => <option key={name} value={name} />)}
                  </datalist>
                  {editMetaCreditedArtist.trim() && editMetaCreditedArtist.trim() !== selectedGroup.parentName && (
                    <p className="text-[10px] text-white/30 mt-1">
                      Moves this album from <span className="text-white/50">{selectedGroup.parentName}</span> to <span className="text-[var(--theme-color)]">{editMetaCreditedArtist.trim()}</span>.
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Source Artist</label>
                  <ArtistSelect value={editMetaSourceArtist} onChange={setEditMetaSourceArtist} disabled={savingMeta} />
                </div>
                {editMetaSourceArtist && (
                  <div>
                    <label className="text-xs text-white/40 mb-1 block">Source Era / Album</label>
                    <EraSelect artistLabel={editMetaSourceArtist} value={editMetaSourceEra} onChange={setEditMetaSourceEra} disabled={savingMeta} />
                  </div>
                )}
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Description</label>
                  <textarea
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[var(--theme-color)] transition-colors resize-none"
                    placeholder="Project description…"
                    value={editMetaDescription}
                    onChange={e => setEditMetaDescription(e.target.value)}
                    disabled={savingMeta}
                  />
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Samply URL</label>
                  <input
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[var(--theme-color)] transition-colors"
                    placeholder="https://samply.app/p/..."
                    value={editMetaSamplyUrl}
                    onChange={e => setEditMetaSamplyUrl(e.target.value)}
                    disabled={savingMeta}
                  />
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Untitled URL</label>
                  <input
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[var(--theme-color)] transition-colors"
                    placeholder="https://untitled.stream/library/project/..."
                    value={editMetaUntitledUrl}
                    onChange={e => setEditMetaUntitledUrl(e.target.value)}
                    disabled={savingMeta}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <input
                    id="edit-allow-download"
                    type="checkbox"
                    checked={editMetaAllowDownload}
                    onChange={e => setEditMetaAllowDownload(e.target.checked)}
                    disabled={savingMeta}
                    className="w-4 h-4 accent-[var(--theme-color)]"
                  />
                  <label htmlFor="edit-allow-download" className="text-sm text-white/60 cursor-pointer">Allow track downloads</label>
                </div>
                {saveMetaResult && (
                  <p className={`text-xs text-center ${saveMetaResult.ok ? 'text-green-400' : 'text-red-400'}`}>{saveMetaResult.msg}</p>
                )}
                <button
                  onClick={() => doSaveMeta(selectedGroup)}
                  disabled={savingMeta}
                  className="w-full py-2.5 rounded-lg bg-[var(--theme-color)] text-black text-xs font-bold hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer flex items-center justify-center gap-2"
                >
                  {savingMeta ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</> : 'Save Changes'}
                </button>
                <button
                  onClick={() => { setShowEditMeta(false); setDeleteResult(null); setDeleteTarget(selectedGroup); }}
                  disabled={savingMeta}
                  className="w-full py-2.5 rounded-lg bg-red-600/10 hover:bg-red-600/20 text-red-400 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 border border-red-600/20"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Project
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
      </>
    );
  }

  // GRID VIEW
  return (
    <motion.div
      key="yedits-grid"
      initial={{ opacity: 0, filter: 'blur(10px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, filter: 'blur(10px)' }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="p-6 md:p-8 pb-32 space-y-8"
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-xs uppercase tracking-widest text-white/40 font-bold">Yedit Affiliates</h2>
        <div className="flex items-center gap-2">
          {isAdmin && groups.some(g => g.readOnly) && (
            <button
              onClick={doMigrateLabel}
              disabled={migrating}
              className="flex items-center gap-1.5 text-xs font-bold py-1.5 px-3 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/10 transition-colors cursor-pointer disabled:opacity-50"
              title="Copy the built-in UNVAULTED Records catalog into the uploads bucket so it becomes editable"
            >
              {migrating ? <Loader2 className="w-3 h-3 animate-spin" /> : <PackageOpen className="w-3 h-3" />}
              {migrating ? (migrateStatus || 'Importing…') : `Import ${LABEL_NAME}`}
            </button>
          )}
          {vgUser && (
            <button
              onClick={openUpload}
              className="flex items-center gap-1.5 text-xs font-bold py-1.5 px-3 rounded-lg bg-[var(--theme-color)]/10 hover:bg-[var(--theme-color)]/20 text-[var(--theme-color)] border border-[var(--theme-color)]/20 transition-colors cursor-pointer"
            >
              <Upload className="w-3 h-3" />
              Upload
            </button>
          )}
        </div>
      </div>
      {migrateResult && (
        <p className={`text-xs ${migrateResult.ok ? 'text-green-400' : 'text-red-400'}`}>{migrateResult.msg}</p>
      )}

      {/* Creators section */}
      {creators.length > 0 && (
        <div>
          <h2 className="text-xs uppercase tracking-widest text-white/40 font-bold mb-4">Creators</h2>
          <div className="flex flex-wrap gap-3">
            {creators.map((creator, i) => {
              const isActive = selectedCreator === creator.name;
              const isLabel = isPinnedCreator(creator.name);
              return (
                <motion.button
                  key={creator.name}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => setSelectedCreator(isActive ? null : creator.name)}
                  style={isLabel ? { boxShadow: '0 0 0 1px rgba(36,143,245,0.5), 0 0 12px 2px rgba(36,143,245,0.45)' } : undefined}
                  className={`flex items-center gap-3 pl-1 pr-4 py-1 rounded-full border transition-all cursor-pointer ${
                    isLabel
                      ? 'bg-[#248ff5]/10 border-[#248ff5]/50 text-white'
                      : isActive
                      ? 'bg-[var(--theme-color)]/15 border-[var(--theme-color)]/40 text-white'
                      : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:text-white hover:border-white/20'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-white/10 shrink-0">
                    {creator.previewImage ? (
                      <Img w={200} src={creator.previewImage} alt={creator.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-white/30">
                        {creator.name[0]}
                      </div>
                    )}
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-1.5">
                      <div className={`text-sm font-semibold leading-tight ${isActive ? 'text-[var(--theme-color)]' : ''}`}>
                        {creator.name}
                      </div>
                      {claims[creator.name] && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--theme-color)]/15 text-[var(--theme-color)] border border-[var(--theme-color)]/30 leading-none">
                          ✓
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-white/40">
                      {creator.albumCount} album{creator.albumCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      )}

      {/* Albums grid */}
      <div>
        {selectedCreator && (
          <h2 className="text-xs uppercase tracking-widest text-white/40 font-bold mb-4">{selectedCreator}</h2>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
      {filteredGroups.length === 0 ? (
        <div className="col-span-full text-center text-white/30 text-sm py-20">
          {groups.length === 0 ? 'No content in bucket yet.' : 'No results for that search.'}
        </div>
      ) : (
        filteredGroups.map((group, i) => (
          <motion.div
            key={group.folderPath}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.02, 0.5), duration: 0.3 }}
            onClick={() => setSelectedGroup(group)}
            className="group flex flex-col gap-3 cursor-pointer"
          >
            <div className="relative aspect-square rounded-md overflow-hidden bg-white/5 border border-white/5 group-hover:border-white/20 transition-colors">
              {group.imageUrl ? (
                <Img w={300}
                  src={group.imageUrl}
                  alt={group.displayName}
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-white/5 text-white/20 font-bold text-xl text-center p-4">
                  {group.displayName}
                </div>
              )}
              {(() => {
                const claimEntry = claims[group.parentName];
                const isGroupOwner = isAdmin || (!!vgUser && (
                  group.parentName.toLowerCase() === vgUser.username.toLowerCase() ||
                  claimEntry?.userId === vgUser.id
                ));
                const isClaimed = !!claimEntry;
                return (
                  <>
                    {!isClaimed && !group.readOnly && onClaim && vgUser && !isGroupOwner && !isAdmin && (
                      <button
                        onClick={e => { e.stopPropagation(); onClaim(group.parentName); }}
                        className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 px-2 h-6 rounded-full bg-black/70 hover:bg-[var(--theme-color)]/80 text-white/60 hover:text-white backdrop-blur-sm cursor-pointer text-[10px] font-semibold"
                        title="Claim this profile"
                      >
                        Claim
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
            <div>
              <h3 className="text-sm font-bold text-white group-hover:underline truncate">
                {group.displayName}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                {group.parentName && (
                  <p className="text-white/50 text-xs truncate">{group.parentName}</p>
                )}
                <p className="text-white/30 text-xs shrink-0">{group.songs.length} tracks</p>
              </div>
            </div>
          </motion.div>
        ))
      )}
        </div>
      </div>

      {/* Upload modal */}
      {showUpload && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => { if (!uploading) setShowUpload(false); }}
        >
          <div
            className="bg-[#111] border border-white/10 rounded-xl w-full max-w-md p-6 shadow-2xl overflow-y-auto max-h-[90vh]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-white">Upload to Yedit Affiliates</h3>
              <button
                onClick={() => { if (!uploading) setShowUpload(false); }}
                className="text-white/40 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/40 mb-1 block">Creator Name</label>
                {isAdmin && existingCreators.length > 0 ? (
                  <div className="space-y-1.5">
                    <select
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[var(--theme-color)] transition-colors cursor-pointer"
                      value={existingCreators.includes(uploadCreator) ? uploadCreator : '__new__'}
                      onChange={e => {
                        if (e.target.value === '__new__') setUploadCreator('');
                        else setUploadCreator(e.target.value);
                      }}
                      disabled={uploading}
                    >
                      <option value="__new__">＋ New creator…</option>
                      {existingCreators.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                    {!existingCreators.includes(uploadCreator) && (
                      <input
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[var(--theme-color)] transition-colors"
                        placeholder="New creator name"
                        value={uploadCreator}
                        onChange={e => setUploadCreator(e.target.value)}
                        disabled={uploading}
                      />
                    )}
                  </div>
                ) : (
                  <input
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[var(--theme-color)] transition-colors"
                    placeholder="Your name / handle"
                    value={uploadCreator}
                    onChange={e => setUploadCreator(e.target.value)}
                    disabled={uploading}
                  />
                )}
              </div>

              <div>
                <label className="text-xs text-white/40 mb-1 block">Project / Album Name</label>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[var(--theme-color)] transition-colors"
                  placeholder="Name of your yedit project"
                  value={uploadAlbum}
                  onChange={e => setUploadAlbum(e.target.value)}
                  disabled={uploading}
                />
              </div>

              <div>
                <label className="text-xs text-white/40 mb-1 block">Source Artist</label>
                <ArtistSelect value={uploadSourceArtist} onChange={setUploadSourceArtist} disabled={uploading} />
              </div>

              {uploadSourceArtist && (
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Source Era / Album</label>
                  <EraSelect artistLabel={uploadSourceArtist} value={uploadSourceEra} onChange={setUploadSourceEra} disabled={uploading} />
                </div>
              )}

              <div>
                <label className="text-xs text-white/40 mb-1 block">Description <span className="text-white/20">(optional)</span></label>
                <textarea
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[var(--theme-color)] transition-colors resize-none"
                  placeholder="Project description…"
                  value={uploadDescription}
                  onChange={e => setUploadDescription(e.target.value)}
                  disabled={uploading}
                />
              </div>

              <div>
                <label className="text-xs text-white/40 mb-1 block">Samply URL <span className="text-white/20">(optional)</span></label>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[var(--theme-color)] transition-colors"
                  placeholder="https://samply.app/p/..."
                  value={uploadSamplyUrl}
                  onChange={e => setUploadSamplyUrl(e.target.value)}
                  disabled={uploading}
                />
              </div>

              <div>
                <label className="text-xs text-white/40 mb-1 block">Untitled URL <span className="text-white/20">(optional)</span></label>
                <input
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[var(--theme-color)] transition-colors"
                  placeholder="https://untitled.stream/library/project/..."
                  value={uploadUntitledUrl}
                  onChange={e => setUploadUntitledUrl(e.target.value)}
                  disabled={uploading}
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  id="upload-allow-download"
                  type="checkbox"
                  checked={uploadAllowDownload}
                  onChange={e => setUploadAllowDownload(e.target.checked)}
                  disabled={uploading}
                  className="w-4 h-4 accent-[var(--theme-color)]"
                />
                <label htmlFor="upload-allow-download" className="text-sm text-white/60 cursor-pointer">Allow track downloads</label>
              </div>

              <div>
                <label className="text-xs text-white/40 mb-1 block">Cover Art <span className="text-white/20">(optional)</span></label>
                <div
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm cursor-pointer hover:bg-white/8 transition-colors flex items-center gap-2"
                  onClick={() => !uploading && coverInputRef.current?.click()}
                >
                  {uploadCover
                    ? <span className="text-white/80 truncate">{uploadCover.name}</span>
                    : <span className="text-white/40">Choose image…</span>}
                </div>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => setUploadCover(e.target.files?.[0] ?? null)}
                />
              </div>

              <div>
                <label className="text-xs text-white/40 mb-1 block">
                  Tracks <span className="text-white/20">(audio files, multiple allowed)</span>
                </label>
                <div
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm cursor-pointer hover:bg-white/8 transition-colors"
                  onClick={() => !uploading && tracksInputRef.current?.click()}
                >
                  {uploadTracks.length > 0
                    ? <span className="text-white/80">{uploadTracks.length} file{uploadTracks.length !== 1 ? 's' : ''} selected — click to add more</span>
                    : <span className="text-white/40">Choose audio files…</span>}
                </div>
                <input
                  ref={tracksInputRef}
                  type="file"
                  accept={AUDIO_ACCEPT}
                  multiple
                  className="hidden"
                  onChange={e => {
                    const files = Array.from(e.target.files ?? []);
                    e.target.value = '';
                    if (files.length) setUploadTracks(prev => [...prev, ...files]);
                  }}
                />
                {uploadTracks.length > 0 && (
                  <ul className="mt-1 space-y-1 max-h-40 overflow-y-auto">
                    {uploadTracks.map((f, idx) => {
                      const prog = uploadProgress[f.name];
                      return (
                        <li key={idx} className="px-1">
                          <div className="flex items-center gap-2 text-xs text-white/60">
                            <span className="flex-1 truncate">{f.name}</span>
                            {prog?.status === 'done' && <span className="text-green-400 text-[10px] shrink-0">Done</span>}
                            {prog?.status === 'error' && <span className="text-red-400 text-[10px] shrink-0">Failed</span>}
                            {prog?.status === 'uploading' && <span className="text-white/40 text-[10px] shrink-0">{prog.pct}%</span>}
                            {!uploading && (
                              <button
                                type="button"
                                onClick={() => setUploadTracks(prev => prev.filter((_, i) => i !== idx))}
                                className="text-white/30 hover:text-white/70 shrink-0 cursor-pointer"
                              ><X className="w-3 h-3" /></button>
                            )}
                          </div>
                          {uploading && prog && (
                            <div className="h-1 w-full bg-white/10 rounded-full mt-1 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${prog.status === 'error' ? 'bg-red-400' : 'bg-[var(--theme-color)]'}`}
                                style={{ width: `${prog.status === 'done' ? 100 : prog.pct}%` }}
                              />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {uploadResult && (
                <p className={`text-xs text-center ${uploadResult.ok ? 'text-green-400' : 'text-red-400'}`}>
                  {uploadResult.msg}
                </p>
              )}

              <button
                onClick={doUpload}
                disabled={uploading || !uploadCreator.trim() || !uploadAlbum.trim() || uploadTracks.length === 0}
                className="w-full py-2.5 rounded-lg bg-[var(--theme-color)] text-black text-xs font-bold hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer flex items-center justify-center gap-2"
              >
                {uploading
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</>
                  : <><Upload className="w-3.5 h-3.5" /> Upload</>}
              </button>

              <p className="text-[10px] text-white/20 text-center">
                Uploads are public and visible to all users. Only share content you have permission to upload.
              </p>
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* Delete confirm modal */}
      {deleteTarget && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => { if (!deleting) { setDeleteTarget(null); setDeleteResult(null); } }}
        >
          <div
            className="bg-[#111] border border-white/10 rounded-xl w-full max-w-sm p-6 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">Delete Project</h3>
              <button
                onClick={() => { if (!deleting) { setDeleteTarget(null); setDeleteResult(null); } }}
                className="text-white/40 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-white/60 mb-1">
              Delete <span className="text-white font-semibold">{deleteTarget.displayName}</span>?
            </p>
            <p className="text-xs text-white/30 mb-5">
              This will permanently remove all {deleteTarget.songs.length} track{deleteTarget.songs.length !== 1 ? 's' : ''} and cover art. This cannot be undone.
            </p>

            {deleteResult && (
              <p className={`text-xs text-center mb-3 ${deleteResult.ok ? 'text-green-400' : 'text-red-400'}`}>
                {deleteResult.msg}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { if (!deleting) { setDeleteTarget(null); setDeleteResult(null); } }}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg border border-white/10 text-white/60 text-xs font-bold hover:bg-white/5 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => doDelete(deleteTarget)}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-500 disabled:opacity-40 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                {deleting
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Deleting…</>
                  : <><Trash2 className="w-3.5 h-3.5" /> Delete</>}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </motion.div>
  );
}
