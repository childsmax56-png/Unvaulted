// Yeditsgold moderation panel: profile claims, community-tracker review, and
// (owner only) admin keys. Rendered as a bottom-sheet modal on /yeditsgold and
// embedded inline on the site-wide /admin dashboard.
import { useState, useEffect, useCallback } from 'react';
import { X, Check, ShieldCheck, Copy, KeyRound } from 'lucide-react';

const ACCENT = '#FFD700';

function getVGToken(): string | null { return localStorage.getItem('vg_token'); }

// ─── Admin Panel ──────────────────────────────────────────────────────────────

interface ClaimRow {
  id: string; profile_name: string; user_id: string; username: string;
  email: string; status: string; claimed_at: string; reviewed_at?: string;
}
interface KeyRow {
  key: string; label?: string; created_at: string;
  used_by_username?: string; used_at?: string;
}
interface AdminRow { user_id: string; username: string; email: string; granted_at: string; }

interface CommunityTrackerRow {
  id: string; slug: string; name: string; description?: string;
  username: string; logo_url?: string; submitted_at?: string; reviewed_at?: string;
}

export type YeditsAdminTab = 'claims' | 'keys' | 'trackers';

// `embedded` drops the modal chrome and the internal tab bar; the host page then
// picks the section through `tab`.
export function YeditsAdminPanel({ onClose, onRefreshClaims, isOwner, embedded, tab: tabProp }: {
  onClose?: () => void; onRefreshClaims?: () => void; isOwner: boolean;
  embedded?: boolean; tab?: YeditsAdminTab;
}) {
  const [ownTab, setTab] = useState<YeditsAdminTab>('claims');
  const tab = tabProp ?? ownTab;
  const [claims, setClaims] = useState<ClaimRow[]>([]);
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [ctPending, setCtPending] = useState<CommunityTrackerRow[]>([]);
  const [ctApproved, setCtApproved] = useState<CommunityTrackerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchAll = useCallback(async () => {
    const token = getVGToken();
    if (!token) return;
    setLoading(true);
    try {
      const [claimsRes, keysRes, ctRes] = await Promise.all([
        fetch('/api/yeditsgold-admin-claims', { headers: { Authorization: `Bearer ${token}` } }),
        isOwner ? fetch('/api/yeditsgold-admin-keys', { headers: { Authorization: `Bearer ${token}` } }) : Promise.resolve(null),
        fetch('/api/community/admin/queue', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const claimsData = await claimsRes.json() as { claims?: ClaimRow[] };
      setClaims(claimsData.claims ?? []);
      if (keysRes) {
        const keysData = await keysRes.json() as { keys?: KeyRow[]; admins?: AdminRow[] };
        setKeys(keysData.keys ?? []);
        setAdmins(keysData.admins ?? []);
      }
      if (ctRes.ok) {
        const ctData = await ctRes.json() as { pending?: CommunityTrackerRow[]; approved?: CommunityTrackerRow[] };
        setCtPending(ctData.pending ?? []);
        setCtApproved(ctData.approved ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [isOwner]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const actClaim = async (id: string, action: 'approve' | 'reject') => {
    const token = getVGToken();
    if (!token) return;
    setActionLoading(id + action);
    try {
      await fetch('/api/yeditsgold-admin-claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, action }),
      });
      await fetchAll();
      onRefreshClaims?.();
    } finally { setActionLoading(null); }
  };

  const generateKey = async () => {
    const token = getVGToken();
    if (!token) return;
    setActionLoading('gen');
    try {
      const res = await fetch('/api/yeditsgold-admin-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'generate', label: newKeyLabel }),
      });
      const data = await res.json() as { key?: string };
      if (data.key) { setGeneratedKey(data.key); setNewKeyLabel(''); await fetchAll(); }
    } finally { setActionLoading(null); }
  };

  const revokeAdmin = async (userId: string) => {
    const token = getVGToken();
    if (!token) return;
    setActionLoading('revoke' + userId);
    try {
      await fetch('/api/yeditsgold-admin-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'revoke', userId }),
      });
      await fetchAll();
    } finally { setActionLoading(null); }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const reviewTracker = async (id: string, action: 'approve' | 'reject' | 'remove') => {
    const token = getVGToken();
    if (!token) return;
    if (action === 'remove' && !confirm('Take this community tracker down? It will stop resolving publicly.')) return;
    setActionLoading(id + action);
    try {
      await fetch('/api/community/admin/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, action }),
      });
      await fetchAll();
    } finally { setActionLoading(null); }
  };

  const pending = claims.filter(c => c.status === 'pending');
  const reviewed = claims.filter(c => c.status !== 'pending');

  const tabStyle = (t: typeof tab) => ({
    padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
    background: tab === t ? 'rgba(255,255,255,0.1)' : 'transparent',
    color: tab === t ? '#fff' : 'rgba(255,255,255,0.4)',
  });

  const content = (
    <>
      {loading && <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Loading…</p>}

      {/* ── Claims tab ── */}
      {!loading && tab === 'claims' && (
        <>
          {pending.length === 0 && <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginBottom: 16 }}>No pending claims.</p>}
          {pending.length > 0 && (
            <>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', marginBottom: 12 }}>Pending</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                {pending.map(c => (
                  <div key={c.id} style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{c.profile_name}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>@{c.username} · {c.email} · {new Date(c.claimed_at).toLocaleDateString()}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => actClaim(c.id, 'approve')} disabled={!!actionLoading} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'rgba(74,222,128,0.15)', color: '#4ade80', fontSize: 12, fontWeight: 600 }}>
                        <Check size={13} /> {actionLoading === c.id + 'approve' ? '…' : 'Approve'}
                      </button>
                      <button onClick={() => actClaim(c.id, 'reject')} disabled={!!actionLoading} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'rgba(248,113,113,0.12)', color: '#f87171', fontSize: 12, fontWeight: 600 }}>
                        <X size={13} /> {actionLoading === c.id + 'reject' ? '…' : 'Reject'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {reviewed.length > 0 && (
            <>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', marginBottom: 12 }}>Reviewed</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {reviewed.map(c => (
                  <div key={c.id} style={{ background: '#111', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{c.profile_name}</span>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginLeft: 8 }}>@{c.username}</span>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: c.status === 'approved' ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)', color: c.status === 'approved' ? '#4ade80' : '#f87171' }}>{c.status}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ── Community Trackers tab ── */}
      {!loading && tab === 'trackers' && (
        <>
          {ctPending.length === 0 && <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginBottom: 16 }}>No trackers awaiting review.</p>}
          {ctPending.length > 0 && (
            <>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', marginBottom: 12 }}>Awaiting review</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                {ctPending.map(t => (
                  <div key={t.id} style={{ background: '#161616', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    {t.logo_url && <img src={t.logo_url} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <a href={`/${t.slug}/`} target="_blank" rel="noreferrer" style={{ fontSize: 14, fontWeight: 600, color: '#fff', textDecoration: 'none' }}>{t.name} ↗</a>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>/{t.slug} · @{t.username}{t.submitted_at ? ` · ${new Date(t.submitted_at).toLocaleDateString()}` : ''}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => reviewTracker(t.id, 'approve')} disabled={!!actionLoading} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'rgba(74,222,128,0.15)', color: '#4ade80', fontSize: 12, fontWeight: 600 }}>
                        <Check size={13} /> {actionLoading === t.id + 'approve' ? '…' : 'Approve'}
                      </button>
                      <button onClick={() => reviewTracker(t.id, 'reject')} disabled={!!actionLoading} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'rgba(248,113,113,0.12)', color: '#f87171', fontSize: 12, fontWeight: 600 }}>
                        <X size={13} /> {actionLoading === t.id + 'reject' ? '…' : 'Reject'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          {ctApproved.length > 0 && (
            <>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', marginBottom: 12 }}>Live trackers</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ctApproved.map(t => (
                  <div key={t.id} style={{ background: '#111', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <a href={`/${t.slug}/`} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600, color: '#fff', textDecoration: 'none' }}>{t.name}</a>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginLeft: 8 }}>/{t.slug} · @{t.username}</span>
                    </div>
                    <button onClick={() => reviewTracker(t.id, 'remove')} disabled={!!actionLoading} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid rgba(248,113,113,0.4)', cursor: 'pointer', background: 'transparent', color: '#f87171', fontSize: 12, fontWeight: 600 }}>
                      {actionLoading === t.id + 'remove' ? '…' : 'Remove'}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* ── Keys tab (owner only) ── */}
      {!loading && tab === 'keys' && (
        <>
          {/* Generate new key */}
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', marginBottom: 12 }}>Generate Key</p>
          <div style={{ display: 'flex', gap: 8, marginBottom: generatedKey ? 12 : 24 }}>
            <input
              value={newKeyLabel}
              onChange={e => setNewKeyLabel(e.target.value)}
              placeholder="Label (e.g. dev name)"
              style={{ flex: 1, padding: '9px 14px', borderRadius: 8, background: '#161616', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 13, outline: 'none' }}
              onFocus={e => { e.currentTarget.style.borderColor = `${ACCENT}55`; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
            />
            <button
              onClick={generateKey}
              disabled={actionLoading === 'gen'}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', background: ACCENT, color: '#000', fontSize: 13, fontWeight: 700, opacity: actionLoading === 'gen' ? 0.6 : 1 }}
            >
              <KeyRound size={13} /> {actionLoading === 'gen' ? '…' : 'Generate'}
            </button>
          </div>

          {generatedKey && (
            <div style={{ background: '#0a1a0a', border: '1px solid rgba(74,222,128,0.25)', borderRadius: 10, padding: '14px 16px', marginBottom: 24 }}>
              <p style={{ fontSize: 11, color: '#4ade80', fontWeight: 600, marginBottom: 8 }}>New key — share this once, it burns after use:</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <code style={{ flex: 1, fontSize: 15, fontWeight: 700, letterSpacing: '0.08em', color: '#fff', fontFamily: 'monospace' }}>{generatedKey}</code>
                <button
                  onClick={() => copyKey(generatedKey)}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: '1px solid rgba(74,222,128,0.3)', background: 'transparent', color: '#4ade80', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                >
                  <Copy size={12} /> {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          {/* Key history */}
          {keys.length > 0 && (
            <>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', marginBottom: 12 }}>Key History</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
                {keys.map(k => (
                  <div key={k.key} style={{ background: '#111', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <code style={{ fontSize: 12, color: k.used_at ? 'rgba(255,255,255,0.25)' : '#fff', fontFamily: 'monospace', letterSpacing: '0.05em' }}>{k.key}</code>
                      {k.label && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>{k.label}</span>}
                      {k.used_at && <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginLeft: 8 }}>Used by @{k.used_by_username}</span>}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: k.used_at ? 'rgba(255,255,255,0.05)' : 'rgba(74,222,128,0.1)', color: k.used_at ? 'rgba(255,255,255,0.25)' : '#4ade80' }}>
                      {k.used_at ? 'used' : 'unused'}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Current admins */}
          {admins.length > 0 && (
            <>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', marginBottom: 12 }}>Admins</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {admins.map(a => (
                  <div key={a.user_id} style={{ background: '#111', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>@{a.username}</span>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginLeft: 8 }}>{a.email}</span>
                    </div>
                    <button
                      onClick={() => revokeAdmin(a.user_id)}
                      disabled={!!actionLoading}
                      style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(248,113,113,0.1)', color: '#f87171' }}
                    >
                      {actionLoading === 'revoke' + a.user_id ? '…' : 'Revoke'}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );

  if (embedded) return <div style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>{content}</div>;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0d0d0d', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px 16px 0 0', width: '100%', maxHeight: '82vh', overflow: 'auto', padding: 24 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={18} style={{ color: ACCENT }} />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Admin Panel</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', display: 'flex' }}><X size={18} /></button>
        </div>

        {/* Tabs — keys tab only visible to owner */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 4 }}>
          <button style={tabStyle('claims')} onClick={() => setTab('claims')}>Claims</button>
          <button style={tabStyle('trackers')} onClick={() => setTab('trackers')}>
            Community{ctPending.length > 0 ? ` (${ctPending.length})` : ''}
          </button>
          {isOwner && <button style={tabStyle('keys')} onClick={() => setTab('keys')}>Admin Keys</button>}
        </div>

        {content}
      </div>
    </div>
  );
}

