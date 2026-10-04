const ALLOWED_HOSTS = [
  'api.pillows.su',
  'temp.imgur.gg',
  'i.imgur.gg',
  'drive.google.com',
  'drive.usercontent.google.com',
];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Content-Type',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Disposition',
  'Access-Control-Max-Age': '86400',
};

// Map a filename extension to an audio MIME type. Google Drive serves audio as
// application/octet-stream, which some browsers refuse to play, so we recover a
// real audio type from the Content-Disposition filename when possible.
const EXT_MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  mp4: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  opus: 'audio/ogg',
};

function isDriveHost(host: string): boolean {
  return host === 'drive.google.com' || host === 'drive.usercontent.google.com';
}

// Pull the file ID out of any Google Drive URL shape we might receive:
//   /uc?export=download&id=ID, /uc?id=ID, /file/d/ID/..., /download?id=ID
function driveIdFrom(u: URL): string | null {
  const qId = u.searchParams.get('id');
  if (qId) return qId;
  const m = u.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

function filenameExt(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null;
  const m = contentDisposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  if (!m) return null;
  const dot = m[1].lastIndexOf('.');
  return dot >= 0 ? m[1].slice(dot + 1).toLowerCase() : null;
}

// Google shows an HTML "virus scan" interstitial for large files instead of the
// bytes. Fetch through drive.usercontent.google.com with confirm=t (which serves
// public files directly), and if we still get HTML, parse the confirmation form
// and follow it, carrying the download_warning cookie back.
async function fetchDrive(id: string, range: string | null, method: string): Promise<Response> {
  const confirmUrl = `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`;
  const headers: Record<string, string> = { 'User-Agent': 'Mozilla/5.0' };
  if (range) headers['Range'] = range;

  let resp = await fetch(confirmUrl, { method, headers, redirect: 'follow' });

  const ct = resp.headers.get('content-type') ?? '';
  if (method === 'GET' && ct.includes('text/html')) {
    const body = await resp.text();
    const actionMatch = body.match(/action="([^"]+)"/i);
    if (actionMatch) {
      const action = actionMatch[1].replace(/&amp;/g, '&');
      const followUrl = new URL(action);
      // Merge any hidden form inputs (id, export, confirm, uuid, authuser) into the URL.
      const inputRe = /<input[^>]*name="([^"]+)"[^>]*value="([^"]*)"/gi;
      let im: RegExpExecArray | null;
      while ((im = inputRe.exec(body)) !== null) {
        followUrl.searchParams.set(im[1], im[2].replace(/&amp;/g, '&'));
      }
      const followHeaders: Record<string, string> = { 'User-Agent': 'Mozilla/5.0' };
      if (range) followHeaders['Range'] = range;
      const setCookie = resp.headers.get('set-cookie');
      if (setCookie) followHeaders['Cookie'] = setCookie.split(';')[0];
      resp = await fetch(followUrl.toString(), { method, headers: followHeaders, redirect: 'follow' });
    }
  }

  return resp;
}

function buildResponseHeaders(upstream: Response): Headers {
  const headers = new Headers(CORS);
  headers.set('Accept-Ranges', 'bytes');

  const ext = filenameExt(upstream.headers.get('content-disposition'));
  const upstreamType = upstream.headers.get('content-type') ?? '';
  let contentType = upstreamType;
  if (!contentType || contentType === 'application/octet-stream' || contentType.includes('text/html')) {
    contentType = (ext && EXT_MIME[ext]) || 'audio/mpeg';
  }
  headers.set('Content-Type', contentType);

  for (const h of ['Content-Length', 'Content-Range', 'Content-Disposition']) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  return headers;
}

async function proxy(target: URL, request: Request, method: 'GET' | 'HEAD'): Promise<Response> {
  const range = request.headers.get('Range');

  let upstream: Response;
  if (isDriveHost(target.hostname)) {
    const id = driveIdFrom(target);
    if (!id) return new Response('Missing Drive file id', { status: 400, headers: CORS });
    upstream = await fetchDrive(id, range, method);
  } else {
    const headers: Record<string, string> = { 'User-Agent': 'Mozilla/5.0' };
    if (range) headers['Range'] = range;
    upstream = await fetch(target.toString(), { method, headers, redirect: 'follow' });
  }

  if (!upstream.ok && upstream.status !== 206) {
    return new Response('Upstream error', { status: upstream.status, headers: CORS });
  }

  const headers = buildResponseHeaders(upstream);
  const bodyless = method === 'HEAD' ? null : upstream.body;
  return new Response(bodyless, { status: upstream.status, headers });
}

function parseTarget(request: Request): URL | Response {
  const url = new URL(request.url);
  const target = url.searchParams.get('url');
  if (!target) return new Response('Missing url parameter', { status: 400, headers: CORS });

  let targetUrl: URL;
  try {
    targetUrl = new URL(target);
  } catch {
    return new Response('Invalid url parameter', { status: 400, headers: CORS });
  }
  if (!ALLOWED_HOSTS.includes(targetUrl.hostname)) {
    return new Response('Host not allowed', { status: 403, headers: CORS });
  }
  return targetUrl;
}

export const onRequestOptions: PagesFunction = async () => {
  return new Response(null, { status: 204, headers: CORS });
};

export const onRequestGet: PagesFunction = async (context) => {
  const target = parseTarget(context.request);
  if (target instanceof Response) return target;
  return proxy(target, context.request, 'GET');
};

export const onRequestHead: PagesFunction = async (context) => {
  const target = parseTarget(context.request);
  if (target instanceof Response) return target;
  return proxy(target, context.request, 'HEAD');
};
