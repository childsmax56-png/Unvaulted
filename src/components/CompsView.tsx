import { motion } from 'motion/react';
import { ArrowLeft, ExternalLink, Star } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { CUSTOM_IMAGES , Img} from '../utils';
import { Era } from '../types';

interface LinkEntry {
  text: string;
  url: string;
}

interface CompEntry {
  era: string;
  name: string;
  description: string;
  creator: string;
  review: string;
  downloads: LinkEntry[];
  streaming: LinkEntry[];
}

interface EraGroup {
  eraName: string;
  image?: string;
  comps: CompEntry[];
}

interface CompsViewProps {
  eras: Era[];
  searchQuery: string;
}

function isHighlight(name: string) {
  return name.includes('⭐') || name.includes('🌟') || name.includes('✨');
}

function cleanName(name: string) {
  return name.replace(/[⭐🌟✨]/g, '').trim();
}

function LinkButton({ link }: { link: LinkEntry }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded border border-white/10 text-white/60 bg-white/5 hover:border-[var(--theme-color)]/40 hover:text-[var(--theme-color)] hover:bg-[var(--theme-color)]/5 transition-colors whitespace-nowrap"
    >
      <ExternalLink className="w-2.5 h-2.5 shrink-0" />
      {link.text || 'Link'}
    </a>
  );
}

function LinkGroup({ label, links }: { label: string; links: LinkEntry[] }) {
  if (!links.length) return null;
  return (
    <div className="text-right">
      <p className="text-white/25 text-[10px] uppercase tracking-wider mb-1">{label}</p>
      <div className="flex flex-wrap gap-1 justify-end">
        {links.map((l, i) => <LinkButton key={i} link={l} />)}
      </div>
    </div>
  );
}

