/**
 * netlify/functions/poster.js
 *
 * Serverless handler for Netlify deployments with persistent Netlify Blobs storage:
 * - POST /api/poster      → stores generated poster and returns shareable direct download URL
 * - GET  /api/poster/:id  → directly serves binary PNG download or interactive mobile viewer
 * - GET  /api/poster/network → returns cloud host information
 */
import crypto from 'crypto';
import { getStore } from '@netlify/blobs';

// In-memory fallback
const posterStore = new Map();

function getBlobsStore() {
  try {
    return getStore('maih-posters');
  } catch {
    return null;
  }
}

function renderMobilePosterPage(id) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Your AI Poster – Microsoft AI Innovators Hub</title>
  <meta name="theme-color" content="#050813">
  <style>
    :root {
      --bg: #050813;
      --card-bg: rgba(10, 16, 32, 0.92);
      --cyan: #00f5ff;
      --purple: #8b5cf6;
      --text: #f0f6fc;
      --text-muted: #8899aa;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px 14px 28px;
    }
    .wrapper { width: 100%; max-width: 440px; display: flex; flex-direction: column; align-items: center; gap: 14px; }
    .header { text-align: center; }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--cyan);
      background: rgba(0, 245, 255, 0.08);
      border: 1px solid rgba(0, 245, 255, 0.3);
      padding: 4px 12px;
      border-radius: 999px;
      margin-bottom: 8px;
    }
    .title {
      font-size: 1.25rem;
      font-weight: 800;
      background: linear-gradient(135deg, #ffffff 40%, var(--cyan) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 2px;
    }
    .subtitle { font-size: 0.78rem; color: var(--text-muted); }
    .poster-card {
      width: 100%;
      background: var(--card-bg);
      border: 1px solid rgba(0, 245, 255, 0.25);
      border-radius: 16px;
      padding: 10px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6), 0 0 25px rgba(0, 245, 255, 0.12);
    }
    .poster-img {
      width: 100%;
      height: auto;
      max-height: 52vh;
      object-fit: contain;
      border-radius: 12px;
      display: block;
    }
    .actions { width: 100%; display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
    .btn {
      width: 100%;
      padding: 14px 18px;
      border-radius: 12px;
      font-size: 1rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      text-decoration: none;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      cursor: pointer;
      border: none;
    }
    .btn-primary {
      background: linear-gradient(135deg, #00f5ff 0%, #0077ff 100%);
      color: #030814;
      box-shadow: 0 0 20px rgba(0, 245, 255, 0.4);
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.06);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.18);
    }
    .tip-card {
      width: 100%;
      background: rgba(0, 245, 255, 0.05);
      border: 1px dashed rgba(0, 245, 255, 0.3);
      border-radius: 12px;
      padding: 12px 14px;
      font-size: 0.8rem;
      color: #cbd5e1;
      line-height: 1.45;
    }
    .tip-card strong { color: var(--cyan); }
    .footer { text-align: center; font-size: 0.72rem; color: var(--text-muted); }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="badge">Microsoft AI Innovators Hub</div>
      <h1 class="title">Your Event Poster</h1>
      <p class="subtitle">High-Resolution Photo Booth Capture</p>
    </div>

    <div class="poster-card">
      <img id="posterImg" class="poster-img" src="/api/poster/${id}?raw=1" alt="AI Innovators Hub Poster" />
      <div class="actions">
        <button id="shareBtn" class="btn btn-primary" onclick="handleShareOrSave()">
          <span>📱</span> Save to Photos / Share
        </button>
        <a id="downloadBtn" class="btn btn-secondary" href="/api/poster/${id}?download=1" download="MAIH-Poster.png">
          <span>⬇</span> Download PNG File
        </a>
      </div>
    </div>

    <div class="tip-card">
      <strong>iPhone &amp; Android Tip:</strong><br />
      You can also press &amp; hold the poster image above to save directly to your camera roll!
    </div>

    <div class="footer">
      © MICROSOFT AI INNOVATORS HUB · All About AI &amp; Data
    </div>
  </div>

  <script>
    const id = "${id}";
    const posterUrl = "/api/poster/" + id + "?raw=1";
    const downloadUrl = "/api/poster/" + id + "?download=1";

    // Auto-trigger download
    window.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = 'MAIH-Poster.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }, 500);
    });

    async function handleShareOrSave() {
      try {
        const res = await fetch(posterUrl);
        const blob = await res.blob();
        const file = new File([blob], 'MAIH-Poster.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'Microsoft AI Innovators Hub Poster',
            text: 'Check out my poster from the Microsoft AI Innovators Hub Photo Booth! 🤖✨',
          });
          return;
        }
      } catch (e) {
        if (e.name === 'AbortError') return;
      }
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = 'MAIH-Poster.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  </script>
</body>
</html>`;
}

function renderNotFoundPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Poster Not Found</title>
  <style>
    body { background: #050813; color: #f0f6fc; font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; text-align: center; }
    .card { background: rgba(10, 16, 32, 0.9); border: 1px solid rgba(255, 75, 75, 0.3); border-radius: 16px; padding: 32px 24px; max-width: 400px; }
    h1 { color: #ff5555; font-size: 1.3rem; margin-bottom: 12px; }
  </style>
</head>
<body>
  <div class="card">
    <div style="font-size: 2.5rem; margin-bottom: 12px;">⌛</div>
    <h1>Poster Not Found or Session Expired</h1>
    <p>Please take a new photo at the booth!</p>
  </div>
</body>
</html>`;
}

