import { motion } from 'motion/react';
import { Era } from '../types';
import { formatTextWithTags, ALBUM_RELEASE_DATES, CUSTOM_IMAGES , Img} from '../utils';
import { activeConfig } from '../artists/activeConfig';

export function EraGrid({ eras, onSelectEra }: { key?: string, eras: Era[], onSelectEra: (era: Era) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, filter: 'blur(10px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, filter: 'blur(10px)' }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="p-6 md:p-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 pb-32"
    >
      {eras.map((era, i) => {
        const imageSrc = CUSTOM_IMAGES[era.name] || era.image;

        return (
          <motion.div
            key={era.name}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(i * 0.02, 0.5), duration: 0.3 }}
            onClick={() => onSelectEra({ ...era, image: imageSrc })}
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
                {(ALBUM_RELEASE_DATES[era.name] || activeConfig.MEMBER_RELEASE_DATES?.[era.name]) && <div className="text-white/40 font-medium text-[10px] shrink-0 bg-white/5 px-1.5 py-0.5 rounded uppercase tracking-wider">{ALBUM_RELEASE_DATES[era.name] || activeConfig.MEMBER_RELEASE_DATES?.[era.name]}</div>}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                {era.extra && <p className="text-white/50 text-xs truncate">{formatTextWithTags(era.extra)}</p>}
                <p className="text-white/30 text-xs shrink-0">{Object.values(era.data).reduce((sum, songs) => sum + songs.length, 0)} songs</p>
              </div>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
