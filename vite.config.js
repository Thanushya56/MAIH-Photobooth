import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { networkInterfaces } from 'os'
import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'

// ── In-memory poster store (cleared on server restart) ──────────────────────
const posterStore = new Map()

/**
 * Returns prioritized list of network interfaces on this machine,
 * ignoring virtual adapters (VirtualBox, Docker, WSL, vEthernet, etc.)
 */
function getNetworkInterfacesList() {
  const nets = networkInterfaces()
  const list = []
  const virtualRegex = /virtual|vbox|vmware|vethernet|loopback|tailscale|zerotier|docker|wsl|pseudo|tap|tun|hyper-v|bluetooth|npcap/i

  for (const [name, addrs] of Object.entries(nets)) {
    if (!addrs) continue
    for (const net of addrs) {
      if (net.family === 'IPv4' && !net.internal) {
        const isVirtualSubnet = net.address.startsWith('192.168.56.') || net.address.startsWith('169.254.')
        const isVirtualName = virtualRegex.test(name)
        const isVirtualMac = (net.mac || '').toLowerCase().startsWith('0a:00:27')

        let priority = 10
        let type = 'ethernet'
        if (isVirtualName || isVirtualSubnet || isVirtualMac) {
          priority = 0
          type = 'virtual'
        } else if (/wi-?fi|wlan|wireless/i.test(name)) {
          priority = 100
          type = 'wifi'
        } else if (/eth|ethernet|lan|en\d+/i.test(name)) {
          priority = 50
          type = 'ethernet'
        }

        list.push({
          name,
          address: net.address,
          type,
          priority,
          recommended: priority >= 50,
        })
      }
    }
  }

  // Sort descending by priority (Wi-Fi first, then physical Ethernet, then other)
  list.sort((a, b) => b.priority - a.priority)
  return list
}

/** Returns the most reliable IPv4 address on this machine for phone QR scanning */
function getNetworkIP() {
  if (process.env.VITE_HOST_IP || process.env.HOST_IP) {
    return process.env.VITE_HOST_IP || process.env.HOST_IP
  }
  const list = getNetworkInterfacesList()
  if (list.length > 0 && list[0].priority > 0) {
    return list[0].address
  }
  return list[0]?.address || 'localhost'
}

