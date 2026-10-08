import { useState } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { isLoggedIn } from '../comments';
import { setFollow, useIsFollowing, type FollowScope } from '../alerts';

// "Alert me" toggle for an artist, an era or a single song. Mirrors
// CommentButton's two looks:
//   variant 'icon' (default): compact bell for row action clusters.
//   variant 'pill': h-10 rounded pill for headers, with a label.
interface Props {
  slug: string;
  scope: FollowScope;
  target?: string;     // era name / song name (ignored for 'artist')
  label: string;       // human label shown in the alerts page
  variant?: 'icon' | 'pill';
  isCurrentlyPlaying?: boolean;
  className?: string;
}

export function FollowButton({ slug, scope, target = '', label, variant = 'icon', isCurrentlyPlaying, className }: Props) {
  const following = useIsFollowing(slug, scope, target);
  const [hint, setHint] = useState(false);
  const what = scope === 'artist' ? 'this tracker' : scope === 'era' ? 'this era' : 'this song';
  const title = following ? `Stop alerts for ${what}` : `Alert me when ${what} changes`;

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isLoggedIn()) { setHint(true); setTimeout(() => setHint(false), 2500); return; }
    setFollow(slug, scope, target, label, !following);
  };

  const Icon = following ? BellRing : Bell;
  return (
    <span className="relative inline-flex">
      {variant === 'pill' ? (
        <button
          onClick={toggle}
          title={title}
          className={`w-auto px-4 h-10 flex items-center justify-center gap-2 rounded-full transition-colors cursor-pointer ${
            following ? 'bg-[var(--theme-color)]/20 text-[var(--theme-color)] hover:bg-[var(--theme-color)]/30' : 'bg-white/5 hover:bg-white/10 text-white/50 hover:text-white'
          } ${className || ''}`}
        >
          <Icon className="w-4 h-4" />
          <span className="text-[10px] font-bold tracking-wider uppercase">{following ? 'Following' : 'Alerts'}</span>
        </button>
      ) : (
        <button
          onClick={toggle}
          title={title}
          className={`p-1 rounded transition-all hover:bg-white/10 cursor-pointer ${
            following ? 'text-[var(--theme-color)]' : isCurrentlyPlaying ? 'text-[var(--theme-color)]/60 hover:text-[var(--theme-color)]' : 'text-white/20 hover:text-white/70'
          } ${className || ''}`}
        >
          <Icon className="w-3.5 h-3.5" />
        </button>
      )}
      {hint && (
        <span className="absolute z-50 top-full mt-1 right-0 whitespace-nowrap rounded-md bg-neutral-900 border border-white/10 px-2 py-1 text-[11px] text-white/80 shadow-lg">
          <a href="/account.html" className="underline" onClick={(e) => e.stopPropagation()}>Sign in</a> to get alerts
        </span>
      )}
    </span>
  );
}
