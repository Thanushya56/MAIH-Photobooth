# MICROSOFT AI INNOVATORS HUB – Photo Booth 📸

> **All About AI & Data** | Futuristic event photo booth built with React + Vite

![Tech Stack](https://img.shields.io/badge/React-19-blue?logo=react) ![Vite](https://img.shields.io/badge/Vite-8-purple?logo=vite) ![JavaScript](https://img.shields.io/badge/JavaScript-ES2024-yellow?logo=javascript)

---

## ✨ Features

| Feature | Details |
|---|---|
| 📸 Live webcam capture | Requests camera permission, shows mirrored preview with countdown |
| 🖼️ Photo upload fallback | Drag-and-drop or file-picker upload |
| 🎨 Canvas poster generation | Fully branded poster with circular photo frame, robot illustration, circuit decorations |
| ⬇ PNG download | High-quality 900×1200 poster download |
| 📱 QR code | Points to hosted image URL (requires optional upload config) |
| 👥 Group sizes 1–4 | Badge displayed on poster |
| 🖋 Editable event name | Change at runtime via the Setup step |
| 🏷 Logo upload | Community logo embedded in poster header |
| 📱 Responsive | Works on desktop, tablet, and mobile |

### Photo safety guarantees
- Camera frames captured with a plain `canvas.drawImage()` call — **no AI processing**.
- Photos never leave the browser unless you explicitly click "Upload & Generate QR".
- No face detection, retouching, enhancement, or image-generation API is called.

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment (optional for QR sharing)
```bash
cp .env.example .env
# edit .env and set VITE_UPLOAD_URL if you want QR sharing
```

### 3. Start the dev server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🏗️ Project Structure

```
maih-photobooth/
├── src/
│   ├── components/
│   │   ├── SetupStep.jsx        # Step 1 – logo & event name
│   │   ├── CameraStep.jsx       # Step 2 – webcam capture / upload
│   │   ├── PosterStep.jsx       # Step 3 – poster preview & download
│   │   ├── QRCodeDisplay.jsx    # QR code renderer
│   │   ├── StepsBar.jsx         # Progress indicator
│   │   └── ToastContainer.jsx   # Toast notifications
│   ├── hooks/
│   │   ├── useCamera.js         # Webcam stream lifecycle
│   │   └── useToast.js          # Toast state management
│   ├── utils/
│   │   └── posterGenerator.js   # Canvas poster drawing engine
│   ├── App.jsx                  # Root orchestrator
│   ├── App.css                  # Layout styles
│   ├── index.css                # Design system & global styles
│   └── main.jsx                 # Entry point
├── .env.example                 # Environment variable template
├── index.html                   # HTML shell with Google Fonts
├── vite.config.js               # Vite configuration
└── README.md
```

---

## 📱 QR Code Sharing

The QR sharing feature requires a public image hosting endpoint. Without it, attendees can still **download** the poster as a PNG.

### Option 1 – Imgur (easiest, free)

1. Register an app at [https://api.imgur.com/oauth2/addclient](https://api.imgur.com/oauth2/addclient) (select "Anonymous usage without user authorisation").
2. Copy your **Client ID**.
3. Add to `.env`:
   ```env
   VITE_UPLOAD_URL=https://api.imgur.com/3/image
   VITE_IMGUR_CLIENT_ID=<your_client_id>
   ```
4. Update `PosterStep.jsx` to add the `Authorization` header:
   ```js
   headers: { Authorization: `Client-ID ${import.meta.env.VITE_IMGUR_CLIENT_ID}` }
   ```

### Option 2 – Cloudflare Pages (recommended for events)

1. Create a Cloudflare Pages project.
2. Add a Pages Function at `functions/api/upload.js` that accepts a `multipart/form-data` POST,
   uploads to R2 / KV, and returns `{ url: "..." }`.
3. Set `VITE_UPLOAD_URL=/api/upload` in your Pages environment variables.

### Option 3 – Any backend

POST `multipart/form-data` with field `image`. Return `{ "url": "https://..." }`.

---

## 🌐 Deploying to Netlify

### Via Netlify CLI
```bash
npm install -g netlify-cli
npm run build
netlify deploy --prod --dir=dist
```

### Via Netlify UI
1. Push this folder to a GitHub repository.
2. Go to [netlify.com](https://netlify.com) → **Add new site → Import an existing project**.
3. Connect your GitHub repo.
4. Set **Build command**: `npm run build` and **Publish directory**: `dist`.
5. Add environment variables under **Site configuration → Environment variables**:
   - `VITE_UPLOAD_URL` (if using QR sharing)
6. Deploy!

### Via GitHub Actions (CI/CD)
```yaml
# .github/workflows/deploy.yml
name: Deploy to Netlify
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run build
      - uses: netlify/actions/cli@master
        with:
          args: deploy --prod --dir=dist
        env:
          NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SITE_ID }}
```

---

## 🔧 Production Build

```bash
npm run build
npm run preview   # preview the production bundle locally
```

---

## 🛡️ Privacy & Compliance

- **No data collection.** Photos are processed entirely client-side.
- **No AI face processing.** Webcam frames are captured with `canvas.drawImage()` only.
- **No cloud sync** unless the user explicitly clicks "Upload & Generate QR".
- Photo pixels are never sent to any generative AI or image-enhancement service.

---

## 📄 Licence

MIT © Microsoft AI Innovators Hub Community
