// The TrackerArchive — community index of every Ye tracker copy, other
// artists' trackers, the Leaktionary, sheet templates and the status key.
//
//   /archive            — landing: what's in it, stats, changelog
//   /archive/:tab       — trackers | leaktionary | templates | instructions | key
//
// Data is the live Google Sheet, shaped by functions/api/tracker-archive.ts.

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Home, Search, ExternalLink, Archive, BookOpen, LayoutTemplate, Info, ListChecks, FileSpreadsheet } from 'lucide-react';

const ACCENT = '#22D3EE';
const PAGE_SIZE = 150;

interface TrackerEntry {
  type: string; section: string; title: string; alt?: string; info: string;
  status: string; working: string; tags: string[]; links: string[]; note?: string;
}
interface WordEntry { type: string; title: string; alt?: string; def: string; tags: string[]; links: string[]; note?: string }
interface TemplateEntry { type: string; title: string; alt?: string; info: string; working: string; links: string[] }
interface KeyRow { value: string; meaning: string }
interface ArchiveData {
  sheetUrl: string;
  tabUrls: Record<string, string>;
  home: { stats: string[] };
  trackers: { entries: TrackerEntry[]; sections: { name: string; info?: string }[]; changelog: { date: string; note: string }[] };
  leaktionary: WordEntry[];
  templates: TemplateEntry[];
  instructions: { title: string; steps: { label: string; text: string }[] };
  key: { status: KeyRow[]; working: KeyRow[]; icons: { icon: string; tag: string; meaning: string }[] };
}

// Icon-tag filters, in the order the sheet's Key lists them.
const TAG_FILTERS: { tag: string; icon: string; label: string }[] = [
  { tag: 'best', icon: '⭐', label: 'Best Of' },
  { tag: 'special', icon: '✨', label: 'Special' },
  { tag: 'worst', icon: '🗑️', label: 'Worst Of' },
  { tag: 'joke', icon: '🤡', label: 'Joke' },
  { tag: 'wanted', icon: '🏅', label: 'Wanted' },
  { tag: 'wip', icon: '🚧', label: 'WIP' },
];
const TAG_ICON = Object.fromEntries(TAG_FILTERS.map((t) => [t.tag, t.icon]));

const TABS = [
  { id: 'trackers', label: 'Trackers', icon: Archive },
  { id: 'leaktionary', label: 'Leaktionary', icon: BookOpen },
  { id: 'templates', label: 'Templates', icon: LayoutTemplate },
  { id: 'instructions', label: 'Instructions', icon: ListChecks },
  { id: 'key', label: 'Key', icon: Info },
] as const;
type TabId = typeof TABS[number]['id'];

// Colour per status value — green good, amber partial, red gone, blue archived.
function statusClass(value: string): string {
  const v = value.toLowerCase();
  if (v === 'yes') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
  if (v.startsWith('yes')) return 'bg-teal-500/15 text-teal-300 border-teal-500/30';
  if (v === 'archive copy') return 'bg-sky-500/15 text-sky-300 border-sky-500/30';
  if (v === 'mostly' || v === 'unreleased tab only' || v === 'barely' || v.startsWith('rep')) return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  if (v === 'outdated') return 'bg-orange-500/15 text-orange-300 border-orange-500/30';
  if (v === 'confirmed' || v === 'unknown') return 'bg-violet-500/15 text-violet-300 border-violet-500/30';
  if (v === 'no') return 'bg-red-500/15 text-red-300 border-red-500/30';
  return 'bg-white/5 text-white/60 border-white/15';
}

