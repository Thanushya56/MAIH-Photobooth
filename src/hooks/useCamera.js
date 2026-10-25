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
  const [facingMode, setFacingMode] = useState('user'); // 'user' (selfie) | 'environment' (rear)

  /* ── Attach stream to <video> whenever status becomes 'active' ── */
  useEffect(() => {
    if (status === 'active' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      const p = videoRef.current.play();
      if (p !== undefined) p.catch(e => console.warn('Video play failed:', e));
    }
  }, [status]);

  const startCamera = useCallback(async (desiredMode) => {
    const targetMode = desiredMode || facingMode;
    setStatus('requesting');
    setError(null);

    // Stop existing stream if any
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width:     { min: 1280, ideal: 1920, max: 3840 },
          height:    { min: 720,  ideal: 1080, max: 2160 },
          facingMode: { ideal: targetMode },
          frameRate: { ideal: 30, max: 60 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (desiredMode) setFacingMode(desiredMode);
      setStatus('active');
    } catch (_err) {
      // Fallback: try basic video constraints if specific resolution/facingMode failed
      console.warn('High-res camera constraint failed, falling back to basic video:', _err);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = stream;
        setStatus('active');
      } catch (fallbackErr) {
        streamRef.current = null;
        if (fallbackErr.name === 'NotAllowedError' || fallbackErr.name === 'PermissionDeniedError') {
          setStatus('denied');
          setError('Camera permission was denied. Please allow camera access in your browser settings and try again.');
        } else if (fallbackErr.name === 'NotFoundError') {
          setStatus('error');
          setError('No camera found on this device.');
        } else {
          setStatus('error');
          setError(`Camera error: ${fallbackErr.message}`);
        }
      }
    }
  }, [facingMode]);

  const switchCamera = useCallback(async () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    await startCamera(nextMode);
  }, [facingMode, startCamera]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setStatus('idle');
  }, []);

  /**
   * Capture current frame from the video at native sensor resolution.
   * Exports lossless PNG to eliminate compression artifacts and blurriness.
   */
  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    if (!video) return null;
    const w = video.videoWidth  || 1920;
    const h = video.videoHeight || 1080;
    const canvas = document.createElement('canvas');
    canvas.width  = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(video, 0, 0, w, h); // natural orientation
    return canvas.toDataURL('image/png');
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  return { videoRef, status, error, facingMode, switchCamera, startCamera, stopCamera, captureFrame };
}