/** Renders the mobile-optimized poster landing page for scanned phones */
function renderMobilePosterPage(id) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Your AI Poster – Microsoft AI Innovators Hub</title>
  <meta name="theme-color" content="#050813">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <style>
    :root {
      --bg: #050813;
      --card-bg: rgba(10, 16, 32, 0.92);
      --cyan: #00f5ff;
      --cyan-glow: rgba(0, 245, 255, 0.4);
      --purple: #8b5cf6;
      --text: #f0f6fc;
      --text-muted: #8899aa;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px 14px 28px;
      position: relative;
      overflow-x: hidden;
      -webkit-font-smoothing: antialiased;
    }
    body::before {
      content: '';
      position: fixed;
      top: -15%;
      left: 50%;
      transform: translateX(-50%);
      width: 420px;
      height: 420px;
      background: radial-gradient(circle, rgba(0, 245, 255, 0.14) 0%, rgba(139, 92, 246, 0.08) 50%, transparent 70%);
      pointer-events: none;
      z-index: 0;
    }
    .wrapper {
      position: relative;
      z-index: 1;
      width: 100%;
      max-width: 440px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
    }
    .header {
      text-align: center;
      padding-top: 4px;
    }
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
    .badge-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--cyan);
      box-shadow: 0 0 8px var(--cyan);
      animation: pulse 2s infinite;
    }
    @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.85); } }
    .title {
      font-size: 1.25rem;
      font-weight: 800;
      letter-spacing: 0.02em;
      background: linear-gradient(135deg, #ffffff 40%, var(--cyan) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 2px;
    }
    .subtitle {
      font-size: 0.78rem;
      color: var(--text-muted);
      letter-spacing: 0.03em;
    }
    .poster-card {
      width: 100%;
      background: var(--card-bg);
      border: 1px solid rgba(0, 245, 255, 0.25);
      border-radius: 16px;
      padding: 10px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6), 0 0 25px rgba(0, 245, 255, 0.12);
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .poster-wrapper {
      width: 100%;
      position: relative;
      border-radius: 12px;
      overflow: hidden;
      background: #000;
      display: flex;
      justify-content: center;
    }
    .poster-img {
      width: 100%;
      height: auto;
      max-height: 54vh;
      object-fit: contain;
      border-radius: 12px;
      display: block;
      -webkit-touch-callout: default !important;
      user-select: auto !important;
      -webkit-user-select: auto !important;
    }
    .actions {
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 12px;
    }
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
      transition: all 0.2s ease;
      touch-action: manipulation;
    }
    .btn-primary {
      background: linear-gradient(135deg, #00f5ff 0%, #0077ff 100%);
      color: #030814;
      box-shadow: 0 0 20px rgba(0, 245, 255, 0.4);
    }
    .btn-primary:active {
      transform: scale(0.98);
      filter: brightness(1.1);
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.06);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.18);
    }
    .btn-secondary:active {
      background: rgba(255, 255, 255, 0.12);
    }
    .tip-card {
      width: 100%;
      background: rgba(0, 245, 255, 0.05);
      border: 1px dashed rgba(0, 245, 255, 0.3);
      border-radius: 12px;
      padding: 12px 14px;
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 0.8rem;
      color: #cbd5e1;
      line-height: 1.45;
    }
    .tip-card strong { color: var(--cyan); }
    .footer {
      text-align: center;
      font-size: 0.72rem;
      color: var(--text-muted);
      padding: 8px 0 12px;
    }
    .toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: rgba(10, 24, 40, 0.96);
      border: 1px solid var(--cyan);
      color: var(--cyan);
      padding: 10px 22px;
      border-radius: 999px;
      font-size: 0.85rem;
      font-weight: 600;
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 0 4px 25px rgba(0, 245, 255, 0.35);
      z-index: 100;
      pointer-events: none;
      white-space: nowrap;
    }
    .toast.show {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="badge"><span class="badge-dot"></span> Microsoft AI Innovators Hub</div>
      <h1 class="title">Your Event Poster</h1>
      <p class="subtitle">High-Resolution Photo Booth Capture</p>
    </div>

    <div class="poster-card">
      <div class="poster-wrapper">
        <img id="posterImg" class="poster-img" src="/api/poster/${id}?raw=1" alt="AI Innovators Hub Poster" />
      </div>

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
      <span style="font-size: 1.2rem; line-height: 1;">💡</span>
      <div>
        <strong>iPhone &amp; Android Tip:</strong><br />
        You can also <strong>press &amp; hold</strong> the poster image above, then select <em>"Save to Photos"</em> or <em>"Download image"</em> directly to your camera roll!
      </div>
    </div>

    <div class="footer">
      © MICROSOFT AI INNOVATORS HUB · All About AI &amp; Data
    </div>
  </div>

  <div id="toast" class="toast">Poster ready!</div>

  <script>
    const id = "${id}";
    const posterUrl = "/api/poster/" + id + "?raw=1";
    const downloadUrl = "/api/poster/" + id + "?download=1";

    function showToast(msg) {
      const t = document.getElementById('toast');
      t.textContent = msg;
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 3200);
    }

    async function handleShareOrSave() {
      const shareBtn = document.getElementById('shareBtn');
      const originalText = shareBtn.innerHTML;
      shareBtn.innerHTML = '<span>⏳</span> Preparing…';
      shareBtn.style.opacity = '0.7';

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
          showToast('Shared successfully! 🎉');
          shareBtn.innerHTML = originalText;
          shareBtn.style.opacity = '1';
          return;
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          // User dismissed share dialog
          shareBtn.innerHTML = originalText;
          shareBtn.style.opacity = '1';
          return;
        }
        console.warn('Native share fallback:', err);
      }

      // Fallback: direct download
      triggerDirectDownload();
      shareBtn.innerHTML = originalText;
      shareBtn.style.opacity = '1';
    }

    function triggerDirectDownload() {
      showToast('Downloading poster… 💾');
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = 'MAIH-Poster.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  </script>
</body>
</html>`
}

function renderNotFoundPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Poster Not Found – Microsoft AI Innovators Hub</title>
  <style>
    body {
      background: #050813;
      color: #f0f6fc;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      text-align: center;
    }
    .card {
      background: rgba(10, 16, 32, 0.9);
      border: 1px solid rgba(255, 75, 75, 0.3);
      border-radius: 16px;
      padding: 32px 24px;
      max-width: 400px;
    }
    h1 { font-size: 1.3rem; color: #ff5555; margin-bottom: 12px; }
    p { font-size: 0.85rem; color: #8899aa; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div style="font-size: 2.5rem; margin-bottom: 12px;">⌛</div>
    <h1>Poster Not Found or Session Expired</h1>
    <p>This poster may have expired because the photo booth server was restarted. Please take a new photo at the booth!</p>
  </div>
</body>
</html>`
}

/**
 * Common middleware handler for both dev and preview servers
 */
