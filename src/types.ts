export interface Song {
  name: string;
  extra?: string;
  extra2?: string;
  description?: string;
  track_length?: string;
  leak_date?: string;
  file_date?: string;
  available_length?: string;
  quality?: string;
  url?: string;
  urls?: string[];
  image?: string;
  realEra?: any;
  bpm?: string;
  fakesType?: string;
  fakesLength?: string;
  subera?: string;
  // Comment-thread context stamped on at play time so the mini player can open
  // the same per-entry thread as the row it was played from (see src/comments).
  commentTracker?: string;
  commentKey?: string;
  commentLabel?: string;
}

export interface EraData {
  [category: string]: Song[];
}

export interface Era {
  name: string;
  extra?: string;
  timeline?: string;
  description?: string;
  fileInfo?: string[];
  image?: string;
  backgroundColor?: string;
  textColor?: string;
  data: EraData;
}

export interface TrackerData {
  name: string;
  tabs: string[];
  current_tab: string;
  eras: Record<string, Era>;
}

export interface PlaylistSong {
  songName: string;
  eraName: string;
  url: string;
  song?: Song;
  // Global playlists mix songs from many trackers, so each entry remembers its
  // source tracker slug + display artwork/artist so it can be played and shown
  // without that tracker's full data being loaded.
  tracker?: string;
  image?: string;
  artist?: string;
}

export interface UserPlaylist {
  id: string;
  name: string;
  cover?: string;
  songs: PlaylistSong[];
  // Reserved auto-playlists (e.g. the derived "Favorites" list) are not stored
  // or user-editable song-wise; they are rebuilt from other state.
  readonly?: boolean;
}

export interface SearchFilters {
  tags: string[];
  excludedTags: string[];
  qualities: string[];
  excludedQualities: string[];
  availableLengths: string[];
  excludedAvailableLengths: string[];
  durationOp: string;
  durationValue: string;
  playableOnly?: boolean;
  hasClips?: 'include' | 'exclude' | null;
  hasRemixes?: 'include' | 'exclude' | null;
  hasSamples?: 'include' | 'exclude' | null;
  albums?: string[];
}
