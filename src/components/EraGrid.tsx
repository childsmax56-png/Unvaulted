import { motion } from 'motion/react';
import { Era } from '../types';
import { formatTextWithTags, ALBUM_RELEASE_DATES, CUSTOM_IMAGES , Img} from '../utils';
import { activeConfig } from '../artists/activeConfig';
import { eraAvailability, yearOf } from '../availability';
import { AvailabilityBar, AvailabilityLegend } from './AvailabilityBar';

function releaseDateOf(era: Era): string | undefined {
  return ALBUM_RELEASE_DATES[era.name] || activeConfig.MEMBER_RELEASE_DATES?.[era.name];
}

export function EraGrid({ eras, onSelectEra }: { key?: string, eras: Era[], onSelectEra: (era: Era) => void }) {
  const years = eras.map(e => yearOf(releaseDateOf(e))).filter((y): y is string => !!y);
  const hasAvailability = eras.some(e => eraAvailability(e).total > 0);

  return (
    <motion.div
      initial={{ opacity: 0, filter: 'blur(10px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, filter: 'blur(10px)' }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="p-4 sm:p-6 md:p-8 pb-32 flex flex-col gap-5"
    >
      {hasAvailability && (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-white/60">
            {eras.length} eras{years.length > 1 ? ` · ${years[0]} → ${years[years.length - 1]}` : ''}
          </h2>
          <AvailabilityLegend />
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-6 md:gap-x-6">
        {eras.map((era, i) => {
          const imageSrc = CUSTOM_IMAGES[era.name] || era.image;
          const counts = eraAvailability(era);
          const playable = counts.full + counts.partial;
          const date = releaseDateOf(era);
          const year = yearOf(date);

          return (
            <motion.button
              type="button"
              key={era.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.5), duration: 0.3 }}
              onClick={() => onSelectEra({ ...era, image: imageSrc })}
              className="group flex flex-col gap-2.5 text-left cursor-pointer"
            >
              <div className="relative w-full aspect-square rounded-lg overflow-hidden bg-white/5 border border-white/5 group-hover:border-white/20 transition-colors">
                {imageSrc ? (
                  <Img w={300} src={imageSrc} alt={era.name} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-white/5 text-white/20 font-bold text-2xl text-center p-4">
                    {era.name}
                  </div>
                )}
                {year && (
                  <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/70 font-mono text-[11px] font-medium text-white/90" title={date}>{year}</span>
                )}
              </div>

              <div className="flex flex-col gap-1.5 min-w-0 w-full">
                <h3 className="text-sm font-semibold text-white group-hover:underline truncate">{formatTextWithTags(era.name)}</h3>
                {era.extra && <p className="text-white/50 text-xs truncate -mt-1">{formatTextWithTags(era.extra)}</p>}
                {counts.total > 0 && <AvailabilityBar counts={counts} height={5} />}
                <p className="font-mono text-[11px] text-white/55 truncate">
                  {counts.total > 0 ? `${playable} playable / ${counts.total}` : 'No songs'}
                </p>
              </div>
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
