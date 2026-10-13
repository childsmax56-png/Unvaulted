import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, Loader2 } from 'lucide-react';
import { TrackerData, Era, Song } from '../types';
import { useSettings } from '../SettingsContext';

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

interface ScreenContext {
  activeCategory: string;
  selectedAlbumName?: string;
  currentSongName?: string;
  currentEraName?: string;
}

interface ChatBubbleProps {
  data: TrackerData | null;
  screenContext: ScreenContext;
  showPlayer: boolean;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

function cleanSongName(name: string): string {
  return name.replace(/\s*[\[(][^\])[]*[\])]/g, '').trim();
}

function eraSlug(name: string): string {
  return encodeURIComponent(
    name.replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-')
  );
}

function buildTrackerSummary(data: TrackerData): string {
  const eras = Object.values(data.eras || {}) as Era[];
  const lines: string[] = [];

  for (const era of eras) {
    const slug = eraSlug(era.name);
    const categories = Object.entries(era.data || {});
    const allSongs: string[] = [];
    for (const [, songs] of categories) {
      for (const song of songs as Song[]) {
        const parts = [cleanSongName(song.name)];
        if (song.quality) parts.push(`quality:${song.quality}`);
        if (song.available_length) parts.push(`length:${song.available_length}`);
        if (song.leak_date) parts.push(`leaked:${song.leak_date}`);
        if (!song.url && !(song.urls?.length)) parts.push('unavailable');
        allSongs.push(parts.join(' | '));
      }
    }
    lines.push(`=== ${era.name} | url:/album/${slug} ===`);
    lines.push(...allSongs);
  }

  const result = lines.join('\n');
  // Cap at 600k chars — well within Gemini 2.5 Flash's 1M token context window
  return result.length > 600000 ? result.slice(0, 600000) + '\n...[truncated]' : result;
}

function renderMessage(text: string) {
  const pattern = /\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;
  return text.split('\n').map((line, li) => {
    const nodes: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((m = pattern.exec(line)) !== null) {
      if (m.index > last) nodes.push(line.slice(last, m.index));
      if (m[1] !== undefined) {
        const href = m[2];
        nodes.push(
          <a
            key={m.index}
            href={href}
            className="underline text-[var(--theme-color)] hover:opacity-80"
          >
            {m[1]}
          </a>
        );
      } else if (m[3] !== undefined) {
        nodes.push(<strong key={m.index}>{m[3]}</strong>);
      }
      last = m.index + m[0].length;
    }
    if (last < line.length) nodes.push(line.slice(last));
    return <span key={li}>{li > 0 && <br />}{nodes}</span>;
  });
}

export function ChatBubble({ data, screenContext, showPlayer, open, onOpenChange }: ChatBubbleProps) {
  const { settings } = useSettings();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setLoading(true);

    try {
      const trackerSummary = data ? buildTrackerSummary(data) : 'Tracker data not yet loaded.';
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages,
          screenContext,
          trackerSummary,
        }),
      });

      const json = await res.json() as { reply?: string; error?: string; details?: string };
      const reply = json.reply
        || (settings.aiErrorDetails
          ? (json.details ? `Error: ${json.details}` : json.error || 'Something went wrong.')
          : 'Something went wrong. Please try again.');
      setMessages([...nextHistory, { role: 'model', content: reply }]);
    } catch {
      setMessages([...nextHistory, { role: 'model', content: 'Failed to get a response. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const bottomOffset = showPlayer ? 'bottom-28' : 'bottom-6';

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            className={`fixed right-4 sm:right-6 z-[9000] w-[calc(100vw-2rem)] sm:w-96 flex flex-col rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-[#111]`}
            style={{
              bottom: showPlayer ? 'calc(5.5rem + 1.5rem)' : '5rem',
              maxHeight: 'min(600px, calc(100dvh - 8rem - env(safe-area-inset-top)))',
            }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#181818]">
              <div className="flex items-center gap-3">
                <img src="https://i.ibb.co/TMFsFsSp/YE-I-01.png" alt="YE-I" className="w-9 h-9 rounded-full object-cover bg-black" />
                <div>
                  <p className="text-white text-sm font-semibold leading-tight">YE-I</p>
                  <p className="text-white/40 text-[10px]">Ask anything about Ye's music</p>
                </div>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="text-white/40 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
              {messages.length === 0 && (
                <div className="text-white/30 text-sm text-center py-6 leading-relaxed">
                  Ask about any Ye song, era, leak, or quality rating.
                </div>
              )}
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[var(--theme-color)] text-white rounded-br-sm'
                        : 'bg-white/8 text-white/85 rounded-bl-sm border border-white/8'
                    }`}
                  >
                    {msg.role === 'user' ? msg.content : renderMessage(msg.content)}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-white/8 border border-white/8 px-3 py-2 rounded-xl rounded-bl-sm">
                    <Loader2 className="w-3 h-3 text-white/40 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="px-3 py-2 border-t border-white/10 bg-[#181818] flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask something..."
                rows={1}
                className="flex-1 bg-white/6 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 resize-none focus:outline-none focus:border-[var(--theme-color)]/50 transition-colors"
                style={{ maxHeight: '80px', overflowY: 'auto' }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="p-2 rounded-xl bg-[var(--theme-color)] text-white disabled:opacity-30 hover:opacity-90 transition-opacity cursor-pointer disabled:cursor-not-allowed flex-shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
