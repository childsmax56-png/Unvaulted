import { motion, AnimatePresence } from 'motion/react';
import { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, ExternalLink, Image as ImageIcon, X, Link as LinkIcon, Share2, Check, Download, Loader2 } from 'lucide-react';
import { Era, SearchFilters } from '../types';
import { formatTextWithTags, ALBUM_RELEASE_DATES, createSlug, matchesFilters, CUSTOM_IMAGES, handleDownloadFile , Img, resolveImbbUrl, peekImbbCache} from '../utils';
import { useSettings } from '../SettingsContext';
import { CommentButton } from './CommentButton';
import { makeEntryKey, makeEraKey, baseEraName } from '../comments';
import { activeConfig } from '../artists/activeConfig';

export interface ArtEntry {
  Era: string;
  Name: string;
  Notes: string;
  Designer: string;
  "Art Type": string;
  "Project Type": string;
  Use: string;
  "Link(s)": string;
}

interface ArtGalleryProps {
  eras: Era[];
  artData: ArtEntry[];
  searchQuery: string;
  filters: SearchFilters;
}

function getUseBadgeColor(_use: string) {
  return 'border-white/10 text-white/50 bg-white/5';
}

// ibb.co page-URL resolution (with its shared in-memory + localStorage cache)
// now lives in utils.tsx so every Img across the app resolves covers the same
// way. Re-exported here for existing importers (e.g. CoverPickerModal).
export { resolveImbbUrl };

const RENDERABLE_DOMAINS = [
  'i.scdn.co', 'mzstatic.com', 't2.genius.com', 'images.genius.com',
  'i.postimg.cc', 'i.discogs.com', 'pbs.twimg.com', 'lh3.googleusercontent.com',
  'lh4.googleusercontent.com', 'lh5.googleusercontent.com', 'lh6.googleusercontent.com',
  'm.media-amazon.com', 'payload.cargocollective.com', 'media.giphy.com',
];

export function isLinkRenderable(link: string | undefined | null): boolean {
  if (!link) return false;
  const lc = link.toLowerCase();
  if (link.includes('ibb.co') || link.includes('pillows.su/f/') || link.startsWith('/api/sheet-image?')) return true;
  if (lc.endsWith('.png') || lc.endsWith('.jpg') || lc.endsWith('.jpeg') || lc.endsWith('.gif') || lc.endsWith('.webp')) return true;
  try {
    const { hostname } = new URL(link);
    return RENDERABLE_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
  } catch { return false; }
}

export function ArtImage({ url, alt, contain = false }: { url: string; alt: string; contain?: boolean }) {
  const [imgSrc, setImgSrc] = useState<string | null>(() => {
    // Synchronously return cached value if available
    if (url.includes('ibb.co') && !url.includes('i.ibb.co')) {
      return peekImbbCache(url) ?? null;
    }
    if (url.includes('pillows.su/f/')) {
      const hash = url.split('/f/')[1]?.split('/')[0]?.split('?')[0];
      return hash ? `https://api.pillows.su/api/get/${hash}` : url;
    }
    return url;
  });
  const [error, setError] = useState(false);

  useEffect(() => {
    setError(false);
    if (url.includes('ibb.co') && !url.includes('i.ibb.co')) {
      const cached = peekImbbCache(url);
      if (cached) { setImgSrc(cached); return; }
      setImgSrc(null);
      let mounted = true;
      resolveImbbUrl(url).then(direct => {
        if (!mounted) return;
        if (direct) setImgSrc(direct);
        else setError(true);
      });
      return () => { mounted = false; };
    } else if (url.includes('pillows.su/f/')) {
      const hash = url.split('/f/')[1]?.split('/')[0]?.split('?')[0];
      setImgSrc(hash ? `https://api.pillows.su/api/get/${hash}` : url);
    } else {
      setImgSrc(url);
    }
  }, [url]);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white/5">
        <ImageIcon className="w-8 h-8 text-white/20" />
      </div>
    );
  }

  if (!imgSrc) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-white/5">
        <div className="w-6 h-6 border-2 border-[var(--theme-color)]/30 border-t-[var(--theme-color)] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Img w={500}
      src={imgSrc}
      alt={alt}
      className={`w-full h-full group-hover:scale-105 transition-transform duration-500 bg-white/5 ${contain ? 'object-contain' : 'object-cover'}`}
    />
  );
}

