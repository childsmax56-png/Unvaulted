import { useState } from 'react';
import { Flag, Check, Loader2 } from 'lucide-react';
import { reportBrokenLink } from '../linkStatus';

// "Report broken link" flag for a catalog row. Sends a report; the server
// re-checks the link and only badges it dead if the host confirms the file is
// gone. Signed-in is optional.
interface Props {
  tracker: string;
  url: string;
  label: string;
  era?: string;
  isCurrentlyPlaying?: boolean;
}

export function ReportLinkButton({ tracker, url, label, era, isCurrentlyPlaying }: Props) {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('Report broken link');

  const onClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (state === 'sending' || state === 'done') return;
    setState('sending');
    const res = await reportBrokenLink({ tracker, url, label, era, reason: 'user' });
    if (!res.ok) {
      setState('error');
      setMessage(res.error || 'Report failed');
      return;
    }
    setState('done');
    setMessage(res.status === 'dead'
      ? 'Confirmed dead — thanks!'
      : res.status === 'ok'
        ? 'Reported — the link looks up right now, a moderator will take a look'
        : 'Reported — thanks!');
  };

  return (
    <button
      onClick={onClick}
      title={message}
      aria-label={message}
      className={`p-1 rounded transition-all hover:bg-red-500/15 cursor-pointer ${
        state === 'done' ? 'text-red-400/80'
          : state === 'error' ? 'text-red-400'
          : isCurrentlyPlaying ? 'text-[var(--theme-color)]/40 hover:text-red-400' : 'text-white/20 hover:text-red-400'
      }`}
    >
      {state === 'sending' ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : state === 'done' ? <Check className="w-3.5 h-3.5" />
        : <Flag className="w-3.5 h-3.5" />}
    </button>
  );
}
