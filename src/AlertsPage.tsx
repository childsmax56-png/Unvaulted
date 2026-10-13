// /alerts — the signed-in user's leak-alert inbox, what they follow, and how
// alerts reach them (web push on this device, Discord webhook).

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Home, Bell, BellOff, Loader2, Smartphone, Trash2, Check } from 'lucide-react';
import { SiDiscord } from 'react-icons/si';
import { getArtistConfig } from './artists/registry';
import { Img } from './utils';
import { isLoggedIn } from './comments';
import {
  fetchNotifications, markAllRead, refreshUnread, useFollows, loadFollows, setFollow,
  fetchAlertSettings, saveDiscordWebhook, pushSupported, usePushEnabled, enablePush, disablePush,
  type ChangeItem, type AlertSettings,
} from './alerts';
import { ChangeRowItem } from './ChangesPage';

const ACCENT = '#F5C518';
const TABS = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'following', label: 'Following' },
  { id: 'delivery', label: 'Delivery' },
] as const;
type TabId = typeof TABS[number]['id'];

function Inbox() {
  const [items, setItems] = useState<ChangeItem[] | null>(null);
  const [nextBefore, setNextBefore] = useState<number | null>(null);

  useEffect(() => {
    fetchNotifications().then((d) => {
      setItems(d.items);
      setNextBefore(d.nextBefore);
      // Opening the inbox reads everything; unread dots stay for this visit.
      if (d.unread > 0) markAllRead().then(refreshUnread);
    });
  }, []);

  if (items === null) return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>;
  if (items.length === 0) {
    return (
      <div className="text-center text-white/40 text-sm py-20 flex flex-col items-center gap-3">
        <Bell className="w-8 h-8 text-white/20" />
        <div>No alerts yet.</div>
        <div className="text-xs text-white/30 max-w-sm">
          Follow a tracker, era or song with the bell icon. When it gets a new song, a link or a full version, it shows up here.
        </div>
        <Link to="/changes" className="mt-2 text-xs px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-white/70">Browse the changelog →</Link>
      </div>
    );
  }
  return (
    <div>
      {items.map((c) => <ChangeRowItem key={c.id} c={c} showArtist unread={!c.read_at} />)}
      {nextBefore && (
        <div className="flex justify-center py-4">
          <button
            onClick={() => fetchNotifications(nextBefore).then((d) => { setItems((p) => [...(p ?? []), ...d.items]); setNextBefore(d.nextBefore); })}
            className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-sm text-white/70 cursor-pointer">
            Load more
          </button>
        </div>
      )}
    </div>
  );
}

