import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, Mic2, AlignLeft, Clock, ChevronDown, ExternalLink, Info } from 'lucide-react';
import { Song, Era } from '../types';
import { createPortal } from 'react-dom';
import { useLyrics } from '../useLyrics';
import type { Annotation, LyricsSource } from '../useLyrics';
import { Img } from '../utils';

interface LyricsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSong: Song;
  era: Era | null;
  currentTime?: number;
  onSeek?: (time: number) => void;
}

import { useSettings } from '../SettingsContext';

function buildAnnotatedSegments(text: string, annotations: Annotation[]) {
  // Filter out junk fragments (zero-width spaces, whitespace-only, very short)
  const valid = annotations.filter(a => a.fragment.replace(/[​\s]/g, '').length > 2);
  if (!valid.length) return [{ text, annIdx: -1 }];

  const lowerText = text.toLowerCase();
  const matches: { start: number; end: number; annIdx: number }[] = [];

  for (let i = 0; i < valid.length; i++) {
    const lowerFrag = valid[i].fragment.toLowerCase();
    const idx = lowerText.indexOf(lowerFrag);
    if (idx !== -1) {
      matches.push({ start: idx, end: idx + valid[i].fragment.length, annIdx: i });
    }
  }

  matches.sort((a, b) => a.start - b.start);

  const nonOverlapping = matches.filter((m, i) => {
    if (i === 0) return true;
    return m.start >= matches[i - 1].end;
  });

  const segments: { text: string; annIdx: number }[] = [];
  let pos = 0;
  for (const m of nonOverlapping) {
    if (m.start > pos) segments.push({ text: text.slice(pos, m.start), annIdx: -1 });
    segments.push({ text: text.slice(m.start, m.end), annIdx: m.annIdx });
    pos = m.end;
  }
  if (pos < text.length) segments.push({ text: text.slice(pos), annIdx: -1 });
  return segments;
}

