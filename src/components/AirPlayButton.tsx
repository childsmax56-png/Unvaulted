import { Airplay } from 'lucide-react';
import { useAirPlay, showAirPlayPicker } from '../player/airplay';
import { usePlayerField } from '../player/audioStore';

// Opens Safari's AirPlay device picker for the global audio element. Renders
// nothing unless an AirPlay receiver is reachable (Safari only) and the track
// is playing through our own <audio> element (not a Spotify/YouTube embed).
export default function AirPlayButton({
  className = '',
  iconClassName = 'w-4 h-4',
}: {
  className?: string;
  iconClassName?: string;
}) {
  const { available, active } = useAirPlay();
  const [activePlayer] = usePlayerField('activePlayer');

  if ((!available && !active) || activePlayer !== 'audio') return null;

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
