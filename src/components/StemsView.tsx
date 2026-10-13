import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Play, ExternalLink, X, Share2, Volume2, Check, Download, Loader2, Star } from 'lucide-react';
import { Era, Song, SearchFilters } from '../types';
import { useState, useMemo, useEffect } from 'react';
import { formatTextWithTags, getCleanSongNameWithTags, matchesFilters, createSlug, getSongSlug, ALBUM_RELEASE_DATES, isSongNotAvailable, looksLikeRealLink, CUSTOM_IMAGES, getArtistName, buildArtistTag, buildTitleTag, buildDownloadName, handleDownloadFile, resolveUrl, detectAudioExt, embedID3Tags, embedFLACTags, flacToWav, embedWAVTags, formatTextForNotification, parseNoteDescription , Img, relPath, absPath, sanitizeFilename, runWithConcurrencyLimit} from '../utils';
import { useDownloadManager } from '../DownloadManagerContext';
import { SongTitle, SongExtra } from './SongTitle';
import { saveAs } from 'file-saver';
import { useSettings } from '../SettingsContext';
import { MvEntry, RemixEntry, SampleEntry } from '../App';
import { findMvsForSong, findRemixesForSong, findSamplesForSong } from './EraDetail';
import { AddToPlaylistButton } from './AddToPlaylistButton';
import { CommentButton } from './CommentButton';
import { makeEntryKey, makeEraKey, baseEraName, stampSongComment } from '../comments';
import { activeConfig } from '../artists/activeConfig';

export interface StemEntry {
  Era: string;
  Name: string;
  "Notes\n(Join the Discord to help fix any issues + help with dead links)"?: string;
  "File\nDate"?: string;
  "Leak Date"?: string | { valueType: string };
  "Full Length"?: string;
  BPM?: string | number;
  "Available Length"?: string;
  Quality?: string;
  "Link(s)"?: string;
}

interface StemsViewProps {
  eras: Era[];
  stemsData: StemEntry[];
  searchQuery: string;
  filters: SearchFilters;
  onPlaySong: (song: Song, era: Era, contextTracks?: Song[]) => void;
  currentSong?: Song | null;
  isPlaying?: boolean;
  mvData?: MvEntry[];
  remixData?: RemixEntry[];
  samplesData?: SampleEntry[];
  toggleFavorite?: (song: Song, eraName: string) => void;
  favoriteKeys?: { songName: string; eraName: string; url: string }[];
}

const ERA_MAPPINGS: Record<string, string> = {
  "Donda [V1]": "DONDA [V1]",
  "Bully": "BULLY [V1]",
  "BULLY": "BULLY [V1]"
};

