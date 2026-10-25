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
import {
  uploadToLocalServer,
  uploadToImgBB,
  uploadToImgur,
  uploadToCustomEndpoint,
} from '../utils/cloudUploader.js';

const UPLOAD_ENDPOINT = import.meta.env.VITE_UPLOAD_URL || '';

export default function PosterStep({
  photoDataUrl,
  logoDataUrl,
  templateDataUrl = '/poster-template-cutout.png',
  eventName,
  groupSize = 1,
  dirHandle,
  setDirHandle,
  onReset,
  addToast,
}) {
  const canvasRef = useRef(null);
  const autoSavedForPhotoRef = useRef(null);
  const uploadedForPhotoRef = useRef(null);

  const [loading,      setLoading]      = useState(true);
  const [loadingMsg,   setLoadingMsg]   = useState('GENERATING YOUR POSTER…');
  const [posterUrl,    setPosterUrl]    = useState(null);
  const [shareUrl,     setShareUrl]     = useState(null);
  const [directDownloadUrl, setDirectDownloadUrl] = useState(null);
  const [viewerUrl,    setViewerUrl]    = useState(null);
  const [localDownloadUrl, setLocalDownloadUrl] = useState(null);
  const [isPublic,     setIsPublic]     = useState(false);
  const [provider,     setProvider]     = useState('local');
  const [downloadMode, setDownloadMode] = useState(() => {
    return localStorage.getItem('maih_download_mode') || 'direct'; // 'direct' or 'viewer'
  });
  const [imgbbKey,     setImgbbKey]     = useState(() => {
    return localStorage.getItem('maih_imgbb_key') || import.meta.env.VITE_IMGBB_API_KEY || '';
  });
  const [imgbbInput,   setImgbbInput]   = useState(imgbbKey);
  const [uploading,    setUploading]    = useState(false);
  const [uploadErr,    setUploadErr]    = useState(null);
  const [serverInfo,   setServerInfo]   = useState(null); // { url, id, ip, port, interfaces, tunnelUrl, isPublic }
  const [customIp,     setCustomIp]     = useState('');
  const [showNetworkSettings, setShowNetworkSettings] = useState(false);
  const [ipInput,      setIpInput]      = useState('');

  const customIpRef = useRef(customIp);
  useEffect(() => {
    customIpRef.current = customIp;
  }, [customIp]);

  // Auto-save state
  const [autoSaveInfo, setAutoSaveInfo] = useState(null); // { filename, folderName, method }
  const [autoSaveErr,  setAutoSaveErr]  = useState(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  // ── Auto-upload poster for QR (Direct download & Public Internet) ─
  const uploadPoster = useCallback(async (dataUrl, overrideIp) => {
    if (!dataUrl) return;
    setUploading(true);
    setUploadErr(null);

    const ipToSend = overrideIp !== undefined ? overrideIp : customIpRef.current;
    const activeDownloadMode = localStorage.getItem('maih_download_mode') || downloadMode;

    // 1. Try ImgBB if API key is provided
    const activeImgbbKey = localStorage.getItem('maih_imgbb_key') || imgbbKey;
    if (activeImgbbKey) {
      try {
        const res = await uploadToImgBB(dataUrl, activeImgbbKey);
        setDirectDownloadUrl(res.directDownloadUrl);
        setViewerUrl(res.viewerUrl);
        setShareUrl(activeDownloadMode === 'direct' ? res.directDownloadUrl : res.viewerUrl);
        setIsPublic(true);
        setProvider('imgbb');
        // Also sync copy to admin server so organizer has a complete archive
        uploadToLocalServer(dataUrl, ipToSend).catch(() => {});
        setUploading(false);
        addToast('ImgBB CDN ready — scan to download directly! 🌐🎉', 'success');
        return;
      } catch (err) {
        console.warn('ImgBB upload error, falling back to local server:', err.message);
      }
    }

    // 2. Try Imgur if Client-ID is provided
    if (import.meta.env.VITE_IMGUR_CLIENT_ID) {
      try {
        const res = await uploadToImgur(dataUrl, import.meta.env.VITE_IMGUR_CLIENT_ID);
        setDirectDownloadUrl(res.directDownloadUrl);
        setViewerUrl(res.viewerUrl);
        setShareUrl(activeDownloadMode === 'direct' ? res.directDownloadUrl : res.viewerUrl);
        setIsPublic(true);
        setProvider('imgur');
        uploadToLocalServer(dataUrl, ipToSend).catch(() => {});
        setUploading(false);
        addToast('Imgur upload ready — scan to download directly! 🌐🎉', 'success');
        return;
      } catch (err) {
        console.warn('Imgur upload error, falling back to local server:', err.message);
      }
    }

    // 3. Try custom UPLOAD_ENDPOINT if provided
    if (UPLOAD_ENDPOINT) {
      try {
        const res = await uploadToCustomEndpoint(dataUrl, UPLOAD_ENDPOINT);
        setDirectDownloadUrl(res.directDownloadUrl);
        setViewerUrl(res.viewerUrl);
        setShareUrl(activeDownloadMode === 'direct' ? res.directDownloadUrl : res.viewerUrl);
        setIsPublic(true);
        setProvider('custom');
        uploadToLocalServer(dataUrl, ipToSend).catch(() => {});
        setUploading(false);
        addToast('Cloud upload ready — scan to download directly! 🌐🎉', 'success');
        return;
      } catch (err) {
        console.warn('Custom upload error, falling back to local server:', err.message);
      }
    }

    // 4. Default: Local poster-server with automatic Cloudflare Tunnel
    try {
      const res = await uploadToLocalServer(dataUrl, ipToSend);
      setDirectDownloadUrl(res.directDownloadUrl);
      setViewerUrl(res.viewerUrl);
      setLocalDownloadUrl(res.localUrl);
      setIsPublic(res.isPublic);
      setServerInfo(res.serverInfo);
      setProvider(res.isPublic ? 'tunnel' : 'local');

      const targetUrl = activeDownloadMode === 'direct' ? res.directDownloadUrl : res.viewerUrl;
      setShareUrl(targetUrl);
      setUploading(false);

      if (res.isPublic) {
        addToast('Public QR ready — scan to download (No Wi-Fi needed)! 🌐🚀', 'success');
      } else {
        addToast('QR code ready — scan to download! 🎉', 'success');
      }
      return;
    } catch (err) {
      console.warn('Poster upload error:', err.message);
      const isCloud = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
      setUploadErr(isCloud
        ? `Cloud upload temporarily unavailable: ${err.message || 'Service busy'}. Please click Retry below.`
        : 'Photo booth server not connected. Please make sure "npm run dev" is running in the terminal.'
      );
    }

    setUploading(false);
  }, [addToast, downloadMode, imgbbKey]);

  function handleToggleDownloadMode(newMode) {
    setDownloadMode(newMode);
    localStorage.setItem('maih_download_mode', newMode);
    if (newMode === 'direct' && directDownloadUrl) {
      setShareUrl(directDownloadUrl);
      addToast('QR Code updated: Direct Download on scan ⚡', 'info');
    } else if (newMode === 'viewer' && viewerUrl) {
      setShareUrl(viewerUrl);
      addToast('QR Code updated: Mobile Viewer on scan 📱', 'info');
    }
  }

  function handleSaveImgbbKey(keyToSave) {
    const trimmed = keyToSave.trim();
    setImgbbKey(trimmed);
    if (trimmed) {
      localStorage.setItem('maih_imgbb_key', trimmed);
      addToast('ImgBB API key saved! Uploading poster… 🌐', 'success');
    } else {
      localStorage.removeItem('maih_imgbb_key');
      addToast('ImgBB API key removed. Using Cloudflare Tunnel / Local. 🔄', 'info');
    }
    if (posterUrl) {
      uploadPoster(posterUrl);
    }
  }

  function handleApplyIp(ipToApply) {
    setCustomIp(ipToApply);
    if (posterUrl) {
      uploadPoster(posterUrl, ipToApply);
      addToast(`Updated network IP to ${ipToApply || 'auto-detect'}! 🔄`, 'info');
    }
  }

  function handleSwitchToLocalWifi() {
    if (localDownloadUrl) {
      setShareUrl(localDownloadUrl);
      setIsPublic(false);
      addToast('QR switched to Local Wi-Fi link 📶', 'info');
    }
  }

  function handleSwitchToPublicInternet() {
    if (directDownloadUrl) {
      setShareUrl(downloadMode === 'direct' ? directDownloadUrl : viewerUrl);
      setIsPublic(true);
      addToast('QR switched to Public Internet link (No Wi-Fi needed) 🌐', 'info');
    }
  }

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
          eventName,
          logoDataUrl,
        });

        if (cancelled) return;
        const dataUrl = canvasRef.current.toDataURL('image/png');
        setPosterUrl(dataUrl);

        // Prepare optimized image for mobile QR download (JPEG quality 0.93, ~500KB vs 6.4MB PNG)
        // Keeps full 1446x2048 resolution, uploads in 0.15s, and prevents serverless 413 Payload Too Large limits!
        let uploadPayload = dataUrl;
        try {
          const fastJpg = canvasRef.current.toDataURL('image/jpeg', 0.93);
          if (fastJpg && fastJpg.length > 500) {
            uploadPayload = fastJpg;
          }
        } catch {
          // fallback to dataUrl
        }

        // Upload to QR service & auto-save immediately (only once per unique image)
        if (uploadedForPhotoRef.current !== dataUrl) {
          uploadedForPhotoRef.current = dataUrl;
          uploadPoster(uploadPayload);
        }
        if (autoSavedForPhotoRef.current !== dataUrl) {
          autoSavedForPhotoRef.current = dataUrl;
          triggerAutoSave(dataUrl, dirHandle);
        }
      } catch (err) {
        console.error('Poster generation error:', err);
        addToast('Failed to generate poster. Please try again.', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => { cancelled = true; };
  }, [photoDataUrl, templateDataUrl, groupSize, eventName, logoDataUrl, dirHandle, addToast, uploadPoster, triggerAutoSave]);

  // ── Manual Download & Mobile Share ────────────────────────────────
  const [canShare] = useState(() => typeof navigator !== 'undefined' && Boolean(navigator.share));

  function downloadPoster() {
    if (!posterUrl) return;
    const filename = autoSaveInfo?.filename || formatPosterFilename();
    const a = document.createElement('a');
    a.href     = posterUrl;
    a.download = filename;
    a.click();
    addToast(`Poster downloaded: ${filename}! 🎉`, 'success');
  }

  async function handleShareOrSave() {
    if (!posterUrl) return;
    const filename = autoSaveInfo?.filename || formatPosterFilename();

    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        const res = await fetch(posterUrl);
        const blob = await res.blob();
        const file = new File([blob], filename, { type: 'image/png' });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            title: 'My AI Poster - Microsoft AI Innovators Hub',
            text: `Check out my official poster from ${eventName || 'Microsoft AI Innovators Hub'}! 🚀✨`,
            files: [file],
          });
          addToast('Poster shared! 📲', 'success');
          return;
        } else {
          await navigator.share({
            title: 'My AI Poster - Microsoft AI Innovators Hub',
            text: `Check out my official poster from ${eventName || 'Microsoft AI Innovators Hub'}! 🚀✨`,
            url: shareUrl || directDownloadUrl || window.location.href,
          });
          addToast('Poster link shared! 📲', 'success');
          return;
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.warn('Native share failed, downloading instead:', err);
    }

    // Fallback: standard file download
    downloadPoster();
  }

  return (
    <div className="glass-card step-card">
      <h2 className="section-title">
        {eventName && eventName !== 'EVENT NAME 2026' ? `${eventName} Poster Ready! 🎉` : 'Your Poster is Ready! 🎉'}
      </h2>
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

            {/* Custom Community Logo in Preview (if uploaded and not default) */}
            {logoDataUrl && logoDataUrl !== '/logo-mark.png' && (
              <img
                src={logoDataUrl}
                alt="Community Logo"
                style={{
                  position: 'absolute',
                  top: '2.5%',
                  right: '4.5%',
                  width: '8%',
                  height: 'auto',
                  maxHeight: '6%',
                  objectFit: 'contain',
                  zIndex: 3,
                  filter: 'drop-shadow(0 0 8px rgba(0, 245, 255, 0.6))',
                }}
              />
            )}

            {/* Custom Event Name in Preview (if using custom template or customized event name) */}
            {eventName && (templateDataUrl !== '/poster-template-cutout.png' || (eventName !== 'EVENT NAME 2026' && eventName.trim())) && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '3.6%',
                  left: '4%',
                  right: '4%',
                  textAlign: 'center',
                  zIndex: 3,
                  color: '#ffffff',
                  fontFamily: 'var(--font-display)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textShadow: '0 0 10px var(--cyan)',
                  textTransform: 'uppercase',
                }}
              >
                {eventName}
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
          {canShare && (
            <button
              id="share-poster-btn"
              className="btn btn-primary btn-lg"
              style={{ flex: 2, minWidth: 180 }}
              onClick={handleShareOrSave}
              disabled={!posterUrl}
            >
              📲 Save to Photos / Share
            </button>
          )}
          <button
            id="download-poster-btn"
            className={`btn ${canShare ? 'btn-secondary' : 'btn-primary'} btn-lg`}
            style={{ flex: canShare ? 1.5 : 2, minWidth: 160 }}
            onClick={downloadPoster}
            disabled={!posterUrl}
          >
            ⬇ Download PNG
          </button>
          <button
            id="retake-poster-btn"
            className="btn btn-danger"
            style={{ flex: 1, minWidth: 110 }}
            onClick={onReset}
          >
            ↺ Start Over
          </button>
        </div>

        {/* QR section */}
        <div style={{
          background: 'rgba(0,0,0,0.35)',
          border: '1px solid rgba(0,245,255,0.18)',
          borderRadius: 'var(--radius-md)',
          padding: 24,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          {/* Header & Status Badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', color: 'var(--cyan)', margin: 0 }}>
              📱 Scan QR to Download to Phone
            </h3>

            {isPublic ? (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 12px',
                borderRadius: 999,
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                fontSize: '0.78rem',
                color: '#34d399',
                fontFamily: 'var(--font-accent)',
                fontWeight: 700,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 10px #34d399' }} />
                <span>🌐 4G/5G Ready · No Same Wi-Fi Needed</span>
              </div>
            ) : serverInfo?.ip ? (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 999,
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                fontSize: '0.75rem',
                color: '#fbbf24',
                fontFamily: 'var(--font-accent)',
              }}>
                <span className="pulse-dot" style={{ width: 6, height: 6 }} />
                <span>Local Wi-Fi: {serverInfo.ip}</span>
              </div>
            ) : null}
          </div>

          {/* Mode Switcher Tabs */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 16,
            background: 'rgba(255,255,255,0.04)',
            padding: 4,
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.08)',
            maxWidth: 440,
          }}>
            <button
              type="button"
              onClick={() => handleToggleDownloadMode('direct')}
              style={{
                flex: 1,
                padding: '7px 12px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.78rem',
                fontWeight: 700,
                fontFamily: 'var(--font-accent)',
                letterSpacing: '0.03em',
                transition: 'all 0.2s ease',
                background: downloadMode === 'direct' ? 'linear-gradient(135deg, #00f5ff 0%, #0077ff 100%)' : 'transparent',
                color: downloadMode === 'direct' ? '#030814' : 'var(--text-muted)',
                boxShadow: downloadMode === 'direct' ? '0 0 14px rgba(0,245,255,0.4)' : 'none',
              }}
            >
              ⚡ Direct Download (Instant Save)
            </button>
            <button
              type="button"
              onClick={() => handleToggleDownloadMode('viewer')}
              style={{
                flex: 1,
                padding: '7px 12px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.78rem',
                fontWeight: 700,
                fontFamily: 'var(--font-accent)',
                letterSpacing: '0.03em',
                transition: 'all 0.2s ease',
                background: downloadMode === 'viewer' ? 'linear-gradient(135deg, #00f5ff 0%, #0077ff 100%)' : 'transparent',
                color: downloadMode === 'viewer' ? '#030814' : 'var(--text-muted)',
                boxShadow: downloadMode === 'viewer' ? '0 0 14px rgba(0,245,255,0.4)' : 'none',
              }}
            >
              📱 Mobile Webpage (View &amp; Share)
            </button>
          </div>

          {uploading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--cyan)', fontFamily: 'var(--font-accent)', padding: '24px 0' }}>
              <span className="animate-pulse-glow" style={{ fontSize: '1.5rem' }}>⏳</span>
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>Preparing direct download QR code…</p>
                <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Setting up public download link</p>
              </div>
            </div>
          )}

          {shareUrl && !uploading && (
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <QRCodeDisplay url={shareUrl} size={220} allowEnlarge={true} />

              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{
                  background: isPublic ? 'rgba(16, 185, 129, 0.08)' : 'rgba(0, 245, 255, 0.05)',
                  border: isPublic ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(0, 245, 255, 0.15)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px 14px',
                  marginBottom: 14,
                }}>
                  <p style={{ color: isPublic ? '#34d399' : 'var(--cyan)', fontFamily: 'var(--font-accent)', fontWeight: 700, fontSize: '0.9rem', marginBottom: 4 }}>
                    {downloadMode === 'direct' ? '⚡ 1-Scan Direct Download' : '📱 1-Scan Mobile Viewer'}
                  </p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.5, margin: 0 }}>
                    {isPublic
                      ? 'Point any phone camera (iPhone or Android) on cellular 4G/5G data or any Wi-Fi to directly download the high-resolution poster!'
                      : 'Point your phone camera to download your poster. Make sure your phone is connected to the same Wi-Fi network.'}
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: isPublic ? '#34d399' : 'var(--cyan)' }}>⚡</span>
                    <span>
                      {downloadMode === 'direct'
                        ? 'Directly saves full-res MAIH-Poster.png into device Downloads/Photos'
                        : 'Opens mobile preview page with 1-tap "Save to Photos" button'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: isPublic ? '#34d399' : 'var(--cyan)' }}>🌐</span>
                    <span>
                      {isPublic
                        ? 'No Wi-Fi setup needed — works on cellular data (4G/5G) or any network'
                        : `Same Wi-Fi network required (${serverInfo?.ip || 'local IP'})`}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: isPublic ? '#34d399' : 'var(--cyan)' }}>📱</span>
                    <span>Compatible with iPhone Camera &amp; Android QR Scanner</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => window.open(shareUrl, '_blank')}
                    title="Test the download link in a new browser tab"
                  >
                    🔗 Test Link
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => navigator.clipboard?.writeText(shareUrl).then(() => addToast('URL copied to clipboard! 📋', 'success'))}
                  >
                    📋 Copy Link
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowNetworkSettings(prev => !prev)}
                    style={{ fontSize: '0.76rem' }}
                  >
                    ⚙ {showNetworkSettings ? 'Hide Settings' : 'Cloud & Network Settings'}
                  </button>
                </div>

                {/* Collapsible Network & Cloud Settings */}
                {showNetworkSettings && (
                  <div style={{
                    background: 'rgba(5, 8, 16, 0.92)',
                    border: '1px solid rgba(0, 245, 255, 0.25)',
                    borderRadius: 'var(--radius-sm)',
                    padding: 14,
                    marginTop: 10,
                  }}>
                    <p style={{ margin: '0 0 6px', fontSize: '0.82rem', color: 'var(--cyan)', fontWeight: 700 }}>
                      🌐 Public Cloud &amp; Network Configuration
                    </p>

                    {/* Active Provider & Tunnel Status */}
                    <div style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 6,
                      padding: '8px 10px',
                      marginBottom: 12,
                      fontSize: '0.75rem',
                      lineHeight: 1.5,
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                        <strong style={{ color: isPublic ? '#34d399' : '#fbbf24' }}>
                          {isPublic ? `🟢 Public Internet Active (${provider.toUpperCase()})` : '📶 Local Wi-Fi Mode'}
                        </strong>
                      </div>
                      {serverInfo?.tunnelUrl && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, wordBreak: 'break-all' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Tunnel:</span>
                          <span style={{ color: 'var(--cyan)', fontFamily: 'monospace' }}>{serverInfo.tunnelUrl}</span>
                        </div>
                      )}
                    </div>

                    {/* Source Toggle if both public and local are available */}
                    {serverInfo?.tunnelUrl && localDownloadUrl && (
                      <div style={{ marginBottom: 12 }}>
                        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                          Network Route:
                        </label>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{
                              flex: 1,
                              fontSize: '0.72rem',
                              padding: '5px 8px',
                              background: isPublic ? 'rgba(0,245,255,0.2)' : 'rgba(255,255,255,0.05)',
                              borderColor: isPublic ? 'var(--cyan)' : 'rgba(255,255,255,0.1)',
                              color: isPublic ? '#fff' : 'var(--text-muted)',
                            }}
                            onClick={handleSwitchToPublicInternet}
                          >
                            🌐 Public Tunnel
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{
                              flex: 1,
                              fontSize: '0.72rem',
                              padding: '5px 8px',
                              background: !isPublic ? 'rgba(0,245,255,0.2)' : 'rgba(255,255,255,0.05)',
                              borderColor: !isPublic ? 'var(--cyan)' : 'rgba(255,255,255,0.1)',
                              color: !isPublic ? '#fff' : 'var(--text-muted)',
                            }}
                            onClick={handleSwitchToLocalWifi}
                          >
                            📶 Local Wi-Fi
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ImgBB Free Cloud Option */}
                    <div style={{
                      background: 'rgba(0, 245, 255, 0.04)',
                      border: '1px solid rgba(0, 245, 255, 0.15)',
                      borderRadius: 6,
                      padding: 10,
                      marginBottom: 12,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <strong style={{ fontSize: '0.76rem', color: 'var(--cyan)' }}>
                          ☁ ImgBB Cloud Uploader (Optional)
                        </strong>
                        <a
                          href="https://api.imgbb.com/"
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: '0.7rem', color: 'var(--cyan)', textDecoration: 'underline' }}
                        >
                          Get Free Key ↗
                        </a>
                      </div>
                      <p style={{ margin: '0 0 8px', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                        Host posters on ImgBB CDN with permanent global direct download links.
                      </p>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          type="text"
                          placeholder="ImgBB API Key (e.g. 7a8b9c...)"
                          value={imgbbInput}
                          onChange={e => setImgbbInput(e.target.value)}
                          style={{
                            flex: 1,
                            background: 'rgba(0,0,0,0.6)',
                            border: '1px solid rgba(0,245,255,0.2)',
                            borderRadius: 6,
                            padding: '6px 8px',
                            color: '#fff',
                            fontSize: '0.74rem',
                            fontFamily: 'monospace',
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{ fontSize: '0.72rem', padding: '6px 10px' }}
                          onClick={() => handleSaveImgbbKey(imgbbInput)}
                        >
                          Save
                        </button>
                        {imgbbKey && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.72rem', padding: '6px 8px' }}
                            onClick={() => {
                              setImgbbInput('');
                              handleSaveImgbbKey('');
                            }}
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Local LAN IP Fallback */}
                    <div style={{ marginTop: 8 }}>
                      <p style={{ margin: '0 0 6px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                        LAN Network IP (For offline local Wi-Fi mode):
                      </p>
                      {serverInfo?.interfaces && serverInfo.interfaces.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                          {serverInfo.interfaces.map(iface => (
                            <button
                              key={iface.address}
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{
                                justifyContent: 'space-between',
                                fontSize: '0.72rem',
                                padding: '5px 8px',
                                borderColor: serverInfo.ip === iface.address ? 'var(--cyan)' : 'rgba(255,255,255,0.08)',
                                background: serverInfo.ip === iface.address ? 'rgba(0, 245, 255, 0.1)' : 'rgba(255,255,255,0.02)',
                              }}
                              onClick={() => handleApplyIp(iface.address)}
                            >
                              <span>{iface.name} ({iface.type})</span>
                              <span style={{ fontFamily: 'monospace', color: serverInfo.ip === iface.address ? 'var(--cyan)' : 'var(--text-muted)' }}>
                                {iface.address}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: 6 }}>
                        <input
                          type="text"
                          placeholder="Custom IP or Domain"
                          value={ipInput}
                          onChange={e => setIpInput(e.target.value)}
                          style={{
                            flex: 1,
                            background: 'rgba(0,0,0,0.6)',
                            border: '1px solid rgba(0,245,255,0.2)',
                            borderRadius: 6,
                            padding: '6px 8px',
                            color: '#fff',
                            fontSize: '0.72rem',
                          }}
                        />
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.72rem', padding: '6px 10px' }}
                          onClick={() => {
                            if (ipInput.trim()) handleApplyIp(ipInput.trim());
                          }}
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {uploadErr && !uploading && !shareUrl && (
            <div style={{
              padding: '16px 20px',
              background: 'rgba(255,165,0,0.08)',
              border: '1px solid rgba(255,165,0,0.25)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              color: '#fbbf24',
              lineHeight: 1.6,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <strong>⚠ QR Code Offline</strong>
                {posterUrl && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => uploadPoster(posterUrl)}
                    style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                  >
                    🔄 Retry
                  </button>
                )}
              </div>
              <p style={{ margin: '0 0 8px' }}>{uploadErr}</p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Tip: You can still click <strong>Download PNG</strong> above to save the poster directly on this computer.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
