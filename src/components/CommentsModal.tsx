import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, MessageCircle, Loader2, Trash2, CornerDownRight, Send } from 'lucide-react';
import {
  CommentNode, VGUser, fetchComments, postComment, deleteComment, getUser,
} from '../comments';

const profileHref = (username: string) => `/u/${encodeURIComponent(username)}`;

// Owner accounts mirror functions/api/_yedits-auth OWNER_EMAILS — used only to
// surface the delete affordance on others' comments; the API is the real gate.
const OWNER_EMAILS = ['vaultgold671@gmail.com', 'childsmax56@gmail.com'];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tracker: string;
  entryKey: string;
  entryLabel: string;
  entryType?: string;
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

export function CommentsModal({ isOpen, onClose, tracker, entryKey, entryLabel, entryType }: Props) {
  const [comments, setComments] = useState<CommentNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState('');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const user: VGUser | null = getUser();
  const isOwner = !!user && OWNER_EMAILS.includes((user.email || '').toLowerCase());
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const list = await fetchComments(tracker, entryKey);
    setComments(list);
    setLoading(false);
  }, [tracker, entryKey]);

  useEffect(() => { if (isOpen) { load(); setError(''); setReplyTo(null); } }, [isOpen, load]);

  // Close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const total = comments.reduce((n, c) => n + 1 + c.replies.length, 0);

  const submit = async (text: string, parentId?: string) => {
    const trimmed = text.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    setError('');
    const res = await postComment({ tracker, entry: entryKey, entryLabel, entryType, parentId, body: trimmed });
    setPosting(false);
    if (!res.ok) { setError(res.error || 'Failed to post'); return; }
    if (parentId) { setReplyBody(''); setReplyTo(null); } else { setBody(''); }
    await load();
  };

  const remove = async (id: string) => {
    const ok = await deleteComment(id, tracker, entryKey);
    if (ok) await load();
  };

  const canDelete = (c: CommentNode) => !!user && (c.userId === user.id || isOwner);

  const renderComment = (c: CommentNode, isReply = false) => (
    <div key={c.id} className={isReply ? 'pl-4 border-l border-white/10' : ''}>
      <div className="flex items-start gap-2 py-2">
        <Link to={profileHref(c.username)} onClick={onClose} title={`${c.username}'s profile`} className="shrink-0">
          {c.avatarUrl ? (
            <img
              src={c.avatarUrl}
              alt={c.username}
              className="w-7 h-7 rounded-full object-cover shrink-0 mt-0.5 bg-white/5"
              loading="lazy"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-[var(--theme-color)]/20 text-[var(--theme-color)] flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
              {(c.username || '?').charAt(0).toUpperCase()}
            </div>
          )}
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <Link to={profileHref(c.username)} onClick={onClose} className="text-sm font-semibold text-white hover:text-[var(--theme-color)] hover:underline">{c.username}</Link>
            <span className="text-[11px] text-white/40">{timeAgo(c.createdAt)}</span>
          </div>
          <p className="text-sm text-white/80 whitespace-pre-wrap break-words leading-snug mt-0.5">{c.body}</p>
          <div className="flex items-center gap-3 mt-1">
            {!isReply && user && (
              <button
                onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyBody(''); }}
                className="text-[11px] text-white/40 hover:text-white/80 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <CornerDownRight className="w-3 h-3" /> Reply
              </button>
            )}
            {canDelete(c) && (
              <button
                onClick={() => remove(c.id)}
                className="text-[11px] text-white/40 hover:text-red-400 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            )}
          </div>

          {replyTo === c.id && (
            <div className="mt-2 flex items-end gap-2">
              <textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(replyBody, c.id); }}
                placeholder={`Reply to ${c.username}…`}
                rows={2}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[var(--theme-color)]/50 resize-none"
              />
              <button
                onClick={() => submit(replyBody, c.id)}
                disabled={posting || !replyBody.trim()}
                className="p-2 rounded-lg bg-[var(--theme-color)] text-black disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
      {c.replies.length > 0 && (
        <div className="ml-9">{c.replies.map((r) => renderComment(r, true))}</div>
      )}
    </div>
  );

  if (!isOpen) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-[100010] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
        >
          <motion.div
            initial={{ y: 40, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 40, scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:w-[520px] max-h-[85vh] sm:max-h-[70vh] bg-[#1a1a1a] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <MessageCircle className="w-4 h-4 text-[var(--theme-color)] shrink-0" />
                <div className="min-w-0">
                  <div className="text-white font-bold text-sm">Comments{total > 0 ? ` · ${total}` : ''}</div>
                  <div className="text-[11px] text-white/40 truncate">{entryLabel}</div>
                </div>
              </div>
              <button onClick={onClose} className="text-white/50 hover:text-white transition-colors cursor-pointer shrink-0">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar px-4 py-2">
              {loading ? (
                <div className="flex items-center justify-center py-12 text-white/40">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center py-12 text-white/40 text-sm">
                  No comments yet. Be the first to say something.
                </div>
              ) : (
                comments.map((c) => renderComment(c))
              )}
            </div>

            <div className="border-t border-white/10 p-3 shrink-0">
              {user ? (
                <>
                  <div className="flex items-end gap-2">
                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(body); }}
                      placeholder="Add a comment…"
                      rows={2}
                      className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-[var(--theme-color)]/50 resize-none"
                    />
                    <button
                      onClick={() => submit(body)}
                      disabled={posting || !body.trim()}
                      className="p-2.5 rounded-lg bg-[var(--theme-color)] text-black disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shrink-0"
                    >
                      {posting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </div>
                  {error && <p className="text-xs text-red-400 mt-1.5">{error}</p>}
                  <p className="text-[10px] text-white/30 mt-1.5">Signed in as {user.username} · ⌘/Ctrl+Enter to post</p>
                </>
              ) : (
                <div className="text-center py-2 text-sm text-white/50">
                  <span className="text-white/70">Sign in</span> to your unvaulted account to comment.
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
