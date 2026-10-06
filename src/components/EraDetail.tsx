import { Fragment } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Play, ExternalLink, X, Share2, Volume2, Check, Download, Loader2, Film, Disc3, Layers, Star, Pencil, CheckSquare, Square, ListMusic, Plus } from 'lucide-react';
import { SiYoutube } from 'react-icons/si';
import { Era, Song, SearchFilters } from '../types';
import { useState, useMemo, useEffect } from 'react';
import { formatTextWithTags, getCleanSongNameWithTags, matchesFilters, createSlug, getSongSlug, ALBUM_RELEASE_DATES, isSongNotAvailable, looksLikeRealLink, ALBUM_DESCRIPTIONS, ERA_DISCLAIMERS, HIDDEN_ALBUMS, CUSTOM_IMAGES, getArtistName, buildArtistTag, buildTitleTag, buildDownloadName, handleDownloadFile, resolveUrl, detectAudioExt, embedID3Tags, embedFLACTags, flacToWav, embedWAVTags, formatTextForNotification, parseNoteDescription, ERA_THEMES , Img, sanitizeFilename, runWithConcurrencyLimit} from '../utils';
import { activeConfig } from '../artists/activeConfig';
import { eraArtwork } from '../eraArtwork';
import { addItemsToGlobalTierList, readGlobalTierLists } from '../tierListStore';
import { SongTitle, SongExtra } from './SongTitle';
import { saveAs } from 'file-saver';
import { useSettings } from '../SettingsContext';
import { useDownloadManager } from '../DownloadManagerContext';
import { isLastfmLoggedIn } from '../lastfm';
import { SiLastdotfm } from 'react-icons/si';
import { MvEntry, RemixEntry, SampleEntry } from '../App';
import { AddToPlaylistButton } from './AddToPlaylistButton';
import { CommentButton } from './CommentButton';
import { ReportLinkButton } from './ReportLinkButton';
import { useDeadLinks, isDeadLink } from '../linkStatus';
import { makeEntryKey, makeEraKey, baseEraName, stampSongComment } from '../comments';
import { usePlaylists } from '../PlaylistContext';
import { useIsClamped } from '../hooks/useIsClamped';