function Badge({ value, label }: { value: string; label?: string }) {
  if (!value) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold whitespace-nowrap ${statusClass(value)}`}>
      {label && <span className="opacity-60 font-normal">{label}</span>}{value}
    </span>
  );
}

function linkLabel(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname === 'docs.google.com') {
      if (u.pathname.includes('/spreadsheets/')) return 'Sheet';
      if (u.pathname.includes('/document/')) return 'Doc';
      if (u.pathname.includes('/presentation/')) return 'Slides';
    }
    return u.hostname.replace(/^www\./, '');
  } catch { return 'Link'; }
}

function Links({ links }: { links: string[] }) {
  if (!links.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {links.map((url, i) => (
        <a key={i} href={url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/25 text-[11px] text-white/80 transition-colors max-w-full">
          <ExternalLink className="w-3 h-3 shrink-0" /><span className="truncate">{linkLabel(url)}</span>
        </a>
      ))}
    </div>
  );
}

function Status({ text }: { text: string }) {
  return <div className="flex items-center justify-center text-white/40 text-sm py-24 px-6 text-center">{text}</div>;
}

export function TrackerArchivePage() {
  const navigate = useNavigate();
  const { tab } = useParams<{ tab?: string }>();
  const active = TABS.some((t) => t.id === tab) ? (tab as TabId) : null;
  const [data, setData] = useState<ArchiveData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    document.title = 'TrackerArchive · unvaulted';
    fetch('/api/tracker-archive')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setData)
      .catch(() => setError(true));
  }, []);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col pb-32">
      <div className="sticky top-0 z-20 bg-black/90 backdrop-blur border-b border-white/10">
        <div className="flex items-center gap-3 px-4 md:px-8 py-4">
          <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm cursor-pointer transition-colors" title="Home">
            <Home className="w-4 h-4" /> <span className="hidden sm:inline">Home</span>
          </button>
          <button onClick={() => navigate('/archive')} className="text-lg md:text-xl font-black tracking-tight ml-1 truncate cursor-pointer">
            TRACKER<span style={{ color: ACCENT }}>ARCHIVE</span>
          </button>
          {data && (
            <a href={active ? data.tabUrls[active] : data.sheetUrl} target="_blank" rel="noopener noreferrer"
              className="ml-auto flex items-center gap-1.5 text-white/50 hover:text-white text-xs transition-colors shrink-0">
              <FileSpreadsheet className="w-4 h-4" /> <span className="hidden sm:inline">Open sheet</span>
            </a>
          )}
        </div>
        <div className="flex gap-1 px-4 md:px-8 pb-2 overflow-x-auto no-scrollbar">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => navigate(`/archive/${id}`)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap cursor-pointer transition-colors ${active === id ? 'text-black font-semibold' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
              style={active === id ? { background: ACCENT } : undefined}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 md:px-8 pt-6 max-w-6xl w-full mx-auto">
        {error ? <Status text="Couldn't load the TrackerArchive. Try again in a minute." />
          : !data ? <Status text="Loading the TrackerArchive…" />
          : active === 'trackers' ? <TrackersTab data={data} />
          : active === 'leaktionary' ? <LeaktionaryTab entries={data.leaktionary} />
          : active === 'templates' ? <TemplatesTab entries={data.templates} />
          : active === 'instructions' ? <InstructionsTab data={data} />
          : active === 'key' ? <KeyTab data={data} />
          : <Overview data={data} />}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Landing
// ---------------------------------------------------------------------------

function Overview({ data }: { data: ArchiveData }) {
  const navigate = useNavigate();
  const counts: Record<TabId, string> = {
    trackers: `${data.trackers.entries.length.toLocaleString()} entries`,
    leaktionary: `${data.leaktionary.length} terms`,
    templates: `${data.templates.length} templates`,
    instructions: `${data.instructions.steps.length} steps`,
    key: 'Status & icon meanings',
  };
  const blurbs: Record<TabId, string> = {
    trackers: 'Every Ye tracker, its copies and backups through the years, plus other artists’ trackers, websites and tools.',
    leaktionary: 'The leak community dictionary: terms, people and notable docs.',
    templates: 'Historic tracker sheet templates going back to 2016.',
    instructions: 'How to get past the archive.org pop-up on Unreleased-tab copies.',
    key: 'What “Up to date”, “Working” and the ⭐ ✨ 🗑️ 🤡 🏅 icons mean.',
  };
  const tagCounts = TAG_FILTERS.map((f) => ({ ...f, n: data.trackers.entries.filter((e) => e.tags.includes(f.tag)).length })).filter((f) => f.n);

  return (
    <div className="space-y-8">
      <p className="text-white/50 text-sm max-w-3xl">
        The TrackerArchive is a community-run index of leak trackers: every known copy of the Ye tracker, other artists’ sheets,
        groupbuy and Discord history, and the tools and terms around it. Synced live from the sheet.
      </p>

      {data.home.stats.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {data.home.stats.map((s, i) => (
            <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-white/60 leading-relaxed">
              {s.split('|').map((part, j) => <div key={j}>{part.trim()}</div>)}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => navigate(`/archive/${id}`)}
            className="text-left p-4 rounded-2xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.07] hover:border-white/25 transition-colors cursor-pointer">
            <div className="flex items-center gap-2 font-bold">
              <Icon className="w-4 h-4" style={{ color: ACCENT }} /> {label}
              <span className="ml-auto text-[11px] font-normal text-white/35">{counts[id]}</span>
            </div>
            <p className="text-sm text-white/50 mt-1.5">{blurbs[id]}</p>
          </button>
        ))}
      </div>

      {tagCounts.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-white/70 mb-2">Jump to</h2>
          <div className="flex flex-wrap gap-2">
            {tagCounts.map((f) => (
              <button key={f.tag} onClick={() => navigate(`/archive/trackers?tag=${f.tag}`)}
                className="px-3 py-1.5 rounded-full text-sm bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer">
                {f.icon} {f.label} <span className="text-white/35">{f.n}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {data.trackers.changelog.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-white/70 mb-2">Changelog</h2>
          <div className="rounded-xl border border-white/5 divide-y divide-white/5">
            {data.trackers.changelog.slice(0, 12).map((c, i) => (
              <div key={i} className="flex gap-3 px-3 py-2 text-sm">
                <span className="text-white/35 tabular-nums shrink-0 w-24">{c.date}</span>
                <span className="text-white/70">{c.note}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trackers
// ---------------------------------------------------------------------------

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 focus-within:border-white/30">
      <Search className="w-4 h-4 text-white/40 shrink-0" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="bg-transparent outline-none text-sm flex-1 min-w-0 placeholder:text-white/30" />
    </label>
  );
}

function TrackersTab({ data }: { data: ArchiveData }) {
  const initialTag = new URLSearchParams(window.location.search).get('tag') ?? '';
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState(initialTag);
  const [type, setType] = useState('');
  const [section, setSection] = useState('');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const { entries, sections } = data.trackers;

  // Keep ?tag= in the URL so a filtered view can be shared.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (tag) url.searchParams.set('tag', tag); else url.searchParams.delete('tag');
    window.history.replaceState(window.history.state, '', url);
  }, [tag]);

  const sectionNames = useMemo(() => {
    const used = new Set(entries.map((e) => e.section));
    return sections.map((s) => s.name).filter((n, i, a) => used.has(n) && a.indexOf(n) === i);
  }, [entries, sections]);
  const sectionInfo = useMemo(() => new Map(sections.map((s) => [s.name, s.info])), [sections]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) =>
      (!tag || e.tags.includes(tag)) && (!type || e.type === type) && (!section || e.section === section) &&
      (!q || `${e.title} ${e.alt ?? ''} ${e.info} ${e.section}`.toLowerCase().includes(q)));
  }, [entries, query, tag, type, section]);

  useEffect(() => { setLimit(PAGE_SIZE); }, [query, tag, type, section]);

  // Group consecutive rows by section, preserving the sheet's order.
  const groups = useMemo(() => {
    const out: { section: string; rows: TrackerEntry[] }[] = [];
    for (const e of filtered.slice(0, limit)) {
      const last = out[out.length - 1];
      if (last && last.section === e.section) last.rows.push(e); else out.push({ section: e.section, rows: [e] });
    }
    return out;
  }, [filtered, limit]);

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-3">
        <button onClick={() => setTag('')}
          className={`px-3 py-1.5 rounded-full text-sm border cursor-pointer transition-colors ${!tag ? 'bg-white text-black border-white font-semibold' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
          All
        </button>
        {TAG_FILTERS.map((f) => {
          const n = entries.filter((e) => e.tags.includes(f.tag)).length;
          if (!n) return null;
          return (
            <button key={f.tag} onClick={() => setTag(tag === f.tag ? '' : f.tag)}
              className={`px-3 py-1.5 rounded-full text-sm border cursor-pointer transition-colors ${tag === f.tag ? 'bg-white text-black border-white font-semibold' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
              {f.icon} {f.label} <span className={tag === f.tag ? 'text-black/50' : 'text-white/35'}>{n}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-2">
        <SearchBox value={query} onChange={setQuery} placeholder="Search trackers, copies, owners…" />
        <select value={type} onChange={(e) => setType(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/80 cursor-pointer">
          <option value="">All types</option>
          <option value="Trackers">Trackers</option>
          <option value="Websites">Websites</option>
          <option value="Archive">Archive</option>
        </select>
        <select value={section} onChange={(e) => setSection(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/80 cursor-pointer sm:max-w-[16rem]">
          <option value="">All sections</option>
          {sectionNames.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <p className="text-xs text-white/35 mb-4">{filtered.length.toLocaleString()} of {entries.length.toLocaleString()} entries</p>

      {filtered.length === 0 ? <Status text="Nothing matches those filters." /> : (
        <div className="space-y-6">
          {groups.map((g, gi) => (
            <section key={gi}>
              {g.section && (
                <div className="mb-2">
                  <h2 className="font-bold" style={{ color: ACCENT }}>{g.section}</h2>
                  {sectionInfo.get(g.section) && <p className="text-xs text-white/40 mt-0.5 max-w-3xl">{sectionInfo.get(g.section)}</p>}
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                {g.rows.map((e, i) => (
                  <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col gap-2 min-w-0">
                    <div className="min-w-0">
                      <div className="font-semibold leading-snug">
                        {e.tags.map((t) => <span key={t} className="mr-1">{TAG_ICON[t]}</span>)}{e.title}
                      </div>
                      {e.alt && <div className="text-[11px] italic text-white/40">{e.alt}</div>}
                    </div>
                    {e.info && <p className="text-xs text-white/55 whitespace-pre-line leading-relaxed">{e.info}</p>}
                    <div className="flex flex-wrap items-center gap-1.5 mt-auto">
                      <Badge value={e.status} label="Up to date:" />
                      <Badge value={e.working} label="Working:" />
                      {e.note && <span className="text-[11px] text-white/35">{e.note}</span>}
                    </div>
                    <Links links={e.links} />
                  </div>
                ))}
              </div>
            </section>
          ))}
          {filtered.length > limit && (
            <div className="flex justify-center">
              <button onClick={() => setLimit((l) => l + PAGE_SIZE)}
                className="px-4 py-2 rounded-full text-sm bg-white/5 border border-white/10 hover:bg-white/10 cursor-pointer">
                Show more ({(filtered.length - limit).toLocaleString()} left)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Leaktionary / Templates / Instructions / Key
// ---------------------------------------------------------------------------

function LeaktionaryTab({ entries }: { entries: WordEntry[] }) {
  const [query, setQuery] = useState('');
  const [type, setType] = useState('');
  const types = useMemo(() => [...new Set(entries.map((e) => e.type))], [entries]);
  const filtered = entries.filter((e) => (!type || e.type === type) &&
    (!query || `${e.title} ${e.alt ?? ''} ${e.def}`.toLowerCase().includes(query.trim().toLowerCase())));
  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-2 mb-2">
        <SearchBox value={query} onChange={setQuery} placeholder="Search the Leaktionary…" />
        <select value={type} onChange={(e) => setType(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/80 cursor-pointer">
          <option value="">All types</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <p className="text-xs text-white/35 mb-4">✨ Notable · ⭐ Best / outstanding</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {filtered.map((e, i) => (
          <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col gap-1.5 min-w-0">
            <div className="flex items-start gap-2">
              <div className="font-semibold leading-snug flex-1 min-w-0">
                {e.tags.map((t) => <span key={t} className="mr-1">{TAG_ICON[t]}</span>)}{e.title}
                {e.alt && <span className="text-xs italic font-normal text-white/40"> {e.alt}</span>}
              </div>
              <span className="text-[10px] uppercase tracking-wide text-white/35 shrink-0 mt-0.5">{e.type}</span>
            </div>
            {e.def && <p className="text-sm text-white/60 whitespace-pre-line leading-relaxed">{e.def}</p>}
            {e.note && <p className="text-xs text-white/40">{e.note}</p>}
            <Links links={e.links} />
          </div>
        ))}
      </div>
      {filtered.length === 0 && <Status text="No terms match that search." />}
    </div>
  );
}

function TemplatesTab({ entries }: { entries: TemplateEntry[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {entries.map((e, i) => (
        <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col gap-2 min-w-0">
          <div>
            <div className="font-semibold">{e.title}</div>
            {e.alt && <div className="text-[11px] italic text-white/40">{e.alt}</div>}
          </div>
          {e.info && <p className="text-sm text-white/60 leading-relaxed">{e.info}</p>}
          <div className="flex items-center gap-2 mt-auto">
            <Badge value={e.working} label="Working:" />
            <span className="text-[10px] uppercase tracking-wide text-white/35">{e.type}</span>
          </div>
          <Links links={e.links} />
        </div>
      ))}
    </div>
  );
}

function InstructionsTab({ data }: { data: ArchiveData }) {
  const { title, steps } = data.instructions;
  return (
    <div className="max-w-2xl">
      {title && <h2 className="font-bold mb-1" style={{ color: ACCENT }}>{title.replace(/\b([A-Z]{2,})\b/g, (w) => w[0] + w.slice(1).toLowerCase())}</h2>}
      <p className="text-xs text-white/40 mb-4">
        The original tab has screenshots for each step — <a href={data.tabUrls.instructions} target="_blank" rel="noopener noreferrer" className="underline hover:text-white">view them on the sheet</a>.
      </p>
      <ol className="space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
            <span className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold text-black shrink-0" style={{ background: ACCENT }}>{i + 1}</span>
            <p className="text-sm text-white/70 leading-relaxed">{s.text}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function KeyTab({ data }: { data: ArchiveData }) {
  const { status, working, icons } = data.key;
  const Table = ({ title, rows }: { title: string; rows: KeyRow[] }) => (
    <div>
      <h2 className="font-bold mb-2" style={{ color: ACCENT }}>{title}</h2>
      <div className="rounded-xl border border-white/5 divide-y divide-white/5">
        {rows.map((r, i) => (
          <div key={i} className="flex gap-3 px-3 py-2.5 items-start">
            <div className="w-36 shrink-0"><Badge value={r.value} /></div>
            <p className="text-sm text-white/60 whitespace-pre-line">{r.meaning}</p>
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Table title="Up to date / Evidence" rows={status} />
      <Table title="Working / Available" rows={working} />
      {icons.length > 0 && (
        <div className="lg:col-span-2">
          <h2 className="font-bold mb-2" style={{ color: ACCENT }}>Icon tags</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {icons.map((r, i) => (
              <div key={i} className="flex gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                <span className="text-2xl leading-none">{r.icon}</span>
                <p className="text-sm text-white/60">{r.meaning}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