function createPosterMiddleware(server) {
  return (req, res, next) => {
    const urlObj = new URL(req.url, 'http://localhost')
    const pathname = urlObj.pathname

    // ── GET /api/poster/network  → returns detected LAN IPs for UI config ────
    if (req.method === 'GET' && (pathname === '/network' || pathname === '/network/')) {
      const interfaces = getNetworkInterfacesList()
      const selectedIp = getNetworkIP()
      const port = server.httpServer?.address()?.port || server.config?.server?.port || 5173
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Access-Control-Allow-Origin', '*')
      return res.end(JSON.stringify({ selectedIp, port, interfaces }))
    }

    // ── POST /api/poster  → store image, auto-save disk backup, return { url, id, ip, port, interfaces }
    if (req.method === 'POST' && (pathname === '' || pathname === '/')) {
      let body = Buffer.alloc(0)
      req.on('data', chunk => { body = Buffer.concat([body, chunk]) })
      req.on('end', () => {
        try {
          const { image, customIp } = JSON.parse(body.toString())
          if (!image || !image.startsWith('data:image/')) {
            res.statusCode = 400
            return res.end(JSON.stringify({ error: 'Invalid image data' }))
          }
          const id = randomUUID()
          const base64Data = image.split(',')[1]
          const imgBuffer = Buffer.from(base64Data, 'base64')
          posterStore.set(id, imgBuffer)

          // Auto-save backup directly to dedicated 'AI Innovators Hub Posters' folder
          try {
            const postersDir = path.resolve('AI Innovators Hub Posters')
            if (!fs.existsSync(postersDir)) fs.mkdirSync(postersDir, { recursive: true })
            const pad = n => String(n).padStart(2, '0')
            const d = new Date()
            const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`
            let saveFilename = `AI_Poster_${dateStr}.png`
            let counter = 1
            while (fs.existsSync(path.join(postersDir, saveFilename))) {
              saveFilename = `AI_Poster_${dateStr}_${counter}.png`
              counter++
            }
            fs.writeFileSync(path.join(postersDir, saveFilename), imgBuffer)
          } catch (fsErr) {
            console.warn('Local disk backup save error:', fsErr.message)
          }

          const port = server.httpServer?.address()?.port || server.config?.server?.port || 5173
          const interfaces = getNetworkInterfacesList()
          const ip = customIp || getNetworkIP()
          const url = `http://${ip}:${port}/api/poster/${id}`

          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.end(JSON.stringify({ url, id, ip, port, interfaces }))
        } catch (e) {
          res.statusCode = 500
          res.end(JSON.stringify({ error: e.message }))
        }
      })
      return
    }

    // ── GET /api/poster/:id  → serve either interactive mobile page OR raw PNG download
    if (req.method === 'GET') {
      const match = pathname.match(/^\/([0-9a-f-]{36})(\.png)?$/i)
      if (match) {
        const id = match[1]
        const data = posterStore.get(id)

        if (!data) {
          const acceptHeader = req.headers['accept'] || ''
          if (acceptHeader.includes('text/html')) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.statusCode = 404
            return res.end(renderNotFoundPage())
          }
          res.statusCode = 404
          res.setHeader('Content-Type', 'application/json')
          return res.end(JSON.stringify({ error: 'Poster not found or session expired' }))
        }

        const isDownload = urlObj.searchParams.get('download') === '1' || urlObj.searchParams.has('download')
        const isRaw = urlObj.searchParams.get('raw') === '1' || urlObj.searchParams.has('raw') || pathname.endsWith('.png')
        const acceptHeader = req.headers['accept'] || ''
        const wantsHtml = acceptHeader.includes('text/html') && !isDownload && !isRaw

        if (wantsHtml) {
          res.setHeader('Content-Type', 'text/html; charset=utf-8')
          res.setHeader('Cache-Control', 'no-store')
          res.setHeader('Access-Control-Allow-Origin', '*')
          return res.end(renderMobilePosterPage(id))
        }

        // Binary PNG response
        res.setHeader('Content-Type', 'image/png')
        if (isDownload) {
          res.setHeader('Content-Disposition', 'attachment; filename="MAIH-Poster.png"')
        } else {
          res.setHeader('Content-Disposition', 'inline; filename="MAIH-Poster.png"')
        }
        res.setHeader('Cache-Control', 'no-store')
        res.setHeader('Access-Control-Allow-Origin', '*')
        return res.end(data)
      }
    }

    next()
  }
}

// ── Vite plugin: /api/poster  ────────────────────────────────────────────────
function posterServerPlugin() {
  return {
    name: 'poster-server',
    configureServer(server) {
      server.middlewares.use('/api/poster', createPosterMiddleware(server))
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api/poster', createPosterMiddleware(server))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), posterServerPlugin()],
  server: {
    host: true, // expose on all interfaces (0.0.0.0) so phones on the same WiFi can connect
    port: 5173,
  },
  preview: {
    host: true,
    port: 5173,
  },
})
