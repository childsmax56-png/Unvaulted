import { useSettings, LOADING_SCREENS } from '../SettingsContext';
import { activeConfig } from '../artists/activeConfig';
import { AlignLeft, AlignCenter, AlignRight, History, Trash2, RotateCcw, X, RefreshCw, Check, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Category } from './Navbar';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { SiLastdotfm } from 'react-icons/si';
import { isLastfmLoggedIn } from '../lastfm';
import { saveAs } from 'file-saver';
import { Era } from '../types';
import { embedID3Tags, detectAudioExt, ALBUM_RELEASE_DATES, CUSTOM_IMAGES, buildArtistTag, sanitizeFilename, runWithConcurrencyLimit } from '../utils';
import { useDownloadManager } from '../DownloadManagerContext';
import { ArtEntry } from './ArtGallery';
import { StemEntry } from './StemsView';
import { MiscEntry } from './MiscView';

interface SettingsViewProps {
  onCategoryChange: (cat: Category) => void;
  searchQuery: string;
  eras?: Era[];
  artData?: ArtEntry[];
  stemsData?: StemEntry[];
  miscData?: MiscEntry[];
}

async function resolveAudioUrl(rawUrl: string): Promise<string> {
  if (rawUrl.includes('imgur.gg/f/')) {
    const id = rawUrl.split('/f/')[1];
    const host = new URL(rawUrl).host;
    const res = await fetch(`https://${host}/api/file/${id}`);
    const data = await res.json();
    return data.cdnUrl as string;
  }
  if (rawUrl.includes('pillows.su/f/')) {
    const id = rawUrl.split('/f/')[1];
    return `https://api.pillows.su/api/get/${id}`;
  }
  return rawUrl;
}