export function LyricsModal({ isOpen, onClose, currentSong, era, currentTime = 0, onSeek }: LyricsModalProps) {
  const [preferredSource, setPreferredSource] = useState<LyricsSource>('genius');
  const { plainLyrics, parsedSyncedLyrics, source, annotations, geniusUrl, songInfo, loading, error, available, searching } = useLyrics(currentSong, era, preferredSource);
  const { settings } = useSettings();
  const [viewMode, setViewMode] = useState<'sync' | 'plain' | 'info'>('sync');
  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevSongKeyRef = useRef<string | null>(null);

  const hasSynced = !!parsedSyncedLyrics && parsedSyncedLyrics.length > 0;
  const hasAnnotations = !!annotations && annotations.length > 0;

  useEffect(() => {
    if (viewMode === 'info') return;
    if (!loading && !hasSynced && plainLyrics) {
      setViewMode('plain');
    } else if (!loading && hasSynced) {
      setViewMode('sync');
    }
  }, [hasSynced, plainLyrics, loading]);

  // Dismiss annotation panel when song or view changes; reset info tab on song change
  useEffect(() => {
    const songKey = currentSong ? `${currentSong.name}|${currentSong.url || ''}` : null;
    if (prevSongKeyRef.current === songKey) return;
    prevSongKeyRef.current = songKey;
    setSelectedAnnotation(null);
    setViewMode('sync');
    setPreferredSource('genius');
  }, [currentSong]);

  useEffect(() => {
    setSelectedAnnotation(null);
  }, [viewMode]);

  const currentLineIndex = parsedSyncedLyrics
    ? parsedSyncedLyrics.findIndex((line, i) => {
        const nextLine = parsedSyncedLyrics[i + 1];
        return currentTime >= line.time && (!nextLine || currentTime < nextLine.time);
      })
    : -1;

  useEffect(() => {
    if (isOpen && viewMode === 'sync' && parsedSyncedLyrics && currentLineIndex !== -1 && containerRef.current) {
      const container = containerRef.current;
      const activeElement = container.querySelector(`[data-index="${currentLineIndex}"]`) as HTMLElement;
      if (activeElement) {
        const containerHalfHeight = container.clientHeight / 2;
        const elementOffset = activeElement.offsetTop;
        const elementHalfHeight = activeElement.clientHeight / 2;
        container.scrollTo({
          top: elementOffset - containerHalfHeight + elementHalfHeight,
          behavior: 'smooth'
        });
      }
    }
  }, [currentLineIndex, isOpen, viewMode, parsedSyncedLyrics]);

  const handleAnnotationClick = useCallback((ann: Annotation) => {
    setSelectedAnnotation(prev => prev?.fragment === ann.fragment ? null : ann);
  }, []);

  if (!isOpen) return null;

  const bgImage = currentSong.image || era?.image;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95, filter: 'blur(10px)' }}
          animate={{ opacity: settings.miniLyricsOpacity / 100, y: 0, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: 20, scale: 0.95, filter: 'blur(10px)' }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed bottom-28 right-4 md:right-8 w-[350px] md:w-[400px] h-[500px] max-h-[60vh] z-[100] rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex flex-col bg-[#1a1a1a]"
        >
          {bgImage && settings.showMiniLyricsArt && (
            <div className="absolute inset-0 z-0">
              <Img w={400} eager src={bgImage} alt="Background" className="w-full h-full object-cover opacity-30 blur-xl scale-110" />
              <div className="absolute inset-0 bg-black/60" />
            </div>
          )}

          <div className="relative z-10 flex items-center justify-between p-4 border-b border-white/10 bg-black/40">
            <div className="flex items-center gap-2 text-white font-bold">
              <Mic2 className="w-4 h-4 text-[var(--theme-color)]" />
              Lyrics
              <div className="flex items-center bg-white/10 rounded-full p-0.5 ml-1">
                {(['genius', 'lrclib'] as const).map(src => {
                  const isActive = source === src;
                  const disabled = !available[src];
                  return (
                    <button
                      key={src}
                      onClick={() => { setPreferredSource(src); setViewMode('sync'); }}
                      disabled={disabled}
                      title={disabled ? (searching[src] ? 'Searching…' : 'No lyrics on ' + (src === 'genius' ? 'Genius' : 'lrclib')) : undefined}
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors ${
                        isActive
                          ? src === 'genius' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/20 text-white'
                          : disabled ? 'text-white/20 cursor-not-allowed' : 'text-white/50 hover:text-white/80 cursor-pointer'
                      }`}
                    >
                      {src === 'genius' ? 'Genius' : 'lrclib'}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {hasSynced && plainLyrics && (
                <div className="flex items-center bg-white/10 rounded-full p-0.5">
                  <button
                    onClick={() => setViewMode('sync')}
                    className={`p-1.5 rounded-full transition-colors ${viewMode === 'sync' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/80'}`}
                    title="Synced Lyrics"
                  >
                    <Clock className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode('plain')}
                    className={`p-1.5 rounded-full transition-colors ${viewMode === 'plain' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/80'}`}
                    title="Plain Text"
                  >
                    <AlignLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {source === 'genius' && songInfo && (
                <button
                  onClick={() => setViewMode(v => v === 'info' ? (hasSynced ? 'sync' : 'plain') : 'info')}
                  className={`p-1.5 rounded-full transition-colors ${viewMode === 'info' ? 'text-[var(--theme-color)]' : 'text-white/50 hover:text-white/80'}`}
                  title="Song Info"
                >
                  <Info className="w-4 h-4" />
                </button>
              )}
              <button onClick={onClose} className="text-white/50 hover:text-white transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div
            ref={containerRef}
            className="relative z-10 flex-1 overflow-y-auto p-6 custom-scrollbar flex flex-col mask-image-y"
            style={{ maskImage: viewMode === 'sync' ? 'linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)' : 'none' }}
          >
            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center text-white/50 gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-[var(--theme-color)]" />
                <span className="text-sm font-medium">Searching lyrics...</span>
              </div>
            ) : error ? (
              <div className="flex-1 flex items-center justify-center text-white/50 text-center text-sm font-medium">
                {error}
              </div>
            ) : viewMode === 'sync' && parsedSyncedLyrics ? (
              <div className={`flex flex-col gap-4 py-32 ${settings.miniLyricsAlignment === 'left' ? 'text-left' : settings.miniLyricsAlignment === 'right' ? 'text-right' : 'text-center'}`}>
                {parsedSyncedLyrics.map((line, i) => {
                  const isActive = i === currentLineIndex;
                  const isPassed = i < currentLineIndex;
                  return (
                    <motion.div
                      key={i}
                      data-index={i}
                      onClick={() => onSeek && onSeek(line.time)}
                      animate={{
                        scale: isActive ? 1.05 : 1,
                        opacity: isActive ? 1 : isPassed ? 0.5 : 0.3,
                      }}
                      transition={{ duration: 0.3 }}
                      className={`text-lg md:text-xl font-bold leading-tight cursor-pointer hover:opacity-80 transition-opacity ${isActive ? 'text-white' : 'text-white/50'}`}
                    >
                      {line.text || '♪'}
                    </motion.div>
                  );
                })}
                <div className="mt-8 text-xs text-white/40 text-center uppercase tracking-wider">
                  Lyrics may not be accurate
                </div>
              </div>
            ) : viewMode === 'info' && songInfo ? (
              <div className="flex-1 flex flex-col gap-5 py-2">
                {songInfo.description && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">About</p>
                    <p className="text-white/80 text-sm leading-relaxed">{songInfo.description}</p>
                  </div>
                )}
                {songInfo.samples.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Samples</p>
                    {songInfo.samples.map((s, i) => (
                      <p key={i} className="text-white/80 text-sm">
                        "{s.title}" — <span className="text-white/50">{s.artist}</span>
                      </p>
                    ))}
                  </div>
                )}
                {songInfo.producers.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Produced by</p>
                    <p className="text-white/80 text-sm">{songInfo.producers.join(', ')}</p>
                  </div>
                )}
                {songInfo.writers.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Written by</p>
                    <p className="text-white/80 text-sm">{songInfo.writers.join(', ')}</p>
                  </div>
                )}
                {songInfo.annotationCount > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Annotations</p>
                    <p className="text-white/80 text-sm">{songInfo.annotationCount} on Genius</p>
                  </div>
                )}
                {geniusUrl && (
                  <a href={geniusUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[var(--theme-color)] text-xs hover:opacity-80 transition-opacity mt-auto">
                    <ExternalLink className="w-3 h-3" /> View full page on Genius
                  </a>
                )}
              </div>
            ) : plainLyrics ? (
              <div className="flex-1 flex flex-col">
                <div className={`text-white/90 text-sm md:text-base leading-relaxed font-medium whitespace-pre-wrap ${settings.miniLyricsAlignment === 'left' ? 'text-left' : settings.miniLyricsAlignment === 'right' ? 'text-right' : 'text-center'}`}>
                  {hasAnnotations && source === 'genius' && annotations
                    ? buildAnnotatedSegments(plainLyrics, annotations).map((seg, i) =>
                        seg.annIdx >= 0 ? (
                          <span
                            key={i}
                            onClick={() => handleAnnotationClick(annotations[seg.annIdx])}
                            className="cursor-pointer border-b border-dotted border-[var(--theme-color)] text-[var(--theme-color)] hover:opacity-80 transition-opacity"
                          >
                            {seg.text}
                          </span>
                        ) : (
                          <span key={i}>{seg.text}</span>
                        )
                      )
                    : plainLyrics}
                </div>
                {hasAnnotations && source === 'genius' && (
                  <p className="mt-4 text-[10px] text-white/30 text-center">
                    Tap highlighted text to see Genius annotations
                  </p>
                )}
                <div className="mt-4 text-xs text-white/40 text-center uppercase tracking-wider">
                  Lyrics may not be accurate
                </div>
              </div>
            ) : null}
          </div>

          {/* Annotation panel */}
          <AnimatePresence>
            {selectedAnnotation && (
              <motion.div
                initial={{ y: '100%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="absolute bottom-0 left-0 right-0 z-20 bg-[#111]/95 backdrop-blur-md border-t border-white/10 rounded-b-2xl max-h-[55%] flex flex-col"
              >
                <div className="flex items-start justify-between px-4 pt-3 pb-2 border-b border-white/10 gap-2">
                  <p className="text-[var(--theme-color)] text-sm font-semibold leading-snug flex-1">
                    "{selectedAnnotation.fragment}"
                  </p>
                  <div className="flex items-center gap-1 shrink-0">
                    {geniusUrl && (
                      <a
                        href={geniusUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white/40 hover:text-white/70 transition-colors p-1"
                        title="View on Genius"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                    <button
                      onClick={() => setSelectedAnnotation(null)}
                      className="text-white/40 hover:text-white/70 transition-colors p-1 cursor-pointer"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="overflow-y-auto px-4 py-3 pb-6 custom-scrollbar">
                  <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">
                    {selectedAnnotation.body}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
