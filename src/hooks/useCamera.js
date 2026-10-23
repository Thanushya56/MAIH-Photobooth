/**
 * useCamera.js
 *
 * The blank-video bug: getUserMedia resolves before the <video> element is
 * mounted (it only renders once status === 'active').  The fix is to store
 * the stream in a ref and attach it inside a useEffect that fires AFTER
 * the DOM update when status flips to 'active'.
 */
import { useState, useRef, useCallback, useEffect } from 'react';

export function useCamera() {
  const videoRef   = useRef(null);
  const streamRef  = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | requesting | active | denied | error
  const [error,  setError]  = useState(null);

  /* ── Attach stream to <video> whenever status becomes 'active' ── */
  useEffect(() => {
    if (status === 'active' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      const p = videoRef.current.play();
      if (p !== undefined) p.catch(e => console.warn('Video play failed:', e));
    }
  }, [status]);

  const startCamera = useCallback(async () => {
    setStatus('requesting');
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;
      setStatus('active'); // triggers the useEffect above after render
    } catch (err) {
      streamRef.current = null;
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setStatus('denied');
        setError('Camera permission was denied. Please allow access in your browser settings and try again.');
      } else if (err.name === 'NotFoundError') {
        setStatus('error');
        setError('No camera found on this device.');
      } else {
        setStatus('error');
        setError(`Camera error: ${err.message}`);
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus('idle');
  }, []);

  /**
   * Capture current frame from the video.
   * Raw pixels only — no AI processing, no filters, no face detection.
   */
  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video) return null;
    const w = video.videoWidth  || 640;
    const h = video.videoHeight || 480;
    const canvas = document.createElement('canvas');
    canvas.width  = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, w, h); // natural orientation
    return canvas.toDataURL('image/jpeg', 0.96);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  return { videoRef, status, error, startCamera, stopCamera, captureFrame };
}
