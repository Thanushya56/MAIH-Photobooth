/**
 * App.jsx – MICROSOFT AI INNOVATORS HUB Photo Booth
 * Root orchestrator for the 3-step flow:
 *   1. Setup (logo + event name)
 *   2. Photo capture
 *   3. Poster generation & download
 */
import React, { useState, useEffect } from 'react';
import './App.css';

import { useToast }      from './hooks/useToast.js';
import ToastContainer    from './components/ToastContainer.jsx';
import StepsBar          from './components/StepsBar.jsx';
import SetupStep         from './components/SetupStep.jsx';
import CameraStep        from './components/CameraStep.jsx';
import PosterStep        from './components/PosterStep.jsx';
import QRCodeDisplay     from './components/QRCodeDisplay.jsx';
import AdminGallery      from './components/AdminGallery.jsx';
import { getStoredDirectoryHandle, isFileSystemAccessSupported } from './utils/autoSaver.js';

const COMMUNITY_NAME = 'MICROSOFT AI INNOVATORS HUB';
const TAGLINE        = 'All About AI & Data';
const CURRENT_YEAR   = new Date().getFullYear();

export default function App() {
  // ── Global state ──────────────────────────────────────────────────
  const [step, setStep]             = useState(1); // 1 | 2 | 3
  const [logoDataUrl, setLogoDataUrl] = useState('/logo-mark.png');
  const [eventName, setEventName]   = useState('EVENT NAME 2026');
  const [photoDataUrl, setPhotoDataUrl] = useState(null);
  const [groupSize, setGroupSize]   = useState(1);
  const [templateDataUrl, setTemplateDataUrl] = useState('/poster-template-cutout.png');
  const [dirHandle, setDirHandle]   = useState(null);
  const [isAdmin, setIsAdmin] = useState(() => {
    if (typeof window === 'undefined') return false;
    // Check if user manually switched to guest mode
    if (sessionStorage.getItem('maih_guest_mode') === 'true') return false;
    // Check if stored admin auth exists
    if (sessionStorage.getItem('maih_admin_auth') === 'true' || localStorage.getItem('maih_admin_auth') === 'true') {
      return true;
    }
    // Host laptop running on localhost or 127.0.0.1 defaults to admin
    const hostname = window.location.hostname;
    return hostname === 'localhost' || hostname === '127.0.0.1';
  });

  const [networkInfo, setNetworkInfo] = useState(null);
  const [showMobileModal, setShowMobileModal] = useState(false);
  const [showAdminGallery, setShowAdminGallery] = useState(false);
  const [galleryCount, setGalleryCount] = useState(0);

  // Admin login modal state
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [adminPinError, setAdminPinError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Restore stored directory handle and fetch network info on load
  useEffect(() => {
    fetch('/api/poster/network')
      .then(r => r.json())
      .then(d => setNetworkInfo(d))
      .catch(e => console.warn('Could not load network info:', e));
  }, []);

  // Poll gallery poster count ONLY when user is an authorized admin
  useEffect(() => {
    if (!isAdmin) return;

    function checkCount() {
      const pin = sessionStorage.getItem('maih_admin_pin') || localStorage.getItem('maih_admin_pin') || '';
      const headers = pin ? { 'x-admin-pin': pin } : {};
      fetch('/api/poster/gallery', { headers })
        .then(r => {
          if (r.status === 401) return null;
          return r.json();
        })
        .then(d => {
          if (d && typeof d.count === 'number') setGalleryCount(d.count);
        })
        .catch(() => {});
    }

    checkCount();
    const interval = setInterval(checkCount, 4000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  // Restore stored directory handle on load
  useEffect(() => {
    async function initDir() {
      if (isFileSystemAccessSupported()) {
        try {
          const stored = await getStoredDirectoryHandle();
          if (stored) {
            setDirHandle(stored);
          }
        } catch (e) {
          console.warn('Could not restore directory handle:', e);
        }
      }
    }
    initDir();
  }, []);

  const { toasts, addToast, removeToast } = useToast();

  // ── Step navigation ───────────────────────────────────────────────
  function goToStep(n) { setStep(n); }

  function handlePhotoReady(dataUrl, size) {
    setPhotoDataUrl(dataUrl);
    setGroupSize(size);
    setStep(3);
    addToast('Photo captured! Generating your poster…', 'info');
  }

  function handleReset() {
    setStep(1);
    setPhotoDataUrl(null);
    setGroupSize(1);
    setTemplateDataUrl('/poster-template-cutout.png');
    setLogoDataUrl('/logo-mark.png');
    addToast('Starting fresh 🔄', 'info');
  }

  function handleAdminLogout() {
    setIsAdmin(false);
    setGalleryCount(0);
    sessionStorage.setItem('maih_guest_mode', 'true');
    sessionStorage.removeItem('maih_admin_auth');
    sessionStorage.removeItem('maih_admin_pin');
    localStorage.removeItem('maih_admin_auth');
    localStorage.removeItem('maih_admin_pin');
    setShowAdminGallery(false);
    addToast('Switched to Guest View. Gallery hidden.', 'info');
  }

  async function handleAdminLogin(e) {
    if (e) e.preventDefault();
    const pin = adminPinInput.trim();
    if (!pin) return;
    setIsLoggingIn(true);
    setAdminPinError('');
    try {
      const res = await fetch('/api/poster/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (res.ok && data.authorized) {
        sessionStorage.removeItem('maih_guest_mode');
        sessionStorage.setItem('maih_admin_auth', 'true');
        sessionStorage.setItem('maih_admin_pin', pin);
        localStorage.setItem('maih_admin_auth', 'true');
        localStorage.setItem('maih_admin_pin', pin);
        setIsAdmin(true);
        setShowAdminLoginModal(false);
        setAdminPinInput('');
        setShowAdminGallery(true);
        addToast('Organizer unlocked! Welcome admin 📸', 'success');
      } else {
        setAdminPinError('Invalid Admin PIN. Access denied.');
      }
    } catch {
      // Fallback offline verification for maih2026
      if (pin === 'maih2026' || pin === '2026') {
        sessionStorage.removeItem('maih_guest_mode');
        sessionStorage.setItem('maih_admin_auth', 'true');
        sessionStorage.setItem('maih_admin_pin', pin);
        localStorage.setItem('maih_admin_auth', 'true');
        localStorage.setItem('maih_admin_pin', pin);
        setIsAdmin(true);
        setShowAdminLoginModal(false);
        setAdminPinInput('');
        setShowAdminGallery(true);
        addToast('Organizer unlocked! Welcome admin 📸', 'success');
      } else {
        setAdminPinError('Verification failed. Check network or PIN.');
      }
    } finally {
      setIsLoggingIn(false);
    }
  }

  const mobileUrl = networkInfo?.tunnelUrl || (networkInfo?.selectedIp ? `http://${networkInfo.selectedIp}:${networkInfo.port || 5173}` : (typeof window !== 'undefined' ? window.location.origin : ''));

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="app-wrapper">
      {/* Animated background layers */}
      <div className="animated-bg" />
      <div className="grid-overlay" />

      {/* Team Portal Backdrop (Group Photo with Downward Transparency) */}
      <div className={`portal-team-backdrop ${step === 1 ? 'is-home' : 'is-subpage'}`} aria-hidden="true">
        <div className="portal-team-img-wrapper">
          <img
            src="/maih-team-group.jpg"
            alt="MAIH Organizing Team"
            className="portal-team-img"
          />
          <div className="portal-team-gradient-down" />
        </div>
      </div>

      {/* Header */}
      <header className="app-header" role="banner">
        <div className="header-brand">
          <div className="header-logo-wrapper">
            {logoDataUrl ? (
              <img src={logoDataUrl} alt="Community logo" />
            ) : (
              <div className="header-logo-placeholder">AI</div>
            )}
          </div>
          <div className="header-text">
            <h1>{COMMUNITY_NAME}</h1>
            <p>{TAGLINE}</p>
          </div>
        </div>
        <div className="header-actions">
          {isAdmin && (
            <button
              type="button"
              id="admin-gallery-btn"
              className="admin-portal-btn"
              onClick={() => setShowAdminGallery(true)}
              title="Admin: View all photos captured across all phones and laptops in real-time"
            >
              🖼️ Photos {galleryCount > 0 && <span className="gallery-counter-pill">{galleryCount}</span>}
            </button>
          )}
          <button
            type="button"
            id="open-on-phone-btn"
            className="mobile-portal-btn"
            onClick={() => setShowMobileModal(true)}
            title="Scan QR to open and use Photo Booth on phone"
          >
            📱 Open on Phone
          </button>
          <div className="header-badge">
            <span className="pulse-dot" />
            PHOTO BOOTH LIVE
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="app-main" id="main-content" role="main">

        {/* Hero */}
        <section className="hero-section animate-slide-up">
          <div className="hero-team-tag">
            <span className="team-tag-pulse" />
            <span className="team-tag-label">COMMUNITY SPOTLIGHT · MAIH CORE TEAM</span>
          </div>
          <div className="hero-title">
            <span className="line1">AI Photo Booth</span>
            <span className="line2">Powered by {COMMUNITY_NAME}</span>
          </div>
          <div className="hero-divider" />
          <p className="hero-subtitle">
            Step into the future. Capture your moment, get a stunning branded poster,
            and share your AI journey with the community.
          </p>
        </section>

        {/* Steps indicator */}
        <StepsBar currentStep={step} />

        {/* Step panels */}
        {step === 1 && (
          <SetupStep
            logoDataUrl={logoDataUrl}
            setLogoDataUrl={setLogoDataUrl}
            eventName={eventName}
            setEventName={setEventName}
            templateDataUrl={templateDataUrl}
            setTemplateDataUrl={setTemplateDataUrl}
            dirHandle={dirHandle}
            setDirHandle={setDirHandle}
            addToast={addToast}
            onNext={() => goToStep(2)}
          />
        )}

        {step === 2 && (
          <CameraStep
            onPhotoReady={handlePhotoReady}
            onBack={() => goToStep(1)}
          />
        )}

        {step === 3 && photoDataUrl && (
          <PosterStep
            photoDataUrl={photoDataUrl}
            logoDataUrl={logoDataUrl}
            templateDataUrl={templateDataUrl}
            eventName={eventName}
            groupSize={groupSize}
            dirHandle={dirHandle}
            setDirHandle={setDirHandle}
            onReset={handleReset}
            addToast={addToast}
          />
        )}

      </main>

      {/* Footer */}
      <footer className="app-footer" role="contentinfo">
        <div className="footer-content">
          <span>© {CURRENT_YEAR} {COMMUNITY_NAME} · {TAGLINE}</span>
          <span className="footer-dot">•</span>
          {isAdmin ? (
            <span className="footer-admin-status">
              <span className="admin-status-dot" /> Organizer Mode
              <button
                type="button"
                className="footer-admin-toggle-btn"
                onClick={handleAdminLogout}
                title="Switch to Guest View to preview attendee experience"
              >
                (Switch to Guest View)
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="footer-admin-link"
              onClick={() => {
                setAdminPinError('');
                setAdminPinInput('');
                setShowAdminLoginModal(true);
              }}
              title="Organizer Login: Enter secret PIN to access all attendee photos"
            >
              🔒 Organizer Login
            </button>
          )}
        </div>
      </footer>

      {/* Mobile Connect QR Modal */}
      {showMobileModal && (
        <div className="modal-overlay" onClick={() => setShowMobileModal(false)}>
          <div
            className="modal-content glass-card mobile-modal-box"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 440, padding: '28px 24px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.6rem' }}>📱</span>
                <div>
                  <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', color: 'var(--cyan)', fontSize: '1.15rem' }}>
                    Open on Mobile Phone
                  </h3>
                  <p style={{ margin: '2px 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    Scan with your iPhone or Android camera
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', padding: '6px 12px' }}
                onClick={() => setShowMobileModal(false)}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0' }}>
              <div style={{
                background: '#ffffff',
                padding: 12,
                borderRadius: 14,
                boxShadow: '0 0 35px rgba(0,245,255,0.25)',
                marginBottom: 16,
              }}>
                <QRCodeDisplay url={mobileUrl} size={220} allowEnlarge={false} />
              </div>

              {networkInfo?.tunnelActive ? (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '5px 14px',
                  borderRadius: 999,
                  background: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  fontSize: '0.78rem',
                  color: '#34d399',
                  fontFamily: 'var(--font-accent)',
                  fontWeight: 600,
                  marginBottom: 12,
                }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 8px #34d399' }} />
                  <span>🌐 4G/5G Public Access Ready · No Same Wi-Fi Needed</span>
                </div>
              ) : (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '5px 14px',
                  borderRadius: 999,
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.35)',
                  fontSize: '0.78rem',
                  color: '#fbbf24',
                  fontFamily: 'var(--font-accent)',
                  fontWeight: 600,
                  marginBottom: 12,
                }}>
                  <span className="pulse-dot" style={{ width: 6, height: 6 }} />
                  <span>Connect phone to same Wi-Fi: {networkInfo?.selectedIp || 'Local network'}</span>
                </div>
              )}

              <div style={{
                width: '100%',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(0,245,255,0.2)',
                borderRadius: 8,
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                marginBottom: 14,
              }}>
                <span style={{
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  color: 'var(--cyan)',
                  wordBreak: 'break-all',
                }}>
                  {mobileUrl}
                </span>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ flexShrink: 0, padding: '4px 10px', fontSize: '0.75rem' }}
                  onClick={() => {
                    navigator.clipboard.writeText(mobileUrl);
                    addToast('URL copied to clipboard! 📋', 'success');
                  }}
                >
                  📋 Copy
                </button>
              </div>

              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', margin: 0, lineHeight: 1.5 }}>
                💡 <strong>How to open:</strong> Open your phone's built-in camera app and point it at the QR code. Tap the pop-up banner to launch the photo booth on your phone!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Admin Login PIN Modal */}
      {showAdminLoginModal && (
        <div className="modal-overlay" onClick={() => setShowAdminLoginModal(false)}>
          <div
            className="modal-content glass-card admin-login-card"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 400, padding: '26px 22px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.6rem' }}>🔐</span>
                <div>
                  <h3 style={{ margin: 0, fontFamily: 'var(--font-display)', color: 'var(--cyan)', fontSize: '1.15rem' }}>
                    Organizer Access
                  </h3>
                  <p style={{ margin: '2px 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    Enter Admin PIN to view attendee photo gallery
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm"
                style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)', padding: '6px 12px' }}
                onClick={() => setShowAdminLoginModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAdminLogin}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                  Secret Organizer PIN
                </label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Enter PIN (e.g. maih2026)"
                  value={adminPinInput}
                  onChange={e => {
                    setAdminPinInput(e.target.value);
                    if (adminPinError) setAdminPinError('');
                  }}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    fontSize: '1.05rem',
                    letterSpacing: '0.15em',
                    textAlign: 'center',
                    background: 'rgba(5, 8, 16, 0.7)',
                    border: adminPinError ? '1.5px solid #ef4444' : '1.5px solid rgba(0, 245, 255, 0.35)',
                    borderRadius: 8,
                    color: '#ffffff',
                    outline: 'none',
                  }}
                />
                {adminPinError && (
                  <p style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: 8, textAlign: 'center' }}>
                    ⚠️ {adminPinError}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAdminLoginModal(false)}
                  disabled={isLoggingIn}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!adminPinInput.trim() || isLoggingIn}
                  style={{
                    background: 'linear-gradient(135deg, #00f5ff, #8b5cf6)',
                    border: 'none',
                    fontWeight: 700,
                  }}
                >
                  {isLoggingIn ? 'Verifying…' : 'Unlock Dashboard 🔓'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Live Gallery Modal */}
      {isAdmin && showAdminGallery && (
        <AdminGallery
          onClose={() => setShowAdminGallery(false)}
          addToast={addToast}
        />
      )}

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
