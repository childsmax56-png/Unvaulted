import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Filter, X, Check, Info, Minus } from 'lucide-react';
import { SearchFilters } from '../types';
import { Category } from './Navbar';
import { useSettings } from '../SettingsContext';
import { TAG_TOOLTIP_MAP, FILTER_TOOLTIPS, TAG_MAP } from '../utils';

function FilterTagItem({ tag, status, onToggle, settings }: { tag: any, status: number, onToggle: () => void, settings: any }) {
  const [isHovered, setIsHovered] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const tooltipText = TAG_TOOLTIP_MAP[tag.label];

  const updateRect = () => {
    if (tagRef.current) {
      setRect(tagRef.current.getBoundingClientRect());
    }
  };

  useEffect(() => {
    if (isHovered) {
      updateRect();
      window.addEventListener('scroll', updateRect, true);
      window.addEventListener('resize', updateRect);
      return () => {
        window.removeEventListener('scroll', updateRect, true);
        window.removeEventListener('resize', updateRect);
      };
    }
  }, [isHovered]);

  return (
    <div
      ref={tagRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onToggle}
      className={`relative flex items-center gap-2 group ${tag.disabled ? 'opacity-50 cursor-not-allowed text-white/40' : 'cursor-pointer hover:bg-white/5'} p-1.5 rounded-md transition-colors`}
    >
      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${status === 1 ? 'bg-white text-black border-white' : status === 2 ? 'bg-red-500/20 text-red-500 border-red-500/50' : 'border-white/30 text-transparent'}`}>
        {status === 2 ? <Minus className="w-3 h-3" /> : <Check className="w-3 h-3" />}
      </div>
      <span className="text-sm text-white/90 group-hover:text-white truncate flex items-center gap-1.5">
        {settings.tagsAsEmojis ? (
          <>
            <span className="flex items-center justify-center">
              {Object.entries(TAG_MAP).find(([, v]) => v === tag.label)?.[0] || ''}
            </span>
            {tag.label}
          </>
        ) : tag.label}
      </span>

      {tooltipText && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isHovered && rect && (
            <motion.div
              initial={{ opacity: 0, x: "-50%", y: "calc(-100% + 5px)", filter: 'blur(4px)', scale: 0.95 }}
              animate={{ opacity: 1, x: "-50%", y: "-100%", filter: 'blur(0px)', scale: 1 }}
              exit={{ opacity: 0, x: "-50%", y: "calc(-100% + 5px)", filter: 'blur(4px)', scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              style={{
                position: 'fixed',
                left: rect.left + rect.width / 2,
                top: rect.top - 8,
                zIndex: 99999,
                transformOrigin: 'bottom center'
              }}
              className="hidden md:block w-48 sm:w-64 p-3 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl pointer-events-none"
            >
              <div className="flex flex-col gap-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="text-base flex items-center justify-center text-[var(--theme-color)]">
                    {Object.entries(TAG_MAP).find(([, v]) => v === tag.label)?.[0] || ''}
                  </span>
                  <span className="font-bold text-white text-xs">{tag.label}</span>
                </div>
                <p className="text-white/70 text-[11px] leading-snug whitespace-normal line-clamp-3">
                  {tooltipText}
                </p>
              </div>
              <div className="absolute top-full left-1/2 -ml-1.5 -mt-[1px] border-solid border-t-neutral-900 border-x-transparent border-b-transparent border-[6px]" />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

function FilterGenericItem({ label, tooltip, status, onToggle }: { label: string, tooltip?: string, status: number, onToggle: () => void }) {
  const [isHovered, setIsHovered] = useState(false);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const tagRef = useRef<HTMLDivElement>(null);

  const updateRect = () => {
    if (tagRef.current) {
      setRect(tagRef.current.getBoundingClientRect());
    }
  };

  useEffect(() => {
    if (isHovered) {
      updateRect();
      window.addEventListener('scroll', updateRect, true);
      window.addEventListener('resize', updateRect);
      return () => {
        window.removeEventListener('scroll', updateRect, true);
        window.removeEventListener('resize', updateRect);
      };
    }
  }, [isHovered]);

  return (
    <div
      ref={tagRef}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onToggle}
      className="relative flex items-center gap-2 group cursor-pointer hover:bg-white/5 p-1.5 rounded-md transition-colors"
    >
      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${status === 1 ? 'bg-white text-black border-white' : status === 2 ? 'bg-red-500/20 text-red-500 border-red-500/50' : 'border-white/30 text-transparent'}`}>
        {status === 2 ? <Minus className="w-3 h-3" /> : <Check className="w-3 h-3" />}
      </div>
      <span className="text-sm text-white/90 group-hover:text-white truncate">
        {label}
      </span>

      {tooltip && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isHovered && rect && (
            <motion.div
              initial={{ opacity: 0, x: "-50%", y: "calc(-100% + 5px)", filter: 'blur(4px)', scale: 0.95 }}
              animate={{ opacity: 1, x: "-50%", y: "-100%", filter: 'blur(0px)', scale: 1 }}
              exit={{ opacity: 0, x: "-50%", y: "calc(-100% + 5px)", filter: 'blur(4px)', scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              style={{
                position: 'fixed',
                left: rect.left + rect.width / 2,
                top: rect.top - 8,
                zIndex: 99999,
                transformOrigin: 'bottom center'
              }}
              className="hidden md:block w-48 sm:w-64 p-3 bg-neutral-900 border border-white/10 rounded-xl shadow-2xl pointer-events-none"
            >
              <div className="flex flex-col gap-1 text-left">
                <span className="font-bold text-white text-xs">{label}</span>
                <p className="text-white/70 text-[11px] leading-snug whitespace-normal line-clamp-3">
                  {tooltip}
                </p>
              </div>
              <div className="absolute top-full left-1/2 -ml-1.5 -mt-[1px] border-solid border-t-neutral-900 border-x-transparent border-b-transparent border-[6px]" />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}

interface FilterMenuProps {
  filters: SearchFilters;
  setFilters: (filters: SearchFilters) => void;
  activeCategory?: Category;
}

const AVAILABLE_TAGS = [
  { label: 'Lost Media', id: '⁉️' },
  { label: 'AI', id: '🤖' },
  { label: 'Worst Of', id: '🗑️' },
  { label: 'Unwanted', id: '🚮' },
  { label: 'Special', id: '✨' },
  { label: 'By YƵYGOLD', id: '💛' },
  { label: 'Grails', id: '🏆' },
  { label: 'Best Of', id: '⭐' },
  { label: 'Wanted', id: '🏅' }
];

const AVAILABLE_QUALITIES = [
  'Lossless',
  'CD Quality',
  'High Quality',
  'Low Quality',
  'Recording',
  'Not Available'
];

const AVAILABLE_LENGTHS = [
  'Snippet',
  'Partial',
  'Beat Only',
  'Tagged',
  'Stem Bounce',
  'Full',
  'OG File',
  'Confirmed',
  'Rumored',
  'Conflicting Sources'
];

const ALBUMS_LIST = [
  "Before The College Dropout",
  "The College Dropout",
  "Late Registration",
  "Graduation",
  "808s & Heartbreak",
  "Good Ass Job",
  "My Beautiful Dark Twisted Fantasy",
  "Watch the Throne",
  "Cruel Summer",
  "Thank God For Drugs",
  "Yeezus",
  "Cruel Winter [V1]",
  "Yeezus 2",
  "So Help Me God",
  "SWISH",
  "The Life Of Pablo",
  "Cruel Winter [V2]",
  "Wolves",
  "Turbo Grafx 16",
  "LOVE EVERYONE",
  "ye",
  "KIDS SEE GHOSTS",
  "Good Ass Job (2018)",
  "Yandhi [V1]",
  "Yandhi [V2]",
  "JESUS IS KING",
  "God's Country",
  "JESUS IS KING: The Dr. Dre Version",
  "DONDA [V1]",
  "Donda [V2]",
  "Donda [V3]",
  "Donda 2",
  "WAR",
  "YEBU",
  "Bad Bitch Playbook",
  "VULTURES 1",
  "VULTURES 2",
  "VULTURES 3",
  "BULLY [V1]",
  "CUCK",
  "DONDA 2 (2025)",
  "IN A PERFECT WORLD",
  "BULLY [V2]",
  "Ongoing"
];

export function FilterMenu({ filters, setFilters, activeCategory }: FilterMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { settings } = useSettings();

  const filteredTags = AVAILABLE_TAGS.filter(tag => {
    if (activeCategory === 'stems') {
      return tag.label === 'Lost Media' || tag.label === 'By YƵYGOLD';
    }
    if (activeCategory === 'misc') {
      return tag.label === 'Lost Media' || tag.label === 'Best Of' || tag.label === 'By YƵYGOLD';
    }
    return true;
  });

  const FAKES_TAGS = [
    { label: 'Stem Edit', id: 'Stem Edit' },
    { label: 'Detag', id: 'Detag' },
    { label: 'By YƵYGOLD', id: '💛' },
    { label: 'Comp', id: 'Comp' },
    { label: 'Fake Leak', id: 'Fake Leak' },
    { label: 'Fake Rumor', id: 'Fake Rumor' },
    { label: 'AI', id: 'AI' },
    { label: 'Edit', id: 'Edit' },
    { label: 'Recreation', id: 'Recreation' },
    { label: 'Impression', id: 'Impression' },
    { label: 'Divine Intervention', id: 'Divine Intervention' },
    { label: 'Fake Person', id: 'Fake Person' },
  ];

  const FAKES_QUALITIES = [
    'Not Available', 'Full HQ', 'Full Lossless', 'Full CDQ', 'Full LQ', 'Lossless Snippet', 'CDQ Snippet', 'HQ Snippet', 'Partial HQ', 'Recording', 'Full HQ (Tagged)', 'Full CDQ (Tagged)', '3 inches', 'Partial LQ'
  ];

  const currentTags = activeCategory === 'fakes' ? FAKES_TAGS : filteredTags;
  const currentQualities = activeCategory === 'fakes' ? FAKES_QUALITIES : AVAILABLE_QUALITIES;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const clearFilters = () => {
    setFilters({ tags: [], excludedTags: [], tagMatch: filters.tagMatch, qualities: [], excludedQualities: [], availableLengths: [], excludedAvailableLengths: [], durationOp: '>', durationValue: '', playableOnly: false, hasClips: null, hasRemixes: null, hasSamples: null, albums: [] });
  };

  const hasActiveFilters = filters.tags.length > 0 || (filters.excludedTags && filters.excludedTags.length > 0) || filters.qualities.length > 0 || (filters.excludedQualities && filters.excludedQualities.length > 0) || (filters.availableLengths?.length > 0) || (filters.excludedAvailableLengths && filters.excludedAvailableLengths.length > 0) || filters.durationValue !== '' || filters.playableOnly || filters.hasClips !== null || filters.hasRemixes !== null || filters.hasSamples !== null || (filters.albums && filters.albums.length > 0);

  const toggleFilter = (type: 'tags' | 'qualities' | 'availableLengths', excludedType: 'excludedTags' | 'excludedQualities' | 'excludedAvailableLengths', item: string) => {
    const included = filters[type] || [];
    const excluded = filters[excludedType] || [];

    if (included.includes(item)) {
      setFilters({
        ...filters,
        [type]: included.filter(i => i !== item),
        [excludedType]: [...excluded, item]
      });
    } else if (excluded.includes(item)) {
      setFilters({
        ...filters,
        [excludedType]: excluded.filter(i => i !== item)
      });
    } else {
      setFilters({
        ...filters,
        [type]: [...included, item]
      });
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-1.5 rounded-md border transition-colors flex items-center justify-center ${hasActiveFilters || isOpen
          ? 'bg-white/10 border-white/30 text-white'
          : 'bg-transparent border-transparent text-white/50 hover:text-white/80 hover:bg-white/5'
          }`}
        title="Search Filters"
      >
        <Filter className="w-4 h-4" />
        {hasActiveFilters && (
          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-[#ffffff] rounded-full border border-black shadow"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-72 glass-panel border border-white/10 rounded-lg shadow-xl p-4 z-50 text-white animate-in fade-in slide-in-from-top-2 max-h-[80vh] overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/10">
            <h3 className="text-sm font-semibold">Search Filters</h3>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-white/50 hover:text-white flex items-center gap-1 transition-colors"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-white/50 uppercase tracking-wider font-semibold">Tags</label>
                <div
                  className="flex items-center rounded-md border border-white/10 bg-black/30 p-0.5 text-[11px] font-semibold"
                  title="Match songs with all of the selected tags, or with any of them"
                >
                  {(['all', 'any'] as const).map(mode => {
                    const active = (filters.tagMatch ?? 'all') === mode;
                    return (
                      <button
                        key={mode}
                        onClick={() => setFilters({ ...filters, tagMatch: mode })}
                        className={`px-2 py-0.5 rounded transition-colors ${active ? 'bg-white text-black' : 'text-white/50 hover:text-white'}`}
                      >
                        {mode === 'all' ? 'Match all' : 'Match any'}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1.5">
                {currentTags.map(tag => {
                  let status = 0;
                  const isIncluded = filters.tags.includes(tag.id);
                  const isExcluded = (filters.excludedTags || []).includes(tag.id);
                  if (isIncluded) status = 1;
                  else if (isExcluded) status = 2;

                  return (
                    <FilterTagItem
                      key={tag.id}
                      tag={tag}
                      status={status}
                      onToggle={() => !(tag as any).disabled && toggleFilter('tags', 'excludedTags', tag.id)}
                      settings={settings}
                    />
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs text-white/50 mb-2 uppercase tracking-wider font-semibold">Quality</label>
              <div className="space-y-1.5">
                {currentQualities.map(quality => {
                  let status = 0;
                  const isIncluded = filters.qualities.includes(quality);
                  const isExcluded = (filters.excludedQualities || []).includes(quality);
                  if (isIncluded) status = 1;
                  else if (isExcluded) status = 2;

                  return (
                    <FilterGenericItem
                      key={quality}
                      label={quality}
                      tooltip={FILTER_TOOLTIPS[quality]}
                      status={status}
                      onToggle={() => toggleFilter('qualities', 'excludedQualities', quality)}
                    />
                  );
                })}
              </div>
            </div>

            {activeCategory !== 'fakes' && (
              <div>
                <label className="block text-xs text-white/50 mb-2 uppercase tracking-wider font-semibold">Available Length</label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                  {AVAILABLE_LENGTHS.map(len => {
                    let status = 0;
                    const isIncluded = (filters.availableLengths || []).includes(len);
                    const isExcluded = (filters.excludedAvailableLengths || []).includes(len);
                    if (isIncluded) status = 1;
                    else if (isExcluded) status = 2;

                    return (
                      <FilterGenericItem
                        key={len}
                        label={len}
                        tooltip={FILTER_TOOLTIPS[len]}
                        status={status}
                        onToggle={() => toggleFilter('availableLengths', 'excludedAvailableLengths', len)}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs text-white/50 mb-2 uppercase tracking-wider font-semibold">Availability</label>
              <div
                onClick={() => setFilters({ ...filters, playableOnly: !filters.playableOnly })}
                className="flex items-center gap-2 cursor-pointer p-1.5 rounded-md hover:bg-white/5 transition-colors group"
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${filters.playableOnly ? 'bg-white text-black border-white' : 'border-white/30 text-transparent'}`}>
                  <Check className="w-3 h-3" />
                </div>
                <span className="text-sm text-white/90 group-hover:text-white truncate">
                  Only Playable on Site
                </span>
              </div>
            </div>

            {activeCategory === 'music' && (
              <div>
                <label className="block text-xs text-white/50 mb-2 uppercase tracking-wider font-semibold">Features</label>
                <div className="space-y-1.5">
                  {(['hasClips', 'hasRemixes', 'hasSamples'] as const).map(feature => {
                    let status = 0;
                    if (filters[feature] === 'include') status = 1;
                    else if (filters[feature] === 'exclude') status = 2;

                    const label = feature === 'hasClips' ? 'Has Clip' : feature === 'hasRemixes' ? 'Has Remixes' : 'Has Samples';

                    return (
                      <div
                        key={feature}
                        onClick={() => {
                          let nextVal: 'include' | 'exclude' | null = null;
                          if (status === 0) nextVal = 'include';
                          else if (status === 1) nextVal = 'exclude';
                          else nextVal = null;
                          
                          setFilters({ ...filters, [feature]: nextVal });
                        }}
                        className="flex items-center gap-2 cursor-pointer p-1.5 rounded-md hover:bg-white/5 transition-colors group"
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${status === 1 ? 'bg-white text-black border-white' : status === 2 ? 'bg-red-500/20 text-red-500 border-red-500/50' : 'border-white/30 text-transparent'}`}>
                          {status === 2 ? <Minus className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                        </div>
                        <span className="text-sm text-white/90 group-hover:text-white truncate">
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {(activeCategory === 'recent' || activeCategory === 'history') && (
              <>
                <div>
                  <label className="block text-xs text-white/50 mb-2 uppercase tracking-wider font-semibold">Albums</label>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                    {ALBUMS_LIST.map(album => {
                      let status = 0;
                      const isIncluded = (filters.albums || []).includes(album);
                      if (isIncluded) status = 1;

                      return (
                        <div
                          key={album}
                          onClick={() => {
                            const current = filters.albums || [];
                            if (current.includes(album)) {
                              setFilters({ ...filters, albums: current.filter(a => a !== album) });
                            } else {
                              setFilters({ ...filters, albums: [...current, album] });
                            }
                          }}
                          className="flex items-center gap-2 cursor-pointer p-1.5 rounded-md hover:bg-white/5 transition-colors group"
                        >
                          <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${status === 1 ? 'bg-white text-black border-white' : 'border-white/30 text-transparent'}`}>
                            {status === 1 && <Check className="w-3 h-3" />}
                          </div>
                          <span className="text-sm text-white/90 group-hover:text-white truncate">
                            {album}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs text-white/50 mb-2 uppercase tracking-wider font-semibold">Duration (Length)</label>
              <div className="flex gap-2">
                <select
                  value={filters.durationOp}
                  onChange={(e) => setFilters({ ...filters, durationOp: e.target.value })}
                  className="w-20 bg-black/50 border border-white/10 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-white/30 cursor-pointer text-white"
                >
                  <option value=">">More than</option>
                  <option value="<">Less than</option>
                  <option value="=">Exactly</option>
                </select>
                <input
                  type="text"
                  placeholder="5:00 or 5"
                  value={filters.durationValue}
                  onChange={(e) => setFilters({ ...filters, durationValue: e.target.value })}
                  className="flex-1 min-w-0 bg-black/50 border border-white/10 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-white/30 placeholder:text-white/20 text-white"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
