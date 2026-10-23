/**
 * QRCodeDisplay – generates and renders a QR code using the `qrcode` library.
 * The QR code points to the provided URL (data URL or hosted URL).
 */
import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

export default function QRCodeDisplay({ url, size = 160 }) {
  const canvasRef = useRef(null);
  const [qrError, setQrError] = useState(null);

  useEffect(() => {
    if (!url || !canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, url, {
      width: size,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    }).catch(err => setQrError(err.message));
  }, [url, size]);

  if (qrError) {
    return (
      <div style={{ color: '#ef4444', fontSize: '0.8rem', textAlign: 'center' }}>
        QR generation failed: {qrError}
      </div>
    );
  }

  return (
    <div className="qr-container">
      <canvas ref={canvasRef} style={{ borderRadius: 8 }} />
      <p style={{ fontFamily: 'var(--font-accent)', fontSize: '0.75rem', color: 'var(--text-muted)', letterSpacing: '0.05em', textAlign: 'center', maxWidth: 200 }}>
        Scan to view &amp; share your poster
      </p>
    </div>
  );
}