export async function handler(event) {
  const path = event.path || '';
  const httpMethod = event.httpMethod;

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Accept',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // GET /api/poster/network
  if (httpMethod === 'GET' && (path.endsWith('/network') || path.endsWith('/network/'))) {
    const host = event.headers.host || 'Netlify Cloud';
    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selectedIp: host,
        port: 443,
        interfaces: [{ name: 'Netlify Cloud', address: host, type: 'cloud', priority: 100, recommended: true }],
        tunnelUrl: `https://${host}`,
        tunnelActive: true,
        isPublic: true,
      }),
    };
  }

  // POST /api/poster
  if (httpMethod === 'POST') {
    try {
      const { image } = JSON.parse(event.body || '{}');
      if (!image || !image.startsWith('data:image/')) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid image data' }) };
      }
      const id = crypto.randomUUID();
      const base64Data = image.split(',')[1];

      // Save to Netlify Blobs for cross-instance persistence
      const store = getBlobsStore();
      if (store) {
        try {
          await store.set(id, base64Data, { metadata: { createdAt: Date.now() } });
        } catch (err) {
          console.warn('Netlify Blobs set error:', err.message);
        }
      }
      posterStore.set(id, base64Data);

      const host = event.headers.host || 'localhost';
      const proto = event.headers['x-forwarded-proto'] || 'https';
      const directDownloadUrl = `${proto}://${host}/api/poster/${id}?download=1`;
      const viewerUrl = `${proto}://${host}/api/poster/${id}`;

      return {
        statusCode: 200,
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: directDownloadUrl,
          directDownloadUrl,
          viewerUrl,
          id,
          ip: host,
          port: 443,
          isPublic: true,
          interfaces: [],
        }),
      };
    } catch (e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: e.message }) };
    }
  }

  // GET /api/poster/gallery or /api/poster/list (ADMIN ONLY)
  if (httpMethod === 'GET' && (path.endsWith('/gallery') || path.endsWith('/list'))) {
    const adminPin = process.env.ADMIN_PIN || 'maih2026';
    const reqPin = event.headers['x-admin-pin'] || (event.queryStringParameters && event.queryStringParameters.pin);
    if (!reqPin || reqPin !== adminPin) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Access denied: Admin authentication required', requiresAuth: true }),
      };
    }

    const posters = [];
    const store = getBlobsStore();
    if (store) {
      try {
        const { blobs } = await store.list();
        for (const blob of blobs) {
          posters.push({
            id: blob.key,
            filename: `MAIH_Poster_${blob.key}.png`,
            createdAt: blob.uploadedAt || new Date().toISOString(),
            timestamp: blob.uploadedAt ? new Date(blob.uploadedAt).getTime() : Date.now(),
            url: `/api/poster/${blob.key}`,
            downloadUrl: `/api/poster/${blob.key}?download=1`,
          });
        }
      } catch (e) {
        console.warn('Blobs list error:', e.message);
      }
    } else {
      for (const [id] of posterStore.entries()) {
        posters.push({
          id,
          filename: `MAIH_Poster_${id}.png`,
          createdAt: new Date().toISOString(),
          timestamp: Date.now(),
          url: `/api/poster/${id}`,
          downloadUrl: `/api/poster/${id}?download=1`,
        });
      }
    }
    posters.sort((a, b) => b.timestamp - a.timestamp);
    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ count: posters.length, posters }),
    };
  }

  // GET /api/poster/:id
  if (httpMethod === 'GET') {
    const match = path.match(/\/([0-9a-f-]{36})(\.png)?$/i);
    if (match) {
      const id = match[1];
      let base64Data = posterStore.get(id);

      if (!base64Data) {
        const store = getBlobsStore();
        if (store) {
          try {
            base64Data = await store.get(id);
          } catch (err) {
            console.warn('Netlify Blobs get error:', err.message);
          }
        }
      }

      if (!base64Data) {
        const accept = event.headers['accept'] || '';
        if (accept.includes('text/html')) {
          return {
            statusCode: 404,
            headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8' },
            body: renderNotFoundPage(),
          };
        }
        return {
          statusCode: 404,
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Poster not found or session expired' }),
        };
      }

      const queryParams = event.queryStringParameters || {};
      const isDownload = queryParams.download === '1' || queryParams.download !== undefined;
      const isRaw = queryParams.raw === '1' || path.endsWith('.png');
      const accept = event.headers['accept'] || '';
      const wantsHtml = accept.includes('text/html') && !isDownload && !isRaw;

      if (wantsHtml) {
        return {
          statusCode: 200,
          headers: { ...headers, 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
          body: renderMobilePosterPage(id),
        };
      }

      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Content-Type': 'image/png',
          'Content-Disposition': isDownload ? 'attachment; filename="MAIH-Poster.png"' : 'inline; filename="MAIH-Poster.png"',
          'Cache-Control': 'public, max-age=86400',
        },
        body: base64Data,
        isBase64Encoded: true,
      };
    }
  }

  return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
}
