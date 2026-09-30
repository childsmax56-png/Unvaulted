import { motion } from 'motion/react';
import { useMemo } from 'react';
import { ExternalLink, AtSign } from 'lucide-react';
import { activeConfig } from '../artists/activeConfig';
import { SOCIALS_DATA, SocialEntry } from '../socialsData';

interface SocialsViewProps {
  searchQuery: string;
}

export function SocialsView({ searchQuery }: SocialsViewProps) {
  const accent = activeConfig.accentColor;
  const entries = SOCIALS_DATA[activeConfig.slug] ?? [];
  const query = searchQuery.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!query) return entries;
    return entries.filter(e =>
      e.platform.toLowerCase().includes(query) ||
      e.handle.toLowerCase().includes(query) ||
      e.notes.toLowerCase().includes(query) ||
      e.type.toLowerCase().includes(query)
    );
  }, [entries, query]);

  const groups = useMemo(() => {
    const byType: Record<string, SocialEntry[]> = {};
    const order: string[] = [];
    for (const e of filtered) {
      const t = e.type || 'Other';
      if (!byType[t]) { byType[t] = []; order.push(t); }
      byType[t].push(e);
    }
    return order.map(type => ({ type, items: byType[type] }));
  }, [filtered]);

  return (
    <motion.div
      key="socials"
      initial={{ opacity: 0, filter: 'blur(10px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, filter: 'blur(10px)' }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="pb-12"
    >
      <div className="px-6 md:px-8 pt-6 md:pt-8 pb-6 border-b border-white/5">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">Socials</h1>
          <span
            className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full border"
            style={{ background: `${accent}1a`, color: accent, borderColor: `${accent}33` }}
          >
            Links
          </span>
        </div>
        <p className="text-white/40 text-sm max-w-2xl">
          Known accounts, pages, and communities for {activeConfig.artistLabel}.
        </p>
      </div>

      <div className="px-4 md:px-8 mt-6 max-w-3xl mx-auto flex flex-col gap-8">
        {groups.map(g => (
          <section key={g.type}>
            <div className="text-xs font-bold uppercase tracking-widest text-white/40 mb-3">{g.type}</div>
            <div className="flex flex-col gap-2">
              {g.items.map((e, i) => <SocialRow key={g.type + i} entry={e} accent={accent} />)}
            </div>
          </section>
        ))}
        {groups.length === 0 && (
          <div className="text-white/40 text-sm py-12 text-center">
            {entries.length === 0 ? 'No socials listed yet.' : 'No matches for your search.'}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function SocialRow({ entry, accent }: { entry: SocialEntry; accent: string }) {
  const inactive = entry.status === 'Inactive';
  const inner = (
    <>
      <AtSign className="w-4 h-4 shrink-0 mt-0.5" style={{ color: accent }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-white">{entry.platform}</span>
          {entry.handle && <span className="text-xs text-white/50">{entry.handle}</span>}
          {entry.status && (
            <span
              className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{
                background: inactive ? 'rgba(255,255,255,0.06)' : `${accent}20`,
                color: inactive ? 'rgba(255,255,255,0.4)' : accent,
              }}
            >
              {entry.status}
            </span>
          )}
        </div>
        {entry.notes && <div className="text-xs text-white/40 mt-1 leading-relaxed">{entry.notes}</div>}
      </div>
      {entry.link && <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-1" style={{ color: accent }} />}
    </>
  );

  const className = 'flex items-start gap-3 p-3 rounded-lg border border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.05] transition-colors';

  if (entry.link) {
    return (
      <a href={entry.link} target="_blank" rel="noopener noreferrer" className={className}>
        {inner}
      </a>
    );
  }
  return <div className={className}>{inner}</div>;
}