export function CompsView({ eras, searchQuery }: CompsViewProps) {
  const [allComps, setAllComps] = useState<CompEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEra, setSelectedEra] = useState<string | null>(null);

  useEffect(() => {
    fetch('/data/comps.json')
      .then(r => r.json())
      .then(data => { setAllComps(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const eraGroups = useMemo<EraGroup[]>(() => {
    const map = new Map<string, CompEntry[]>();
    for (const c of allComps) {
      if (!map.has(c.era)) map.set(c.era, []);
      map.get(c.era)!.push(c);
    }
    return Array.from(map.entries()).map(([eraName, comps]) => {
      const matchingEra = eras.find(e => e.name === eraName);
      const image = CUSTOM_IMAGES[eraName] || matchingEra?.image;
      return { eraName, image, comps };
    });
  }, [allComps, eras]);

  const filteredGroups = useMemo<EraGroup[]>(() => {
    if (!searchQuery) return eraGroups;
    const q = searchQuery.toLowerCase();
    return eraGroups.map(g => ({
      ...g,
      comps: g.comps.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.era.toLowerCase().includes(q) ||
        c.creator.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
      ),
    })).filter(g => g.comps.length > 0);
  }, [eraGroups, searchQuery]);

  const selectedGroup = useMemo(
    () => filteredGroups.find(g => g.eraName === selectedEra) ?? null,
    [filteredGroups, selectedEra]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-white/30 text-sm">
        Loading comps...
      </div>
    );
  }

  if (selectedGroup) {
    return (
      <motion.div
        key="comps-detail"
        initial={{ opacity: 0, filter: 'blur(10px)' }}
        animate={{ opacity: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, filter: 'blur(10px)' }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="absolute inset-0 z-10 bg-yzy-black overflow-y-auto pb-64"
      >
        {/* Header */}
        <div className="p-6 md:p-8 flex flex-col md:flex-row items-start gap-6 md:gap-8 border-b border-white/5 bg-white/5">
          <button
            onClick={() => setSelectedEra(null)}
            className="cursor-pointer mt-1 flex items-center justify-center w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="w-32 h-32 md:w-48 md:h-48 rounded-md overflow-hidden bg-white/5 shrink-0 shadow-xl">
            {selectedGroup.image ? (
              <Img w={400} eager
                src={selectedGroup.image}
                alt={selectedGroup.eraName}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/20 font-bold text-xl text-center p-4">
                {selectedGroup.eraName}
              </div>
            )}
          </div>

          <div className="flex flex-col justify-end h-full py-2">
            <div className="flex items-center gap-4 mb-3 flex-wrap">
              <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight">
                {selectedGroup.eraName}
              </h1>
              <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-[var(--theme-color)]/10 text-[var(--theme-color)] border border-[var(--theme-color)]/20">
                Comps
              </span>
            </div>
            <p className="text-white/50 text-sm">
              {selectedGroup.comps.length} comp{selectedGroup.comps.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Comp list */}
        <div className="px-6 md:px-8 mt-8 max-w-5xl mx-auto mb-16">
          <div className="hidden sm:flex items-center px-4 py-2 text-xs font-semibold text-white/30 uppercase tracking-wider border-b border-white/5 mb-2">
            <div className="flex-1">Comp</div>
            <div className="w-40 text-right">Download</div>
            <div className="w-36 text-right ml-4">Stream</div>
          </div>

          <div className="flex flex-col">
            {selectedGroup.comps.map((comp, i) => {
              const highlight = isHighlight(comp.name);
              return (
                <div
                  key={i}
                  className={`group flex items-start gap-4 px-4 py-3.5 rounded-md transition-colors ${highlight ? 'bg-[var(--theme-color)]/5' : 'hover:bg-white/5'}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {highlight && (
                        <Star className="w-3.5 h-3.5 text-[var(--theme-color)] shrink-0" fill="currentColor" />
                      )}
                      <span className={`text-sm font-semibold leading-snug ${highlight ? 'text-[var(--theme-color)]' : 'text-white'}`}>
                        {cleanName(comp.name)}
                      </span>
                    </div>
                    {comp.creator && (
                      <p className="text-white/40 text-xs mt-0.5">{comp.creator}</p>
                    )}
                    {comp.description && (
                      <p className="text-white/55 text-xs mt-1.5 leading-relaxed max-w-xl">{comp.description}</p>
                    )}
                    {comp.review && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <ExternalLink className="w-3 h-3 text-[var(--theme-color)]/60" />
                        <span className="text-[var(--theme-color)]/60 text-xs">{comp.review}</span>
                      </div>
                    )}
                    {/* Mobile links */}
                    <div className="flex sm:hidden flex-wrap gap-3 mt-2">
                      {comp.downloads.length > 0 && (
                        <div>
                          <p className="text-white/25 text-[10px] uppercase tracking-wider mb-1">Download</p>
                          <div className="flex flex-wrap gap-1">
                            {comp.downloads.map((l, j) => <LinkButton key={j} link={l} />)}
                          </div>
                        </div>
                      )}
                      {comp.streaming.length > 0 && (
                        <div>
                          <p className="text-white/25 text-[10px] uppercase tracking-wider mb-1">Stream</p>
                          <div className="flex flex-wrap gap-1">
                            {comp.streaming.map((l, j) => <LinkButton key={j} link={l} />)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Desktop links */}
                  <div className="hidden sm:flex flex-col items-end gap-2 shrink-0 min-w-[160px]">
                    <LinkGroup label="Download" links={comp.downloads} />
                    <LinkGroup label="Stream" links={comp.streaming} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    );
  }

  // Era grid
  return (
    <motion.div
      key="comps-grid"
      initial={{ opacity: 0, filter: 'blur(10px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, filter: 'blur(10px)' }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="p-6 md:p-8 pb-32"
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
      {filteredGroups.map((group, i) => (
        <motion.div
          key={group.eraName}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: Math.min(i * 0.02, 0.5), duration: 0.3 }}
          onClick={() => setSelectedEra(group.eraName)}
          className="group flex flex-col gap-3 cursor-pointer"
        >
          <div className="relative aspect-square rounded-md overflow-hidden bg-white/5 border border-white/5 group-hover:border-white/20 transition-colors">
            {group.image ? (
              <Img w={300}
                src={group.image}
                alt={group.eraName}
                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/20 font-bold text-lg text-center p-4">
                {group.eraName}
              </div>
            )}
            <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm text-white/80 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded">
              {group.comps.length} comp{group.comps.length !== 1 ? 's' : ''}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white group-hover:underline truncate">
              {group.eraName}
            </h3>
          </div>
        </motion.div>
      ))}
      </div>
    </motion.div>
  );
}