export function SettingsView({ onCategoryChange, searchQuery, eras = [], artData = [], stemsData = [], miscData = [] }: SettingsViewProps) {
  const { settings, updateSettings, resetSettings } = useSettings();
  const { startJob, updateJob, startItem, finishItem, finishJob } = useDownloadManager();
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [sheetUrlInput, setSheetUrlInput] = useState(settings.googleSheetsUrl);
  const [sheetSaved, setSheetSaved] = useState(false);
  const [dlProgress, setDlProgress] = useState<{ [key: string]: string | null }>({});

  const setProgress = (key: string, val: string | null) =>
    setDlProgress(prev => ({ ...prev, [key]: val }));

  const handleDownloadUnreleased = async () => {
    if (dlProgress['unreleased']) return;
    const songs: { name: string; era: string; eraImage?: string; songImage?: string; url: string }[] = [];
    for (const era of eras) {
      for (const tracks of Object.values(era.data || {})) {
        for (const song of tracks) {
          const url = song.url || (song.urls && song.urls[0]) || '';
          if (url) songs.push({ name: song.name, era: era.name, eraImage: era.image, songImage: song.image, url });
        }
      }
    }
    if (!songs.length) return;
    setProgress('unreleased', `0 / ${songs.length}`);
    const jobId = startJob('All Unreleased', songs.length);
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    let done = 0;
    await runWithConcurrencyLimit(songs, async ({ name, era, eraImage, songImage, url }) => {
      try {
        const fetchUrl = await resolveAudioUrl(url);
        const res = await fetch(fetchUrl);
        if (!res.ok) throw new Error('fetch failed');
        let blob = await res.blob();
        const ext = await detectAudioExt(blob);
        if (settings.embedMetadata && ext === '.mp3') {
          const artUrl = songImage || CUSTOM_IMAGES[era] || eraImage;
          const songTitle = name.includes(' - ') ? name.substring(name.indexOf(' - ') + 3) : name;
          try {
            blob = await embedID3Tags(blob, {
              title: songTitle,
              artist: buildArtistTag(name, era, settings.tagFeaturedArtists),
              album: era,
              year: ALBUM_RELEASE_DATES[era]?.split('/').pop(),
              artworkUrl: artUrl,
            }, songTitle);
          } catch { /* skip tagging, save raw */ }
        }
        zip.file(`${sanitizeFilename(era)}/${sanitizeFilename(name)}${ext}`, blob);
      } catch { /* skip */ } finally {
        done++;
        setProgress('unreleased', `${done} / ${songs.length}`);
      }
    }, 4, 2, (completed, total) => updateJob(jobId, completed, total), ({ name }) => startItem(jobId, name), ({ name }) => finishItem(jobId, name));
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'all-unreleased.zip');
    finishJob(jobId, 'done');
    setProgress('unreleased', null);
  };

  const handleDownloadArt = async () => {
    if (dlProgress['art']) return;
    const items = artData.filter(a => a['Link(s)']?.trim());
    if (!items.length) return;
    setProgress('art', `0 / ${items.length}`);
    const jobId = startJob('All Art', items.length);
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    let done = 0;
    await runWithConcurrencyLimit(items, async (item) => {
      try {
        const url = item['Link(s)'].split('\n')[0].trim();
        const res = await fetch(url);
        if (!res.ok) throw new Error('fetch failed');
        const blob = await res.blob();
        const ext = blob.type.includes('png') ? '.png' : blob.type.includes('gif') ? '.gif' : blob.type.includes('webp') ? '.webp' : '.jpg';
        zip.file(`${sanitizeFilename(item.Era || 'misc')}/${sanitizeFilename(item.Name)}${ext}`, blob);
      } catch { /* skip */ } finally {
        done++;
        setProgress('art', `${done} / ${items.length}`);
      }
    }, 4, 2, (completed, total) => updateJob(jobId, completed, total), (item) => startItem(jobId, item.Name), (item) => finishItem(jobId, item.Name));
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'all-art.zip');
    finishJob(jobId, 'done');
    setProgress('art', null);
  };

  const handleDownloadStems = async () => {
    if (dlProgress['stems']) return;
    const items = stemsData.filter(s => s['Link(s)']?.trim());
    if (!items.length) return;
    setProgress('stems', `0 / ${items.length}`);
    const jobId = startJob('All Stems', items.length);
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    let done = 0;
    await runWithConcurrencyLimit(items, async (item) => {
      try {
        const url = item['Link(s)']!.split('\n')[0].trim();
        const fetchUrl = await resolveAudioUrl(url);
        const res = await fetch(fetchUrl);
        if (!res.ok) throw new Error('fetch failed');
        const blob = await res.blob();
        const ext = await detectAudioExt(blob);
        zip.file(`${sanitizeFilename(item.Era || 'misc')}/${sanitizeFilename(item.Name)}${ext}`, blob);
      } catch { /* skip */ } finally {
        done++;
        setProgress('stems', `${done} / ${items.length}`);
      }
    }, 4, 2, (completed, total) => updateJob(jobId, completed, total), (item) => startItem(jobId, item.Name), (item) => finishItem(jobId, item.Name));
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'all-stems.zip');
    finishJob(jobId, 'done');
    setProgress('stems', null);
  };

  const handleDownloadMisc = async () => {
    if (dlProgress['misc']) return;
    const items = miscData.filter(m => m['Link(s)']?.trim());
    if (!items.length) return;
    setProgress('misc', `0 / ${items.length}`);
    const jobId = startJob('All Misc', items.length);
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    let done = 0;
    await runWithConcurrencyLimit(items, async (item) => {
      try {
        const url = item['Link(s)']!.split('\n')[0].trim();
        const fetchUrl = await resolveAudioUrl(url);
        const res = await fetch(fetchUrl);
        if (!res.ok) throw new Error('fetch failed');
        const blob = await res.blob();
        const isImg = blob.type.includes('png') || blob.type.includes('jpg') || blob.type.includes('jpeg') || blob.type.includes('gif') || blob.type.includes('webp');
        const ext = isImg ? (blob.type.includes('png') ? '.png' : blob.type.includes('gif') ? '.gif' : blob.type.includes('webp') ? '.webp' : '.jpg') : await detectAudioExt(blob);
        zip.file(`${sanitizeFilename(item.Era || 'misc')}/${sanitizeFilename(item.Name)}${ext}`, blob);
      } catch { /* skip */ } finally {
        done++;
        setProgress('misc', `${done} / ${items.length}`);
      }
    }, 4, 2, (completed, total) => updateJob(jobId, completed, total), (item) => startItem(jobId, item.Name), (item) => finishItem(jobId, item.Name));
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'all-misc.zip');
    finishJob(jobId, 'done');
    setProgress('misc', null);
  };

  const handleDownloadEverything = async () => {
    if (dlProgress['everything']) return;
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    const songs: { name: string; era: string; eraImage?: string; songImage?: string; url: string }[] = [];
    for (const era of eras) {
      for (const tracks of Object.values(era.data || {})) {
        for (const song of tracks) {
          const url = song.url || (song.urls && song.urls[0]) || '';
          if (url) songs.push({ name: song.name, era: era.name, eraImage: era.image, songImage: song.image, url });
        }
      }
    }
    const artItems = artData.filter(a => a['Link(s)']?.trim());
    const stemItems = stemsData.filter(s => s['Link(s)']?.trim());
    const miscItems = miscData.filter(m => m['Link(s)']?.trim());

    const total = songs.length + artItems.length + stemItems.length + miscItems.length;
    if (!total) return;
    let done = 0;
    const jobId = startJob('Everything', total);
    const tick = () => { done++; setProgress('everything', `${done} / ${total}`); updateJob(jobId, done, total); };

    setProgress('everything', `0 / ${total}`);

    type DownloadTask = { kind: 'song' | 'art' | 'stem' | 'misc'; data: any };
    const tasks: DownloadTask[] = [
      ...songs.map(data => ({ kind: 'song' as const, data })),
      ...artItems.map(data => ({ kind: 'art' as const, data })),
      ...stemItems.map(data => ({ kind: 'stem' as const, data })),
      ...miscItems.map(data => ({ kind: 'misc' as const, data })),
    ];

    await runWithConcurrencyLimit(tasks, async ({ kind, data }) => {
      try {
        if (kind === 'song') {
          const { name, era, eraImage, songImage, url } = data;
          const fetchUrl = await resolveAudioUrl(url);
          const res = await fetch(fetchUrl);
          if (!res.ok) throw new Error('fetch failed');
          let blob = await res.blob();
          const ext = await detectAudioExt(blob);
          if (settings.embedMetadata && ext === '.mp3') {
            const artUrl = songImage || CUSTOM_IMAGES[era] || eraImage;
            const songTitle = name.includes(' - ') ? name.substring(name.indexOf(' - ') + 3) : name;
            try {
              blob = await embedID3Tags(blob, {
                title: songTitle,
                artist: buildArtistTag(name, era, settings.tagFeaturedArtists),
                album: era,
                year: ALBUM_RELEASE_DATES[era]?.split('/').pop(),
                artworkUrl: artUrl,
              }, songTitle);
            } catch { /* skip tagging, save raw */ }
          }
          zip.file(`unreleased/${sanitizeFilename(era)}/${sanitizeFilename(name)}${ext}`, blob);
        } else if (kind === 'art') {
          const item = data;
          const url = item['Link(s)'].split('\n')[0].trim();
          const res = await fetch(url);
          if (!res.ok) throw new Error('fetch failed');
          const blob = await res.blob();
          const ext = blob.type.includes('png') ? '.png' : blob.type.includes('gif') ? '.gif' : blob.type.includes('webp') ? '.webp' : '.jpg';
          zip.file(`art/${sanitizeFilename(item.Era || 'misc')}/${sanitizeFilename(item.Name)}${ext}`, blob);
        } else if (kind === 'stem') {
          const item = data;
          const url = item['Link(s)']!.split('\n')[0].trim();
          const fetchUrl = await resolveAudioUrl(url);
          const res = await fetch(fetchUrl);
          if (!res.ok) throw new Error('fetch failed');
          const blob = await res.blob();
          const ext = await detectAudioExt(blob);
          zip.file(`stems/${sanitizeFilename(item.Era || 'misc')}/${sanitizeFilename(item.Name)}${ext}`, blob);
        } else {
          const item = data;
          const url = item['Link(s)']!.split('\n')[0].trim();
          const fetchUrl = await resolveAudioUrl(url);
          const res = await fetch(fetchUrl);
          if (!res.ok) throw new Error('fetch failed');
          const blob = await res.blob();
          const isImg = blob.type.includes('png') || blob.type.includes('jpg') || blob.type.includes('jpeg') || blob.type.includes('gif') || blob.type.includes('webp');
          const ext = isImg ? (blob.type.includes('png') ? '.png' : blob.type.includes('gif') ? '.gif' : blob.type.includes('webp') ? '.webp' : '.jpg') : await detectAudioExt(blob);
          zip.file(`misc/${sanitizeFilename(item.Era || 'misc')}/${sanitizeFilename(item.Name)}${ext}`, blob);
        }
      } catch { /* skip */ } finally { tick(); }
    }, 4, 2, undefined,
      ({ kind, data }) => startItem(jobId, kind === 'song' ? data.name : data.Name),
      ({ kind, data }) => finishItem(jobId, kind === 'song' ? data.name : data.Name));

    setProgress('everything', 'Zipping...');
    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'everything.zip');
    finishJob(jobId, 'done');
    setProgress('everything', null);
  };

  const handleSaveSheetUrl = () => {
    updateSettings({ googleSheetsUrl: sheetUrlInput.trim() });
    setSheetSaved(true);
    setTimeout(() => window.location.reload(), 800);
  };

  const handleEasterEgg = () => {
    window.dispatchEvent(new CustomEvent('play-easter-egg'));
  };

  const handleClearCache = () => {
    if (isConfirmingClear) {
      localStorage.clear();
      window.location.reload();
    } else {
      setIsConfirmingClear(true);
      setTimeout(() => setIsConfirmingClear(false), 3000);
    }
  };

  const handleResetSettings = () => {
    if (isConfirmingReset) {
      resetSettings();
      setIsConfirmingReset(false);
    } else {
      setIsConfirmingReset(true);
      setTimeout(() => setIsConfirmingReset(false), 3000);
    }
  };

  const matchesSearch = (text: string) => {
    if (!searchQuery) return true;
    return text.toLowerCase().includes(searchQuery.toLowerCase());
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -20, filter: 'blur(10px)' }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-12 bg-[#050505]"
    >
      <div className="max-w-4xl mx-auto space-y-4">

        {matchesSearch('tags as emojis') && (
          <div className="flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-xl">
            <span className="text-sm font-medium text-white/90">Tags as Emojis</span>
            <button
              onClick={() => updateSettings({ tagsAsEmojis: !settings.tagsAsEmojis })}
              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${settings.tagsAsEmojis ? 'bg-[var(--theme-color)]' : 'bg-white/10'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${settings.tagsAsEmojis ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        )}

        {Object.keys(activeConfig.ERA_THEMES).length > 0 && matchesSearch('era themes disable background') && (
          <div className="flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-xl">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white/90">Disable Era Themes</span>
              <span className="text-xs text-white/40">Turn off era-based background art and images</span>
            </div>
            <button
              onClick={() => updateSettings({ disableEraThemes: !settings.disableEraThemes })}
              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${settings.disableEraThemes ? 'bg-[var(--theme-color)]' : 'bg-white/10'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${settings.disableEraThemes ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        )}

        {matchesSearch('download og filename original filename') && (
          <div className="flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-xl">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white/90">Download as OG Filename</span>
              <span className="text-xs text-white/40">Use the original filename from notes when downloading, if available</span>
            </div>
            <button
              onClick={() => updateSettings({ downloadAsOgFilename: !settings.downloadAsOgFilename })}
              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${settings.downloadAsOgFilename ? 'bg-[var(--theme-color)]' : 'bg-white/10'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${settings.downloadAsOgFilename ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        )}

        {matchesSearch('embed metadata id3 tags title artist album year artwork') && (
          <div className="flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-xl">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white/90">Embed Metadata on Download</span>
              <span className="text-xs text-white/40">Embed title, artist, album, year, and cover art into downloaded MP3s</span>
            </div>
            <button
              onClick={() => updateSettings({ embedMetadata: !settings.embedMetadata })}
              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${settings.embedMetadata ? 'bg-[var(--theme-color)]' : 'bg-white/10'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${settings.embedMetadata ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        )}

        {matchesSearch('tag featured artists feat ft with features metadata id3 artist download') && (
          <div className="flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-xl">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white/90">Tag Featured Artists</span>
              <span className="text-xs text-white/40">Add featured artists (feat., ft., with) to the artist tag of downloaded songs</span>
            </div>
            <button
              onClick={() => updateSettings({ tagFeaturedArtists: !settings.tagFeaturedArtists })}
              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${settings.tagFeaturedArtists ? 'bg-[var(--theme-color)]' : 'bg-white/10'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${settings.tagFeaturedArtists ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        )}

        {matchesSearch('convert mp3 spotify local files transcode format flac wav download') && (
          <div className="flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-xl">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white/90">Download as MP3</span>
              <span className="text-xs text-white/40">Convert downloads to MP3 so they show up in Spotify's Local Files (WAV/FLAC/M4A are re-encoded; slower per song)</span>
            </div>
            <button
              onClick={() => updateSettings({ convertToMp3: !settings.convertToMp3 })}
              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${settings.convertToMp3 ? 'bg-[var(--theme-color)]' : 'bg-white/10'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${settings.convertToMp3 ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        )}

        {matchesSearch('share link pillowcase site song link copy') && (
          <div className="flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-xl">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white/90">Share Link Type</span>
              <span className="text-xs text-white/40">Choose what link is copied when you share a song</span>
            </div>
            <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1 shrink-0">
              <button
                onClick={() => updateSettings({ shareLinkType: 'site' })}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${settings.shareLinkType === 'site' ? 'bg-[var(--theme-color)] text-black' : 'text-white/50 hover:text-white'}`}
              >
                UNVAULTED
              </button>
              <button
                onClick={() => updateSettings({ shareLinkType: 'pillowcase' })}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${settings.shareLinkType === 'pillowcase' ? 'bg-[var(--theme-color)] text-black' : 'text-white/50 hover:text-white'}`}
              >
                Pillowcase
              </button>
            </div>
          </div>
        )}

        {matchesSearch('videos mini player floating pip music video') && (
          <div className="flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-xl">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white/90">Videos Mini Player</span>
              <span className="text-xs text-white/40">Play music videos in a floating mini player with fullscreen support</span>
            </div>
            <button
              onClick={() => updateSettings({ videosMiniPlayer: !settings.videosMiniPlayer })}
              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${settings.videosMiniPlayer ? 'bg-[var(--theme-color)]' : 'bg-white/10'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${settings.videosMiniPlayer ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        )}

        {matchesSearch('ye-i ai assistant error details debug') && (
          <div className="flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-xl">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white/90">YE-I: Show Detailed Errors</span>
              <span className="text-xs text-white/40">Show full API error messages instead of a generic response</span>
            </div>
            <button
              onClick={() => updateSettings({ aiErrorDetails: !settings.aiErrorDetails })}
              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${settings.aiErrorDetails ? 'bg-[var(--theme-color)]' : 'bg-white/10'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${settings.aiErrorDetails ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        )}

        {matchesSearch('keyboard shortcuts') && (
          <div className="hidden md:flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-xl">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white/90">Keyboard Shortcuts</span>
            </div>
            <button
              onClick={() => updateSettings({ keyboardShortcuts: !settings.keyboardShortcuts })}
              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${settings.keyboardShortcuts ? 'bg-[var(--theme-color)]' : 'bg-white/10'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${settings.keyboardShortcuts ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        )}

        {matchesSearch('keyboard shortcuts list') && (
          <div className="hidden md:flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-xl">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white/90">Keyboard Shortcuts List</span>
              <span className="text-xs text-white/40">View all available keyboard shortcuts</span>
            </div>
            <button
              onClick={() => setShowShortcutsModal(true)}
              className="text-xs font-medium bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-md transition-colors cursor-pointer shrink-0"
            >
              View List
            </button>
          </div>
        )}

        {matchesSearch('notification when playing') && (
          <div className="flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-xl">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white/90">Notification When Playing</span>
              <span className="text-xs text-white/40">Show browser notification on song change when tab is hidden</span>
            </div>
            <button
              onClick={async () => {
                if (!settings.notificationWhenPlaying) {
                  if (Notification.permission !== 'granted') {
                    const permission = await Notification.requestPermission();
                    if (permission === 'granted') {
                      updateSettings({ notificationWhenPlaying: true });
                    } else {
                      alert('Notification permission denied by browser.');
                    }
                  } else {
                    updateSettings({ notificationWhenPlaying: true });
                  }
                } else {
                  updateSettings({ notificationWhenPlaying: false });
                }
              }}
              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${settings.notificationWhenPlaying ? 'bg-[var(--theme-color)]' : 'bg-white/10'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${settings.notificationWhenPlaying ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        )}

        {matchesSearch('remember search') && (
          <div className="flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-xl">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white/90">Remember Search</span>
              <span className="text-xs text-white/40">Keep search query active when returning to home</span>
            </div>
            <button
              onClick={() => updateSettings({ rememberSearch: !settings.rememberSearch })}
              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${settings.rememberSearch ? 'bg-[var(--theme-color)]' : 'bg-white/10'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${settings.rememberSearch ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        )}

        {matchesSearch('full screen volume') && (
          <div className="hidden md:flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-xl">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white/90">Full Screen Volume Slider</span>
              <span className="text-xs text-white/40">Show the volume bar in full screen mode</span>
            </div>
            <button
              onClick={() => updateSettings({ fullScreenVolume: !settings.fullScreenVolume })}
              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${settings.fullScreenVolume ? 'bg-[var(--theme-color)]' : 'bg-white/10'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${settings.fullScreenVolume ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        )}

        {matchesSearch('not open in a new tab') && (
          <div className="flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-xl">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white/90">Not Open In A New Tab</span>
              <span className="text-xs text-white/40">Open unplayable songs in a popup window instead of a new tab</span>
            </div>
            <button
              onClick={() => updateSettings({ notOpenInNewTab: !settings.notOpenInNewTab })}
              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${settings.notOpenInNewTab ? 'bg-[var(--theme-color)]' : 'bg-white/10'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${settings.notOpenInNewTab ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        )}

        {matchesSearch('save listening history') && (
          <div className="flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-xl">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white/90">Save Listening History</span>
              <span className="text-xs text-white/40">Keep track of your most played songs</span>
            </div>
            <div className="flex items-center gap-4">
              {settings.saveListeningHistory && (
                <button
                  onClick={() => onCategoryChange('history')}
                  className="text-xs font-medium bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5"
                >
                  <History className="w-3.5 h-3.5" />
                  View History
                </button>
              )}
              <button
                onClick={() => updateSettings({ saveListeningHistory: !settings.saveListeningHistory })}
                className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${settings.saveListeningHistory ? 'bg-[var(--theme-color)]' : 'bg-white/10'}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${settings.saveListeningHistory ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
        )}

        {matchesSearch('show random song button') && (
          <div className="flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-xl">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white/90">Show Random Song Button</span>
              <span className="text-xs text-white/40">Display the dice button in Music tab</span>
            </div>
            <button
              onClick={() => updateSettings({ showRandomSongButton: !settings.showRandomSongButton })}
              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${settings.showRandomSongButton ? 'bg-[var(--theme-color)]' : 'bg-white/10'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${settings.showRandomSongButton ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        )}

        {matchesSearch('yedit affiliates comps mode') && (
          <div className="flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-xl">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white/90">Yedit Affiliates in Comps</span>
              <span className="text-xs text-white/40">Move Yedit Affiliates into Comps as a button, removing it from the navbar</span>
            </div>
            <button
              onClick={() => updateSettings({ YZYGOLDMode: !settings.YZYGOLDMode })}
              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${settings.YZYGOLDMode ? 'bg-[var(--theme-color)]' : 'bg-white/10'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${settings.YZYGOLDMode ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        )}

        {matchesSearch('dropdown nav navbar navigation') && (
          <div className="flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-xl">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white/90">Dropdown Navigation</span>
              <span className="text-xs text-white/40">Replace the tab bar with a compact dropdown menu</span>
            </div>
            <button
              onClick={() => updateSettings({ dropdownNav: !settings.dropdownNav })}
              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${settings.dropdownNav ? 'bg-[var(--theme-color)]' : 'bg-white/10'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${settings.dropdownNav ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        )}

        {isLastfmLoggedIn() && matchesSearch('last.fm formatting') && (
          <div className="flex flex-col gap-4 p-4 bg-[#111] border border-white/10 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <SiLastdotfm className="w-5 h-5 text-[#d51007]" />
              <span className="text-sm font-bold text-white/90">Last.fm Formatting</span>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white/90">Show Version</span>
                <span className="text-xs text-white/40">Include version in the song name</span>
              </div>
              <button
                onClick={() => updateSettings({ lastfmShowVersion: !settings.lastfmShowVersion })}
                className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${settings.lastfmShowVersion ? 'bg-[#d51007]' : 'bg-white/10'}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${settings.lastfmShowVersion ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between mt-2">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white/90">Show Tags</span>
                <span className="text-xs text-white/40">Include tags like Best Of, Ai, etc. in the song name</span>
              </div>
              <button
                onClick={() => updateSettings({ lastfmShowTags: !settings.lastfmShowTags })}
                className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${settings.lastfmShowTags ? 'bg-[#d51007]' : 'bg-white/10'}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${settings.lastfmShowTags ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between mt-2">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white/90">Show More Info</span>
                <span className="text-xs text-white/40">Include features, producers, refs and alternative names in the song name</span>
              </div>
              <button
                onClick={() => updateSettings({ lastfmShowFeats: !settings.lastfmShowFeats })}
                className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${settings.lastfmShowFeats ? 'bg-[#d51007]' : 'bg-white/10'}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${settings.lastfmShowFeats ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
        )}

        {matchesSearch('start volume') && (
          <div className="hidden md:flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-xl">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white/90">Start Volume</span>
              <span className="text-xs text-white/40">Set a default volume when you return to the site</span>
            </div>
            <div className="flex items-center gap-4">
              {settings.startVolume !== null && (
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={settings.startVolume}
                    onChange={(e) => updateSettings({ startVolume: parseInt(e.target.value) })}
                    className="w-24 accent-[var(--theme-color)]"
                  />
                  <span className="text-xs text-white/60 w-8 text-right">{settings.startVolume}%</span>
                </div>
              )}
              <button
                onClick={() => updateSettings({ startVolume: settings.startVolume !== null ? null : 100 })}
                className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${settings.startVolume !== null ? 'bg-[var(--theme-color)]' : 'bg-white/10'}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${settings.startVolume !== null ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
        )}

        {matchesSearch('startup shuffle') && (
          <div className="flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-xl">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white/90">Startup Shuffle</span>
              <span className="text-xs text-white/40">Enable shuffle automatically when opening the site</span>
            </div>
            <button
              onClick={() => updateSettings({ startupShuffle: !settings.startupShuffle })}
              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${settings.startupShuffle ? 'bg-[var(--theme-color)]' : 'bg-white/10'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${settings.startupShuffle ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        )}

        {matchesSearch('startup loop') && (
          <div className="flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-xl">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white/90">Startup Loop</span>
              <span className="text-xs text-white/40">Enable loop automatically when opening the site</span>
            </div>
            <div className="flex items-center gap-3">
              {settings.startupLoop > 0 && (
                <select
                  value={settings.startupLoop}
                  onChange={(e) => updateSettings({ startupLoop: parseInt(e.target.value) })}
                  className="bg-white/10 text-xs text-white px-2 py-1 rounded border border-white/10 outline-none"
                >
                  <option value={2} className="bg-[#111]">Loop All</option>
                  <option value={1} className="bg-[#111]">Loop One</option>
                </select>
              )}
              <button
                onClick={() => updateSettings({ startupLoop: settings.startupLoop > 0 ? 0 : 1 })}
                className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${settings.startupLoop > 0 ? 'bg-[var(--theme-color)]' : 'bg-white/10'}`}
              >
                <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${settings.startupLoop > 0 ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
              </button>
            </div>
          </div>
        )}

        {matchesSearch('show album art in mini player') && (
          <div className="flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-xl">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white/90">Show Album Art in Mini Player</span>
            </div>
            <button
              onClick={() => updateSettings({ showMiniPlayerArt: !settings.showMiniPlayerArt })}
              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${settings.showMiniPlayerArt ? 'bg-[var(--theme-color)]' : 'bg-white/10'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${settings.showMiniPlayerArt ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        )}

        {matchesSearch('notification settings show next song') && (
          <div className="flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-xl">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white/90">Show Next Song 10 Sec Before End Song</span>
              <span className="text-xs text-white/40">Shows a popup in Full Screen Mode</span>
            </div>
            <button
              onClick={() => updateSettings({ showNextSongNotification: !settings.showNextSongNotification })}
              className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${settings.showNextSongNotification ? 'bg-[var(--theme-color)]' : 'bg-white/10'}`}
            >
              <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${settings.showNextSongNotification ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
            </button>
          </div>
        )}

        {matchesSearch('theme color') && (
          <div className="flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-xl">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-white/90">Theme Color</span>
              <span className="text-xs text-white/40">Change the gold color</span>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={settings.themeColor}
                onChange={(e) => updateSettings({ themeColor: e.target.value })}
                className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent"
              />
            </div>
          </div>
        )}

        {matchesSearch('lyrics font size mini alignment opacity') && (
          <div className="border border-white/5 rounded-2xl p-2 bg-[#0a0a0a] mt-8">
            <div className="text-center py-8">
              <h3 className="text-xl font-bold text-white mb-1">Lyrics & Display</h3>
              <p className="text-sm text-white/50">
                Change the style <span onClick={handleEasterEgg} className="cursor-pointer">of</span> the site and lyrics.
              </p>
            </div>
            
            <div className="space-y-2">
              {matchesSearch('synced lyrics only') && (
                <div className="flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-xl">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-white/90">Synced Lyrics Only</span>
                    <span className="text-xs text-white/40">Hide plain text lyrics if synced are unavailable</span>
                  </div>
                  <button
                    onClick={() => updateSettings({ syncedLyricsOnly: !settings.syncedLyricsOnly })}
                    className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${settings.syncedLyricsOnly ? 'bg-[var(--theme-color)]' : 'bg-white/10'}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${settings.syncedLyricsOnly ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              )}

              {matchesSearch('mini lyrics alignment') && (
                <div className="flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-xl">
                  <span className="text-sm font-medium text-white/90">Mini lyrics alignment</span>
                  <div className="flex items-center bg-white/5 rounded-full p-1 border border-white/5">
                    <button
                      onClick={() => updateSettings({ miniLyricsAlignment: 'left' })}
                      className={`p-2 rounded-full transition-colors ${settings.miniLyricsAlignment === 'left' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'}`}
                    >
                      <AlignLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => updateSettings({ miniLyricsAlignment: 'center' })}
                      className={`p-2 rounded-full transition-colors ${settings.miniLyricsAlignment === 'center' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'}`}
                    >
                      <AlignCenter className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => updateSettings({ miniLyricsAlignment: 'right' })}
                      className={`p-2 rounded-full transition-colors ${settings.miniLyricsAlignment === 'right' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'}`}
                    >
                      <AlignRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {matchesSearch('font size') && (
                <div className="flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-xl">
                  <span className="text-sm font-medium text-white/90">Global Font Size</span>
                  <div className="flex items-center bg-white/5 rounded-full p-1 border border-white/5">
                    <button
                      onClick={() => updateSettings({ globalFontSize: 'small' })}
                      className={`px-3 py-1 text-xs rounded-full transition-colors ${settings.globalFontSize === 'small' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'}`}
                    >
                      Small
                    </button>
                    <button
                      onClick={() => updateSettings({ globalFontSize: 'medium' })}
                      className={`px-3 py-1 text-xs rounded-full transition-colors ${settings.globalFontSize === 'medium' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'}`}
                    >
                      Medium
                    </button>
                    <button
                      onClick={() => updateSettings({ globalFontSize: 'large' })}
                      className={`px-3 py-1 text-xs rounded-full transition-colors ${settings.globalFontSize === 'large' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'}`}
                    >
                      Large
                    </button>
                  </div>
                </div>
              )}

              {matchesSearch('show album art in mini lyrics') && (
                <div className="flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-xl">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-white/90">Show Album Art in Mini Lyrics</span>
                  </div>
                  <button
                    onClick={() => updateSettings({ showMiniLyricsArt: !settings.showMiniLyricsArt })}
                    className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${settings.showMiniLyricsArt ? 'bg-[var(--theme-color)]' : 'bg-white/10'}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${settings.showMiniLyricsArt ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              )}

              {matchesSearch('mini lyrics opacity') && (
                <div className="flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-xl">
                  <span className="text-sm font-medium text-white/90">Mini Lyrics Opacity</span>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={settings.miniLyricsOpacity}
                      onChange={(e) => updateSettings({ miniLyricsOpacity: parseInt(e.target.value) })}
                      className="w-24 accent-[var(--theme-color)]"
                    />
                    <span className="text-xs text-white/60 w-8 text-right">{settings.miniLyricsOpacity}%</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {matchesSearch('custom songs google sheets import spreadsheet') && (
          <div className="border border-white/5 rounded-2xl p-2 bg-[#0a0a0a] mt-8">
            <div className="text-center py-8">
              <h3 className="text-xl font-bold text-white mb-1">Custom Songs</h3>
              <p className="text-sm text-white/50">Import songs from a public Google Sheet.</p>
            </div>
            <div className="space-y-2">
              <div className="flex flex-col gap-3 p-4 bg-[#111] border border-white/5 rounded-xl">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-white/90">Google Sheets URL</span>
                  <span className="text-xs text-white/40">
                    Paste a public Google Sheets URL using the tracker format (columns: Era, Name, Notes, Track Length, File Date, Leak Date, Available Length, Quality, Link(s)). Songs are added on page load.
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://docs.google.com/spreadsheets/d/..."
                    value={sheetUrlInput}
                    onChange={(e) => setSheetUrlInput(e.target.value)}
                    className="flex-1 bg-white/5 text-xs text-white px-3 py-2 rounded-lg border border-white/10 outline-none focus:border-white/30 min-w-0"
                  />
                  <button
                    onClick={handleSaveSheetUrl}
                    className={`text-xs font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-1.5 shrink-0 ${
                      sheetSaved
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                  >
                    {sheetSaved ? <Check className="w-3.5 h-3.5" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    {sheetSaved ? 'Saved!' : 'Save & Reload'}
                  </button>
                </div>
                {settings.googleSheetsUrl && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white/40 truncate max-w-xs">{settings.googleSheetsUrl}</span>
                    <button
                      onClick={() => { setSheetUrlInput(''); updateSettings({ googleSheetsUrl: '' }); }}
                      className="text-xs text-red-400/70 hover:text-red-400 transition-colors shrink-0 ml-2"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {matchesSearch('loading screen startup intro') && (
          <div className="border border-white/5 rounded-2xl p-2 bg-[#0a0a0a] mt-8">
            <div className="text-center py-8">
              <h3 className="text-xl font-bold text-white mb-1">Loading Screen</h3>
              <p className="text-sm text-white/50">Choose a loading screen shown on startup.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pb-2">
              {LOADING_SCREENS.map((screen) => (
                <button
                  key={screen.id}
                  onClick={() => updateSettings({ loadingScreen: screen.id })}
                  className={`relative p-4 rounded-xl border transition-all text-left cursor-pointer ${
                    settings.loadingScreen === screen.id
                      ? 'border-[var(--theme-color)] bg-[var(--theme-color)]/10'
                      : 'border-white/5 bg-[#111] hover:bg-[#1a1a1a]'
                  }`}
                >
                  {settings.loadingScreen === screen.id && (
                    <div className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[var(--theme-color)]" />
                  )}
                  <span className={`text-sm font-medium ${settings.loadingScreen === screen.id ? 'text-[var(--theme-color)]' : 'text-white/80'}`}>
                    {screen.label}
                  </span>
                  {screen.id === 'shuffle' && (
                    <span className="block text-xs text-white/30 mt-0.5">Random each visit</span>
                  )}
                  {screen.type !== 'none' && screen.id !== 'shuffle' && (
                    <span className="block text-xs text-white/30 mt-0.5">{screen.type === 'video' ? 'Video' : 'GIF'}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {matchesSearch('mass downloads download all unreleased art stems misc everything') && (
          <div className="border border-white/5 rounded-2xl p-2 bg-[#0a0a0a] mt-8">
            <div className="text-center py-8">
              <h3 className="text-xl font-bold text-white mb-1">Mass Downloads</h3>
              <p className="text-sm text-white/50">Download entire categories as a ZIP file.</p>
              <p className="text-xs text-yellow-400/70 mt-1">⚠ Keep this tab open and active until the download finishes.</p>
              <p className="text-xs text-white/30 mt-1">Tip: turn off <span className="text-white/50">Embed Metadata on Download</span> for faster downloads.</p>
            </div>
            <div className="space-y-2 pb-2">
              <div className="flex items-center justify-between p-4 bg-[var(--theme-color)]/10 border border-[var(--theme-color)]/20 rounded-xl">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-white/90">Download Everything</span>
                  <span className="text-xs text-white/40">All unreleased, art, stems, and misc in one ZIP</span>
                </div>
                <button
                  onClick={handleDownloadEverything}
                  disabled={!!dlProgress['everything']}
                  className="text-xs font-bold bg-[var(--theme-color)] hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md transition-opacity flex items-center gap-2 shrink-0 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  {dlProgress['everything'] ? dlProgress['everything'] : 'Download Everything'}
                </button>
              </div>
              {[
                { key: 'unreleased', label: 'Download All Unreleased', desc: 'All songs from every era', handler: handleDownloadUnreleased },
                { key: 'art', label: 'Download All Art', desc: 'Every art gallery entry', handler: handleDownloadArt },
                { key: 'stems', label: 'Download All Stems', desc: 'Every stems entry', handler: handleDownloadStems },
                { key: 'misc', label: 'Download All Misc', desc: 'Every misc entry', handler: handleDownloadMisc },
              ].map(({ key, label, desc, handler }) => (
                <div key={key} className="flex items-center justify-between p-4 bg-[#111] border border-white/5 rounded-xl">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-white/90">{label}</span>
                    <span className="text-xs text-white/40">{desc}</span>
                  </div>
                  <button
                    onClick={handler}
                    disabled={!!dlProgress[key]}
                    className="text-xs font-medium bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md transition-colors flex items-center gap-2 shrink-0 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {dlProgress[key] ? dlProgress[key] : 'Download'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {matchesSearch('clear cache data reset all settings') && (
          <div className="border border-red-500/20 rounded-2xl p-2 bg-[#0a0a0a] mt-8">
            <div className="text-center py-8">
              <h3 className="text-xl font-bold text-red-400 mb-1">Danger Zone</h3>
            </div>
            
            <div className="space-y-2">
              {matchesSearch('clear cache data') && (
                <div className="flex items-center justify-between p-4 bg-[#111] border border-red-500/10 rounded-xl">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-white/90">Clear Cache & Data</span>
                    <span className="text-xs text-white/40">Removes all local data and reloads</span>
                  </div>
                  <button
                    onClick={handleClearCache}
                    className={`text-xs font-bold px-4 py-2 rounded-md transition-colors flex items-center gap-2 ${isConfirmingClear ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-red-500/10 hover:bg-red-500/20 text-red-400'}`}
                  >
                    <Trash2 className="w-4 h-4" />
                    {isConfirmingClear ? 'Are you sure?' : 'Clear Data'}
                  </button>
                </div>
              )}

              {matchesSearch('reset all settings') && (
                <div className="flex items-center justify-between p-4 bg-[#111] border border-red-500/10 rounded-xl">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-white/90">Reset All Settings</span>
                    <span className="text-xs text-white/40">Restore to the default settings</span>
                  </div>
                  <button
                    onClick={handleResetSettings}
                    className={`text-xs font-bold px-4 py-2 rounded-md transition-colors flex items-center gap-2 ${isConfirmingReset ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-red-500/10 hover:bg-red-500/20 text-red-400'}`}
                  >
                    <RotateCcw className="w-4 h-4" />
                    {isConfirmingReset ? 'Are you sure?' : 'Reset Settings'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {showShortcutsModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowShortcutsModal(false)}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#111] border border-white/10 rounded-xl max-w-md w-full p-6 shadow-2xl max-h-[80vh] overflow-y-auto custom-scrollbar"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-white">Keyboard Shortcuts</h3>
                  <button onClick={() => setShowShortcutsModal(false)} className="text-white/50 hover:text-white cursor-pointer">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <span className="text-sm text-white/80 font-medium">Play / Pause</span>
                    <div className="flex gap-2">
                      <kbd className="px-2 py-1 bg-white/10 rounded text-xs text-white font-mono border border-white/10">Space</kbd>
                      <kbd className="px-2 py-1 bg-white/10 rounded text-xs text-white font-mono border border-white/10">K</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <span className="text-sm text-white/80 font-medium">Next Song</span>
                    <div className="flex gap-2">
                      <kbd className="px-2 py-1 bg-white/10 rounded text-xs text-white font-mono border border-white/10">Right Arrow</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <span className="text-sm text-white/80 font-medium">Previous Song</span>
                    <div className="flex gap-2">
                      <kbd className="px-2 py-1 bg-white/10 rounded text-xs text-white font-mono border border-white/10">Left Arrow</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <span className="text-sm text-white/80 font-medium">Toggle Full Screen</span>
                    <div className="flex gap-2">
                      <kbd className="px-2 py-1 bg-white/10 rounded text-xs text-white font-mono border border-white/10">F</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <span className="text-sm text-white/80 font-medium">Toggle Lyrics</span>
                    <div className="flex gap-2">
                      <kbd className="px-2 py-1 bg-white/10 rounded text-xs text-white font-mono border border-white/10">L</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <span className="text-sm text-white/80 font-medium">Toggle Shuffle</span>
                    <div className="flex gap-2">
                      <kbd className="px-2 py-1 bg-white/10 rounded text-xs text-white font-mono border border-white/10">S</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <span className="text-sm text-white/80 font-medium">Toggle Loop</span>
                    <div className="flex gap-2">
                      <kbd className="px-2 py-1 bg-white/10 rounded text-xs text-white font-mono border border-white/10">O</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <span className="text-sm text-white/80 font-medium">Toggle Favorite</span>
                    <div className="flex gap-2">
                      <kbd className="px-2 py-1 bg-white/10 rounded text-xs text-white font-mono border border-white/10">G</kbd>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <span className="text-sm text-white/80 font-medium">Download Song</span>
                    <div className="flex gap-2">
                      <kbd className="px-2 py-1 bg-white/10 rounded text-xs text-white font-mono border border-white/10">D</kbd>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </motion.div>
  );
}