export function ArtGallery({ eras, artData, searchQuery, filters }: ArtGalleryProps) {
  const { settings } = useSettings();
  const [selectedEra, setSelectedEra] = useState<Era | null>(null);
  const [zoomedArt, setZoomedArt] = useState<ArtEntry | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const filteredEras = useMemo(() => {
    return eras.filter(era => {
      const eraArt = artData.filter(item => item.Era === era.name);
      if (eraArt.length === 0) return false;

      const hasActiveFilters = filters.tags.length > 0 || filters.qualities.length > 0 || (filters.availableLengths && filters.availableLengths.length > 0) || filters.durationValue !== '' || filters.playableOnly;
      const q = searchQuery.toLowerCase();

      if (!searchQuery && !hasActiveFilters) return true;

      const matchesEraName = !hasActiveFilters && searchQuery && (era.name.toLowerCase().includes(q) || (era.extra && era.extra.toLowerCase().includes(q)));
      
      const matchesArt = eraArt.some(item => {
        const pseudoSong = {
          name: item.Name,
          extra: item.Designer || '',
          description: item.Notes || '',
          quality: item['Art Type'] || item['Project Type'] || ''
        };
        return matchesFilters(pseudoSong, searchQuery, filters);
      });

      return matchesEraName || matchesArt;
    });
  }, [eras, artData, searchQuery, filters]);

  const eraItems = useMemo(() => {
    if (!selectedEra) return [];
    let items = artData.filter(item => item.Era === selectedEra.name);
    
    const hasActiveFilters = filters.tags.length > 0 || filters.qualities.length > 0 || (filters.availableLengths && filters.availableLengths.length > 0) || filters.durationValue !== '' || filters.playableOnly;
    if (!searchQuery && !hasActiveFilters) return items;
    
    return items.filter(item => {
      const pseudoSong = {
        name: item.Name,
        extra: item.Designer || '',
        description: item.Notes || '',
        quality: item['Art Type'] || item['Project Type'] || ''
      };
      return matchesFilters(pseudoSong, searchQuery, filters);
    });
  }, [selectedEra, artData, searchQuery, filters]);

  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      if (!selectedEra && window.location.hash.startsWith('#art-')) {
        return;
      }
    }

    if (selectedEra) {
      let newHash = `#art-${createSlug(selectedEra.name)}`;
      if (zoomedArt) {
        newHash += `-${createSlug(zoomedArt.Name.split('\n')[0])}`;
      }
      if (window.location.hash !== newHash) {
        window.history.replaceState(null, '', newHash);
      }
    } else {
      if (window.location.hash !== '#art') {
        window.history.replaceState(null, '', '#art');
      }
    }
  }, [selectedEra, zoomedArt]);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#art-')) {
      const hashContent = hash.substring(5);
      const sortedEras = [...eras].sort((a, b) => createSlug(b.name).length - createSlug(a.name).length);

      const match = sortedEras.find(e => {
        const slug = createSlug(e.name);
        return hashContent === slug || hashContent.startsWith(`${slug}-`);
      });

      if (match) {
        setSelectedEra(match);
        const eraSlug = createSlug(match.name);

        if (hashContent.length > eraSlug.length && artData.length > 0) {
          const itemSlug = hashContent.substring(eraSlug.length + 1);
          const item = artData.find(a =>
            a.Era === match.name &&
            createSlug(a.Name.split('\n')[0]) === itemSlug
          );
          if (item) setZoomedArt(item);
        }
      }
    }
  }, [eras, artData]);

  const copyLink = (era: Era, item?: ArtEntry) => {
    let link = `${window.location.origin}/#art-${createSlug(era.name)}`;
    if (item) {
      link += `-${createSlug(item.Name.split('\n')[0])}`;
    }
    navigator.clipboard.writeText(link);
    setToastMessage('Link copied to clipboard!');
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleDownloadAlbum = async () => {
    if (!eraItems.length) return;
    setIsDownloading(true);
    setToastMessage(`Downloading ${eraItems.length} images... Allow multiple downloads!`);
    
    for (let i = 0; i < eraItems.length; i++) {
        const item = eraItems[i];
        const link = item['Link(s)']?.split('\n')[0]?.trim();
        const isRenderable = isLinkRenderable(link);
        if (link && isRenderable) {
           await handleDownloadFile(link, `${item.Name.split('\n')[0]}`, settings.tagsAsEmojis);
           await new Promise(res => setTimeout(res, 800));
        }
    }
    setToastMessage(`Download complete!`);
    setTimeout(() => setToastMessage(null), 3000);
    setIsDownloading(false);
  };

  if (selectedEra) {
    const eraImageSrc = CUSTOM_IMAGES[selectedEra.name] || selectedEra.image;

    return (
      <motion.div
        key="art-detail"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col md:flex-row h-full overflow-hidden"
      >
        <div className="w-full md:w-[380px] lg:w-[420px] shrink-0 p-6 md:p-8 flex flex-col md:h-full overflow-y-auto no-scrollbar border-b md:border-b-0 md:border-r border-white/5 bg-black/20">
          <button
            onClick={() => setSelectedEra(null)}
            className="flex items-center gap-2 text-white/50 hover:text-white mb-6 md:mb-8 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back to albums</span>
          </button>

          <div className="group relative w-full aspect-square rounded-lg md:rounded-xl overflow-hidden shadow-2xl mb-6 md:mb-8 bg-white/5 border border-white/10">
            {eraImageSrc ? (
              <Img w={600} eager
                src={eraImageSrc}
                alt={selectedEra.name}
                className="w-full h-full object-cover opacity-90 transition-opacity"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-white/20">
                <ImageIcon className="w-16 h-16 mb-4 opacity-50" />
                <span className="font-display font-bold text-2xl">{selectedEra.name}</span>
              </div>
            )}
            <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-lg md:rounded-xl pointer-events-none" />
          </div>

          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white tracking-tight">
                {formatTextWithTags(selectedEra.name)}
              </h2>
            </div>

            <div className="flex items-center justify-between mb-8 pb-8 border-b border-white/10">
              <div className="flex items-center gap-4 text-xs font-mono text-white/40">
                <span className="flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5" />
                  {eraItems.length} Pic{eraItems.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadAlbum}
                  disabled={isDownloading}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                  title="Download all images"
                >
                  {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => copyLink(selectedEra)}
                  className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                  title="Copy album link"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                <CommentButton
                  tracker={activeConfig.slug}
                  entryKey={makeEraKey(selectedEra.name)}
                  entryLabel={baseEraName(selectedEra.name)}
                  entryType="Era"
                  variant="pill"
                />
              </div>
            </div>
          </div>
        </div>

        <div ref={contentRef} className="flex-1 overflow-y-auto min-h-0 bg-[#0a0a0a] relative">
          <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {eraItems.map((item, i) => {
                const link = item['Link(s)']?.split('\n')[0]?.trim();
                const isRenderable = isLinkRenderable(link);

                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="group relative bg-white/[0.03] border border-white/5 rounded-lg overflow-hidden hover:border-white/15 transition-all duration-300 cursor-pointer flex flex-col h-full"
                    onClick={() => {
                      if (isRenderable) {
                        setZoomedArt(item);
                      } else {
                        window.open(link, '_blank');
                      }
                    }}
                  >
                    <div className="aspect-square bg-black/40 relative overflow-hidden flex-shrink-0">
                      {isRenderable && link ? (
                        <ArtImage url={link} alt={item.Name} />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-white/[0.02] text-white/30 group-hover:text-white/50 transition-colors">
                          <LinkIcon className="w-8 h-8 mb-3" />
                          <span className="text-xs font-medium uppercase tracking-widest text-center">Click here to visit site</span>
                        </div>
                      )}
                      {isRenderable && (
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      )}
                    </div>

                    <div className="p-3 flex-1 flex flex-col">
                      <p className="text-sm font-medium text-white mb-2">{item.Name.split('\n')[0]}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-auto">
                        {item['Project Type'] && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded border border-white/10 text-white/50 bg-white/5 truncate max-w-[100px]">
                            {item['Project Type']}
                          </span>
                        )}
                        {item.Use && (
                          <span className={`text-[9px] px-1.5 py-0.5 rounded border truncate max-w-[80px] ${getUseBadgeColor(item.Use)}`}>
                            {item.Use}
                          </span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>

        {typeof document !== 'undefined' && createPortal(
          <AnimatePresence>
            {zoomedArt && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/95 z-[99999] flex items-center justify-center p-2 md:p-8"
                onClick={() => setZoomedArt(null)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: 20 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  className="flex flex-col lg:flex-row bg-[#111] border border-white/10 rounded-xl overflow-hidden max-w-7xl w-full max-h-[95vh] relative"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex-1 bg-black/50 p-2 md:p-8 flex items-center justify-center relative min-h-[35vh] lg:min-h-[600px]">
                    <ArtImage url={zoomedArt['Link(s)']?.split('\n')[0]?.trim()} alt={zoomedArt.Name} contain={true} />
                  </div>

                  <div className="w-full lg:w-[400px] shrink-0 p-6 md:p-8 bg-[#111] border-t lg:border-t-0 lg:border-l border-white/10 overflow-y-auto flex flex-col relative">
                    <div className="absolute top-4 right-4 md:top-6 md:right-6 z-50 flex items-center gap-2">
                      <button
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors"
                        onClick={() => {
                          const url = zoomedArt['Link(s)']?.split('\n')[0]?.trim();
                          if (url) {
                            setToastMessage('Downloading...');
                            handleDownloadFile(url, `${zoomedArt.Name.split('\n')[0]}`, settings.tagsAsEmojis);
                            setTimeout(() => setToastMessage(null), 3000);
                          }
                        }}
                        title="Download image"
                      >
                        <Download className="w-5 h-5 md:w-6 md:h-6 p-0.5" />
                      </button>
                      <button
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors"
                        onClick={() => copyLink(selectedEra, zoomedArt)}
                        title="Copy item link"
                      >
                        <Share2 className="w-5 h-5 md:w-6 md:h-6 p-0.5" />
                      </button>
                      <div className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors flex items-center">
                        <CommentButton
                          tracker={activeConfig.slug}
                          entryKey={makeEntryKey('Art', zoomedArt.Era || selectedEra?.name || '', zoomedArt.Name.split('\n')[0])}
                          entryLabel={zoomedArt.Name.split('\n')[0]}
                          entryType="Art"
                        />
                      </div>
                      <button
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors"
                        onClick={() => setZoomedArt(null)}
                        title="Close"
                      >
                        <X className="w-5 h-5 md:w-6 md:h-6" />
                      </button>
                    </div>

                    <div className="mb-6 pr-24">
                      <h3 className="text-xl font-bold text-white mb-1">{zoomedArt.Name.split('\n')[0]}</h3>
                      {zoomedArt.Name.includes('\n') && (
                        <p className="text-sm text-white/40">{zoomedArt.Name.split('\n').slice(1).join(' ')}</p>
                      )}
                      <p className="text-sm text-[var(--theme-color)] font-medium mt-2">{zoomedArt.Era}</p>
                    </div>

                    <div className="flex flex-col gap-6 flex-1">
                      {zoomedArt.Notes && (
                        <div>
                          <h4 className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-2">Description</h4>
                          <p className="text-sm text-white/70 leading-relaxed font-medium">{zoomedArt.Notes}</p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4">
                        {zoomedArt.Designer && (
                          <div>
                            <h4 className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-1">Designer</h4>
                            <p className="text-sm text-white/80">{zoomedArt.Designer}</p>
                          </div>
                        )}
                        {zoomedArt['Art Type'] && (
                          <div>
                            <h4 className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-1">Type</h4>
                            <p className="text-sm text-white/80">{zoomedArt['Art Type']}</p>
                          </div>
                        )}
                        {zoomedArt['Project Type'] && (
                          <div>
                            <h4 className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-1">Project</h4>
                            <p className="text-sm text-white/80">{zoomedArt['Project Type']}</p>
                          </div>
                        )}
                        {zoomedArt.Use && (
                          <div>
                            <h4 className="text-[10px] font-semibold text-white/30 uppercase tracking-widest mb-1">Status</h4>
                            <p className="text-sm text-white/80">{zoomedArt.Use}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

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
      </motion.div>
    );
  }

  return (
    <motion.div
      key="art-grid"
      initial={{ opacity: 0, filter: 'blur(10px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, filter: 'blur(10px)' }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="p-6 md:p-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 pb-32"
    >
      {filteredEras.map((era, i) => {
        const imageSrc = CUSTOM_IMAGES[era.name] || era.image;

        return (
          <motion.div
            key={era.name}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.02, 0.5), duration: 0.3 }}
            onClick={() => setSelectedEra(era)}
            className="group flex flex-col gap-3 cursor-pointer"
          >
            <div className="relative aspect-square rounded-md overflow-hidden bg-white/5 border border-white/5 group-hover:border-white/20 transition-colors">
              {imageSrc ? (
                <Img w={300} src={imageSrc} alt={era.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-white/5 text-white/20 font-bold text-2xl text-center p-4">
                  {era.name}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-bold text-white group-hover:underline truncate flex items-center gap-2">
                <div className="truncate">{formatTextWithTags(era.name)}</div>
              </h3>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