function Following() {
  const follows = useFollows();
  useEffect(() => { loadFollows(true); }, []);
  const bySlug = useMemo(() => {
    const m = new Map<string, typeof follows>();
    for (const f of follows) m.set(f.slug, [...(m.get(f.slug) ?? []), f]);
    return [...m];
  }, [follows]);

  if (follows.length === 0) {
    return (
      <div className="text-center text-white/40 text-sm py-20">
        You’re not following anything yet. Use the <Bell className="inline w-3.5 h-3.5 -mt-0.5" /> on a tracker’s{' '}
        <Link to="/changes" className="underline">changelog</Link>, an era page or a song row.
      </div>
    );
  }
  const scopeLabel = { artist: 'Whole tracker', era: 'Era', song: 'Song' } as const;
  return (
    <div className="flex flex-col gap-5">
      {bySlug.map(([slug, list]) => {
        const cfg = getArtistConfig(slug);
        return (
          <section key={slug}>
            <Link to={`/changes/${slug}`} className="flex items-center gap-2 mb-1 px-1">
              <Img src={cfg?.artistPhotoUrl || cfg?.logoUrl || ''} w={48} alt="" className="w-6 h-6 rounded-md object-cover" />
              <span className="text-sm font-bold">{cfg?.artistLabel || slug}</span>
            </Link>
            {list.map((f) => (
              <div key={`${f.scope}|${f.target}`} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5">
                <span className="text-[10px] uppercase tracking-wider font-bold text-white/35 w-24 shrink-0">{scopeLabel[f.scope]}</span>
                <span className="text-sm truncate flex-1">{f.scope === 'artist' ? 'New songs, links & full versions' : (f.label || f.target)}</span>
                <button onClick={() => setFollow(f.slug, f.scope, f.target, f.label || '', false)} title="Unfollow"
                  className="p-1.5 rounded text-white/30 hover:text-red-300 hover:bg-white/10 cursor-pointer">
                  <BellOff className="w-4 h-4" />
                </button>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}

function Delivery() {
  const [settings, setSettings] = useState<AlertSettings | null>(null);
  const [pushOn, setPushOn] = usePushEnabled();
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState<string | null>(null);
  const [hook, setHook] = useState('');
  const [hookMsg, setHookMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [hookBusy, setHookBusy] = useState(false);

  useEffect(() => {
    fetchAlertSettings().then((s) => { setSettings(s); setHook(s?.discordWebhook ?? ''); });
  }, []);

  const togglePush = async () => {
    setPushBusy(true); setPushMsg(null);
    try {
      if (pushOn) { await disablePush(); setPushOn(false); }
      else {
        if (!settings?.vapidPublicKey) { setPushMsg('Push notifications aren’t configured on the server yet.'); return; }
        const err = await enablePush(settings.vapidPublicKey);
        if (err) setPushMsg(err); else setPushOn(true);
      }
    } catch (e) {
      setPushMsg((e as Error).message || 'Something went wrong');
    } finally {
      setPushBusy(false);
    }
  };

  const save = async (test: boolean, value = hook) => {
    setHookBusy(true); setHookMsg(null);
    const err = await saveDiscordWebhook(value.trim() || null, test && !!value.trim());
    setHookBusy(false);
    setHookMsg(err ? { ok: false, text: err } : { ok: true, text: value.trim() ? (test ? 'Saved. Check Discord for a test message.' : 'Saved') : 'Removed' });
  };

  if (!settings) return <div className="flex justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>;
  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-start gap-3">
          <Smartphone className="w-5 h-5 text-white/60 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">Push notifications on this device</div>
            <p className="text-xs text-white/45 mt-0.5">
              {pushSupported()
                ? `Get a system notification when something you follow changes.${settings.pushDevices ? ` Turned on for ${settings.pushDevices} device${settings.pushDevices === 1 ? '' : 's'}.` : ''}`
                : 'Not supported in this browser. On iPhone, add UNVAULTED to your Home Screen and open it from there.'}
            </p>
            {pushMsg && <p className="text-xs text-red-300 mt-2">{pushMsg}</p>}
          </div>
          {pushSupported() && (
            <button onClick={togglePush} disabled={pushBusy || pushOn === null}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer disabled:opacity-50 ${pushOn ? 'bg-white/10 text-white/80 hover:bg-white/15' : 'text-black'}`}
              style={pushOn ? undefined : { background: ACCENT }}>
              {pushBusy ? '…' : pushOn ? 'Turn off' : 'Turn on'}
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="flex items-start gap-3">
          <SiDiscord className="w-5 h-5 text-[#5865F2] mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">Discord webhook</div>
            <p className="text-xs text-white/45 mt-0.5">
              Post your alerts to a Discord channel. In Discord: Channel settings → Integrations → Webhooks → New Webhook → Copy Webhook URL.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 mt-3">
              <input value={hook} onChange={(e) => setHook(e.target.value)} placeholder="https://discord.com/api/webhooks/…"
                className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs outline-none focus:border-white/30" />
              <div className="flex gap-2">
                <button onClick={() => save(true)} disabled={hookBusy || !hook.trim()}
                  className="px-3 py-2 rounded-lg text-xs font-bold text-black cursor-pointer disabled:opacity-40" style={{ background: ACCENT }}>
                  Save & test
                </button>
                {settings.discordWebhook && (
                  <button onClick={() => { setHook(''); save(false, ''); setSettings({ ...settings, discordWebhook: null }); }} disabled={hookBusy} title="Remove webhook"
                    className="px-2.5 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            {hookMsg && (
              <p className={`text-xs mt-2 flex items-center gap-1 ${hookMsg.ok ? 'text-emerald-300' : 'text-red-300'}`}>
                {hookMsg.ok && <Check className="w-3.5 h-3.5" />}{hookMsg.text}
              </p>
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-white/35 px-1">
        Alerts for a whole tracker cover new songs, new links and snippets going full. Era and song alerts also cover quality changes, renames and link updates.
      </p>
    </div>
  );
}

export function AlertsPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabId>(() => (new URLSearchParams(location.search).get('tab') as TabId) || 'inbox');
  const signedIn = isLoggedIn();

  useEffect(() => { document.title = 'Alerts · unvaulted'; }, []);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col pb-32" style={{ ['--theme-color' as any]: ACCENT }}>
      <div className="sticky top-0 z-20 bg-black/90 backdrop-blur border-b border-white/10">
        <div className="flex items-center gap-3 px-4 md:px-8 py-4">
          <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm cursor-pointer transition-colors" title="Home">
            <Home className="w-4 h-4" /> <span className="hidden sm:inline">Home</span>
          </button>
          <span className="text-lg md:text-xl font-black tracking-tight ml-1">LEAK<span style={{ color: ACCENT }}>ALERTS</span></span>
          <Link to="/changes" className="ml-auto text-xs text-white/50 hover:text-white">Changelog →</Link>
        </div>
        {signedIn && (
          <div className="flex gap-1 px-4 md:px-8 pb-2">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors cursor-pointer ${tab === t.id ? 'bg-white text-black' : 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white'}`}>
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="w-full max-w-3xl mx-auto px-4 md:px-6 pt-6">
        {!signedIn ? (
          <div className="text-center text-white/50 text-sm py-24 flex flex-col items-center gap-3">
            <Bell className="w-8 h-8 text-white/20" />
            <div><a href="/account.html" className="underline text-white/80">Sign in</a> to follow trackers, eras and songs and get alerted when they change.</div>
          </div>
        ) : tab === 'inbox' ? <Inbox /> : tab === 'following' ? <Following /> : <Delivery />}
      </div>
    </div>
  );
}
