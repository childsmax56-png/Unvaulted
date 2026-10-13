// UNVAULTED service worker — leak-alert push notifications only.
// Deliberately has NO fetch handler: it never intercepts or caches requests.
//
// Pushes arrive without a payload; we ask the server what's new using this
// browser's own subscription endpoint as the key (see
// functions/api/alerts/push-pending.ts).

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Mirrors createSlug in src/utils.tsx.
function createSlug(name) {
  return encodeURIComponent(
    name.replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').toLowerCase()
  );
}

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let items = [];
    let unread = 0;
    try {
      const sub = await self.registration.pushManager.getSubscription();
      if (sub) {
        const res = await fetch('/api/alerts/push-pending', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        if (res.ok) ({ items, unread } = await res.json());
      }
    } catch { /* fall through to a generic notification */ }

    // Browsers require a visible notification for every push.
    if (!items.length) {
      return self.registration.showNotification('UNVAULTED', {
        body: 'There are new updates on trackers you follow.',
        icon: '/icons/icon-192.png',
        tag: 'vg-alerts',
        data: { url: '/alerts' },
      });
    }
    const first = items[0];
    const title = unread > 1 ? `${first.name} + ${unread - 1} more update${unread > 2 ? 's' : ''}` : first.name;
    return self.registration.showNotification(title, {
      body: items.slice(0, 3).map((i) => `${i.name} — ${i.text}`).join('\n'),
      icon: '/icons/icon-192.png',
      tag: 'vg-alerts',
      renotify: true,
      data: { url: unread > 1 ? '/alerts' : `/${first.slug}/album/${createSlug(first.era)}` },
    });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/alerts';
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of wins) {
      if ('navigate' in w) { await w.focus(); return w.navigate(url); }
    }
    return self.clients.openWindow(url);
  })());
});
