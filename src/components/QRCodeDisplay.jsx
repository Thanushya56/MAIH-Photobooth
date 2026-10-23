/**
 * QRCodeDisplay.jsx
 *
 * Renders an ultra-scannable QR code using the `qrcode` library.
 * Features:
 * - High-contrast black on white canvas with generous quiet zone (margin: 3)
 * - Error correction level 'Q' (25% redundancy) for instant scanning through screen reflections & angles
 * - Futuristic viewfinder targeting brackets and "Ready to Scan" indicator
 * - 1-Click "Enlarge" modal showing a massive 360px QR code for effortless scanning from a distance
 */
import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

export default function QRCodeDisplay({ url, size = 220, allowEnlarge = true }) {
  const canvasRef = useRef(null);
  const modalCanvasRef = useRef(null);
  const [qrError, setQrError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Render primary QR code
  useEffect(() => {
    if (!url || !canvasRef.current) return;
    setQrError(null);

    QRCode.toCanvas(canvasRef.current, url, {
      width: size,
      margin: 3,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'Q',
    }).catch(err => setQrError(err.message));
  }, [url, size]);

  // Render modal enlarged QR code when open
  useEffect(() => {
    if (!isModalOpen || !url || !modalCanvasRef.current) return;

    QRCode.toCanvas(modalCanvasRef.current, url, {
      width: 360,
      margin: 4,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'Q',
    }).catch(err => console.error('Enlarged QR error:', err));
  }, [isModalOpen, url]);

  // Close modal on Escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  if (qrError) {
    return (
      <div style={{
        color: '#ef4444',
        fontSize: '0.85rem',
        padding: 16,
        background: 'rgba(239, 68, 68, 0.1)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        textAlign: 'center',
      }}>
        ⚠ QR generation failed: {qrError}
      </div>
    );
  }

  return (
    <>
      <div
        className="qr-container"
        style={{ cursor: allowEnlarge ? 'pointer' : 'default' }}
        onClick={() => allowEnlarge && setIsModalOpen(true)}
        role={allowEnlarge ? 'button' : undefined}
        tabIndex={allowEnlarge ? 0 : undefined}
        onKeyDown={e => {
          if (allowEnlarge && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setIsModalOpen(true);
          }
        }}
        title={allowEnlarge ? 'Click to enlarge QR code for easy scanning' : undefined}
      >
        {/* Futuristic viewfinder container with corner brackets */}
        <div className="qr-viewfinder">
          <div className="qr-corner corner-tl" />
          <div className="qr-corner corner-tr" />
          <div className="qr-corner corner-bl" />
          <div className="qr-corner corner-br" />

          <div className="qr-canvas-card">
            <canvas ref={canvasRef} className="qr-canvas" />
          </div>

          {allowEnlarge && (
            <div className="qr-enlarge-hint">
              <span>🔍 Tap to Enlarge</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <span className="pulse-dot" style={{ width: 8, height: 8 }} />
          <span style={{
            fontFamily: 'var(--font-accent)',
            fontSize: '0.78rem',
            color: 'var(--cyan)',
            letterSpacing: '0.08em',
            fontWeight: 600,
            textTransform: 'uppercase',
          }}>
            Ready to Scan
          </span>
        </div>
      </div>

      {/* Enlarged QR Code Modal */}
      {isModalOpen && (
        <div
          className="qr-modal-backdrop animate-fade-in"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="qr-modal-card animate-scale-up"
            onClick={e => e.stopPropagation()}
          >
            <button
              className="qr-modal-close"
              onClick={() => setIsModalOpen(false)}
              aria-label="Close enlarged QR code"
            >
              ✕
            </button>

            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 14px',
                borderRadius: 999,
                background: 'rgba(0, 245, 255, 0.1)',
                border: '1px solid rgba(0, 245, 255, 0.3)',
                color: 'var(--cyan)',
                fontSize: '0.75rem',
                fontFamily: 'var(--font-accent)',
                letterSpacing: '0.1em',
                marginBottom: 8,
                fontWeight: 700,
              }}>
                <span className="pulse-dot" style={{ width: 6, height: 6 }} />
                INSTANT PHONE DOWNLOAD
              </div>
              <h3 style={{
                fontFamily: 'var(--font-display)',
                fontSize: '1.3rem',
                color: '#ffffff',
                marginBottom: 4,
              }}>
                Scan to Save Your Poster
              </h3>
              <p style={{
                fontSize: '0.85rem',
                color: 'var(--text-secondary)',
                maxWidth: 320,
                margin: '0 auto',
              }}>
                Point any phone camera (iPhone or Android) at the screen to view and save directly to your photos!
              </p>
            </div>

            <div className="qr-modal-viewfinder">
              <div className="qr-corner corner-tl" />
              <div className="qr-corner corner-tr" />
              <div className="qr-corner corner-bl" />
              <div className="qr-corner corner-br" />

              <div className="qr-canvas-card" style={{ padding: 12 }}>
                <canvas ref={modalCanvasRef} className="qr-canvas-large" />
              </div>
            </div>

            <p style={{
              fontFamily: 'var(--font-accent)',
              fontSize: '0.8rem',
              color: 'var(--text-muted)',
              marginTop: 16,
              textAlign: 'center',
            }}>
              Tap anywhere outside or press <kbd style={{
                background: 'rgba(255,255,255,0.1)',
                padding: '2px 6px',
                borderRadius: 4,
                color: '#fff',
              }}>ESC</kbd> to close
            </p>
          </div>
        </div>
      )}
    </>
  );
}
