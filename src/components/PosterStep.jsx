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
  const [uploading,    setUploading]    = useState(false);
  const [uploadErr,    setUploadErr]    = useState(null);
  const [serverInfo,   setServerInfo]   = useState(null); // { url, id, ip, port, interfaces }
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

  // ── Auto-upload poster for QR ─────────────────────────────────────
  const uploadPoster = useCallback(async (dataUrl, overrideIp) => {
    if (!dataUrl) return;
    setUploading(true);
    setUploadErr(null);

    const ipToSend = overrideIp !== undefined ? overrideIp : customIpRef.current;

    // 1. Try Vite local poster-server (same-WiFi download & local disk backup)
    try {
      const resp = await fetch(LOCAL_API, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ image: dataUrl, customIp: ipToSend || undefined }),
      });
      const contentType = resp.headers.get('content-type') || '';
      if (resp.ok && contentType.includes('application/json')) {
        const data = await resp.json();
        if (data.url) {
          setShareUrl(data.url);
          setServerInfo(data);
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
        const headers = {};
        if (import.meta.env.VITE_IMGUR_CLIENT_ID) {
          headers['Authorization'] = `Client-ID ${import.meta.env.VITE_IMGUR_CLIENT_ID}`;
        }
        const resp = await fetch(UPLOAD_ENDPOINT, { method: 'POST', body: form, headers });
        if (!resp.ok) throw new Error(`Upload failed: ${resp.statusText}`);
        const json = await resp.json();
        const url  = json?.data?.link || json?.url || null;
        if (!url) throw new Error('Upload service did not return a URL.');
        setShareUrl(url);
        setUploading(false);
        addToast('Poster uploaded! QR code ready. 🎉', 'success');
        return;
      } catch (err) {
        setUploadErr(err.message);
        addToast(`Upload failed: ${err.message}`, 'error');
      }
    } else {
      setUploadErr('Photo booth server not connected. Please make sure "npm run dev" is running in the terminal.');
    }

    setUploading(false);
  }, [addToast]);

  function handleApplyIp(ipToApply) {
    setCustomIp(ipToApply);
    if (posterUrl) {
      uploadPoster(posterUrl, ipToApply);
      addToast(`Updated network IP to ${ipToApply || 'auto-detect'}! 🔄`, 'info');
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

        // Upload to QR service & auto-save immediately (only once per unique image)
        if (uploadedForPhotoRef.current !== dataUrl) {
          uploadedForPhotoRef.current = dataUrl;
          uploadPoster(dataUrl);
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
          background: 'rgba(0,0,0,0.35)',
          border: '1px solid rgba(0,245,255,0.18)',
          borderRadius: 'var(--radius-md)',
          padding: 24,
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.05rem', color: 'var(--cyan)', margin: 0 }}>
              📱 Scan QR to Download on Your Phone
            </h3>
            {serverInfo?.ip && (
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 999,
                background: 'rgba(0, 245, 255, 0.08)',
                border: '1px solid rgba(0, 245, 255, 0.25)',
                fontSize: '0.75rem',
                color: 'var(--cyan)',
                fontFamily: 'var(--font-accent)',
              }}>
                <span className="pulse-dot" style={{ width: 6, height: 6 }} />
                <span>Wi-Fi: {serverInfo.ip}</span>
              </div>
            )}
          </div>

          {uploading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--cyan)', fontFamily: 'var(--font-accent)', padding: '24px 0' }}>
              <span className="animate-pulse-glow" style={{ fontSize: '1.5rem' }}>⏳</span>
              <div>
                <p style={{ margin: 0, fontWeight: 600 }}>Preparing QR code &amp; mobile download page…</p>
                <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Setting up instant mobile save &amp; share</p>
              </div>
            </div>
          )}

          {shareUrl && !uploading && (
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <QRCodeDisplay url={shareUrl} size={220} allowEnlarge={true} />

              <div style={{ flex: 1, minWidth: 240 }}>
                <div style={{
                  background: 'rgba(0, 245, 255, 0.05)',
                  border: '1px solid rgba(0, 245, 255, 0.15)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px 14px',
                  marginBottom: 14,
                }}>
                  <p style={{ color: 'var(--cyan)', fontFamily: 'var(--font-accent)', fontWeight: 700, fontSize: '0.9rem', marginBottom: 4 }}>
                    ✓ Ready to Scan &amp; Save
                  </p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', lineHeight: 1.5, margin: 0 }}>
                    Point your phone camera (iPhone or Android) to open the mobile poster viewer with <strong>1-tap Save to Photos</strong> &amp; AirDrop/Sharing!
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: 'var(--cyan)' }}>⚡</span>
                    <span>Instant full-res poster display on phone</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: 'var(--cyan)' }}>📸</span>
                    <span>Save directly to Apple Photos or Android Gallery</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: 'var(--cyan)' }}>📶</span>
                    <span>Same Wi-Fi network: phone must connect to this venue Wi-Fi</span>
                  </div>
                </div>

                {/* Helpful Troubleshooting Card */}
                <div style={{
                  background: 'rgba(255, 180, 0, 0.08)',
                  border: '1px solid rgba(255, 180, 0, 0.25)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '10px 14px',
                  marginBottom: 14,
                  fontSize: '0.78rem',
                  color: '#fef08a',
                  lineHeight: 1.5,
                }}>
                  <strong style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: '#facc15' }}>
                    <span>💡</span> Phone says "Site can't be reached"?
                  </strong>
                  <div style={{ color: '#fde047' }}>
                    1. <strong>Phone Wi-Fi:</strong> Check that your phone's Wi-Fi is ON and connected to the same network (not mobile 4G/5G data).<br />
                    2. <strong>Windows Setting:</strong> In Windows <em>Settings &gt; Network &amp; Internet &gt; Wi-Fi &gt; Manage Known Networks</em>, ensure network profile is set to <strong>Private</strong> (Windows blocks incoming phone connections when set to Public).
                  </div>
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => window.open(shareUrl, '_blank')}
                    title="Test the mobile download page in a new browser tab"
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
                    ⚙ {showNetworkSettings ? 'Hide Network' : 'Network Settings'}
                  </button>
                </div>

                {/* Collapsible Network Settings */}
                {showNetworkSettings && (
                  <div style={{
                    background: 'rgba(5, 8, 16, 0.85)',
                    border: '1px solid rgba(0, 245, 255, 0.25)',
                    borderRadius: 'var(--radius-sm)',
                    padding: 14,
                    marginTop: 10,
                  }}>
                    <p style={{ margin: '0 0 8px', fontSize: '0.8rem', color: 'var(--cyan)', fontWeight: 600 }}>
                      Network Configuration
                    </p>
                    <p style={{ margin: '0 0 10px', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                      If your phone is on a different network or using a hotspot / tunnel, choose or enter your IP below:
                    </p>

                    {serverInfo?.interfaces && serverInfo.interfaces.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                        {serverInfo.interfaces.map(iface => (
                          <button
                            key={iface.address}
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{
                              justifyContent: 'space-between',
                              fontSize: '0.75rem',
                              padding: '6px 10px',
                              borderColor: serverInfo.ip === iface.address ? 'var(--cyan)' : 'rgba(255,255,255,0.1)',
                              background: serverInfo.ip === iface.address ? 'rgba(0, 245, 255, 0.12)' : 'rgba(255,255,255,0.03)',
                            }}
                            onClick={() => handleApplyIp(iface.address)}
                          >
                            <span><strong>{iface.name}</strong> ({iface.type})</span>
                            <span style={{ fontFamily: 'monospace', color: serverInfo.ip === iface.address ? 'var(--cyan)' : 'var(--text-muted)' }}>
                              {iface.address} {iface.recommended ? '★' : ''}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="text"
                        placeholder="Custom IP or Domain (e.g. 192.168.1.100)"
                        value={ipInput}
                        onChange={e => setIpInput(e.target.value)}
                        style={{
                          flex: 1,
                          background: 'rgba(0,0,0,0.5)',
                          border: '1px solid rgba(0,245,255,0.2)',
                          borderRadius: 6,
                          padding: '6px 10px',
                          color: '#fff',
                          fontSize: '0.75rem',
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                        onClick={() => {
                          if (ipInput.trim()) handleApplyIp(ipInput.trim());
                        }}
                      >
                        Apply
                      </button>
                      {customIp && (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                          onClick={() => {
                            setIpInput('');
                            handleApplyIp('');
                          }}
                        >
                          Reset
                        </button>
                      )}
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
                <strong>⚠ QR Code Sharing Offline</strong>
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
                Tip: Use the <strong>Download PNG</strong> button above to save the poster directly to this computer.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
