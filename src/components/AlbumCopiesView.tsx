import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ExternalLink, Download, X, Share2, Disc3 } from 'lucide-react';
import { useState, useMemo, useEffect, Fragment } from 'react';
import { Era } from '../types';
import { formatTextWithTags, createSlug, CUSTOM_IMAGES, Img } from '../utils';
import { SongTitle } from './SongTitle';
import { CommentButton } from './CommentButton';
import { makeEntryKey, makeEraKey, baseEraName } from '../comments';
import { activeConfig } from '../artists/activeConfig';
import { SuberaBanner } from './SuberaBanner';

export interface AlbumCopy {
  name: string;
  extra?: string;
  notes: string;
  copy_length: string;
  date: string;
  available_length: string;
  type: string;
  quality: string;
  url: string;
  urls: string[];
  subera?: string;
  subera_note?: string;
}

export interface AlbumCopyEra {
  name: string;
  extra?: string;
  copies: AlbumCopy[];
}

interface AlbumCopiesViewProps {
  eras: Era[];
  albumCopiesData: AlbumCopyEra[];
  searchQuery: string;
}

// A link that actually points at a downloadable copy (vs. "Link Needed" / "N/A" placeholders).
function isRealLink(url: string): boolean {
  const u = (url || '').trim().toLowerCase();
  if (!u) return false;
  if (u === 'n/a' || u.includes('link needed') || u.includes('source needed') || u.includes('tba')) return false;
  return u.startsWith('http');
}

