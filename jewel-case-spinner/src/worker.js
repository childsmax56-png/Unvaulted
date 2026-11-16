import files from './files.generated.js';

const decoded = new Map();
function body(path) {
  if (!decoded.has(path)) {
    const bin = atob(files[path].b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    decoded.set(path, bytes);
  }
  return decoded.get(path);
}

const security = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

export default {
  async fetch(request) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
    let path = new URL(request.url).pathname;
    if (path.endsWith('/')) path += 'index.html';
    if (!files[path]) path = '/index.html';
    const headers = {
      ...security,
      'Content-Type': files[path].type,
      'Cache-Control': path.startsWith('/vendor/') ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate',
    };
    return new Response(request.method === 'HEAD' ? null : body(path), { headers });
  },
};