function normalizeName(name: string): string {
  return name
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\n.*/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function findMvsForSong(songName: string, eraName: string, mvData: MvEntry[]): MvEntry[] {
  const normalizedSong = normalizeName(songName);

  let currentCategory = 'Unreleased';
  const matchedMvs: { mv: MvEntry, category: string }[] = [];

  for (const mv of mvData) {
    if (mv.Name === 'Released' || mv.Name === 'Unreleased') {
      currentCategory = mv.Name;
      continue;
    }

    if (!mv.Era || !mv.Name) continue;
    if (mv.Era !== eraName) continue;

    if (mv.Name === "Can't Tell Me Nothing [Music Video]" && (!mv['Link(s)'] || mv['Link(s)'].trim() === "")) {
      mv['Link(s)'] = "https://www.youtube.com/watch?v=E58qLXBfLrs";
    }

    if (!mv['Link(s)'] || mv['Link(s)'].toLowerCase().includes('link needed') || mv['Link(s)'].toLowerCase().includes('source needed')) continue;

    const normalizedMv = normalizeName(mv.Name);
    if (!normalizedMv || !normalizedSong) {
      if (mv.Name === songName || mv.Name.includes(songName) || (songName.length > 2 && songName.includes(mv.Name))) {
         matchedMvs.push({ mv, category: currentCategory });
      }
      continue;
    }

    if (normalizedMv.includes(normalizedSong) || normalizedSong.includes(normalizedMv)) {
      matchedMvs.push({ mv, category: currentCategory });
    }
  }

  const released = matchedMvs.filter(m => m.category === 'Released');
  if (released.length > 0) {
    return released.map(m => m.mv);
  }

  return matchedMvs.map(m => m.mv);
}

export function findRemixesForSong(songName: string, eraName: string, remixData: RemixEntry[]): RemixEntry[] {
  const cleanSong = songName
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\n.*/g, '')
    .replace(/[^a-zA-Z0-9\s']/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

  if (!cleanSong || cleanSong.length < 2) return [];

  return remixData.filter(remix => {
    if (!remix.Era || remix.Era !== eraName) return false;
    const link = remix['Link(s)']?.split('\n')[0]?.trim();
    if (!link || link.toLowerCase().includes('link needed') || link.toLowerCase().includes('source needed')) return false;

    const potentials: string[] = [];

    const parenMatches = [...remix.Name.matchAll(/\(([^)]+)\)/g)];
    for (const m of parenMatches) {
      const inner = m[1].trim().toLowerCase();
      if (inner.startsWith('feat') || inner.startsWith('prod')) continue;
      potentials.push(m[1].trim());
    }

    const firstLine = remix.Name.split('\n')[0];
    const dashIdx = firstLine.indexOf(' - ');
    if (dashIdx >= 0) {
      const title = firstLine.substring(dashIdx + 3).replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim();
      if (title) potentials.push(title);
    } else {
      const title = firstLine.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim();
      if (title) potentials.push(title);
    }

    for (const potential of potentials) {
      const cleanP = potential
        .replace(/[^a-zA-Z0-9\s']/g, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
      if (!cleanP || cleanP.length < 2) continue;
      if (cleanP === cleanSong) return true;
      if (cleanSong.length >= 4 && cleanP.includes(cleanSong)) return true;
      if (cleanP.length >= 4 && cleanSong.includes(cleanP)) return true;
    }

    return false;
  });
}

export function findSamplesForSong(songName: string, eraName: string, samplesData: SampleEntry[]): SampleEntry[] {
  const cleanSong = songName
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .replace(/\n.*/g, '')
    .replace(/[^a-zA-Z0-9\s']/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

  if (!cleanSong || cleanSong.length < 2) return [];

  return samplesData.filter(sample => {
    if (!sample.Era || sample.Era !== eraName) return false;
    const link = (sample['Link(s)'] || '').split('\n')[0]?.trim();
    if (!link || link.toLowerCase().includes('link needed') || link.toLowerCase().includes('source needed')) return false;

    const sourceSongName = sample["Song Name\n(Special thanks to Isak & Jeen for their invaluable help on this page)"] || sample.Name || '';

    const potentials: string[] = [];

    const parenMatches = [...sourceSongName.matchAll(/\(([^)]+)\)/g)];
    for (const m of parenMatches) {
      const inner = m[1].trim().toLowerCase();
      if (inner.startsWith('feat') || inner.startsWith('prod')) continue;
      potentials.push(m[1].trim());
    }

    const firstLine = sourceSongName.split('\n')[0];
    const dashIdx = firstLine.indexOf(' - ');
    if (dashIdx >= 0) {
      const title = firstLine.substring(dashIdx + 3).replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim();
      if (title) potentials.push(title);
    } else {
      const title = firstLine.replace(/\(.*?\)/g, '').replace(/\[.*?\]/g, '').trim();
      if (title) potentials.push(title);
    }

    for (const potential of potentials) {
      const cleanP = potential
        .replace(/[^a-zA-Z0-9\s']/g, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
      if (!cleanP || cleanP.length < 2) continue;
      if (cleanP === cleanSong) return true;
      if (cleanSong.length >= 4 && cleanP.includes(cleanSong)) return true;
      if (cleanP.length >= 4 && cleanSong.includes(cleanP)) return true;
    }

    return false;
  });
}

// Returns the artist URL prefix (e.g. "/yzygold") when running under /:artist/ on a
// unified host, or "" when running at the root of a standalone deployment.
function getArtistUrlPrefix(): string {
  const slug = activeConfig.slug;
  if (!slug) return '';
  const prefix = `/${slug}`;
  return (window.location.pathname === prefix || window.location.pathname.startsWith(prefix + '/')) ? prefix : '';
}

export const handleShareSilent = (song: Song, era: Era): string => {
  let baseUrl = window.location.origin + window.location.pathname;

  if ((era.name === "Recent Leaks" || era.name === "Favorites") && song.realEra) {
    const isHidden = HIDDEN_ALBUMS.includes(song.realEra.name);
    const prefix = getArtistUrlPrefix();
    baseUrl = window.location.origin + prefix + (isHidden ? "/related/" : "/album/") + createSlug(song.realEra.name);
  }

  const allSongsInEra = Object.values(era.data || {}).flat();
  const songParam = getSongSlug(song, allSongsInEra);

  return `${baseUrl}?song=${songParam}`;
};

export function EraDetail({ era, onBack, onPlaySong, searchQuery = '', filters, currentSong, isPlaying, mvData = [], remixData = [], samplesData = [], favoriteKeys = [], toggleFavorite, onNavigateToEra }: { key?: string, era: Era, onBack?: () => void, onPlaySong: (song: Song, era: Era, contextTracks?: Song[]) => void, searchQuery?: string, filters: SearchFilters, currentSong?: Song | null, isPlaying?: boolean, mvData?: MvEntry[], remixData?: RemixEntry[], samplesData?: SampleEntry[], favoriteKeys?: { songName: string, eraName: string, url: string }[], toggleFavorite?: (song: Song, eraName: string) => void, onNavigateToEra?: (era: Era) => void }) {
  const { settings, updateSettings } = useSettings();
  const deadLinks = useDeadLinks(activeConfig.slug);
  const { startJob, updateJob, startItem, finishItem, finishJob } = useDownloadManager();
  const [zoomedImage, setZoomedImage] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showLatestOnly, setShowLatestOnly] = useState(false);
  const [showFirstOnly, setShowFirstOnly] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(era.name === 'Recent Leaks' ? 15 : 9999);
  const [openRemixKey, setOpenRemixKey] = useState<string | null>(null);
  const [openSampleKey, setOpenSampleKey] = useState<string | null>(null);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [descriptionRef, isDescriptionClamped] = useIsClamped<HTMLParagraphElement>(
    ALBUM_DESCRIPTIONS[era.name],
    isDescriptionExpanded,
  );
  const [editingLfmName, setEditingLfmName] = useState(false);
  const [lfmNameDraft, setLfmNameDraft] = useState('');
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [isDownloadingSelected, setIsDownloadingSelected] = useState(false);
  const [isPlaylistMenuOpen, setIsPlaylistMenuOpen] = useState(false);
  const [playlistCreating, setPlaylistCreating] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isTierMenuOpen, setIsTierMenuOpen] = useState(false);
  const [tierCreating, setTierCreating] = useState(false);
  const [newTierName, setNewTierName] = useState('');
  const [tierLists, setTierLists] = useState<{ id: string; name: string }[]>([]);
  const { playlists, addToPlaylist, createPlaylist } = usePlaylists();

  useEffect(() => {
    setVisibleCount(era.name === 'Recent Leaks' ? 15 : 9999);
    setIsDescriptionExpanded(false);
  }, [era.name]);

  const handleShare = (e: React.MouseEvent, song: Song) => {
    e.stopPropagation();

    if (settings.shareLinkType === 'pillowcase') {
      const rawUrl = song.url || (song.urls && song.urls.length > 0 ? song.urls[0] : '');
      if (rawUrl && rawUrl.includes('pillows.su/f/')) {
        navigator.clipboard.writeText(rawUrl);
        setToastMessage("Pillowcase link copied!");
        setTimeout(() => setToastMessage(null), 3000);
        return;
      }
    }

    let baseUrl = window.location.origin + window.location.pathname;

    if ((era.name === 'Recent Leaks' || era.name === 'Favorites') && (song as any).realEra) {
      const isHidden = HIDDEN_ALBUMS.includes((song as any).realEra.name);
      const prefix = getArtistUrlPrefix();
      baseUrl = window.location.origin + prefix + (isHidden ? '/related/' : '/album/') + createSlug((song as any).realEra.name);
    }

    const allSongsInEra = Object.values(era.data || {}).flat();
    const songParam = getSongSlug(song, allSongsInEra);
    const linkToCopy = `${baseUrl}?song=${songParam}`;

    navigator.clipboard.writeText(linkToCopy);
    setToastMessage("Song link copied!");
    setTimeout(() => setToastMessage(null), 3000);
  };


  const handleShareAlbum = () => {
    const baseUrl = window.location.origin + window.location.pathname;
    navigator.clipboard.writeText(baseUrl);
    setToastMessage("Album link copied!");
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleDownloadAlbum = async () => {
    if (!allFilteredPlayableSongs.length) {
      setToastMessage("No playable songs found in this album.");
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    setIsDownloading(true);
    setToastMessage(`Preparing download for ${allFilteredPlayableSongs.length} songs...`);
    const jobId = startJob(era.name, allFilteredPlayableSongs.length);

    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    await runWithConcurrencyLimit(allFilteredPlayableSongs, async (song) => {
      const rawUrl = song.url || (song.urls && song.urls.length > 0 ? song.urls[0] : '');
      if (!rawUrl || !(rawUrl.includes('pillows.su/f/') || rawUrl.includes('imgur.gg/f/') || rawUrl.includes('i.imgur.com') || rawUrl.includes('pixeldrain.com/u/') || rawUrl.includes('krakenfiles.com/view/') || rawUrl.includes('ibb.co') || rawUrl.match(/\.(png|jpg|jpeg)$/i) || rawUrl.startsWith('https://i.scdn.co/'))) return;
      try {
        const { fetchUrl, isImage, imageExt, headers } = await resolveUrl(rawUrl);
        const res = await fetch(fetchUrl, { ...(headers ? { headers } : {}), signal: AbortSignal.timeout(30000) });
        if (!res.ok && res.status !== 206) throw new Error('fetch failed');
        const ct = res.headers.get('content-type') ?? '';
        if (ct.startsWith('text/html') || ct.startsWith('application/json')) throw new Error('non-audio response');
        let blob = await res.blob();
        const songEraName = (song as any).realEra?.name || era.name;
        const songTitle = song.name.includes(' - ') ? song.name.substring(song.name.indexOf(' - ') + 3) : song.name;
        const fileName = buildDownloadName(song.name, settings.tagFeaturedArtists, settings.tagsAsEmojis);
        let ext: string;
        if (isImage) {
          ext = imageExt || await detectAudioExt(blob);
        } else {
          ext = await detectAudioExt(blob);
        }
        // Apply content-type override for all URLs — corrects .mp3 fallback when magic bytes
        // are ambiguous (e.g. audio from ibb.co or other image-flagged hosts).
        if (ext === '.mp3') {
          if (ct.includes('flac'))                                     ext = '.flac';
          else if (ct.includes('wav') || ct.includes('wave'))          ext = '.wav';
          else if (ct.includes('aiff'))                                ext = '.aiff';
          else if (ct.includes('ogg') || ct.includes('opus'))          ext = '.ogg';
          else if (ct.includes('m4a') || (ct.includes('mp4') && !ct.includes('video'))) ext = '.m4a';
        }
        const isLossless = song.quality?.toLowerCase().includes('lossless');
        if (settings.embedMetadata && (ext === '.mp3' || ext === '.flac' || ext === '.wav')) {
          // Skip artwork in zip path — concurrent artwork fetches across all songs saturate
          // the browser's connection limit and cause the download to hang.
          const tagMeta = {
            title: buildTitleTag(song.name, settings.tagFeaturedArtists),
            artist: buildArtistTag(song.name, songEraName, settings.tagFeaturedArtists),
            album: songEraName,
            year: ALBUM_RELEASE_DATES[songEraName]?.split('/').pop(),
            artworkUrl: undefined,
          };
          try {
            if (ext === '.mp3') blob = await embedID3Tags(blob, tagMeta, songTitle);
            else if (ext === '.wav') blob = await embedWAVTags(blob, tagMeta, songTitle);
            else if (ext === '.flac') {
              try {
                blob = await flacToWav(blob); ext = '.wav';
                blob = await embedWAVTags(blob, tagMeta, songTitle);
              } catch {
                if (!isLossless) blob = await embedFLACTags(blob, tagMeta, songTitle);
              }
            }
          } catch { /* skip tagging, save raw */ }
        } else if (isLossless && ext === '.flac') {
          try { blob = await flacToWav(blob); ext = '.wav'; } catch { /* keep as FLAC */ }
        }
        zip.file(`${sanitizeFilename(fileName)}${ext}`, blob);
      } catch (err) {
        console.error(`Failed to download ${song.name}:`, err);
        throw err;
      }
    }, 4, 2, (completed, total) => updateJob(jobId, completed, total), (song) => startItem(jobId, song.name), (song) => finishItem(jobId, song.name));

    setToastMessage('Zipping...');
    try {
      const content = await zip.generateAsync(
        { type: 'blob', compression: 'STORE' },
        (meta) => {
          if (meta.percent < 100) setToastMessage(`Zipping... ${Math.round(meta.percent)}%`);
        }
      );
      saveAs(content, `${era.name}.zip`);
      finishJob(jobId, 'done');
    } catch (err) {
      console.error('Zip generation failed:', err);
      setToastMessage('Download failed. Try downloading songs individually.');
      setTimeout(() => setToastMessage(null), 4000);
      finishJob(jobId, 'error');
    } finally {
      setIsDownloading(false);
      setToastMessage(null);
    }
  };

  const getSongKey = (category: string, index: number) => `${category}__${index}`;

  const handleDownloadSelected = async () => {
    const selectedSongs = processedCategories.flatMap(({ category, songs }) =>
      songs.map((song, i) => ({ song, category, key: getSongKey(category, i) }))
    ).filter(({ key }) => selectedKeys.has(key)).map(({ song }) => song)
      .filter(song => {
        const rawUrl = song.url || (song.urls && song.urls.length > 0 ? song.urls[0] : '');
        return rawUrl && (rawUrl.includes('pillows.su/f/') || rawUrl.includes('imgur.gg/f/') || rawUrl.includes('i.imgur.com') || rawUrl.includes('krakenfiles.com/view/') || rawUrl.includes('pixeldrain.com/u/')) && !isSongNotAvailable(song, rawUrl);
      });

    if (!selectedSongs.length) {
      setToastMessage("No playable songs selected.");
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    setIsDownloadingSelected(true);
    setToastMessage(`Preparing download for ${selectedSongs.length} songs...`);
    const jobId = startJob('Selected Songs', selectedSongs.length);

    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    await runWithConcurrencyLimit(selectedSongs, async (song) => {
      const rawUrl = song.url || (song.urls && song.urls.length > 0 ? song.urls[0] : '');
      if (!rawUrl) return;
      try {
        const { fetchUrl, isImage, imageExt, headers } = await resolveUrl(rawUrl);
        const res = await fetch(fetchUrl, { ...(headers ? { headers } : {}), signal: AbortSignal.timeout(30000) });
        if (!res.ok && res.status !== 206) throw new Error('fetch failed');
        const ct = res.headers.get('content-type') ?? '';
        if (ct.startsWith('text/html') || ct.startsWith('application/json')) throw new Error('non-audio response');
        let blob = await res.blob();
        const songEraName = (song as any).realEra?.name || era.name;
        const songTitle = song.name.includes(' - ') ? song.name.substring(song.name.indexOf(' - ') + 3) : song.name;
        const fileName = buildDownloadName(song.name, settings.tagFeaturedArtists, settings.tagsAsEmojis);
        let ext: string;
        if (isImage) { ext = imageExt || await detectAudioExt(blob); }
        else { ext = await detectAudioExt(blob); }
        if (ext === '.mp3') {
          if (ct.includes('flac')) ext = '.flac';
          else if (ct.includes('wav') || ct.includes('wave')) ext = '.wav';
          else if (ct.includes('aiff')) ext = '.aiff';
          else if (ct.includes('ogg') || ct.includes('opus')) ext = '.ogg';
          else if (ct.includes('m4a') || (ct.includes('mp4') && !ct.includes('video'))) ext = '.m4a';
        }
        const isLossless = song.quality?.toLowerCase().includes('lossless');
        if (settings.embedMetadata && (ext === '.mp3' || ext === '.flac' || ext === '.wav')) {
          const tagMeta = {
            title: buildTitleTag(song.name, settings.tagFeaturedArtists),
            artist: buildArtistTag(song.name, songEraName, settings.tagFeaturedArtists),
            album: songEraName,
            year: ALBUM_RELEASE_DATES[songEraName]?.split('/').pop(),
            artworkUrl: undefined,
          };
          try {
            if (ext === '.mp3') blob = await embedID3Tags(blob, tagMeta, songTitle);
            else if (ext === '.wav') blob = await embedWAVTags(blob, tagMeta, songTitle);
            else if (ext === '.flac') {
              try { blob = await flacToWav(blob); ext = '.wav'; blob = await embedWAVTags(blob, tagMeta, songTitle); }
              catch { if (!isLossless) blob = await embedFLACTags(blob, tagMeta, songTitle); }
            }
          } catch { /* skip tagging */ }
        } else if (isLossless && ext === '.flac') {
          try { blob = await flacToWav(blob); ext = '.wav'; } catch { /* keep as FLAC */ }
        }
        zip.file(`${sanitizeFilename(fileName)}${ext}`, blob);
      } catch (err) {
        console.error(`Failed to download ${song.name}:`, err);
        throw err;
      }
    }, 4, 2, (completed, total) => updateJob(jobId, completed, total), (song) => startItem(jobId, song.name), (song) => finishItem(jobId, song.name));

    setToastMessage('Zipping...');
    try {
      const content = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
      saveAs(content, `Selected Songs.zip`);
      finishJob(jobId, 'done');
    } catch {
      setToastMessage('Download failed.');
      setTimeout(() => setToastMessage(null), 4000);
      finishJob(jobId, 'error');
    } finally {
      setIsDownloadingSelected(false);
      setToastMessage(null);
    }
  };

  const handleFavoriteSelected = () => {
    if (!toggleFavorite) return;
    const toFavorite = processedCategories.flatMap(({ category, songs }) =>
      songs.map((song, i) => ({ song, category, key: getSongKey(category, i) }))
    ).filter(({ key }) => selectedKeys.has(key)).map(({ song }) => song);

    toFavorite.forEach(song => {
      const rawUrl = song.url || (song.urls && song.urls.length > 0 ? song.urls[0] : '');
      const isPlayable = rawUrl && (rawUrl.includes('pillows.su/f/') || rawUrl.includes('imgur.gg/f/') || rawUrl.includes('i.imgur.com') || rawUrl.includes('krakenfiles.com/view/') || rawUrl.includes('pixeldrain.com/u/')) && !isSongNotAvailable(song, rawUrl);
      if (!isPlayable) return;
      const isStarred = favoriteKeys.some(k => k.songName === song.name && k.url === rawUrl);
      if (!isStarred) toggleFavorite(song, (song as any).realEra?.name || era.name);
    });

    setToastMessage(`Added ${toFavorite.length} song${toFavorite.length !== 1 ? 's' : ''} to Favorites`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const getSelectedPlayableSongs = () => {
    return processedCategories.flatMap(({ category, songs }) =>
      songs.map((song, i) => ({ song, category, key: getSongKey(category, i) }))
    ).filter(({ key }) => selectedKeys.has(key)).map(({ song }) => song)
      .filter(song => {
        const rawUrl = song.url || (song.urls && song.urls.length > 0 ? song.urls[0] : '');
        return rawUrl && (rawUrl.includes('pillows.su/f/') || rawUrl.includes('imgur.gg/f/') || rawUrl.includes('i.imgur.com') || rawUrl.includes('krakenfiles.com/view/') || rawUrl.includes('pixeldrain.com/u/')) && !isSongNotAvailable(song, rawUrl);
      });
  };

  const handleAddSelectedToPlaylist = (playlistId: string) => {
    const toAdd = getSelectedPlayableSongs();
    toAdd.forEach(song => {
      const rawUrl = song.url || (song.urls && song.urls.length > 0 ? song.urls[0] : '');
      const cleanSong = { ...song };
      delete (cleanSong as any).realEra;
      const entryEra = (song as any).realEra?.name || era.name;
      addToPlaylist(playlistId, { songName: song.name, eraName: entryEra, url: rawUrl, song: cleanSong, tracker: activeConfig.slug, image: eraArtwork(activeConfig.slug, entryEra) || (song as any).realEra?.image || era.image || song.image || activeConfig.logoUrl, artist: activeConfig.getArtistName(entryEra) });
    });
    setToastMessage(`Added ${toAdd.length} song${toAdd.length !== 1 ? 's' : ''} to playlist`);
    setTimeout(() => setToastMessage(null), 3000);
    setIsPlaylistMenuOpen(false);
  };

  const handleCreatePlaylistFromSelected = () => {
    if (!newPlaylistName.trim()) return;
    const id = createPlaylist(newPlaylistName.trim());
    setNewPlaylistName('');
    setPlaylistCreating(false);
    handleAddSelectedToPlaylist(id);
  };

  // --- Tier List (cross-artist Tier List Maker on the homepage) -------------
  const openTierMenu = () => {
    setTierLists(readGlobalTierLists().map(t => ({ id: t.id, name: t.name })));
    setIsTierMenuOpen(o => !o);
  };

  const handleAddSelectedToTierList = (listId: string | null, name?: string) => {
    // Rank cards can be any selected song, playable or not.
    const selected = processedCategories.flatMap(({ category, songs }) =>
      songs.map((song, i) => ({ song, key: getSongKey(category, i) }))
    ).filter(({ key }) => selectedKeys.has(key)).map(({ song }) => song);

    if (!selected.length) return;

    const items = selected.map(song => {
      const eraName = (song as any).realEra?.name || era.name;
      const cover = CUSTOM_IMAGES[eraName] || (song as any).realEra?.image || era.image || '';
      const url = song.url || (song.urls && song.urls.length > 0 ? song.urls[0] : '') || '';
      return {
        kind: 'song' as const,
        eraName,
        songName: song.name,
        version: song.extra,
        url,
        image: cover,
        artist: activeConfig.slug,
        artistName: activeConfig.artistLabel,
      };
    });

    const { added } = addItemsToGlobalTierList(listId, name ?? null, items);
    setIsTierMenuOpen(false);
    setTierCreating(false);
    setNewTierName('');
    setToastMessage(
      added > 0
        ? `Added ${added} song${added !== 1 ? 's' : ''} to tier list · rank it on the Tier List Maker (homepage)`
        : 'Those songs are already on that tier list'
    );
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleCreateTierListFromSelected = () => {
    if (!newTierName.trim()) return;
    handleAddSelectedToTierList(null, newTierName.trim());
  };

  const processedCategories = useMemo(() => {
    return Object.entries(era.data || {}).map(([category, songs]) => {
      let processedSongs = songs.filter(song => {
        if (!matchesFilters(song, searchQuery, filters)) return false;

        if (filters.hasClips) {
          const has = findMvsForSong(song.name, era.name, mvData).length > 0;
          if (filters.hasClips === 'include' && !has) return false;
          if (filters.hasClips === 'exclude' && has) return false;
        }

        if (filters.hasRemixes) {
          const has = findRemixesForSong(song.name, era.name, remixData).length > 0;
          if (filters.hasRemixes === 'include' && !has) return false;
          if (filters.hasRemixes === 'exclude' && has) return false;
        }

        if (filters.hasSamples) {
          const has = findSamplesForSong(song.name, era.name, samplesData).length > 0;
          if (filters.hasSamples === 'include' && !has) return false;
          if (filters.hasSamples === 'exclude' && has) return false;
        }

        return true;
      });

      if (showLatestOnly || showFirstOnly) {
        const getVersionNumber = (name: string): number => {
          const match = name.match(/v(\d+)/i);
          return match ? parseInt(match[1], 10) : 0;
        };

        const getBaseName = (name: string): string => {
          let base = name.replace(/\[?v\d+\]?/gi, '').trim();
          const hyphenIndex = base.indexOf('-');
          if (hyphenIndex !== -1 && hyphenIndex < base.length - 1) {
            base = base.substring(hyphenIndex + 1);
          }
          return base.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
        };

        const versionMap = new Map<string, typeof songs[0]>();

        processedSongs.forEach(song => {
          const vNum = getVersionNumber(song.name);
          if (vNum > 0) {
            const base = getBaseName(song.name);
            const existing = versionMap.get(base);
            if (!existing) {
              versionMap.set(base, song);
            } else {
              const existingNum = getVersionNumber(existing.name);
              if (showLatestOnly && existingNum < vNum) {
                versionMap.set(base, song);
              } else if (showFirstOnly && existingNum > vNum) {
                versionMap.set(base, song);
              }
            }
          }
        });

        const noVersion = processedSongs.filter(s => getVersionNumber(s.name) === 0);
        const versioned = processedSongs.filter(s => {
          const vNum = getVersionNumber(s.name);
          if (vNum === 0) return false;
          const base = getBaseName(s.name);
          return versionMap.get(base) === s;
        });

        processedSongs = [...noVersion, ...versioned];
      }

      const stamped = processedSongs.map(s =>
        stampSongComment(s, { tracker: activeConfig.slug, type: category, era: (s as any).realEra?.name || era.name })
      );
      return { category, songs: stamped };
    }).filter(c => c.songs.length > 0);
  }, [era.data, filters, searchQuery, showLatestOnly, showFirstOnly]);

  const allFilteredPlayableSongs = useMemo(() => {
    return processedCategories.flatMap(c => c.songs).filter(song => {
      const rawUrl = song.url || (song.urls && song.urls.length > 0 ? song.urls[0] : '');
      const isNotAvailable = isSongNotAvailable(song, rawUrl);
      return rawUrl && (rawUrl.includes('pillows.su/f/') || rawUrl.includes('imgur.gg/f/') || rawUrl.includes('i.imgur.com') || rawUrl.includes('krakenfiles.com/view/') || rawUrl.includes('pixeldrain.com/u/')) && !isNotAvailable;
    });
  }, [processedCategories]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, filter: 'blur(10px)' }}
        animate={{ opacity: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, filter: 'blur(10px)' }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="absolute inset-0 z-10 bg-yzy-black overflow-y-auto pb-64"
      >
        <div
          className={`p-6 md:p-8 flex flex-col md:flex-row items-start gap-6 md:gap-8 border-b border-white/5${!settings.disableEraThemes && ERA_THEMES[era.name]?.topBanner ? ' bg-center md:bg-right' : ''}`}
          style={!settings.disableEraThemes && ERA_THEMES[era.name]?.topBanner ? {
            backgroundImage: `url(${ERA_THEMES[era.name].topBanner})`,
            backgroundSize: 'cover',
          } : { backgroundColor: 'rgba(255,255,255,0.05)' }}
        >
          {onBack && (
            <button onClick={onBack} className="cursor-pointer mt-1 flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          <div
            className="w-32 h-32 md:w-48 md:h-48 rounded-md overflow-hidden bg-white/5 shrink-0 shadow-xl cursor-pointer"
            onClick={() => setZoomedImage(true)}
            title="Click to zoom"
          >
            {era.image ? (
              <Img w={500} eager src={era.image} alt={era.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-white/20 text-center p-4">{era.name}</div>
            )}
          </div>

          <div className="flex flex-col justify-end h-full py-2 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
            <div className="flex items-center gap-4 mb-3 flex-wrap">
              <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight flex items-center gap-4 flex-wrap">
                <div className="truncate">{formatTextWithTags(era.name)}</div>
                {ALBUM_RELEASE_DATES[era.name] && <div className="text-xl md:text-2xl text-white/30 font-medium bg-white/5 border border-white/5 rounded-lg px-3 py-1 mt-1">{ALBUM_RELEASE_DATES[era.name]}</div>}
              </h1>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setIsSelectMode(m => !m); setSelectedKeys(new Set()); }}
                  className={`flex items-center gap-1.5 px-3 h-10 rounded-full text-xs font-bold transition-colors cursor-pointer ${isSelectMode ? 'bg-[var(--theme-color)] text-black' : 'bg-white/5 hover:bg-white/10 text-white/50 hover:text-white'}`}
                  title="Select songs"
                >
                  <CheckSquare className="w-4 h-4" />
                  <span className="hidden sm:inline">{isSelectMode ? 'Done' : 'Select'}</span>
                </button>
                {era.name !== 'Favorites' && (
                  <button
                    onClick={handleShareAlbum}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                    title="Copy album link"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                )}
                {era.name !== 'Favorites' && era.name !== 'Recent Leaks' && (
                  <CommentButton
                    tracker={activeConfig.slug}
                    entryKey={makeEraKey(era.name)}
                    entryLabel={baseEraName(era.name)}
                    entryType="Era"
                    variant="pill"
                  />
                )}

                {era.name !== 'Recent Leaks' && (
                  showLatestOnly ? (
                    <button
                      onClick={handleDownloadAlbum}
                      disabled={isDownloading}
                      className={`w-auto px-4 h-10 flex items-center justify-center gap-2 rounded-full transition-colors ${isDownloading ? 'bg-[var(--theme-color)]/10 text-[var(--theme-color)] opacity-75 cursor-not-allowed' : 'bg-[var(--theme-color)]/20 text-[var(--theme-color)] hover:bg-[var(--theme-color)]/30 cursor-pointer'}`}
                      title="Download Final Album"
                    >
                      {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      <span className="text-[10px] font-bold tracking-wider uppercase">Download Final Album</span>
                    </button>
                  ) : showFirstOnly ? (
                    <button
                      onClick={handleDownloadAlbum}
                      disabled={isDownloading}
                      className={`w-auto px-4 h-10 flex items-center justify-center gap-2 rounded-full transition-colors ${isDownloading ? 'bg-[var(--theme-color)]/10 text-[var(--theme-color)] opacity-75 cursor-not-allowed' : 'bg-[var(--theme-color)]/20 text-[var(--theme-color)] hover:bg-[var(--theme-color)]/30 cursor-pointer'}`}
                      title="Download First Versions"
                    >
                      {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      <span className="text-[10px] font-bold tracking-wider uppercase">Download First Versions</span>
                    </button>
                  ) : searchQuery || filters.tags.length > 0 || filters.qualities.length > 0 || filters.availableLengths.length > 0 || filters.playableOnly || filters.hasClips !== null || filters.hasRemixes !== null || filters.hasSamples !== null ? (
                    <button
                      onClick={handleDownloadAlbum}
                      disabled={isDownloading}
                      className={`w-auto px-4 h-10 flex items-center justify-center gap-2 rounded-full transition-colors ${isDownloading ? 'text-[var(--theme-color)] bg-white/10 opacity-75 cursor-not-allowed' : 'bg-white/5 hover:bg-white/10 text-white/50 hover:text-white cursor-pointer'}`}
                      title="Download Filtered Songs"
                    >
                      {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      <span className="text-[10px] font-bold tracking-wider uppercase">Download Filtered Songs</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleDownloadAlbum}
                      disabled={isDownloading}
                      className={`w-10 h-10 flex items-center justify-center rounded-full bg-white/5 transition-colors ${isDownloading ? 'text-[var(--theme-color)] bg-white/10 opacity-75 cursor-not-allowed' : 'hover:bg-white/10 text-white/50 hover:text-white cursor-pointer'}`}
                      title="Download all songs"
                    >
                      {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    </button>
                  )
                )}
              </div>
            </div>

            {isLastfmLoggedIn() && era.name !== 'Favorites' && era.name !== 'Recent Leaks' && (
              <div className="flex items-center gap-2 mb-3">
                <SiLastdotfm className="w-4 h-4 text-[#d51007] shrink-0" />
                {editingLfmName ? (
                  <>
                    <input
                      autoFocus
                      className="bg-white/10 border border-white/20 rounded px-2 py-0.5 text-sm text-white outline-none focus:border-[#d51007] w-48"
                      value={lfmNameDraft}
                      onChange={e => setLfmNameDraft(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          const trimmed = lfmNameDraft.trim();
                          const overrides = { ...settings.lastfmEraOverrides };
                          if (trimmed) overrides[era.name] = trimmed;
                          else delete overrides[era.name];
                          updateSettings({ lastfmEraOverrides: overrides });
                          setEditingLfmName(false);
                        } else if (e.key === 'Escape') {
                          setEditingLfmName(false);
                        }
                      }}
                      placeholder={era.name}
                    />
                    <button
                      className="text-xs text-white/50 hover:text-white transition-colors cursor-pointer"
                      onClick={() => {
                        const trimmed = lfmNameDraft.trim();
                        const overrides = { ...settings.lastfmEraOverrides };
                        if (trimmed) overrides[era.name] = trimmed;
                        else delete overrides[era.name];
                        updateSettings({ lastfmEraOverrides: overrides });
                        setEditingLfmName(false);
                      }}
                    >Save</button>
                    <button
                      className="text-xs text-white/30 hover:text-white/60 transition-colors cursor-pointer"
                      onClick={() => setEditingLfmName(false)}
                    >Cancel</button>
                  </>
                ) : (
                  <>
                    <span className="text-xs text-white/40">Scrobbles as:</span>
                    <span className="text-xs text-white/70">{settings.lastfmEraOverrides[era.name] ?? era.name}</span>
                    <button
                      className="text-white/30 hover:text-white/70 transition-colors cursor-pointer"
                      title="Edit Last.fm album name"
                      onClick={() => {
                        setLfmNameDraft(settings.lastfmEraOverrides[era.name] ?? '');
                        setEditingLfmName(true);
                      }}
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    {settings.lastfmEraOverrides[era.name] && (
                      <button
                        className="text-white/20 hover:text-white/50 transition-colors cursor-pointer text-xs"
                        title="Reset to default"
                        onClick={() => {
                          const overrides = { ...settings.lastfmEraOverrides };
                          delete overrides[era.name];
                          updateSettings({ lastfmEraOverrides: overrides });
                        }}
                      >Reset</button>
                    )}
                  </>
                )}
              </div>
            )}

            {ALBUM_DESCRIPTIONS[era.name] && (
              <div className="mb-2 max-w-3xl">
                <p ref={descriptionRef} className={`text-white/80 text-sm leading-relaxed ${isDescriptionExpanded ? '' : 'line-clamp-3'}`}>
                  {ALBUM_DESCRIPTIONS[era.name]}
                </p>
                {(isDescriptionClamped || isDescriptionExpanded) && (
                  <button
                    onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                    className="text-[var(--theme-color)] text-xs font-bold mt-1 hover:underline cursor-pointer"
                  >
                    {isDescriptionExpanded ? 'Show Less' : 'Show More...'}
                  </button>
                )}
              </div>
            )}
            {ERA_DISCLAIMERS[era.name] && (
              <div className="mb-2 max-w-3xl rounded-lg border border-[var(--theme-color)]/40 bg-[var(--theme-color)]/10 px-4 py-3">
                <p className="text-white/90 text-sm leading-relaxed">
                  {ERA_DISCLAIMERS[era.name].text}
                  {ERA_DISCLAIMERS[era.name].linkUrl && (
                    <>
                      {' '}
                      <a
                        href={ERA_DISCLAIMERS[era.name].linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[var(--theme-color)] font-bold underline hover:opacity-80"
                      >
                        {ERA_DISCLAIMERS[era.name].linkText || 'here'}
                      </a>
                    </>
                  )}
                </p>
              </div>
            )}
            {era.extra && <p className="text-white/60 text-sm max-w-2xl">{formatTextWithTags(era.extra)}</p>}
            {era.fileInfo && era.fileInfo.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {era.fileInfo.map((info, i) => (
                  <span key={i} className="text-[10px] px-2 py-1 rounded bg-white/10 text-white/70">{info}</span>
                ))}
              </div>
            )}

            {era.name !== 'Recent Leaks' && era.name !== 'Favorites' && (
              <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setShowLatestOnly(!showLatestOnly);
                      if (!showLatestOnly) setShowFirstOnly(false);
                    }}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${showLatestOnly ? 'bg-[var(--theme-color)]' : 'bg-white/20'}`}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${showLatestOnly ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                  <span className="text-sm font-medium text-white/80 cursor-pointer" onClick={() => {
                      setShowLatestOnly(!showLatestOnly);
                      if (!showLatestOnly) setShowFirstOnly(false);
                  }}>
                    Show Latest Versions Only
                  </span>
                </div>
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      setShowFirstOnly(!showFirstOnly);
                      if (!showFirstOnly) setShowLatestOnly(false);
                    }}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${showFirstOnly ? 'bg-[var(--theme-color)]' : 'bg-white/20'}`}
                  >
                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${showFirstOnly ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                  <span className="text-sm font-medium text-white/80 cursor-pointer" onClick={() => {
                      setShowFirstOnly(!showFirstOnly);
                      if (!showFirstOnly) setShowLatestOnly(false);
                  }}>
                    Show First Versions Only
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div
          className="flex-1"
          style={!settings.disableEraThemes && ERA_THEMES[era.name]?.bottomBanner ? (
            ERA_THEMES[era.name].bottomBannerRepeat ? {
              backgroundImage: `url(${ERA_THEMES[era.name].bottomBanner})`,
              backgroundSize: '100% auto',
              backgroundRepeat: 'repeat-y',
              backgroundPosition: 'top center',
            } : {
              backgroundImage: `url(${ERA_THEMES[era.name].bottomBanner})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          ) : undefined}
        >
        <div className={`px-6 md:px-8 pt-8 max-w-6xl mx-auto${!settings.disableEraThemes && ERA_THEMES[era.name]?.bottomBanner ? ' drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]' : ''}`}>
          {processedCategories.map(({ category, songs: processedSongs }) => {
            return (
              <div key={category} className="mb-10">
                <h3 className="text-lg font-bold text-white mb-4 pb-2 border-b border-white/10">{category}</h3>

                <div className="flex flex-col">
                  <div className="flex items-center px-4 py-2 text-xs font-semibold text-white/40 uppercase tracking-wider border-b border-white/5 mb-2 hidden sm:flex">
                    {isSelectMode && (
                      <button
                        onClick={() => {
                          const allKeys = processedSongs.map((_, i) => getSongKey(category, i));
                          const allSelected = allKeys.every(k => selectedKeys.has(k));
                          setSelectedKeys(prev => {
                            const next = new Set(prev);
                            if (allSelected) allKeys.forEach(k => next.delete(k));
                            else allKeys.forEach(k => next.add(k));
                            return next;
                          });
                        }}
                        className="w-8 shrink-0 flex items-center text-white/40 hover:text-white cursor-pointer"
                      >
                        {processedSongs.every((_, i) => selectedKeys.has(getSongKey(category, i)))
                          ? <CheckSquare className="w-4 h-4 text-[var(--theme-color)]" />
                          : <Square className="w-4 h-4" />}
                      </button>
                    )}
                    {!isSelectMode && <div className="w-8">#</div>}
                    <div className="flex-1">Title</div>
                    <div className="w-32">Quality</div>
                    <div className="w-24 text-right">Length</div>
                  </div>

                  {processedSongs.slice(0, visibleCount).map((song, i) => {
                    const rawUrl = song.url || (song.urls && song.urls.length > 0 ? song.urls[0] : '');
                    const isNotAvailable = isSongNotAvailable(song, rawUrl);
                    const lowerUrl = (rawUrl || '').toLowerCase();
                    const isTrulyEmptyLink = !rawUrl || lowerUrl === 'n/a' || lowerUrl.includes('link needed') || lowerUrl.includes('source needed') || !looksLikeRealLink(rawUrl);
                    const isYoutubeLink = (rawUrl.includes('youtube.com/watch') || rawUrl.includes('youtu.be/')) && !isNotAvailable;
                    const isPlayable = (rawUrl.includes('pillows.su/f/') || rawUrl.includes('imgur.gg/f/') || rawUrl.includes('i.imgur.com') || rawUrl.includes('krakenfiles.com/view/') || rawUrl.includes('pixeldrain.com/u/')) && !isNotAvailable;
                    const isEmpty = isTrulyEmptyLink || isNotAvailable || lowerUrl.includes('n/a');
                    const isDead = !isEmpty && isDeadLink(deadLinks, rawUrl);
                    const isCurrentlyPlaying = (currentSong?.name === song.name && currentSong?.description === song.description) ||
                      (currentSong?.url && song.url && currentSong.url === song.url) ||
                      (currentSong?.urls && song.urls && currentSong.urls.length > 0 && song.urls.length > 0 && currentSong.urls[0] === song.urls[0]);

                    const songKey = getSongKey(category, i);
                    const isSelected = selectedKeys.has(songKey);
                    const prevSubera = i > 0 ? processedSongs[i - 1].subera : undefined;
                    const showSuberaBanner = !!song.subera && song.subera !== prevSubera;

                    return (
                      <Fragment key={i}>
                      {showSuberaBanner && (
                        <div className="bg-white/10 text-center text-xs font-bold uppercase tracking-wider text-white/80 py-2 mb-2 rounded">
                          {song.subera}
                        </div>
                      )}
                      <div
                        onClick={() => {
                          if (isSelectMode) {
                            setSelectedKeys(prev => {
                              const next = new Set(prev);
                              if (next.has(songKey)) next.delete(songKey);
                              else next.add(songKey);
                              return next;
                            });
                          } else if (!isEmpty) {
                            onPlaySong(song, era, allFilteredPlayableSongs);
                          }
                        }}
                        className={`group flex items-center px-4 py-2.5 rounded-md transition-colors relative ${isSelectMode ? 'cursor-pointer hover:bg-white/5' : isEmpty ? 'opacity-50 hover:opacity-100 cursor-default' : 'hover:bg-white/5 cursor-pointer'} ${isCurrentlyPlaying && !isSelectMode ? 'bg-white/5' : ''} ${isSelectMode && isSelected ? 'bg-[var(--theme-color)]/10' : ''}`}
                      >
                        <div className={`w-8 text-sm font-mono flex items-center shrink-0 ${isCurrentlyPlaying ? 'text-[var(--theme-color)]' : 'text-white/40 group-hover:text-white'}`}>
                          {isSelectMode ? (
                            isSelected
                              ? <CheckSquare className="w-4 h-4 text-[var(--theme-color)]" />
                              : <Square className="w-4 h-4 text-white/30" />
                          ) : (
                            <>
                              <span className={`group-hover:hidden`}>
                                {isCurrentlyPlaying ? <Volume2 className={`w-4 h-4 ${isPlaying ? 'animate-pulse' : ''}`} /> : (i + 1)}
                              </span>
                              {isEmpty ? (
                                <X className="w-4 h-4 hidden group-hover:block" />
                              ) : isCurrentlyPlaying && isPlaying ? (
                                <Volume2 className="w-4 h-4 hidden group-hover:block text-[var(--theme-color)]" />
                              ) : isPlayable ? (
                                <Play className="w-4 h-4 hidden group-hover:block" />
                              ) : isYoutubeLink ? (
                                <SiYoutube className="w-4 h-4 hidden group-hover:block text-[#FF0000]" />
                              ) : (
                                <ExternalLink className="w-4 h-4 hidden group-hover:block" />
                              )}
                            </>
                          )}
                        </div>

                        {(era.name === 'Recent Leaks' || era.name === 'Favorites') && song.image && (
                          <div className="w-10 h-10 rounded shrink-0 mr-3 overflow-hidden bg-white/5 shadow-md">
                            <Img w={120} src={song.image} alt={song.extra || ''} className="w-full h-full object-cover" />
                          </div>
                        )}

                        <div className="flex-1 min-w-0 pr-4">
                          <div className={`flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-2 font-medium ${isCurrentlyPlaying ? 'text-[var(--theme-color)]' : 'text-white'}`}>
                            <SongTitle name={song.name} className="break-words whitespace-normal leading-snug" />
                            {song.extra && <SongExtra extra={song.extra} className={`text-xs break-words whitespace-normal leading-snug ${isCurrentlyPlaying ? 'text-[var(--theme-color)]/60' : 'text-white/40'}`} />}
                            {isDead && (
                              <span
                                title="This file has been deleted from its host"
                                className="self-start sm:self-auto shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-red-500/30 text-red-400/90 bg-red-500/10"
                              >
                                Dead link
                              </span>
                            )}
                          </div>
                          {song.description && (() => {
                            const { ogFilename, note } = parseNoteDescription(song.description);
                            return (
                              <div className="mt-1">
                                {note && <div className={`text-xs break-words whitespace-normal leading-snug ${isCurrentlyPlaying ? 'text-[var(--theme-color)]/40' : 'text-white/40'}`}>{formatTextWithTags(note)}</div>}
                                {ogFilename && <div className={`text-[10px] font-mono mt-0.5 ${isCurrentlyPlaying ? 'text-[var(--theme-color)]/25' : 'text-white/25'}`}>OG: {ogFilename}</div>}
                              </div>
                            );
                          })()}
                          {(era.name === 'Recent Leaks' || era.name === 'Favorites') && (song as any).realEra && (
                            <button
                              onClick={(e) => { e.stopPropagation(); onNavigateToEra?.((song as any).realEra); }}
                              className={`text-[9px] px-2 py-0.5 rounded border mt-1 transition-colors ${onNavigateToEra ? 'cursor-pointer hover:border-white/30 hover:text-white/70' : 'cursor-default'} ${isCurrentlyPlaying ? 'border-[var(--theme-color)]/20 text-[var(--theme-color)]/50' : 'border-white/10 text-white/30 bg-white/5'}`}
                            >
                              {(song as any).realEra.name}
                            </button>
                          )}
                        </div>

                        {isPlayable && (() => {
                          const pillowUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
                          return (
                            <button
                              onClick={(e) => { e.stopPropagation(); window.open(pillowUrl, '_blank'); }}
                              className={`shrink-0 p-1 rounded transition-all hover:bg-white/10 hover:text-white cursor-pointer ${isCurrentlyPlaying ? 'text-[var(--theme-color)]/60 hover:text-[var(--theme-color)]' : 'text-white/40'}`}
                              title="Open on Pillowcase"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          );
                        })()}

                        <div className="w-32 shrink-0 hidden sm:flex items-center gap-1.5 flex-wrap">
                          {song.quality && (
                            <span className={`text-[10px] px-2 py-0.5 rounded border ${isCurrentlyPlaying ? 'border-[var(--theme-color)]/20 text-[var(--theme-color)]/80 bg-[var(--theme-color)]/5' : 'border-white/10 text-white/60 bg-white/5'}`}>
                              {song.quality}
                            </span>
                          )}
                          {song.available_length && (
                            <span className={`text-[10px] px-2 py-0.5 rounded border ${isCurrentlyPlaying ? 'border-[var(--theme-color)]/20 text-[var(--theme-color)]/80 bg-[var(--theme-color)]/5' : 'border-white/10 text-white/60 bg-white/5'}`}>
                              {song.available_length}
                            </span>
                          )}
                          {(era.name === 'Recent Leaks' || era.name === 'Recent Production Leaks') && song.leak_date && (
                            <span className={`text-[10px] px-2 py-0.5 rounded border ${isCurrentlyPlaying ? 'border-[var(--theme-color)]/20 text-[var(--theme-color)]/80 bg-[var(--theme-color)]/5' : 'border-white/10 text-white/60 bg-white/5'}`}>
                              Leak: {song.leak_date.split('T')[0]}
                            </span>
                          )}
                        </div>

                        <div className="shrink-0 flex items-center justify-end gap-2 text-right text-xs font-mono hidden sm:flex whitespace-nowrap">
                          <span className={`${isCurrentlyPlaying ? 'text-[var(--theme-color)]/60' : 'text-white/40'}`}>{song.track_length || '-:--'}</span>
                          {(() => {
                            if (!isPlayable || !toggleFavorite || song.name === "Alright but the beat is Father Stretch My Hands Pt. 1") return null;
                            const rawUrl = song.url || (song.urls && song.urls.length > 0 ? song.urls[0] : '');
                            const isStarred = favoriteKeys.some(k => k.songName === song.name && k.url === rawUrl);
                            return (
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleFavorite(song, (song as any).realEra?.name || era.name); }}
                                className={`p-1 rounded transition-all hover:bg-[var(--theme-color)]/20 cursor-pointer ${isStarred ? 'text-[var(--theme-color)]' : 'text-white/20 hover:text-[var(--theme-color)]'}`}
                                title={isStarred ? "Remove from Favorites" : "Add to Favorites"}
                              >
                                <Star className="w-3.5 h-3.5" fill={isStarred ? "currentColor" : "none"} />
                              </button>
                            );
                          })()}
                          {(() => {
                            if (isEmpty) return null;
                            const songUrl = song.url || (song.urls && song.urls.length > 0 ? song.urls[0] : '');
                            const eraNameForPlaylist = (song as any).realEra?.name || era.name;
                            return (
                              <AddToPlaylistButton
                                song={song}
                                eraName={eraNameForPlaylist}
                                url={songUrl}
                                isCurrentlyPlaying={isCurrentlyPlaying}
                              />
                            );
                          })()}
                          {!isEmpty && !isDead && !activeConfig.community && (
                            <ReportLinkButton
                              tracker={activeConfig.slug}
                              url={rawUrl}
                              label={song.name}
                              era={(song as any).realEra?.name || era.name}
                              isCurrentlyPlaying={isCurrentlyPlaying}
                            />
                          )}
                          {(() => {
                            const commentEra = (song as any).realEra?.name || era.name;
                            return (
                              <CommentButton
                                tracker={activeConfig.slug}
                                entryKey={makeEntryKey(category, commentEra, song.name)}
                                entryLabel={song.name}
                                entryType={category}
                                isCurrentlyPlaying={isCurrentlyPlaying}
                              />
                            );
                          })()}
                          {(() => {
                            const mvs = findMvsForSong(song.name, era.name, mvData);
                            if (mvs.length === 0) return null;
                            const firstLink = mvs[0]['Link(s)'].split('\n')[0].trim();
                            if (!firstLink) return null;
                            return (
                              <button
                                onClick={(e) => { e.stopPropagation(); window.open(firstLink, '_blank'); }}
                                className={`p-1 rounded transition-all hover:bg-purple-500/20 text-purple-400/70 hover:text-purple-300 cursor-pointer ${isCurrentlyPlaying ? 'text-purple-400' : ''}`}
                                title={`Watch Music Video`}
                              >
                                <Film className="w-3.5 h-3.5" />
                              </button>
                            );
                          })()}
                          {(() => {
                            const remixes = findRemixesForSong(song.name, era.name, remixData);
                            if (remixes.length === 0) return null;
                            const remixKey = `${category}-${i}`;
                            return (
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenRemixKey(openRemixKey === remixKey ? null : remixKey);
                                  }}
                                  className={`p-1 rounded transition-all hover:bg-teal-500/20 text-teal-400/70 hover:text-teal-300 cursor-pointer ${isCurrentlyPlaying ? 'text-teal-400' : ''}`}
                                  title={`${remixes.length} Remix${remixes.length > 1 ? 'es' : ''}`}
                                >
                                  <Disc3 className="w-3.5 h-3.5" />
                                </button>
                                {openRemixKey === remixKey && (
                                  <>
                                    <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpenRemixKey(null); }} />
                                    <div className="absolute right-0 top-full mt-1 z-50 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl min-w-[300px] max-h-64 overflow-y-auto">
                                      <div className="px-3 py-2 text-xs text-white/40 border-b border-white/10 font-semibold uppercase tracking-wider sticky top-0 bg-[#1a1a1a]">
                                        Remixes ({remixes.length})
                                      </div>
                                      {remixes.map((remix, ri) => {
                                        const link = remix['Link(s)'].split('\n')[0].trim();
                                        const isPillows = link.includes('pillows.su/f/') || link.includes('imgur.gg/f/') || link.includes('i.imgur.com') || link.includes('krakenfiles.com/view/') || link.includes('pixeldrain.com/u/');
                                        return (
                                          <button
                                            key={ri}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (isPillows) {
                                                const remixSong: Song = {
                                                  name: remix.Name.split('\n')[0] + ' [Remix]',
                                                  description: remix.Notes,
                                                  quality: remix.Quality,
                                                  available_length: remix['Available Length'],
                                                  url: link,
                                                  urls: [link]
                                                };
                                                onPlaySong(remixSong, era);
                                              } else {
                                                window.open(link, '_blank');
                                              }
                                              setOpenRemixKey(null);
                                            }}
                                            className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors flex items-center gap-2 cursor-pointer"
                                          >
                                            {isPillows ? <Play className="w-3 h-3 text-teal-400 shrink-0" /> : <ExternalLink className="w-3 h-3 text-white/40 shrink-0" />}
                                            <div className="flex-1 min-w-0">
                                              <div className="text-sm text-white truncate">{remix.Name.split('\n')[0]}</div>
                                              <div className="text-[10px] text-white/40 truncate">{remix['Artist(s)'].split('\n')[0]}</div>
                                            </div>
                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/50 shrink-0">{remix.Quality}</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })()}
                          {(() => {
                            const samples = findSamplesForSong(song.name, era.name, samplesData);
                            if (samples.length === 0) return null;
                            const sampleKey = `${category}-${i}`;
                            return (
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenSampleKey(openSampleKey === sampleKey ? null : sampleKey);
                                  }}
                                  className={`p-1 rounded transition-all hover:bg-[#FF4D4D]/20 text-[#FF4D4D]/70 hover:text-[#FF4D4D] cursor-pointer ${isCurrentlyPlaying ? 'text-[#FF4D4D]' : ''}`}
                                  title={`${samples.length} Sample${samples.length > 1 ? 's' : ''}`}
                                >
                                  <Layers className="w-3.5 h-3.5" />
                                </button>
                                {openSampleKey === sampleKey && (
                                  <>
                                    <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpenSampleKey(null); }} />
                                    <div className="absolute right-0 top-full mt-1 z-50 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl min-w-[300px] max-h-64 overflow-y-auto">
                                      <div className="px-3 py-2 text-xs text-white/40 border-b border-white/10 font-semibold uppercase tracking-wider sticky top-0 bg-[#1a1a1a]">
                                        Samples ({samples.length})
                                      </div>
                                      {samples.map((sample, ri) => {
                                        const link = (sample['Link(s)'] || '').split('\n')[0].trim();
                                        if (!link) return null;
                                        const isPillows = link.includes('pillows.su/f/') || link.includes('imgur.gg/f/') || link.includes('i.imgur.com') || link.includes('krakenfiles.com/view/') || link.includes('pixeldrain.com/u/');
                                        const sampleName = sample["Sample\n(Artist - Track)"] || 'Unknown Sample';
                                        return (
                                          <button
                                            key={ri}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (isPillows) {
                                                const sampleSong: Song = {
                                                  name: sampleName.split('\n')[0] + ' [Sample]',
                                                  description: sample.Notes,
                                                  url: link,
                                                  urls: [link]
                                                };
                                                onPlaySong(sampleSong, era);
                                              } else {
                                                window.open(link, '_blank');
                                              }
                                              setOpenSampleKey(null);
                                            }}
                                            className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors flex items-center gap-2 cursor-pointer"
                                          >
                                            {isPillows ? <Play className="w-3 h-3 text-[#FF4D4D] shrink-0" /> : <ExternalLink className="w-3 h-3 text-white/40 shrink-0" />}
                                            <div className="flex-1 min-w-0">
                                              <div className="text-sm text-white truncate">{sampleName.split('\n')[0]}</div>
                                              <div className="text-[10px] text-white/40 truncate">{sample.Notes?.split('\n')[0] || ''}</div>
                                            </div>
                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/50 shrink-0">Sample</span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })()}
                          <button
                            onClick={(e) => isPlayable && handleShare(e, song)}
                            className={`p-1 rounded ${isPlayable ? 'hover:bg-white/10 hover:text-white text-white/40 cursor-pointer' : 'invisible pointer-events-none'} ${isCurrentlyPlaying && isPlayable ? 'hover:bg-[var(--theme-color)]/10 text-[var(--theme-color)]' : ''}`}
                            title={isPlayable ? "Copy direct song link" : undefined}
                            disabled={!isPlayable}
                          >
                            <Share2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      </Fragment>
                    );
                  })}

                  {era.name === 'Recent Leaks' && visibleCount < processedSongs.length && (
                    <div className="mt-8 mb-4 flex justify-center w-full">
                      <button
                        onClick={() => setVisibleCount(prev => prev + 10)}
                        className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full font-semibold transition-colors uppercase tracking-widest text-xs cursor-pointer active:scale-95"
                      >
                        Load More
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </div>
      </motion.div>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isSelectMode && selectedKeys.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9990] px-4"
            >
              <div className="flex items-center gap-3 bg-[#1a1a1a] border border-white/10 rounded-2xl px-4 py-3 shadow-2xl">
                <span className="text-sm font-semibold text-white/70 flex-1 whitespace-nowrap">
                  {selectedKeys.size} song{selectedKeys.size !== 1 ? 's' : ''} selected
                </span>
                <button
                  onClick={handleFavoriteSelected}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  <Star className="w-3.5 h-3.5 text-[var(--theme-color)]" fill="currentColor" />
                  Favorite
                </button>
                <div className="relative">
                  <button
                    onClick={() => setIsPlaylistMenuOpen(o => !o)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    <ListMusic className="w-3.5 h-3.5 text-[var(--theme-color)]" />
                    Playlist
                  </button>
                  {isPlaylistMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => { setIsPlaylistMenuOpen(false); setPlaylistCreating(false); setNewPlaylistName(''); }} />
                      <div className="absolute bottom-full mb-2 right-0 z-50 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl min-w-[200px] overflow-hidden">
                        {playlists.length === 0 && !playlistCreating && (
                          <div className="px-4 py-2 text-xs text-white/40">No playlists yet</div>
                        )}
                        {playlists.map(p => (
                          <button
                            key={p.id}
                            onClick={() => handleAddSelectedToPlaylist(p.id)}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left text-white/80 hover:bg-white/5 transition-colors cursor-pointer"
                          >
                            <span className="truncate">{p.name}</span>
                          </button>
                        ))}
                        {playlistCreating ? (
                          <div className="p-2 border-t border-white/10" onClick={e => e.stopPropagation()}>
                            <input
                              autoFocus
                              value={newPlaylistName}
                              onChange={e => setNewPlaylistName(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleCreatePlaylistFromSelected();
                                if (e.key === 'Escape') { setPlaylistCreating(false); setNewPlaylistName(''); }
                              }}
                              placeholder="Playlist name..."
                              className="w-full bg-white/10 border border-white/20 rounded px-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-white/40"
                            />
                            <div className="flex gap-2 mt-1.5">
                              <button
                                onClick={handleCreatePlaylistFromSelected}
                                className="flex-1 text-xs py-1 rounded bg-[var(--theme-color)]/20 text-[var(--theme-color)] hover:bg-[var(--theme-color)]/30 transition-colors cursor-pointer"
                              >
                                Create
                              </button>
                              <button
                                onClick={() => { setPlaylistCreating(false); setNewPlaylistName(''); }}
                                className="flex-1 text-xs py-1 rounded bg-white/5 text-white/50 hover:bg-white/10 transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setPlaylistCreating(true)}
                            className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left text-white/50 hover:text-white hover:bg-white/5 transition-colors cursor-pointer ${playlists.length > 0 ? 'border-t border-white/10' : ''}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            New playlist...
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <div className="relative">
                  <button
                    onClick={openTierMenu}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5 text-[var(--theme-color)]" />
                    Tier List
                  </button>
                  {isTierMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => { setIsTierMenuOpen(false); setTierCreating(false); setNewTierName(''); }} />
                      <div className="absolute bottom-full mb-2 right-0 z-50 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl min-w-[220px] overflow-hidden">
                        {tierLists.length === 0 && !tierCreating && (
                          <div className="px-4 py-2 text-xs text-white/40">No tier lists yet</div>
                        )}
                        {tierLists.map(t => (
                          <button
                            key={t.id}
                            onClick={() => handleAddSelectedToTierList(t.id)}
                            className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left text-white/80 hover:bg-white/5 transition-colors cursor-pointer"
                          >
                            <span className="truncate">{t.name}</span>
                          </button>
                        ))}
                        {tierCreating ? (
                          <div className="p-2 border-t border-white/10" onClick={e => e.stopPropagation()}>
                            <input
                              autoFocus
                              value={newTierName}
                              onChange={e => setNewTierName(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleCreateTierListFromSelected();
                                if (e.key === 'Escape') { setTierCreating(false); setNewTierName(''); }
                              }}
                              placeholder="Tier list name..."
                              className="w-full bg-white/10 border border-white/20 rounded px-3 py-1.5 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-white/40"
                            />
                            <div className="flex gap-2 mt-1.5">
                              <button
                                onClick={handleCreateTierListFromSelected}
                                className="flex-1 text-xs py-1 rounded bg-[var(--theme-color)]/20 text-[var(--theme-color)] hover:bg-[var(--theme-color)]/30 transition-colors cursor-pointer"
                              >
                                Create
                              </button>
                              <button
                                onClick={() => { setTierCreating(false); setNewTierName(''); }}
                                className="flex-1 text-xs py-1 rounded bg-white/5 text-white/50 hover:bg-white/10 transition-colors cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setTierCreating(true)}
                            className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left text-white/50 hover:text-white hover:bg-white/5 transition-colors cursor-pointer ${tierLists.length > 0 ? 'border-t border-white/10' : ''}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                            New tier list...
                          </button>
                        )}
                        <div className="px-4 py-2 border-t border-white/10 text-[10px] leading-snug text-white/35">
                          Tier lists are saved to the cross-artist <span className="text-white/55 font-semibold">Tier List Maker</span> on the homepage, where you can rank &amp; export them.
                        </div>
                      </div>
                    </>
                  )}
                </div>
                <button
                  onClick={handleDownloadSelected}
                  disabled={isDownloadingSelected}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--theme-color)] text-black text-xs font-bold transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  {isDownloadingSelected ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  Download
                </button>
              </div>
            </motion.div>
          )}
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.9 }}
              className="fixed bottom-12 left-1/2 -translate-x-1/2 bg-[#0ba345] text-white px-6 py-3.5 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.4)] text-[15px] font-medium tracking-wide z-[9999] flex items-center gap-3"
            >
              <Check className="w-5 h-5 stroke-[2.5]" />
              {toastMessage}
            </motion.div>
          )}

          {zoomedImage && era.image && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setZoomedImage(false)}
              className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out backdrop-blur-sm"
            >
              <Img w={1200} eager src={era.image} alt={era.name} className="max-w-full max-h-full object-contain shadow-2xl rounded-md" />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