function sanitizeFilename(name: string): string {
  const base = (name || 'album-copy').replace(/[\r\n"\\/:*?<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'album-copy';
  return /\.zip$/i.test(base) ? base : `${base}.zip`;
}

// Resolve a copy link to a one-click download when the host allows it.
//   - Pillowcase: streamed through our /api/download proxy with a proper filename.
//     (pillows.su serves cross-site and Cloudflare-worker fetches fine.)
//   - Pixeldrain: 403s every cross-site request AND every Cloudflare-worker fetch
//     (hotlink + cf-worker blocks), so it can't be proxied or hot-linked — we open
//     its /u/ page, which has its own download button.
//   - Anything else (krakenfiles/mega/drive/soundcloud): open the host page.
function getDownloadTarget(rawUrl: string, filename: string): { href: string; direct: boolean } | null {
  const u = (rawUrl || '').trim();
  if (!isRealLink(u)) return null;
  const low = u.toLowerCase();
  if (low.includes('pillows.su/f/')) {
    const id = u.split('/f/')[1]?.split(/[?#]/)[0];
    if (id) return { href: `/api/download?id=${id}&name=${encodeURIComponent(sanitizeFilename(filename))}`, direct: true };
  }
  return { href: u, direct: false };
}

export function AlbumCopiesView({ eras, albumCopiesData, searchQuery }: AlbumCopiesViewProps) {
  const [selectedEra, setSelectedEra] = useState<string | null>(null);
  const [zoomedImage, setZoomedImage] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const erasWithImages = useMemo(() => {
    return albumCopiesData
      .filter(e => e.copies.length > 0)
      .map(e => {
        const matchingEra = eras.find(era => era.name === e.name);
        return {
          ...e,
          image: CUSTOM_IMAGES[e.name] || matchingEra?.image,
        };
      });
  }, [albumCopiesData, eras]);

  useEffect(() => {
    const path = window.location.pathname;
    if (path.includes('/albumcopies/')) {
      const slug = path.split('/albumcopies/')[1];
      if (slug) {
        const match = erasWithImages.find(e => createSlug(e.name) === slug);
        if (match) setSelectedEra(match.name);
      }
    }
  }, [erasWithImages]);

  useEffect(() => {
    if (selectedEra) {
      const newPath = `/albumcopies/${createSlug(selectedEra)}`;
      if (!window.location.pathname.endsWith(newPath)) {
        window.history.pushState({ albumCopiesEra: selectedEra }, '', newPath);
      }
    } else if (window.location.pathname.includes('/albumcopies/')) {
      window.history.pushState({ albumCopiesEra: null }, '', '/albumcopies');
    }
  }, [selectedEra]);

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      if (path.includes('/albumcopies/')) {
        const slug = path.split('/albumcopies/')[1];
        const match = erasWithImages.find(e => createSlug(e.name) === slug);
        setSelectedEra(match ? match.name : null);
      } else if (path.endsWith('/albumcopies')) {
        setSelectedEra(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [erasWithImages]);

  const query = searchQuery.trim().toLowerCase();

  const filteredEras = useMemo(() => {
    if (!query) return erasWithImages;
    return erasWithImages
      .map(era => {
        if (era.name.toLowerCase().includes(query)) return era;
        const copies = era.copies.filter(c =>
          c.name.toLowerCase().includes(query) ||
          (c.notes || '').toLowerCase().includes(query) ||
          (c.quality || '').toLowerCase().includes(query),
        );
        return { ...era, copies };
      })
      .filter(era => era.copies.length > 0);
  }, [erasWithImages, query]);

  const selectedEraData = useMemo(() => {
    if (!selectedEra) return null;
    return erasWithImages.find(e => e.name === selectedEra) || null;
  }, [selectedEra, erasWithImages]);

  const visibleCopies = useMemo(() => {
    if (!selectedEraData) return [];
    if (!query) return selectedEraData.copies;
    if (selectedEraData.name.toLowerCase().includes(query)) return selectedEraData.copies;
    return selectedEraData.copies.filter(c =>
      c.name.toLowerCase().includes(query) ||
      (c.notes || '').toLowerCase().includes(query) ||
      (c.quality || '').toLowerCase().includes(query),
    );
  }, [selectedEraData, query]);

  const triggerToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleShareEra = () => {
    if (!selectedEraData) return;
    const shareUrl = `${window.location.origin}/albumcopies/${createSlug(selectedEraData.name)}`;
    navigator.clipboard.writeText(shareUrl)
      .then(() => triggerToast('Link copied to clipboard'))
      .catch(() => triggerToast('Failed to copy link'));
  };

  if (selectedEraData) {
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
                <Img w={1200} eager src={selectedEraData.image} alt={selectedEraData.name} className="max-w-full max-h-full object-contain shadow-2xl rounded-md" />
              </motion.div>
            )}
            {toastMessage && (
              <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[10100] px-6 py-3 bg-white text-black font-bold rounded-full shadow-[0_8px_30px_rgb(255,255,255,0.2)] flex items-center gap-2 text-[15px] tracking-wide"
              >
                {toastMessage}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
        <motion.div
          initial={{ opacity: 0, filter: 'blur(10px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, filter: 'blur(10px)' }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="absolute inset-0 z-10 bg-yzy-black overflow-y-auto custom-scrollbar pb-64"
        >
          <div className="p-6 md:p-8 flex flex-col md:flex-row items-start gap-6 md:gap-8 border-b border-white/5 bg-white/5">
            <button onClick={() => setSelectedEra(null)} className="cursor-pointer mt-1 flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0">
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div
              className={`w-32 h-32 md:w-48 md:h-48 rounded-md overflow-hidden bg-white/5 shrink-0 shadow-xl ${selectedEraData.image ? 'cursor-pointer' : ''}`}
              onClick={() => { if (selectedEraData.image) setZoomedImage(true); }}
              title={selectedEraData.image ? 'Click to zoom' : undefined}
            >
              {selectedEraData.image ? (
                <Img w={400} src={selectedEraData.image} alt={selectedEraData.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-white/20 text-center p-4">{selectedEraData.name}</div>
              )}
            </div>

            <div className="flex flex-col justify-end h-full py-2">
              <div className="flex items-center gap-4 mb-3 flex-wrap">
                <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight flex items-center gap-4 flex-wrap">
                  <div className="truncate">{formatTextWithTags(selectedEraData.name)}</div>
                </h1>
                <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  Album Copies
                </span>
              </div>
              {selectedEraData.extra && (
                <p className="text-white/50 text-sm mb-2">{formatTextWithTags(selectedEraData.extra)}</p>
              )}
              <p className="text-white/40 text-xs mb-4">{selectedEraData.copies.length} {selectedEraData.copies.length === 1 ? 'copy' : 'copies'} — full album downloads &amp; detailed notes</p>

              <div className="flex items-center gap-2 mt-auto">
                <button
                  onClick={handleShareEra}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5" /> Share
                </button>
                <CommentButton
                  tracker={activeConfig.slug}
                  entryKey={makeEraKey(selectedEraData.name)}
                  entryLabel={baseEraName(selectedEraData.name)}
                  entryType="Era"
                  variant="pill"
                />
              </div>
            </div>
          </div>

          <div className="px-6 md:px-8 mt-8 max-w-5xl mx-auto flex flex-col gap-4">
            {visibleCopies.map((copy, i) => {
              const url = copy.url || (copy.urls && copy.urls[0]) || '';
              const dl = getDownloadTarget(url, `${copy.name}`);
              const playable = dl !== null;
              const showSubera = !!copy.subera && copy.subera !== visibleCopies[i - 1]?.subera;
              return (
                <Fragment key={`${copy.name}-${i}`}>
                {showSubera && <SuberaBanner name={copy.subera!} note={copy.subera_note} className={i > 0 ? 'mt-2 !mb-0' : '!mb-0'} />}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.4), duration: 0.3 }}
                  className={`group rounded-lg border transition-colors ${playable ? 'border-white/10 hover:border-white/25 bg-white/[0.03]' : 'border-white/5 bg-white/[0.01]'}`}
                >
                  <div className="p-4 md:p-5 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2 text-white font-semibold text-base md:text-lg">
                          <span className="text-white/30 font-mono text-sm shrink-0">{i + 1}.</span>
                          <SongTitle name={copy.name} />
                        </div>
                        {copy.extra && (
                          <div className="text-white/40 text-xs mt-1 pl-6">{formatTextWithTags(copy.extra)}</div>
                        )}
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        {dl ? (
                          <a
                            href={dl.href}
                            {...(dl.direct
                              ? { download: sanitizeFilename(copy.name) }
                              : { target: '_blank', rel: 'noopener noreferrer' })}
                            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--theme-color)]/15 hover:bg-[var(--theme-color)]/25 text-[var(--theme-color)] text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                            title={dl.direct ? 'Download zip' : 'Open download page'}
                          >
                            {dl.direct ? <Download className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
                            {dl.direct ? 'Download' : 'Open Page'}
                          </a>
                        ) : (
                          <span className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 text-white/30 text-xs font-bold uppercase tracking-wider">
                            <X className="w-3.5 h-3.5" /> No Link
                          </span>
                        )}
                        <CommentButton
                          tracker={activeConfig.slug}
                          entryKey={makeEntryKey('AlbumCopy', selectedEraData.name, copy.name)}
                          entryLabel={copy.name}
                          entryType="AlbumCopy"
                        />
                      </div>
                    </div>

                    {(copy.copy_length || copy.quality || copy.available_length || copy.type || copy.date) && (
                      <div className="flex items-center gap-1.5 flex-wrap pl-6">
                        {copy.type && <Chip>{copy.type}</Chip>}
                        {copy.quality && <Chip>{copy.quality}</Chip>}
                        {copy.available_length && <Chip>{copy.available_length}</Chip>}
                        {copy.copy_length && <Chip>⏱ {copy.copy_length}</Chip>}
                        {copy.date && <Chip>{copy.date}</Chip>}
                      </div>
                    )}

                    {copy.notes && (
                      <p className="text-white/55 text-sm leading-relaxed whitespace-pre-wrap pl-6 border-l border-white/5 ml-2">
                        {formatTextWithTags(copy.notes)}
                      </p>
                    )}
                  </div>
                </motion.div>
                </Fragment>
              );
            })}
            {visibleCopies.length === 0 && (
              <div className="text-white/40 text-sm py-12 text-center">No copies match your search.</div>
            )}
          </div>
        </motion.div>
      </>
    );
  }

  return (
    <motion.div
      key="albumcopies-grid"
      initial={{ opacity: 0, filter: 'blur(10px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, filter: 'blur(10px)' }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="p-6 md:p-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 pb-32"
    >
      {filteredEras.map((era, i) => (
        <motion.div
          key={era.name}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i * 0.02, 0.5), duration: 0.3 }}
          onClick={() => setSelectedEra(era.name)}
          className="group flex flex-col gap-3 cursor-pointer"
        >
          <div className="relative aspect-square rounded-md overflow-hidden bg-white/5 border border-white/5 group-hover:border-white/20 transition-colors">
            {era.image ? (
              <Img w={300} src={era.image} alt={era.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-white/5 text-white/20 font-bold text-2xl text-center p-4">
                {era.name}
              </div>
            )}
            <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm text-white/80 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded flex items-center gap-1">
              <Disc3 className="w-3 h-3" /> {era.copies.length}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-white group-hover:underline truncate flex items-center gap-2">
              <div className="truncate">{formatTextWithTags(era.name)}</div>
            </h3>
          </div>
        </motion.div>
      ))}
      {filteredEras.length === 0 && (
        <div className="col-span-full text-white/40 text-sm py-12 text-center">No album copies found.</div>
      )}
    </motion.div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] px-2 py-0.5 rounded border border-white/10 text-white/60 bg-white/5 whitespace-nowrap">
      {children}
    </span>
  );
}