function parseStemsToEras(stemsData: StemEntry[], allEras: Era[]): { eraName: string; image?: string; categories: { name: string; songs: Song[] }[] }[] {
  const result: { eraName: string; image?: string; categories: { name: string; songs: Song[] }[] }[] = [];
  let currentEraName = '';
  let currentEraDesc = '';
  let currentCategory = 'Default';
  let currentCategorySongs: Song[] = [];
  let currentEraCategories: { name: string; songs: Song[] }[] = [];

  const formatDate = (d: string | { valueType: string } | undefined) => {
    if (!d || typeof d === 'object') return '';
    try {
      if (d.includes('T') || d.includes('Z')) {
        const date = new Date(d);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
      }
      return d;
    } catch { return d; }
  };

  const CATEGORY_NAMES = ['Instrumentals', 'Acapellas', 'Studio Stems', 'Sessions', 'Live Acapellas', 'Live Stems', 'TV Tracks', 'Samples', 'Multitracks', 'Snippets'];

  for (const item of stemsData) {
    const isBrokenEra = typeof item.Era === 'string' && (
      item.Era.includes('OG File') ||
      item.Era.includes('Unavailable') ||
      // Stat-only era fields like "3 Total\n3 Instrumental" or "2 Acapella"
      item.Era.split('\n').every(line => /^\d+\s+\w/.test(line.trim()))
    );
    const isEraHeader = (!item.Era || isBrokenEra) && item.Name && (
      typeof item["Leak Date"] === 'object'
      || (item["Full Length"] && typeof item["Full Length"] === 'string' && item["Full Length"].length > 50)
      // Short-name era header format (e.g. vampgold): blank Era, era name in Name, nothing else
      || (!item["Link(s)"] && !item.Quality && !CATEGORY_NAMES.includes(item.Name))
    );
    const isCategoryHeader = !item.Era && item.Name && !item.Quality && !item["Link(s)"] && CATEGORY_NAMES.includes(item.Name);

    if (isEraHeader && !isCategoryHeader) {
      if (currentEraName && currentCategorySongs.length > 0) {
        currentEraCategories.push({ name: currentCategory, songs: currentCategorySongs });
      }
      if (currentEraName && currentEraCategories.length > 0) {
        const matchingEra = allEras.find(e => e.name === currentEraName);
        result.push({
          eraName: currentEraName + ' [Stems Album]',
          image: CUSTOM_IMAGES[currentEraName] || matchingEra?.image,
          categories: currentEraCategories
        });
      }

      let rawName = item.Name.split('\n')[0];
      const matchedKey = Object.keys(ERA_MAPPINGS).find(k => k.toLowerCase() === rawName.toLowerCase());
      currentEraName = matchedKey ? ERA_MAPPINGS[matchedKey] : rawName;
      currentEraDesc = '';
      currentCategory = 'Default';
      currentCategorySongs = [];
      currentEraCategories = [];
      continue;
    }

    if (isCategoryHeader) {
      if (currentCategorySongs.length > 0) {
        currentEraCategories.push({ name: currentCategory, songs: currentCategorySongs });
      }
      currentCategory = item.Name;
      currentCategorySongs = [];
      continue;
    }

    if (item.Era && item.Name) {
      // If the era column changed (flat-format CSVs), start a new era group
      const matchedKey = Object.keys(ERA_MAPPINGS).find(k => k.toLowerCase() === item.Era.toLowerCase());
      const mappedEraName = matchedKey ? ERA_MAPPINGS[matchedKey] : item.Era;
      if (mappedEraName !== currentEraName) {
        if (currentCategorySongs.length > 0) {
          currentEraCategories.push({ name: currentCategory, songs: currentCategorySongs });
        }
        if (currentEraName && currentEraCategories.length > 0) {
          const prevEra = allEras.find(e => e.name === currentEraName);
          result.push({
            eraName: currentEraName + ' [Stems Album]',
            image: CUSTOM_IMAGES[currentEraName] || prevEra?.image,
            categories: currentEraCategories,
          });
        }
        currentEraName = mappedEraName;
        currentCategory = 'Default';
        currentCategorySongs = [];
        currentEraCategories = [];
      }

      const notes = item["Notes\n(Join the Discord to help fix any issues + help with dead links)"] || (item as any).Notes || '';

      const links = item["Link(s)"] ? item["Link(s)"].split('\n').filter(l => l.trim()) : [];
      const nameParts = item.Name.split('\n');
      const songName = nameParts[0] || '';
      const extraParts = nameParts.slice(1).join('\n');
      const bpm = item.BPM ? String(item.BPM) : '';
      const fullLength = item["Full Length"];
      let trackLength = '';
      if (fullLength && typeof fullLength === 'string' && !fullLength.includes('T') && !fullLength.includes('Varied')) {
        trackLength = fullLength;
      }

      const song: Song = {
        name: songName + ' [Stems]',
        extra: extraParts ? '\n' + extraParts : undefined,
        description: typeof notes === 'string' ? notes : '',
        track_length: trackLength,
        leak_date: formatDate(item["Leak Date"]),
        file_date: formatDate(item["File\nDate"]),
        available_length: typeof item["Available Length"] === 'string' ? item["Available Length"] : '',
        quality: typeof item.Quality === 'string' ? item.Quality : '',
        url: links.length > 0 ? links[0] : '',
        urls: links,
        bpm: typeof bpm === 'string' ? bpm : '',
      };

      currentCategorySongs.push(song);
    }
  }

  if (currentCategorySongs.length > 0) {
    currentEraCategories.push({ name: currentCategory, songs: currentCategorySongs });
  }
  if (currentEraName && currentEraCategories.length > 0) {
    const matchingEra = allEras.find(e => e.name === currentEraName);
    result.push({
      eraName: currentEraName + ' [Stems Album]',
      image: CUSTOM_IMAGES[currentEraName] || matchingEra?.image,
      categories: currentEraCategories
    });
  }

  // Merge duplicate era groups (same eraName) into one
  const merged: typeof result = [];
  for (const entry of result) {
    const existing = merged.find(e => e.eraName === entry.eraName);
    if (existing) {
      for (const cat of entry.categories) {
        const existingCat = existing.categories.find(c => c.name === cat.name);
        if (existingCat) {
          existingCat.songs.push(...cat.songs);
        } else {
          existing.categories.push(cat);
        }
      }
    } else {
      merged.push(entry);
    }
  }
  return merged;
}

