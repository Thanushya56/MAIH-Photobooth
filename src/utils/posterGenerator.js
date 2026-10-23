/**
 * posterGenerator.js
 *
 * Generates the official Microsoft AI Innovators Hub poster.
 *
 * Features:
 * - Uses the official 723×1024 poster template (2× hi-res: 1446×2048)
 * - Places the user photo inside the central hexagonal / angular sci-fi frame
 * - Precise polygon clipping matching the frame's angular shape
 * - Proportional cover-fit cropping with face positioning (no distortion)
 * - Keeps the neon cyan, blue, purple, and magenta frame border above the photo
 * - No circular crop (no border-radius: 50%, no arc clipping)
 * - No checkerboard placeholder in final output
 * - Preserves all 7 official logos, AI robot, futuristic city, and event details
 */

export const POSTER_W = 723;
export const POSTER_H = 1024;
export const HI_RES_SCALE = 2; // 2× resolution → 1446×2048 px

// Frame bounding box (723×1024 space)
export const FRAME_BBOX = {
  minX: 144,
  maxX: 578,
  minY: 137,
  maxY: 710,
  get width() { return this.maxX - this.minX; },   // 434 px (~60.03%)
  get height() { return this.maxY - this.minY; }, // 573 px (~55.96%)
};

// Exact inner polygon boundary of the central angular frame
export const FRAME_POLYGON = [
  // Top edge
  [257, 137], [469, 137],
  // Top-right corner chamfer & step
  [499, 169], [535, 170], [577, 217],
  // Right vertical edge & middle notch
  [577, 327], [569, 337], [569, 502], [577, 512], [577, 597],
  // Bottom-right corner & step
  [505, 677], [473, 680], [444, 710],
  // Bottom edge
  [273, 710],
  // Bottom-left corner & step
  [242, 680], [218, 677], [144, 597],
  // Left vertical edge & middle notch
  [144, 512], [153, 502], [153, 337], [144, 327], [144, 217],
  // Top-left corner & step
  [188, 170], [225, 169]
];

// Helper: load image
function loadImg(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

/**
 * generatePoster
 * @param {HTMLCanvasElement} canvas - Target canvas
 * @param {object} opts
 *   photoDataUrl    - User photo data URL (required)
 *   templateDataUrl - Poster template URL (defaults to official cutout template)
 *   groupSize       - 1 | 2 | 3 | 4
 * @returns {Promise<void>}
 */
export async function generatePoster(canvas, opts = {}) {
  const {
    photoDataUrl,
    templateDataUrl = '/poster-template-cutout.png',
    groupSize = 1,
  } = opts;

  // 1. Setup high-resolution canvas (2× physical pixels: 1446×2048)
  canvas.width = POSTER_W * HI_RES_SCALE;
  canvas.height = POSTER_H * HI_RES_SCALE;

  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Base coordinate system: 723 × 1024
  ctx.scale(HI_RES_SCALE, HI_RES_SCALE);

  // 2. Base dark background
  ctx.fillStyle = '#050810';
  ctx.fillRect(0, 0, POSTER_W, POSTER_H);

  // 3. Render user photo clipped to the central hexagonal polygon
  if (photoDataUrl) {
    try {
      const photoImg = await loadImg(photoDataUrl);
      const iw = photoImg.naturalWidth || photoImg.width;
      const ih = photoImg.naturalHeight || photoImg.height;

      const fw = FRAME_BBOX.width;
      const fh = FRAME_BBOX.height;

      // Proportional cover-fit: fill the inner frame area with no distortion
      const scale = Math.max(fw / iw, fh / ih);
      const sw = iw * scale;
      const sh = ih * scale;

      // Position: center horizontally, bias 20% vertically for face alignment
      const sx = FRAME_BBOX.minX + (fw - sw) / 2;
      const sy = FRAME_BBOX.minY + Math.max(0, Math.min(fh - sh, (fh - sh) * 0.2));

      ctx.save();
      // Apply exact hexagonal / angular clipping path
      ctx.beginPath();
      FRAME_POLYGON.forEach(([px, py], i) => {
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.closePath();
      ctx.clip();

      // Draw photo
      ctx.drawImage(photoImg, sx, sy, sw, sh);
      ctx.restore();
    } catch (err) {
      console.warn('Failed to load user photo:', err);
    }
  }

  // 4. Render official poster template on top
  // The template contains the neon cyan/magenta glowing frame, 7 logos, robot, futuristic city, and event branding.
  // Drawing it on top guarantees the frame borders remain visible above the photo with zero bleed.
  try {
    const tmplUrl = templateDataUrl || '/poster-template-cutout.png';
    const tmplImg = await loadImg(tmplUrl);
    ctx.drawImage(tmplImg, 0, 0, POSTER_W, POSTER_H);
  } catch (err) {
    console.warn('Failed to load template image, attempting fallback:', err);
    try {
      const fallbackImg = await loadImg('/poster-template.jpg');
      ctx.drawImage(fallbackImg, 0, 0, POSTER_W, POSTER_H);
    } catch (e2) {
      console.error('All template loading failed:', e2);
    }
  }

  // 5. Group size badge if group > 1
  if (groupSize > 1) {
    const bx = FRAME_BBOX.maxX - 40;
    const by = FRAME_BBOX.maxY - 35;

    ctx.save();
    ctx.fillStyle = 'rgba(10, 14, 26, 0.9)';
    ctx.strokeStyle = '#00f5ff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur = 10;

    // Small sci-fi badge
    ctx.beginPath();
    ctx.arc(bx, by, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#00f5ff';
    ctx.font = 'bold 15px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`×${groupSize}`, bx, by);
    ctx.restore();
  }
}
