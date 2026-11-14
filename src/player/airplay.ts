// AirPlay support for the global <audio> element.
//
// Only Safari (macOS, iOS, iPadOS) exposes AirPlay to web pages, through the
// non-standard WebKit API on media elements. Chromium (Chrome, Edge, the
// Electron desktop app) and Firefox have no AirPlay support, so on those
// `available` simply stays false and the button never renders.
//
// Playback keeps running through the single, reused <audio> element from
// audioStore, so once a route is picked it persists across tracks.

import { useEffect, useState } from 'react';
import { getAudioEl } from './audioStore';

type WebKitMediaElement = HTMLMediaElement & {
  webkitShowPlaybackTargetPicker?: () => void;
  webkitCurrentPlaybackTargetIsWireless?: boolean;
};

type AvailabilityEvent = Event & { availability?: 'available' | 'not-available' };

export function isAirPlaySupported(): boolean {
  return typeof window !== 'undefined' && 'WebKitPlaybackTargetAvailabilityEvent' in window;
}

export function showAirPlayPicker(): void {
  const el = getAudioEl() as WebKitMediaElement | null;
  el?.webkitShowPlaybackTargetPicker?.();
}

// `available`: an AirPlay receiver is reachable. `active`: audio is currently
// being sent to one.
export function useAirPlay(): { available: boolean; active: boolean } {
  const [available, setAvailable] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!isAirPlaySupported()) return;
    const el = getAudioEl() as WebKitMediaElement | null;
    if (!el) return;

    const onAvailability = (e: Event) => {
      setAvailable((e as AvailabilityEvent).availability === 'available');
    };
    const onWirelessChange = () => {
      setActive(!!el.webkitCurrentPlaybackTargetIsWireless);
    };

    el.addEventListener('webkitplaybacktargetavailabilitychanged', onAvailability);
    el.addEventListener('webkitcurrentplaybacktargetiswirelesschanged', onWirelessChange);
    onWirelessChange();

    return () => {
      el.removeEventListener('webkitplaybacktargetavailabilitychanged', onAvailability);
      el.removeEventListener('webkitcurrentplaybacktargetiswirelesschanged', onWirelessChange);
    };
  }, []);

  return { available, active };
}
