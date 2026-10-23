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

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="app-wrapper">
      {/* Animated background layers */}
      <div className="animated-bg" />
      <div className="grid-overlay" />

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
        <div className="header-badge">
          <span className="pulse-dot" />
          PHOTO BOOTH LIVE
        </div>
      </header>

      {/* Main content */}
      <main className="app-main" id="main-content" role="main">

        {/* Hero */}
        <section className="hero-section animate-slide-up">
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
        © {CURRENT_YEAR} {COMMUNITY_NAME} · {TAGLINE} · Photo Booth v1.0
      </footer>

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
