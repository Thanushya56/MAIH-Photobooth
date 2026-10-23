/**
 * SetupStep – Step 1
 * Lets the user upload a community logo, enter the event name,
 * and optionally drop a Canva template as the poster background.
 */
import React, { useRef, useState } from 'react';
import { pickPostersDirectory, isFileSystemAccessSupported, clearStoredDirectoryHandle } from '../utils/autoSaver.js';

export default function SetupStep({
  logoDataUrl, setLogoDataUrl,
  eventName, setEventName,
  templateDataUrl, setTemplateDataUrl,
  dirHandle, setDirHandle,
  addToast,
  onNext,
}) {
  const fileRef     = useRef(null);
  const tmplRef     = useRef(null);
  const [isDraggingLogo, setIsDraggingLogo]   = useState(false);
  const [isDraggingTmpl, setIsDraggingTmpl]   = useState(false);

  // ── Auto-save folder handlers ──────────────────────────────────────
  async function handlePickFolder() {
    try {
      const handle = await pickPostersDirectory();
      setDirHandle(handle);
      addToast(`✓ Auto-save folder set: "${handle.name}" 📁`, 'success');
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Folder selection error:', err);
        addToast(`Could not select folder: ${err.message}`, 'error');
      }
    }
  }

  async function handleClearFolder() {
    await clearStoredDirectoryHandle();
    setDirHandle(null);
    addToast('Auto-save folder reset. Standard downloads will be used.', 'info');
  }

  // ── Logo handlers ──────────────────────────────────────────────────
  function handleLogoFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = e => setLogoDataUrl(e.target.result);
    reader.readAsDataURL(file);
  }

  function handleLogoDrop(e) {
    e.preventDefault();
    setIsDraggingLogo(false);
    handleLogoFile(e.dataTransfer.files[0]);
  }

  // ── Canva template handlers ────────────────────────────────────────
  function handleTemplateFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = e => setTemplateDataUrl(e.target.result);
    reader.readAsDataURL(file);
  }

  function handleTemplateDrop(e) {
    e.preventDefault();
    setIsDraggingTmpl(false);
    handleTemplateFile(e.dataTransfer.files[0]);
  }

  return (
    <div className="glass-card step-card">
      <h2 className="section-title">Event Setup</h2>
      <p className="section-subtitle">
        Customise the poster with your logo, event details, and optional Canva background template.
      </p>

      {/* Event Name */}
      <div style={{ marginBottom: 32 }}>
        <label className="input-label" htmlFor="event-name-input">Event Name</label>
        <input
          id="event-name-input"
          className="input-field"
          type="text"
          value={eventName}
          onChange={e => setEventName(e.target.value)}
          placeholder="EVENT NAME 2026"
          maxLength={60}
        />
      </div>

      {/* ── Auto-Save Folder Configuration ── */}
      <div style={{ marginBottom: 32 }}>
        <label className="input-label">
          📁 Automatic Poster Saving{' '}
          <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', fontSize: '0.75rem' }}>
            (saves every generated poster immediately into "AI Innovators Hub Posters")
          </span>
        </label>
        <div style={{
          background: 'rgba(0, 245, 255, 0.03)',
          border: '1px solid rgba(0, 245, 255, 0.18)',
          borderRadius: 'var(--radius-md)',
          padding: '20px 22px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: '1.4rem' }}>{dirHandle ? '✅' : '📁'}</span>
              <strong style={{ color: dirHandle ? 'var(--cyan)' : 'var(--text-primary)', fontFamily: 'var(--font-accent)', fontSize: '0.98rem' }}>
                {dirHandle ? `Active Folder: ${dirHandle.name}` : 'Dedicated Folder: AI Innovators Hub Posters'}
              </strong>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', margin: 0, lineHeight: 1.5 }}>
              {dirHandle ? (
                <>Every generated poster will be saved silently into <strong>{dirHandle.name}</strong> as <code>AI_Poster_YYYY-MM-DD_HH-mm-ss.png</code> without requiring manual clicks.</>
              ) : isFileSystemAccessSupported() ? (
                <>Select a folder on your device. Every poster will be automatically saved into an <strong>"AI Innovators Hub Posters"</strong> folder as full-resolution PNGs.</>
              ) : (
                <>Browser restriction: Direct folder access not supported in this browser. Posters will be automatically downloaded to your default <strong>Downloads</strong> folder.</>
              )}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {isFileSystemAccessSupported() ? (
              <>
                <button
                  type="button"
                  id="pick-folder-btn"
                  className="btn btn-secondary btn-sm"
                  onClick={handlePickFolder}
                >
                  {dirHandle ? '🔄 Change Folder' : '📁 Select Folder'}
                </button>
                {dirHandle && (
                  <button
                    type="button"
                    className="btn btn-sm"
                    style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                    onClick={handleClearFolder}
                  >
                    ✕ Reset
                  </button>
                )}
              </>
            ) : (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Automatic Download Mode
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Canva Template Upload ── */}
      <div style={{ marginBottom: 32 }}>
        <label className="input-label">
          🎨 Canva Poster Template{' '}
          <span style={{ color: 'var(--text-muted)', fontWeight: 400, textTransform: 'none', fontSize: '0.75rem' }}>
            (optional — replaces default background)
          </span>
        </label>
        <div
          className={`upload-zone ${isDraggingTmpl ? 'dragging' : ''}`}
          onDragOver={e => { e.preventDefault(); setIsDraggingTmpl(true); }}
          onDragLeave={() => setIsDraggingTmpl(false)}
          onDrop={handleTemplateDrop}
          onClick={() => tmplRef.current?.click()}
          role="button"
          aria-label="Upload Canva template"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && tmplRef.current?.click()}
          style={{
            cursor: 'pointer',
            borderColor: templateDataUrl ? 'rgba(0,245,255,0.5)' : undefined,
            minHeight: 140,
          }}
        >
          <input
            ref={tmplRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => handleTemplateFile(e.target.files[0])}
          />

          {templateDataUrl ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <img
                src={templateDataUrl}
                alt="Template preview"
                style={{
                  width: 90, height: 120, objectFit: 'cover',
                  borderRadius: 8, border: '2px solid rgba(0,245,255,0.5)',
                  flexShrink: 0,
                }}
              />
              <div>
                <p style={{ color: 'var(--cyan)', fontFamily: 'var(--font-accent)', fontSize: '0.95rem', marginBottom: 6 }}>
                  ✓ Official MAIH Poster Template loaded
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Official Microsoft AI Innovators Hub template.<br />
                  Your photo is placed inside the central hexagonal neon frame.
                </p>
                <button
                  className="btn btn-sm"
                  style={{ marginTop: 10, background: 'rgba(0,245,255,0.1)', color: 'var(--cyan)', border: '1px solid rgba(0,245,255,0.3)' }}
                  onClick={e => { e.stopPropagation(); setTemplateDataUrl('/poster-template-cutout.png'); }}
                >
                  ↺ Reset to Official Template
                </button>
              </div>
            </div>
          ) : (
            <div style={{ pointerEvents: 'none' }}>
              <div style={{ fontSize: '2.8rem', marginBottom: 10 }}>🎨</div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 6 }}>
                Drop your Canva template here, or click to browse
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                PNG, JPG · Export from Canva at full size for best results
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Logo Upload ── */}
      <div style={{ marginBottom: 40 }}>
        <label className="input-label">Community Logo (optional)</label>
        <div
          className={`upload-zone ${isDraggingLogo ? 'dragging' : ''}`}
          onDragOver={e => { e.preventDefault(); setIsDraggingLogo(true); }}
          onDragLeave={() => setIsDraggingLogo(false)}
          onDrop={handleLogoDrop}
          onClick={() => fileRef.current?.click()}
          role="button"
          aria-label="Upload community logo"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && fileRef.current?.click()}
          style={{ cursor: 'pointer' }}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => handleLogoFile(e.target.files[0])}
          />

          {logoDataUrl ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
              <img
                src={logoDataUrl}
                alt="Logo preview"
                style={{ width: 100, height: 100, objectFit: 'contain', borderRadius: 12, border: '2px solid rgba(0,245,255,0.4)', background: 'rgba(255,255,255,0.04)' }}
              />
              <span style={{ color: 'var(--cyan-dim)', fontFamily: 'var(--font-accent)', fontSize: '0.9rem' }}>
                ✓ Official MAIH Logo active — click to replace
              </span>
              <button
                type="button"
                className="btn btn-sm"
                style={{ background: 'rgba(0,245,255,0.1)', color: 'var(--cyan)', border: '1px solid rgba(0,245,255,0.3)', fontSize: '0.75rem', padding: '4px 10px' }}
                onClick={e => { e.stopPropagation(); setLogoDataUrl('/logo-mark.png'); }}
              >
                ↺ Reset to Official Logo
              </button>
            </div>
          ) : (
            <div style={{ pointerEvents: 'none' }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>📁</div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 6 }}>
                Drag &amp; drop your logo here, or click to browse
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                PNG, JPG, SVG · recommended 200×200 px
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Info box */}
      <div
        style={{
          padding: '14px 18px',
          background: 'rgba(0,245,255,0.04)',
          border: '1px solid rgba(0,245,255,0.12)',
          borderRadius: 'var(--radius-sm)',
          marginBottom: 36,
          fontSize: '0.85rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
        }}
      >
        <strong style={{ color: 'var(--cyan)' }}>ℹ Note:</strong> Your photo will be placed
        directly into the central hexagonal neon frame on the poster. No circular crop is applied —
        the photo is scaled proportionally and fitted precisely inside the frame's angular shape.
      </div>

      <button className="btn btn-primary btn-lg" onClick={onNext} style={{ width: '100%' }}>
        Next: Take a Photo →
      </button>
    </div>
  );
}
