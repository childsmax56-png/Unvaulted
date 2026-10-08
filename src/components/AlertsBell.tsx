import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { isLoggedIn } from '../comments';
import { useUnreadCount } from '../alerts';

// Bell linking to the alerts inbox, with an unread badge. Renders nothing for
// signed-out visitors (follows need an account).
export function AlertsBell({ className, style }: { className?: string; style?: React.CSSProperties }) {
  if (!isLoggedIn()) return null;
  return <SignedInBell className={className} style={style} />;
}

function SignedInBell({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const unread = useUnreadCount();
  return (
    <Link
      to="/alerts"
      title={unread ? `${unread} new alert${unread === 1 ? '' : 's'}` : 'Alerts'}
      className={className ?? 'relative flex items-center justify-center w-9 h-9 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors'}
      style={{ position: 'relative', ...style }}
    >
      <Bell className="w-4 h-4" />
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold leading-4 text-center">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Link>
  );
}
