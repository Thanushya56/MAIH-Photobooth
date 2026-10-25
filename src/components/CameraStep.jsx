/**
 * CameraStep.jsx – Step 2
 *
 * Key fix: the <video> element is ALWAYS rendered inside the camera container
 * (just CSS-hidden when not active).  This ensures videoRef.current is never
 * null when startCamera resolves, so the useEffect in useCamera.js can
 * attach the stream immediately after the DOM settles.
 */
import React, { useState, useRef, useEffect } from 'react';
import { useCamera } from '../hooks/useCamera.js';

const COUNTDOWN_SECS = 3;

export default function CameraStep({ onPhotoReady, onBack }) {
  const { videoRef, status, error, facingMode, switchCamera, startCamera, stopCamera, captureFrame } = useCamera();
  const [captured,   setCaptured]   = useState(null);
  const [countdown,  setCountdown]  = useState(null);
  const [groupSize,  setGroupSize]  = useState(1);
  const [mode,       setMode]       = useState('camera');
  const uploadRef    = useRef(null);
  const countdownRef = useRef(null);

  /* Auto-start camera when entering camera mode */
  useEffect(() => {
    if (mode === 'camera' && status === 'idle') {
      startCamera();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  /* ── Countdown → capture ───────────────────────────────────────── */
  function startCountdown() {
    let remaining = COUNTDOWN_SECS;
    setCountdown(remaining);
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(countdownRef.current);
        setCountdown(null);
        doCapture();
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  }

  function doCapture() {
    const dataUrl = captureFrame();
    if (dataUrl) {
      stopCamera();
      setCaptured(dataUrl);
    }
  }

  function retake() {
    clearInterval(countdownRef.current);
    setCountdown(null);
    setCaptured(null);
    startCamera();
  }

  /* ── Upload alternative ────────────────────────────────────────── */
  function handleUpload(e) {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = ev => {
      stopCamera();
      setCaptured(ev.target.result);
    };
    reader.readAsDataURL(file);
  }

  /* ── Mode switching ────────────────────────────────────────────── */
  function switchMode(m) {
    clearInterval(countdownRef.current);
    setCountdown(null);
    setCaptured(null);
    stopCamera();
    setMode(m);
    if (m === 'camera') {
      setTimeout(startCamera, 80);
    }
  }

  function handleUsePhoto() {
    if (captured) onPhotoReady(captured, groupSize);
  }

  /* ── Render ────────────────────────────────────────────────────── */
  return (
    <div className="glass-card step-card">
      <h2 className="section-title">Capture Your Photo</h2>
      <p className="section-subtitle">
        Works seamlessly on laptops, webcams, iPhones, and Android phones.
      </p>

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        {[['camera', '📷 Camera'], ['upload', '📂 Upload Photo']].map(([m, label]) => (
          <button
            key={m}
            id={`mode-${m}-btn`}
            className={`btn ${mode === m ? 'btn-secondary' : ''}`}
            style={mode !== m ? {
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--text-secondary)',
              border: '1px solid rgba(100,116,139,0.3)',
            } : {}}
            onClick={() => switchMode(m)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Group selector */}
      <div style={{ marginBottom: 24 }}>
        <label className="input-label">How many people? (fits in frame)</label>
        <div className="group-selector">
          {[1, 2, 3, 4].map(n => (
            <div
              key={n}
              id={`group-size-${n}`}
              className={`group-option ${groupSize === n ? 'selected' : ''}`}
              onClick={() => setGroupSize(n)}
              role="button"
              tabIndex={0}
              aria-label={`Group size ${n}`}
              onKeyDown={e => e.key === 'Enter' && setGroupSize(n)}
            >
              {n}
              <span className="group-option-label">
                {n === 1 ? 'Solo' : n === 2 ? 'Duo' : n === 3 ? 'Trio' : 'Quad'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── CAMERA MODE ── */}
      {mode === 'camera' && (
        <div>
          {/* The <video> is ALWAYS in the DOM when camera mode is active.
              Only visibility/display is toggled. This is the core camera fix. */}
          <div
            className="camera-container"
            style={{
              marginBottom: 16,
              display: status === 'active' && !captured ? 'block' : 'none',
              position: 'relative',
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="camera-video"
              style={{
                maxHeight: 440,
                transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
              }}
            />
            <div className="camera-overlay">
              <div className="camera-corner tl" />
              <div className="camera-corner tr" />
              <div className="camera-corner bl" />
              <div className="camera-corner br" />
              <div className="scan-line" />
            </div>

            {/* Quick Camera Flip Badge (overlay on viewfinder for phone & mobile ease) */}
            <button
              type="button"
              className="camera-flip-overlay-btn"
              onClick={switchCamera}
              title={`Switch camera (currently ${facingMode === 'user' ? 'front/selfie' : 'rear/back'})`}
              aria-label="Switch camera"
            >
              🔄 {facingMode === 'user' ? 'Rear Cam' : 'Front Cam'}
            </button>

            {/* Countdown overlay */}
            {countdown !== null && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(5,8,16,0.55)',
                zIndex: 10,
              }}>
                <span style={{
                  fontFamily: 'var(--font-display)', fontSize: '8rem', fontWeight: 900,
                  color: 'var(--cyan)', textShadow: '0 0 40px var(--cyan)',
                  lineHeight: 1,
                }}>
                  {countdown}
                </span>
              </div>
            )}
          </div>

          {/* Status overlays (only shown when camera container is hidden) */}
          {status === 'idle' && !captured && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: '3.5rem', marginBottom: 14 }}>📸</div>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
                Starting camera…
              </p>
              <button id="start-camera-btn" className="btn btn-primary btn-lg" onClick={startCamera}>
                🎥 Enable Camera
              </button>
            </div>
          )}

          {status === 'requesting' && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--cyan)' }}>
              <div className="animate-pulse-glow" style={{ fontSize: '3rem', marginBottom: 12 }}>⏳</div>
              <p style={{ fontFamily: 'var(--font-accent)', letterSpacing: '0.1em' }}>
                REQUESTING CAMERA ACCESS…
              </p>
            </div>
          )}

          {(status === 'denied' || status === 'error') && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>🚫</div>
              <p style={{ color: '#ef4444', marginBottom: 20, lineHeight: 1.5 }}>{error}</p>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-secondary" onClick={startCamera}>↺ Try Again</button>
                <button className="btn" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid rgba(100,116,139,0.3)' }}
                  onClick={() => switchMode('upload')}>
                  📂 Upload Instead
                </button>
              </div>
            </div>
          )}

          {/* Capture buttons */}
          {status === 'active' && !captured && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
              <button
                id="capture-btn"
                className="btn btn-primary btn-lg"
                style={{ flex: 3, minWidth: 160 }}
                onClick={startCountdown}
                disabled={countdown !== null}
              >
                {countdown !== null ? `📸 Capturing in ${countdown}…` : '📸 Take Photo (3s)'}
              </button>
              <button
                id="capture-now-btn"
                className="btn btn-secondary"
                style={{ flex: 1, minWidth: 80 }}
                onClick={doCapture}
                disabled={countdown !== null}
                title="Capture immediately"
              >
                ⚡ Now
              </button>
              <button
                id="switch-camera-btn"
                className="btn"
                style={{
                  flex: 1.2,
                  minWidth: 110,
                  background: 'rgba(0, 245, 255, 0.08)',
                  color: 'var(--cyan)',
                  border: '1px solid rgba(0, 245, 255, 0.35)',
                }}
                onClick={switchCamera}
                disabled={countdown !== null}
                title="Switch between front/selfie and back/rear camera"
              >
                🔄 {facingMode === 'user' ? 'Rear' : 'Front'}
              </button>
            </div>
          )}

          {/* Captured preview */}
          {captured && (
            <CapturedPreview photoUrl={captured} onRetake={retake} onUsePhoto={handleUsePhoto} />
          )}
        </div>
      )}

      {/* ── UPLOAD MODE ── */}
      {mode === 'upload' && (
        <div>
          {!captured ? (
            <>
              <div
                className="upload-zone"
                onClick={() => uploadRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="Upload a photo"
                onKeyDown={e => e.key === 'Enter' && uploadRef.current?.click()}
              >
                <input
                  ref={uploadRef}
                  id="photo-upload-input"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleUpload}
                />
                <div style={{ pointerEvents: 'none' }}>
                  <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>🖼️</div>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>
                    Click to select a photo
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    JPEG, PNG, WEBP supported
                  </p>
                </div>
              </div>

              {/* Quick test buttons with current user photos */}
              <div style={{ marginTop: 20, textAlign: 'center' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 10 }}>
                  Or quickly test with:
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => { stopCamera(); setCaptured('/user-photo.jpg'); }}
                  >
                    👤 Current Uploaded Photo
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => { stopCamera(); setCaptured('/thanushya-photo.jpg'); }}
                  >
                    👩 High-Res Portrait Photo
                  </button>
                </div>
              </div>
            </>
          ) : (
            <CapturedPreview
              photoUrl={captured}
              onRetake={() => setCaptured(null)}
              onUsePhoto={handleUsePhoto}
              isUpload
            />
          )}
        </div>
      )}

      {/* Back */}
      <div style={{ marginTop: 28 }}>
        <button className="btn btn-danger btn-sm" onClick={() => { stopCamera(); onBack(); }}>
          ← Back to Setup
        </button>
      </div>
    </div>
  );
}

/* ── Shared captured-photo preview ── */
function CapturedPreview({ photoUrl, onRetake, onUsePhoto, isUpload }) {
  return (
    <div>
      <div style={{
        marginBottom: 16,
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        border: '2px solid rgba(0,245,255,0.3)',
        boxShadow: '0 0 30px rgba(0,245,255,0.1)',
      }}>
        <img
          src={photoUrl}
          alt="Captured photo preview"
          style={{ width: '100%', display: 'block', maxHeight: 420, objectFit: 'contain', background: 'var(--navy-900)' }}
        />
      </div>
      <p style={{ color: 'var(--cyan)', fontFamily: 'var(--font-accent)', fontSize: '0.9rem', marginBottom: 16, textAlign: 'center' }}>
        ✓ {isUpload ? 'Photo selected' : 'Photo captured'} — looking great!
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button id="retake-btn" className="btn btn-danger" style={{ flex: 1 }} onClick={onRetake}>
          ↺ {isUpload ? 'Choose Different' : 'Retake'}
        </button>
        <button id="use-photo-btn" className="btn btn-primary btn-lg" style={{ flex: 2 }} onClick={onUsePhoto}>
          ✓ Use This Photo →
        </button>
      </div>
    </div>
  );
}
