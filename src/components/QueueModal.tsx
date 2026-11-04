import { X, Play } from 'lucide-react';
import { Song, Era } from '../types';
import * as audioStore from '../player/audioStore';
import { useState } from 'react';
import { formatTextWithTags, CUSTOM_IMAGES , Img} from '../utils';
import { motion, AnimatePresence } from 'motion/react';
import { createPortal } from 'react-dom';

interface QueueModalProps {
  onClose: () => void;
  playlist: Song[];
  currentSongIndex: number;
  shuffledQueue: number[];
  isShuffle: boolean;
  loopMode: number;
  onPlaySong: (index: number) => void;
  currentEra: Era | null;
}

export function QueueModal({ onClose, playlist, currentSongIndex, shuffledQueue, isShuffle, loopMode, onPlaySong, currentEra }: QueueModalProps) {
  const [showMore, setShowMore] = useState(false);

  const [hasLoopedOnce] = audioStore.usePlayerField('hasLoopedOnce');
  const upcomingQueue: {song: Song, realIndex: number, queueId: string}[] = [];
  const INITIAL_SHOW_COUNT = 15;

  if (playlist.length > 0) {
    if (loopMode === 2) {
      for (let i = 0; i < 30; i++) {
        upcomingQueue.push({ song: playlist[currentSongIndex], realIndex: currentSongIndex, queueId: `repeat-${currentSongIndex}-${i}` });
      }
    } else {
      let nextIndices: number[] = [];
      if (isShuffle && shuffledQueue.length > 0) {
        const curIdx = shuffledQueue.indexOf(currentSongIndex);
        if (curIdx !== -1) {
          nextIndices = shuffledQueue.slice(curIdx + 1);
        }
      } else {
        nextIndices = playlist.map((_, i) => i).slice(currentSongIndex + 1);
      }

      if (loopMode === 1 && !hasLoopedOnce) nextIndices.unshift(currentSongIndex);

      for (const idx of nextIndices) {
        if (playlist[idx]) {
          upcomingQueue.push({ song: playlist[idx], realIndex: idx, queueId: `normal-${idx}-${upcomingQueue.length}` });
        }
      }
    }
  }

  const displayedQueue = showMore ? upcomingQueue : upcomingQueue.slice(0, INITIAL_SHOW_COUNT);

  return createPortal(
    <motion.div 
      initial={{ opacity: 0, y: 20, scale: 0.95, filter: 'blur(10px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: 20, scale: 0.95, filter: 'blur(10px)' }}
      transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
      className="fixed bottom-28 right-4 md:right-8 w-[350px] md:w-[400px] h-[500px] max-h-[60vh] z-[100] rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex flex-col bg-[#111111]"
    >
      <div className="flex items-center justify-between p-4 px-6 md:px-8 border-b border-white/5 relative z-10 shrink-0 bg-black/40">
            <div className="min-w-0 flex-1 mr-4">
              <h2 className="text-white font-bold truncate text-sm">Queue</h2>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={onClose} className="text-white/50 hover:text-white transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2 custom-scrollbar relative z-10">
            {upcomingQueue.length === 0 ? (
              <div className="text-center text-white/50 py-8 text-xs uppercase tracking-widest font-mono">No upcoming songs</div>
            ) : (
              <>
              <AnimatePresence mode="popLayout">
                {displayedQueue.map((item) => {
                  const eraName = (item.song as any).realEra?.name || currentEra?.name || '';
                  const imgUrl = item.song.image || CUSTOM_IMAGES[eraName] || (item.song as any).realEra?.image || currentEra?.image;
                  
                  return (
                  <motion.div
                    layout
                    initial={{ opacity: 0, filter: 'blur(8px)', y: 20 }}
                    animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
                    exit={{ opacity: 0, filter: 'blur(8px)', scale: 0.95 }}
                    transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
                    key={item.queueId} 
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded overflow-hidden bg-white/5 shrink-0 relative group-hover:block border border-white/5 shadow-md">
                      {imgUrl && (
                        <Img w={100} src={imgUrl} alt="" className="w-full h-full object-cover" />
                      )}
                      <button
                        onClick={() => {
                          onPlaySong(item.realIndex);
                        }}
                        className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40"
                      >
                        <Play className="w-5 h-5 text-white fill-white cursor-pointer" />
                      </button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white font-medium truncate">{formatTextWithTags(item.song.name)}</div>
                      <div className="text-xs text-white/50 truncate">
                        {item.song.extra || ''}
                      </div>
                    </div>
                    {item.song.track_length && (
                      <div className="text-xs font-mono text-white/40 shrink-0">
                        {item.song.track_length}
                      </div>
                    )}
                  </motion.div>
                )})}
              </AnimatePresence>
                
                {!showMore && upcomingQueue.length > INITIAL_SHOW_COUNT && (
                  <button
                    onClick={() => setShowMore(true)}
                    className="w-full py-3 mt-4 text-xs font-bold tracking-widest uppercase text-white/50 hover:text-white hover:bg-white/5 transition-colors rounded-lg border border-white/5"
                  >
                    Show More ({upcomingQueue.length - INITIAL_SHOW_COUNT} total)
                  </button>
                )}
              </>
            )}
          </div>
        </motion.div>,
    document.body
  );
}
