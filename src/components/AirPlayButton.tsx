import { Airplay } from 'lucide-react';
import { useAirPlay, showAirPlayPicker, isAirPlaySupported } from '../player/airplay';
import { usePlayerField } from '../player/audioStore';

// Opens Safari's AirPlay device picker for the global audio element. Renders
// only in browsers with AirPlay (Safari) and while the track is playing through
// our own <audio> element (not a Spotify/YouTube embed).
//
// It does not wait for Safari's "receiver available" event: the element has
// wireless video playback disabled (so AirPlay carries Now Playing covers, see
// audioStore), and with that set Safari stops reporting receivers to it.
export default function AirPlayButton({
  className = '',
  iconClassName = 'w-4 h-4',
}: {
  className?: string;
  iconClassName?: string;
}) {
  const { available, active } = useAirPlay();
  const [activePlayer] = usePlayerField('activePlayer');

  if (!(isAirPlaySupported() || available || active) || activePlayer !== 'audio') return null;

  return (
    <button
      type="button"
      onClick={showAirPlayPicker}
      className={`flex items-center justify-center transition-colors cursor-pointer ${
        active ? 'text-[var(--theme-color)]' : 'text-white/40 hover:text-white'
      } ${className}`}
      title={active ? 'AirPlaying' : 'AirPlay'}
      aria-label={active ? 'AirPlaying — choose speaker' : 'AirPlay'}
    >
      <Airplay className={iconClassName} />
    </button>
  );
}