export function StemsView({ eras, stemsData, searchQuery, filters, onPlaySong, currentSong, isPlaying, mvData = [], remixData = [], samplesData = [], toggleFavorite, favoriteKeys = [] }: StemsViewProps) {
  const { settings } = useSettings();
  const { startJob, updateJob, startItem, finishItem, finishJob } = useDownloadManager();
  const [selectedEra, setSelectedEra] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const parsedEras = useMemo(() => {
    try {
      return parseStemsToEras(stemsData, eras).filter(era => !era.eraName.startsWith('NASIR') && !era.eraName.startsWith('K.T.S.E.') && !era.eraName.startsWith('NEVER STOP') && !era.eraName.startsWith('DAYTONA'));
    } catch (err) {
      console.error('Error parsing stems data:', err);
      return [];
    }
  }, [stemsData, eras]);

  useEffect(() => {
    const path = relPath(window.location.pathname);
    if (path.startsWith('/stems/')) {
      const slug = path.split('/stems/')[1];
      if (slug) {
        const match = parsedEras.find(e => createSlug(e.eraName) === slug);
        if (match) setSelectedEra(match.eraName);
      }
    }
  }, [parsedEras]);

  useEffect(() => {
    const currentPath = relPath(window.location.pathname);
    if (selectedEra) {
      const newPath = `/stems/${createSlug(selectedEra)}`;
      if (currentPath !== newPath) {
        window.history.pushState({ stemsEra: selectedEra }, '', absPath(newPath));
      }
    } else {
      if (currentPath.startsWith('/stems/')) {
        window.history.pushState({ stemsEra: null }, '', absPath('/stems'));
      }
    }
  }, [selectedEra]);

  useEffect(() => {
    const handlePopState = () => {
      const path = relPath(window.location.pathname);
      if (path.startsWith('/stems/')) {
        const slug = path.split('/stems/')[1];
        const match = parsedEras.find(e => createSlug(e.eraName) === slug);
        setSelectedEra(match ? match.eraName : null);
      } else if (path === '/stems') {
        setSelectedEra(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [parsedEras]);

  const filteredEras = useMemo(() => {
    const hasActiveFilters = filters.tags.length > 0 || filters.qualities.length > 0 || (filters.availableLengths && filters.availableLengths.length > 0) || filters.durationValue !== '' || filters.playableOnly;
    if (!searchQuery && !hasActiveFilters) return parsedEras;

    return parsedEras.map(era => {
      if (!hasActiveFilters && searchQuery && era.eraName.toLowerCase().includes(searchQuery.toLowerCase())) {
        return era;
      }

      const newCategories = era.categories.map(cat => {
        const matchingSongs = cat.songs.filter(s => {
          if (!matchesFilters(s, searchQuery, filters)) return false;

          if (filters.hasClips) {
            const has = findMvsForSong(s.name, era.eraName, mvData).length > 0;
            if (filters.hasClips === 'include' && !has) return false;
            if (filters.hasClips === 'exclude' && has) return false;
          }

          if (filters.hasRemixes) {
            const has = findRemixesForSong(s.name, era.eraName, remixData).length > 0;
            if (filters.hasRemixes === 'include' && !has) return false;
            if (filters.hasRemixes === 'exclude' && has) return false;
          }

          if (filters.hasSamples) {
            const has = findSamplesForSong(s.name, era.eraName, samplesData).length > 0;
            if (filters.hasSamples === 'include' && !has) return false;
            if (filters.hasSamples === 'exclude' && has) return false;
          }

          return true;
        });
        return { ...cat, songs: matchingSongs };
      }).filter(cat => cat.songs.length > 0);

      return { ...era, categories: newCategories };
    }).filter(era => era.categories.length > 0);
  }, [parsedEras, searchQuery, filters]);

  const selectedEraData = useMemo(() => {
    if (!selectedEra) return null;
    return parsedEras.find(e => e.eraName === selectedEra) || null;
  }, [selectedEra, parsedEras]);

  const filteredCategories = useMemo(() => {
    if (!selectedEraData) return [];

    const hasActiveFilters = filters.tags.length > 0 || filters.qualities.length > 0 || (filters.availableLengths && filters.availableLengths.length > 0) || filters.durationValue !== '' || filters.playableOnly;
    if (!searchQuery && !hasActiveFilters) return selectedEraData.categories;

    return selectedEraData.categories.map(cat => ({
      ...cat,
      songs: cat.songs.filter(s => {
        if (!matchesFilters(s, searchQuery, filters)) return false;

        if (filters.hasClips) {
          const has = findMvsForSong(s.name, selectedEraData.eraName, mvData).length > 0;
          if (filters.hasClips === 'include' && !has) return false;
          if (filters.hasClips === 'exclude' && has) return false;
        }

        if (filters.hasRemixes) {
          const has = findRemixesForSong(s.name, selectedEraData.eraName, remixData).length > 0;
          if (filters.hasRemixes === 'include' && !has) return false;
          if (filters.hasRemixes === 'exclude' && has) return false;
        }

        if (filters.hasSamples) {
          const has = findSamplesForSong(s.name, selectedEraData.eraName, samplesData).length > 0;
          if (filters.hasSamples === 'include' && !has) return false;
          if (filters.hasSamples === 'exclude' && has) return false;
        }

        return true;
      })
    })).filter(cat => cat.songs.length > 0);
  }, [selectedEraData, searchQuery, filters]);

  const allPlayableSongs = useMemo(() => {
    if (!filteredCategories) return [];
    return filteredCategories.flatMap(c => c.songs).filter(s => {
      const rawUrl = s.url || (s.urls && s.urls.length > 0 ? s.urls[0] : '');
      const isNotAvailable = isSongNotAvailable(s, rawUrl);
      return rawUrl && rawUrl.includes('pillows.su/f/') && !isNotAvailable;
    }).map(s => stampSongComment(s, { tracker: activeConfig.slug, type: 'Stems', era: selectedEraData?.eraName || '' }));
  }, [filteredCategories, selectedEraData]);

  const handleShare = (song: Song, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!selectedEra || !selectedEraData) return;

    if (settings.shareLinkType === 'pillowcase') {
      const rawUrl = song.url || (song.urls && song.urls.length > 0 ? song.urls[0] : '');
      if (rawUrl && rawUrl.includes('pillows.su/f/')) {
        navigator.clipboard.writeText(rawUrl).then(() => {
          setToastMessage('Pillowcase link copied!');
          setTimeout(() => setToastMessage(null), 2000);
        });
        return;
      }
    }

    const allSongsInEra = selectedEraData.categories.flatMap(c => c.songs);
    const shareUrl = `${window.location.origin}/stems/${createSlug(selectedEra)}?song=${getSongSlug(song, allSongsInEra)}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setToastMessage('Link copied!');
      setTimeout(() => setToastMessage(null), 2000);
    });
  };

  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadAlbum = async () => {
    if (!allPlayableSongs.length) return;
    setIsDownloading(true);
    setToastMessage(`Preparing download for ${allPlayableSongs.length} items...`);

    const stemsEraName = selectedEraData!.eraName.replace(' [Stems Album]', '');
    const jobId = startJob(stemsEraName, allPlayableSongs.length);
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    await runWithConcurrencyLimit(allPlayableSongs, async (song) => {
      const rawUrl = song.url || (song.urls && song.urls.length > 0 ? song.urls[0] : '');
      if (!rawUrl || !(rawUrl.includes('pillows.su/f/') || rawUrl.includes('imgur.gg/f/') || rawUrl.includes('ibb.co') || rawUrl.match(/\.(png|jpg|jpeg)$/i) || rawUrl.startsWith('https://i.scdn.co/'))) return;
      try {
        const { fetchUrl, isImage, imageExt, headers } = await resolveUrl(rawUrl);
        const res = await fetch(fetchUrl, headers ? { headers } : undefined);
        if (!res.ok && res.status !== 206) throw new Error('fetch failed');
        const ct = res.headers.get('content-type') ?? '';
        if (ct.startsWith('text/html') || ct.startsWith('application/json')) throw new Error('non-audio response');
        let blob = await res.blob();
        const songTitle = song.name.includes(' - ') ? song.name.substring(song.name.indexOf(' - ') + 3) : song.name;
        const fileName = buildDownloadName(song.name, settings.tagFeaturedArtists, settings.tagsAsEmojis);
        let ext: string;
        if (isImage) {
          ext = imageExt || await detectAudioExt(blob);
        } else {
          ext = await detectAudioExt(blob);
          if (ext === '.mp3') {
            if (ct.includes('flac'))                                     ext = '.flac';
            else if (ct.includes('wav') || ct.includes('wave'))          ext = '.wav';
            else if (ct.includes('aiff'))                                ext = '.aiff';
            else if (ct.includes('ogg') || ct.includes('opus'))          ext = '.ogg';
            else if (ct.includes('m4a') || (ct.includes('mp4') && !ct.includes('video'))) ext = '.m4a';
          }
          if (settings.embedMetadata && (ext === '.mp3' || ext === '.flac' || ext === '.wav')) {
            const artUrl = selectedEraData!.image || CUSTOM_IMAGES[stemsEraName];
            const tagMeta = {
              title: buildTitleTag(song.name, settings.tagFeaturedArtists),
              artist: buildArtistTag(song.name, stemsEraName, settings.tagFeaturedArtists),
              album: stemsEraName,
              year: ALBUM_RELEASE_DATES[stemsEraName]?.split('/').pop(),
              artworkUrl: artUrl,
            };
            try {
              if (ext === '.mp3') blob = await embedID3Tags(blob, tagMeta, songTitle);
              else if (ext === '.wav') blob = await embedWAVTags(blob, tagMeta, songTitle);
              else if (ext === '.flac') {
                try {
                  blob = await flacToWav(blob); ext = '.wav';
                  blob = await embedWAVTags(blob, tagMeta, songTitle);
                } catch {
                  blob = await embedFLACTags(blob, tagMeta, songTitle);
                }
              }
            } catch { /* skip tagging, save raw */ }
          }
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
      saveAs(content, `${stemsEraName}.zip`);
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

  const [zoomedImage, setZoomedImage] = useState(false);

  if (selectedEraData) {
    const dummyEra: Era = {
      name: selectedEraData.eraName,
      image: selectedEraData.image,
      data: {}
    };

    return (
      <>
        {typeof document !== 'undefined' && createPortal(
          <AnimatePresence>
            {zoomedImage && selectedEraData.image && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setZoomedImage(false)}
                className="fixed inset-0 z-[9999] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out backdrop-blur-sm"
              >
                <Img w={1200} eager src={selectedEraData.image} alt={selectedEraData.eraName} className="max-w-full max-h-full object-contain shadow-2xl rounded-md" />
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
        <motion.div
          initial={{ opacity: 0, filter: 'blur(10px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, filter: 'blur(10px)' }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="absolute inset-0 z-10 bg-yzy-black overflow-y-auto pb-64"
        >
          <div className="p-6 md:p-8 flex flex-col md:flex-row items-start gap-6 md:gap-8 border-b border-white/5 bg-white/5">
            <button onClick={() => setSelectedEra(null)} className="cursor-pointer mt-1 flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div
              className={`w-32 h-32 md:w-48 md:h-48 rounded-md overflow-hidden bg-white/5 shrink-0 shadow-xl ${selectedEraData.image ? 'cursor-pointer' : ''}`}
              onClick={() => { if (selectedEraData.image) setZoomedImage(true); }}
              title={selectedEraData.image ? "Click to zoom" : undefined}
            >
              {selectedEraData.image ? (
                <Img w={400} src={selectedEraData.image} alt={selectedEraData.eraName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-white/20 text-center p-4">{selectedEraData.eraName}</div>
              )}
            </div>

            <div className="flex flex-col justify-end h-full py-2">
              <div className="flex items-center gap-4 mb-3 flex-wrap">
                <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight flex items-center gap-4 flex-wrap">
                  <div className="truncate">{formatTextWithTags(selectedEraData.eraName)}</div>
                </h1>
                <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-[var(--theme-color)]/10 text-[var(--theme-color)] border border-[var(--theme-color)]/20">
                  Stems
                </span>

                <div className="flex items-center gap-2 ml-2">
                  <button
                    onClick={handleDownloadAlbum}
                    disabled={isDownloading}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
                    title="Download all items"
                  >
                    {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => {
                      const baseUrl = window.location.origin + window.location.pathname;
                      navigator.clipboard.writeText(baseUrl);
                      setToastMessage("Album link copied!");
                      setTimeout(() => setToastMessage(null), 3000);
                    }}
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
                    title="Copy album link"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                  <CommentButton
                    tracker={activeConfig.slug}
                    entryKey={makeEraKey(selectedEraData.eraName)}
                    entryLabel={baseEraName(selectedEraData.eraName)}
                    entryType="Era"
                    variant="pill"
                  />
                </div>
              </div>
              <p className="text-white/50 text-sm">Instrumentals, Sessions, Acapellas & Studio Stems</p>
            </div>
          </div>

          <div className="px-6 md:px-8 mt-8 max-w-6xl mx-auto">
            {filteredCategories.map(({ name: catName, songs }) => (
              <div key={catName} className="mb-10">
                <h3 className="text-lg font-bold text-white mb-4 pb-2 border-b border-white/10">{catName}</h3>

                <div className="flex flex-col">
                  <div className="flex items-center px-4 py-2 text-xs font-semibold text-white/40 uppercase tracking-wider border-b border-white/5 mb-2 hidden sm:flex">
                    <div className="w-8">#</div>
                    <div className="flex-1">Title</div>
                    <div className="w-20 text-center">BPM</div>
                    <div className="w-28">Quality</div>
                    <div className="w-20 text-right">Length</div>
                    <div className="w-10"></div>
                  </div>

                  {songs.map((song, i) => {
                    const rawUrl = song.url || (song.urls && song.urls.length > 0 ? song.urls[0] : '');
                    const isNotAvailable = isSongNotAvailable(song, rawUrl);
                    const lowerUrl = (rawUrl || '').toLowerCase();
                    const isTrulyEmptyLink = !rawUrl || lowerUrl === 'n/a' || lowerUrl.includes('link needed') || lowerUrl.includes('source needed') || !looksLikeRealLink(rawUrl);
                    const isPlayable = rawUrl.includes('pillows.su/f/') && !isNotAvailable;
                    const isEmpty = isTrulyEmptyLink || isNotAvailable || lowerUrl.includes('n/a');
                    const isCurrentlyPlaying = (currentSong?.url && song.url && currentSong.url === song.url) ||
                      (currentSong?.urls && song.urls && currentSong.urls.length > 0 && song.urls.length > 0 && currentSong.urls[0] === song.urls[0]);

                    const bpm = song.bpm || '';

                    return (
                      <div
                        key={i}
                        onClick={() => !isEmpty && onPlaySong(stampSongComment(song, { tracker: activeConfig.slug, type: 'Stems', era: selectedEraData?.eraName || catName }), dummyEra, allPlayableSongs)}
                        className={`group flex items-center px-4 py-2.5 rounded-md transition-colors ${isEmpty ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/5 cursor-pointer'} ${isCurrentlyPlaying ? 'bg-white/5' : ''}`}
                      >
                        <div className={`w-8 text-sm font-mono flex items-center ${isCurrentlyPlaying ? 'text-[var(--theme-color)]' : 'text-white/40 group-hover:text-white'}`}>
                          <span className="group-hover:hidden">
                            {isCurrentlyPlaying ? <Volume2 className={`w-4 h-4 ${isPlaying ? 'animate-pulse' : ''}`} /> : (i + 1)}
                          </span>
                          {isEmpty ? (
                            <X className="w-4 h-4 hidden group-hover:block" />
                          ) : isPlayable ? (
                            <Play className="w-4 h-4 hidden group-hover:block" />
                          ) : (
                            <ExternalLink className="w-4 h-4 hidden group-hover:block" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0 pr-4">
                          <div className={`flex items-baseline gap-2 truncate font-medium ${isCurrentlyPlaying ? 'text-[var(--theme-color)]' : 'text-white'}`}>
                            <SongTitle name={song.name} />
                            {song.extra && <SongExtra extra={song.extra} className={`text-xs truncate ${isCurrentlyPlaying ? 'text-[var(--theme-color)]/60' : 'text-white/40'}`} />}
                          </div>
                          {song.description && (() => {
                            const { note, ogFilename } = parseNoteDescription(song.description);
                            const display = note ? note.split('\n')[0] : ogFilename ? `OG: ${ogFilename}` : null;
                            return display ? <div className={`flex items-center gap-2 text-xs truncate mt-0.5 ${isCurrentlyPlaying ? 'text-[var(--theme-color)]/40' : 'text-white/40'}`}>{formatTextWithTags(display)}</div> : null;
                          })()}
                        </div>

                        <div className="w-20 text-center shrink-0 hidden sm:flex items-center justify-center">
                          {bpm && (
                            <span className={`text-[10px] px-2 py-0.5 rounded border ${isCurrentlyPlaying ? 'border-[var(--theme-color)]/20 text-[var(--theme-color)]/80 bg-[var(--theme-color)]/5' : 'border-amber-500/20 text-amber-400/70 bg-amber-500/5'}`}>
                              {bpm}
                            </span>
                          )}
                        </div>

                        <div className="w-28 shrink-0 hidden sm:flex items-center gap-1.5 flex-wrap">
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
                        </div>

                        <div className="w-20 shrink-0 hidden sm:flex items-center justify-end text-right text-xs font-mono whitespace-nowrap">
                          <span className={`${isCurrentlyPlaying ? 'text-[var(--theme-color)]/60' : 'text-white/40'}`}>{song.track_length || '-:--'}</span>
                        </div>

                        <div className="w-10 shrink-0 flex items-center justify-end gap-2">
                          {(() => {
                            if (!isPlayable || !toggleFavorite || song.name === "Alright but the beat is Father Stretch My Hands Pt. 1") return null;
                            const rawUrl = song.url || (song.urls && song.urls.length > 0 ? song.urls[0] : '');
                            const isStarred = favoriteKeys.some(k => k.songName === song.name && k.url === rawUrl);
                            return (
                              <button
                                onClick={(e) => { e.stopPropagation(); toggleFavorite(song, 'Stems'); }}
                                className={`p-1 rounded transition-all hover:bg-[var(--theme-color)]/20 cursor-pointer ${isStarred ? 'text-[var(--theme-color)]' : 'text-white/20 hover:text-[var(--theme-color)]'}`}
                                title={isStarred ? "Remove from Favorites" : "Add to Favorites"}
                              >
                                <Star className="w-3.5 h-3.5" fill={isStarred ? "currentColor" : "none"} />
                              </button>
                            );
                          })()}
                          {isPlayable && (() => {
                            const songUrl = song.url || (song.urls && song.urls.length > 0 ? song.urls[0] : '');
                            return (
                              <AddToPlaylistButton
                                song={song}
                                eraName="Stems"
                                url={songUrl}
                                isCurrentlyPlaying={isCurrentlyPlaying}
                              />
                            );
                          })()}
                          {!isEmpty && (
                            <button
                              onClick={(e) => handleShare(song, e)}
                              className="p-1 hover:bg-white/10 rounded cursor-pointer"
                              title="Copy link"
                            >
                              <Share2 className="w-3.5 h-3.5 text-white/50 hover:text-white" />
                            </button>
                          )}
                          <CommentButton
                            tracker={activeConfig.slug}
                            entryKey={makeEntryKey('Stems', selectedEraData?.eraName || catName, song.name)}
                            entryLabel={song.name}
                            entryType="Stems"
                            isCurrentlyPlaying={isCurrentlyPlaying}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {typeof document !== 'undefined' && createPortal(
          <AnimatePresence>
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
          </AnimatePresence>,
          document.body
        )}
      </>
    );
  }

  return (
    <motion.div
      key="stems-grid"
      initial={{ opacity: 0, filter: 'blur(10px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, filter: 'blur(10px)' }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="p-6 md:p-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 pb-32"
    >
      {filteredEras.map((era, i) => {
        const totalSongs = era.categories.reduce((acc, cat) => acc + cat.songs.length, 0);

        return (
          <motion.div
            key={era.eraName}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.02, 0.5), duration: 0.3 }}
            onClick={() => setSelectedEra(era.eraName)}
            className="group flex flex-col gap-3 cursor-pointer"
          >
            <div className="relative aspect-square rounded-md overflow-hidden bg-white/5 border border-white/5 group-hover:border-white/20 transition-colors">
              {era.image ? (
                <Img w={300} src={era.image} alt={era.eraName} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-white/5 text-white/20 font-bold text-2xl text-center p-4">
                  {era.eraName}
                </div>
              )}
              <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm text-white/80 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded">
                {totalSongs} Stems
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold text-white group-hover:underline truncate flex items-center gap-2">
                <div className="truncate">{formatTextWithTags(era.eraName)}</div>
              </h3>
              <p className="text-white/40 text-xs mt-0.5 truncate">
                {era.categories.map(c => c.name).join(', ')}
              </p>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
