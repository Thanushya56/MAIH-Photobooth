/**
 * detectTemplateCircle.js
 *
 * Analyses a Canva template image to find the brightest glowing ring
 * (the photo frame circle), then returns { x, y, r } in the 900×1200
 * poster coordinate space so the photo can be placed automatically.
 *
 * Algorithm:
 *  1. Downscale the template to ~20 % for fast pixel access.
 *  2. For every candidate (cx, cy, r) in a coarse grid, compute a
 *     "ring score": average brightness ON the ring minus the average
 *     brightness just inside and just outside it.
 *     High score → the ring is distinctly brighter than its surroundings
 *     (typical of a neon glow frame).
 *  3. Refine around the best coarse result with a fine grid.
 *  4. Map the detected circle back to poster logical coordinates.
 */

const POSTER_W = 900;
const POSTER_H = 1200;
const PROC_SCALE = 0.2;   // downscale factor for fast processing

/**
 * @param {string} templateDataUrl
 * @returns {Promise<{x:number, y:number, r:number}>}
 */
export function detectTemplateCircle(templateDataUrl) {
  return new Promise(resolve => {
    const img = new Image();

    img.onerror = () => resolve({ x: 450, y: 430, r: 220 });

    img.onload = () => {
      const origW = img.naturalWidth  || img.width;
      const origH = img.naturalHeight || img.height;

      // ── 1. Downscale ──────────────────────────────────────────────
      const pw = Math.round(origW * PROC_SCALE);
      const ph = Math.round(origH * PROC_SCALE);

      const offscreen = document.createElement('canvas');
      offscreen.width  = pw;
      offscreen.height = ph;
      const ctx = offscreen.getContext('2d');
      ctx.drawImage(img, 0, 0, pw, ph);

      const { data } = ctx.getImageData(0, 0, pw, ph);

      // ── 2. Brightness map ─────────────────────────────────────────
      const bright = new Float32Array(pw * ph);
      for (let i = 0; i < pw * ph; i++) {
        const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
        // Weighted luminance – also boosts saturated colours (glows)
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        // Saturation bonus so cyan/blue/purple glows score higher
        const maxC = Math.max(r, g, b) / 255;
        const minC = Math.min(r, g, b) / 255;
        const sat  = maxC > 0 ? (maxC - minC) / maxC : 0;
        bright[i] = Math.min(1, lum + sat * 0.3);
      }

      // ── 3. Sample a circle's circumference ────────────────────────
      function sampleRing(cx, cy, radius, n = 56) {
        let sum = 0, count = 0;
        for (let i = 0; i < n; i++) {
          const angle = (i / n) * Math.PI * 2;
          const px = Math.round(cx + radius * Math.cos(angle));
          const py = Math.round(cy + radius * Math.sin(angle));
          if (px >= 0 && px < pw && py >= 0 && py < ph) {
            sum += bright[py * pw + px]; count++;
          }
        }
        return count > 0 ? sum / count : 0;
      }

      // Ring score: ring brightness minus surroundings (detects glowing rings)
      function ringScore(cx, cy, r) {
        const onRing  = sampleRing(cx, cy, r);
        const inner   = sampleRing(cx, cy, r * 0.70);  // inside the frame
        const outer   = sampleRing(cx, cy, r * 1.30);  // outside the frame
        // Give a spatial prior: prefer circles in upper-centre of image
        const normCx  = cx / pw;                // 0..1
        const normCy  = cy / ph;                // 0..1
        const centreBonus = (1 - Math.abs(normCx - 0.5) * 2) * 0.05  // favour centre-x
                          + (normCy < 0.65 ? 0.05 : 0);              // favour upper portion
        return (onRing * 2 - inner - outer) + centreBonus;
      }

      // ── 4. Coarse grid search ─────────────────────────────────────
      const small = Math.min(pw, ph);
      const stepXY = Math.max(1, Math.round(small * 0.04));
      const minR   = Math.round(small * 0.10);
      const maxR   = Math.round(small * 0.48);
      const stepR  = Math.max(1, Math.round(small * 0.03));

      let bestScore = -Infinity;
      let bestCx = pw * 0.5, bestCy = ph * 0.38, bestR = small * 0.28;

      for (let cx = stepXY; cx < pw - stepXY; cx += stepXY) {
        for (let cy = stepXY; cy < ph - stepXY; cy += stepXY) {
          for (let r = minR; r <= maxR; r += stepR) {
            const score = ringScore(cx, cy, r);
            if (score > bestScore) {
              bestScore = score;
              bestCx = cx; bestCy = cy; bestR = r;
            }
          }
        }
      }

      // ── 5. Fine refinement around best coarse result ──────────────
      const fineW = stepXY * 2;
      const fineR = stepR  * 2;

      for (let cx = bestCx - fineW; cx <= bestCx + fineW; cx++) {
        for (let cy = bestCy - fineW; cy <= bestCy + fineW; cy++) {
          for (let r = Math.max(minR * 0.5, bestR - fineR); r <= bestR + fineR; r++) {
            if (cx < 0 || cy < 0 || cx >= pw || cy >= ph) continue;
            const score = ringScore(cx, cy, r);
            if (score > bestScore) {
              bestScore = score;
              bestCx = cx; bestCy = cy; bestR = r;
            }
          }
        }
      }

      // ── 6. Map back to poster coordinate space ────────────────────
      //  The template is drawn cover-fit into POSTER_W × POSTER_H:
      //    posterScale = max(POSTER_W / origW, POSTER_H / origH)
      //    offsetX     = (POSTER_W - origW * posterScale) / 2
      //    offsetY     = (POSTER_H - origH * posterScale) / 2
      const posterScale = Math.max(POSTER_W / origW, POSTER_H / origH);
      const offsetX     = (POSTER_W - origW * posterScale) / 2;
      const offsetY     = (POSTER_H - origH * posterScale) / 2;

      // Convert: proc-canvas → original-image coords → poster coords
      const imageX = bestCx / PROC_SCALE;
      const imageY = bestCy / PROC_SCALE;
      const imageR = bestR  / PROC_SCALE;

      const result = {
        x: Math.round(offsetX + imageX * posterScale),
        y: Math.round(offsetY + imageY * posterScale),
        r: Math.round(imageR  * posterScale),
      };

      resolve(result);
    };

    img.src = templateDataUrl;
  });
}
