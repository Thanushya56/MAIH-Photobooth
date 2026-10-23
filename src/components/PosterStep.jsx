/**
 * PosterStep.jsx – Step 3
 *
 * Renders the final poster with:
 * - Dedicated photo layer positioned inside the central hexagonal photo frame
 * - CSS clip-path polygon matching the frame's angular shape
 * - Proportional cover-fit cropping with face positioning (no distortion)
 * - Original poster template frame above the photo (neon border intact)
 * - Automatic poster saving to dedicated "AI Innovators Hub Posters" folder
 * - Filename format: AI_Poster_YYYY-MM-DD_HH-mm-ss.png with duplicate protection
 * - Full-resolution 1446×2048 Canvas export for hi-res PNG download & QR code
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { generatePoster } from '../utils/posterGenerator.js';
import {
  autoSavePoster,
  formatPosterFilename,
  pickPostersDirectory,
  isFileSystemAccessSupported,
} from '../utils/autoSaver.js';
import QRCodeDisplay from './QRCodeDisplay.jsx';

const UPLOAD_ENDPOINT = import.meta.env.VITE_UPLOAD_URL || '';
const LOCAL_API       = '/api/poster';

export default function PosterStep({
  photoDataUrl,
  templateDataUrl = '/poster-template-cutout.png',
  groupSize = 1,
  dirHandle,
  setDirHandle,
  onReset,
  addToast,
}) {
  const canvasRef = useRef(null);

  const [loading,      setLoading]      = useState(true);
  const [loadingMsg,   setLoadingMsg]   = useState('GENERATING YOUR POSTER…');
  const [posterUrl,    setPosterUrl]    = useState(null);
  const [shareUrl,     setShareUrl]     = useState(null);
  const [uploading,    setUploading]    = useState(false);
  const [uploadErr,    setUploadErr]    = useState(null);

  // Auto-save state
  const [autoSaveInfo, setAutoSaveInfo] = useState(null); // { filename, folderName, method }
  const [autoSaveErr,  setAutoSaveErr]  = useState(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  // ── Auto-upload poster for QR ─────────────────────────────────────
  const uploadPoster = useCallback(async (dataUrl) => {
    if (!dataUrl) return;
    setUploading(true);
    setUploadErr(null);

    // 1. Try Vite local poster-server (same-WiFi download & local disk backup)
    try {
      const resp = await fetch(LOCAL_API, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ image: dataUrl }),
      });
      if (resp.ok) {
        const { url } = await resp.json();
        if (url) {
          setShareUrl(url);
          setUploading(false);
          addToast('QR code ready — scan to download! 🎉', 'success');
          return;
        }
      }
    } catch { /* Local server not available */ }

    // 2. Optional VITE_UPLOAD_URL fallback
    if (UPLOAD_ENDPOINT) {
      try {
        const res  = await fetch(dataUrl);
        const blob = await res.blob();
        const form = new FormData();
        form.append('image', blob, 'poster.png');
        const resp = await fetch(UPLOAD_ENDPOINT, { method: 'POST', body: form });
        if (!resp.ok) throw new Error(`Upload failed: ${resp.statusText}`);
        const json = await resp.json();
        const url  = json?.data?.link || json?.url || null;
        if (!url) throw new Error('Upload service did not return a URL.');
        setShareUrl(url);
        addToast('Poster uploaded! QR code ready. 🎉', 'success');
        return;
      } catch (err) {
        setUploadErr(err.message);
        addToast(`Upload failed: ${err.message}`, 'error');
      }
    } else {
      setUploadErr('No upload service available — download the poster directly.');
    }

    setUploading(false);
  }, [addToast]);

  // ── Auto-Save Poster Immediately ──────────────────────────────────
  const triggerAutoSave = useCallback(async (dataUrl, targetDirHandle) => {
    if (!dataUrl) return;
    setIsAutoSaving(true);
    setAutoSaveErr(null);

    try {
      const result = await autoSavePoster(dataUrl, targetDirHandle || dirHandle);
      setAutoSaveInfo(result);
      if (result.method === 'filesystem') {
        addToast(`✓ Auto-saved to "${result.folderName}": ${result.filename} 📁`, 'success');
      } else {
        addToast(`✓ Auto-saved full-res poster: ${result.filename} 💾`, 'success');
      }
    } catch (err) {
      console.error('Auto-save error:', err);
      setAutoSaveErr(err.message);
      addToast(`Auto-save error: ${err.message}`, 'error');
    } finally {
      setIsAutoSaving(false);
    }
  }, [dirHandle, addToast]);

  // ── Pick / Change Folder On Demand ────────────────────────────────
  async function handlePickFolderNow() {
    try {
      const handle = await pickPostersDirectory();
      if (setDirHandle) setDirHandle(handle);
      addToast(`Folder connected: "${handle.name}". Saving poster now… 📁`, 'info');
      if (posterUrl) {
        await triggerAutoSave(posterUrl, handle);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Folder selection error:', err);
        addToast(`Could not select folder: ${err.message}`, 'error');
      }
    }
  }

  // ── Render high-res canvas on mount & trigger Auto-Save ───────────
  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!canvasRef.current) return;

      setLoading(true);
      setLoadingMsg('RENDERING YOUR POSTER…');

      try {
        await generatePoster(canvasRef.current, {
          photoDataUrl,
          templateDataUrl: templateDataUrl || '/poster-template-cutout.png',
          groupSize,
        });

        if (cancelled) return;
        const dataUrl = canvasRef.current.toDataURL('image/png');
        setPosterUrl(dataUrl);

        // Upload to QR service & auto-save immediately
        uploadPoster(dataUrl);
        triggerAutoSave(dataUrl, dirHandle);
      } catch (err) {
        console.error('Poster generation error:', err);
        addToast('Failed to generate poster. Please try again.', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => { cancelled = true; };
  }, [photoDataUrl, templateDataUrl, groupSize, dirHandle, addToast, uploadPoster, triggerAutoSave]);

  // ── Manual Download ───────────────────────────────────────────────
  function downloadPoster() {
    if (!posterUrl) return;
    const filename = autoSaveInfo?.filename || formatPosterFilename();
    const a = document.createElement('a');
    a.href     = posterUrl;
    a.download = filename;
    a.click();
    addToast(`Poster downloaded: ${filename}! 🎉`, 'success');
  }

  return (
    <div className="glass-card step-card">
      <h2 className="section-title">Your Poster is Ready! 🎉</h2>
      <p className="section-subtitle">
        Your poster has been generated and automatically saved to your device.
      </p>

      {loading && (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div className="animate-pulse-glow" style={{ fontSize: '3rem', marginBottom: 16 }}>⚙️</div>
          <p style={{ color: 'var(--cyan)', fontFamily: 'var(--font-accent)', letterSpacing: '0.1em' }}>
            {loadingMsg}
          </p>
        </div>
      )}

      <div style={{ display: loading ? 'none' : 'block' }}>
        {/* ── Webpage Poster Preview (Responsive Layered Architecture) ── */}
        <div className="poster-preview-container" style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div
            id="poster-display-container"
            className="poster-display-container"
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 520,
              aspectRatio: '723 / 1024',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 0 50px rgba(0, 245, 255, 0.25), 0 0 20px rgba(139, 92, 246, 0.2)',
              background: '#050810',
            }}
          >
            {/* Layer 1: Dedicated Photo Layer (Angular Hexagonal Clip-Path) */}
            <div
              id="poster-photo-layer"
              className="poster-photo-layer"
              style={{
                position: 'absolute',
                top: '13.38%',
                left: '19.92%',
                width: '60.03%',
                height: '55.96%',
                clipPath: 'polygon(26.04% 0%, 74.88% 0%, 81.80% 5.58%, 90.09% 5.76%, 99.77% 13.96%, 99.77% 33.16%, 97.93% 34.90%, 97.93% 63.70%, 99.77% 65.45%, 99.77% 80.28%, 83.18% 94.24%, 75.81% 94.76%, 69.12% 100%, 29.72% 100%, 22.58% 94.76%, 17.05% 94.24%, 0% 80.28%, 0% 65.45%, 2.07% 63.70%, 2.07% 34.90%, 0% 33.16%, 0% 13.96%, 10.14% 5.76%, 18.66% 5.58%)',
                zIndex: 1,
                overflow: 'hidden',
              }}
            >
              <img
                id="poster-photo-img"
                src={photoDataUrl}
                alt="User in frame"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center 20%',
                  display: 'block',
                }}
              />
            </div>

            {/* Layer 2: Original Poster Template Frame Layer (Neon border, 7 logos, robot, city, text) */}
            <img
              id="poster-frame-overlay"
              className="poster-frame-overlay"
              src={templateDataUrl || '/poster-template-cutout.png'}
              alt="Microsoft AI Innovators Hub Poster Template"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                pointerEvents: 'none',
                zIndex: 2,
                display: 'block',
              }}
            />

            {/* Optional Group badge */}
            {groupSize > 1 && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '31%',
                  right: '23%',
                  zIndex: 3,
                  background: 'rgba(10, 14, 26, 0.92)',
                  border: '2px solid var(--cyan)',
                  borderRadius: '50%',
                  width: 38,
                  height: 38,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--cyan)',
                  fontFamily: 'var(--font-accent)',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  boxShadow: '0 0 14px var(--cyan)',
                }}
              >
                ×{groupSize}
              </div>
            )}

            {/* Hidden High-Resolution Canvas for PNG Generation & Download */}
            <canvas
              ref={canvasRef}
              id="poster-canvas"
              style={{ display: 'none' }}
            />
          </div>
        </div>

        {/* ── Auto-Save Status Banner ── */}
        <div style={{
          maxWidth: 520,
          margin: '0 auto 24px',
          background: autoSaveInfo?.method === 'filesystem'
            ? 'rgba(0, 245, 255, 0.06)'
            : 'rgba(30, 144, 255, 0.05)',
          border: autoSaveInfo?.method === 'filesystem'
            ? '1px solid rgba(0, 245, 255, 0.3)'
            : '1px solid rgba(30, 144, 255, 0.2)',
          borderRadius: 'var(--radius-sm)',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 200 }}>
            <span style={{ fontSize: '1.3rem' }}>
              {isAutoSaving ? '⏳' : autoSaveInfo?.method === 'filesystem' ? '📁' : '💾'}
            </span>
            <div>
              <p style={{ margin: 0, color: 'var(--cyan)', fontSize: '0.88rem', fontWeight: 600 }}>
                {isAutoSaving
                  ? 'Saving poster automatically…'
                  : autoSaveInfo?.method === 'filesystem'
                  ? `Auto-Saved to "${autoSaveInfo.folderName}"`
                  : 'Auto-Saved to Downloads'}
              </p>
              {autoSaveInfo?.filename && (
                <p style={{ margin: '2px 0 0', color: 'var(--text-muted)', fontSize: '0.78rem', fontFamily: 'monospace' }}>
                  {autoSaveInfo.filename}
                </p>
              )}
              {autoSaveErr && (
                <p style={{ margin: '2px 0 0', color: '#ef4444', fontSize: '0.78rem' }}>
                  ⚠ {autoSaveErr}
                </p>
              )}
            </div>
          </div>

          {isFileSystemAccessSupported() && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.78rem', padding: '6px 12px' }}
              onClick={handlePickFolderNow}
            >
              {dirHandle ? '📁 Change Folder' : '📁 Set Auto-Save Folder'}
            </button>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', maxWidth: 520, margin: '0 auto 32px' }}>
          <button
            id="download-poster-btn"
            className="btn btn-primary btn-lg"
            style={{ flex: 2, minWidth: 180 }}
            onClick={downloadPoster}
            disabled={!posterUrl}
          >
            ⬇ Download PNG (Manual Copy)
          </button>
          <button
            id="retake-poster-btn"
            className="btn btn-danger"
            style={{ flex: 1, minWidth: 120 }}
            onClick={onReset}
          >
            ↺ Start Over
          </button>
        </div>

        {/* QR section */}
        <div style={{
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(0,245,255,0.1)',
          borderRadius: 'var(--radius-md)',
          padding: 28,
        }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--cyan)', marginBottom: 16 }}>
            📱 Scan QR to Download on Your Phone
          </h3>

          {uploading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--cyan)', fontFamily: 'var(--font-accent)', marginBottom: 16 }}>
              <span className="animate-pulse-glow">⏳</span>
              <span>Preparing QR code…</span>
            </div>
          )}

          {shareUrl && !uploading && (
            <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <QRCodeDisplay url={shareUrl} size={180} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <p style={{ color: 'var(--cyan)', fontFamily: 'var(--font-accent)', marginBottom: 8 }}>
                  ✓ QR code ready!
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 6, lineHeight: 1.6 }}>
                  Make sure your phone is on the{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>same WiFi</strong>{' '}
                  as this computer, then scan to download the full-resolution poster.
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', wordBreak: 'break-all', marginBottom: 12 }}>
                  {shareUrl}
                </p>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => navigator.clipboard?.writeText(shareUrl).then(() => addToast('URL copied!', 'success'))}
                >
                  📋 Copy URL
                </button>
              </div>
            </div>
          )}

          {uploadErr && !uploading && !shareUrl && (
            <div style={{
              padding: '14px 18px',
              background: 'rgba(255,165,0,0.07)',
              border: '1px solid rgba(255,165,0,0.2)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              color: '#fbbf24',
              lineHeight: 1.6,
            }}>
              <strong>⚠ QR sharing unavailable.</strong><br />
              {uploadErr}<br />
              Use the <strong>Download PNG</strong> button above to save the poster locally.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
