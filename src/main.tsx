import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, useParams, Navigate, useLocation } from 'react-router-dom';
import App from './App.tsx';
import { LandingPage } from './LandingPage.tsx';
import './index.css';
import { SettingsProvider } from './SettingsContext.tsx';
import { DownloadManagerProvider } from './DownloadManagerContext.tsx';
import { DownloadProgressWidget } from './components/DownloadProgressWidget.tsx';

import { ErrorBoundary } from './ErrorBoundary.tsx';
import { setActiveConfig, activeConfig } from './artists/activeConfig.ts';
import { getArtistConfig } from './artists/registry.ts';
import { buildCommunityConfig } from './artists/communityConfigBase.ts';
import { MyTrackerPage } from './MyTrackerPage.tsx';
import { GamePage } from './GamePage.tsx';
import { SnippetGamePage } from './SnippetGamePage.tsx';
import { YEditsGoldPage } from './YEditsGoldPage.tsx';
import { ListeningStatsPage } from './ListeningStatsPage.tsx';
import { ForYouPage } from './ForYouPage.tsx';
import { TierListPage } from './TierListPage.tsx';
import { TermsPage } from './TermsPage.tsx';
import { PrivacyPage } from './PrivacyPage.tsx';
import { DownloadPage } from './DownloadPage.tsx';
import { CreateTrackerPage } from './CreateTrackerPage.tsx';
import { CommunityPage } from './CommunityPage.tsx';
import { PlaylistsPage } from './PlaylistsPage.tsx';
import { GlobalPlaylistProvider } from './GlobalPlaylistContext.tsx';
import { GlobalMiniPlayer } from './player/GlobalMiniPlayer.tsx';

// Top-level path segments that are app routes, not trackers. Anything else is a
// tracker slug (official registry first, then the community fallback).
const RESERVED_TOP_SEGMENTS = new Set([
  'my-tracker', 'game', 'guess', 'yeditsgold', 'listening', 'tierlist',
  'terms', 'privacy', 'download', 'create-tracker', 'community', 'playlists',
  'foryou',
]);

// Renders the persistent mini player on any route where the per-artist <App>
// is NOT mounted (landing page, /my-tracker, etc.). On artist routes App shows
// its own full PlayerBar, so this hides itself to avoid a duplicate bar.
function GlobalPlayerMount() {
  const location = useLocation();
  const firstSegment = location.pathname.split('/').filter(Boolean)[0];
  // Official trackers and community slugs both mount <App>; only reserved app
  // routes (and the landing page) show the standalone mini player.
  const onArtistRoute = !!firstSegment && !RESERVED_TOP_SEGMENTS.has(firstSegment);
  if (onArtistRoute) return null;
  return <GlobalMiniPlayer />;
}

// Mounts the shared tracker <App> for a community (DB-backed) tracker after
// fetching its runtime config. Used when the slug isn't an official tracker.
function CommunityArtistRoute({ slug }: { slug: string }) {
  const [state, setState] = useState<'loading' | 'ready' | 'notfound'>('loading');

  useEffect(() => {
    let cancelled = false;
    setState('loading');
    const token = localStorage.getItem('vg_token');
    fetch(`/api/community/config/${slug}`, token ? { headers: { Authorization: `Bearer ${token}` } } : undefined)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('not found'))))
      .then((payload) => {
        if (cancelled) return;
        setActiveConfig(buildCommunityConfig(payload));
        setState('ready');
      })
      .catch(() => { if (!cancelled) setState('notfound'); });
    return () => { cancelled = true; };
  }, [slug]);

  if (state === 'loading') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontFamily: 'system-ui, sans-serif' }}>
        Loading tracker…
      </div>
    );
  }
  if (state === 'notfound') return <Navigate to="/" replace />;

  return (
    <ErrorBoundary key={slug}>
      <SettingsProvider storagePrefix={activeConfig.STORAGE_PREFIX}>
        <App key={slug} />
      </SettingsProvider>
    </ErrorBoundary>
  );
}

function ArtistRoute() {
  const { artist } = useParams<{ artist: string }>();

  const config = artist ? getArtistConfig(artist) : undefined;

  // Unknown slug → try the community-tracker fallback (fetches a runtime config).
  if (!config) {
    if (!artist) return <Navigate to="/" replace />;
    return <CommunityArtistRoute slug={artist} />;
  }

  // Set the active config before the App mounts — the key forces a full remount
  // on artist change so all components read the freshly set config.
  setActiveConfig(config);

  return (
    <ErrorBoundary key={artist}>
      <SettingsProvider storagePrefix={config.STORAGE_PREFIX}>
        <App key={artist} />
      </SettingsProvider>
    </ErrorBoundary>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DownloadManagerProvider>
      <GlobalPlaylistProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<SettingsProvider><LandingPage /></SettingsProvider>} />
          <Route path="/my-tracker" element={<SettingsProvider><MyTrackerPage /></SettingsProvider>} />
          <Route path="/game" element={<GamePage />} />
          <Route path="/guess" element={<SnippetGamePage />} />
          <Route path="/yeditsgold" element={<SettingsProvider><YEditsGoldPage /></SettingsProvider>} />
          <Route path="/listening" element={<SettingsProvider><ListeningStatsPage /></SettingsProvider>} />
          <Route path="/foryou" element={<SettingsProvider><ForYouPage /></SettingsProvider>} />
          <Route path="/tierlist" element={<SettingsProvider><TierListPage /></SettingsProvider>} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/download" element={<DownloadPage />} />
          <Route path="/community" element={<SettingsProvider><CommunityPage /></SettingsProvider>} />
          <Route path="/playlists" element={<SettingsProvider><PlaylistsPage /></SettingsProvider>} />
          <Route path="/create-tracker" element={<SettingsProvider><CreateTrackerPage /></SettingsProvider>} />
          <Route path="/create-tracker/:id" element={<SettingsProvider><CreateTrackerPage /></SettingsProvider>} />
          <Route path="/:artist/*" element={<ArtistRoute />} />
        </Routes>
        <GlobalPlayerMount />
      </BrowserRouter>
      </GlobalPlaylistProvider>
      <DownloadProgressWidget />
    </DownloadManagerProvider>
  </StrictMode>,
);
