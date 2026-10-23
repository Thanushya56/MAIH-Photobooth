import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { networkInterfaces } from 'os'
import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'

// ── In-memory poster store (cleared on server restart) ──────────────────────
const posterStore = new Map()

/** Returns the first non-internal IPv4 address on this machine */
function getNetworkIP() {
  const nets = networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) return net.address
    }
  }
  return 'localhost'
}

// ── Vite plugin: /api/poster  ────────────────────────────────────────────────
function posterServerPlugin() {
  return {
    name: 'poster-server',
    configureServer(server) {
      server.middlewares.use('/api/poster', (req, res, next) => {
        // POST /api/poster  → store image, return { url, id }
        if (req.method === 'POST') {
          let body = Buffer.alloc(0)
          req.on('data', chunk => { body = Buffer.concat([body, chunk]) })
          req.on('end', () => {
            try {
              const { image } = JSON.parse(body.toString())
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

              const port = server.config.server.port || 5173
              const ip   = getNetworkIP()
              const url  = `http://${ip}:${port}/api/poster/${id}`

              res.setHeader('Content-Type', 'application/json')
              res.setHeader('Access-Control-Allow-Origin', '*')
              res.end(JSON.stringify({ url, id }))
            } catch (e) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: e.message }))
            }
          })
          return
        }

        // GET /api/poster/:id  → serve the stored PNG as a download
        if (req.method === 'GET') {
          // req.url is the path *after* the mount point, e.g. "/abc-uuid"
          const match = req.url.match(/^\/([0-9a-f-]{36})(\.png)?$/i)
          if (match) {
            const id   = match[1]
            const data = posterStore.get(id)
            if (data) {
              res.setHeader('Content-Type', 'image/png')
              res.setHeader('Content-Disposition', 'attachment; filename="MAIH-Poster.png"')
              res.setHeader('Cache-Control', 'no-store')
              res.setHeader('Access-Control-Allow-Origin', '*')
              return res.end(data)
            }
          }
        }

        next()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), posterServerPlugin()],
  server: {
    host: true,   // expose on all interfaces so phones on the same WiFi can connect
    port: 5173,
  },
})
