/**
 * cloudUploader.js
 *
 * Handles uploading poster images to cloud hosting providers or local poster server:
 * 1. ImgBB (Free API key, global CDN, direct download)
 * 2. Cloudinary (Free unsigned preset, fl_attachment direct download)
 * 3. Imgur (Client-ID based)
 * 4. Custom webhook / upload endpoint
 * 5. Local Vite poster server + Cloudflare Tunnel fallback
 */

const LOCAL_API = '/api/poster';

/**
 * Upload to ImgBB (Free API key from https://api.imgbb.com/)
 */
export async function uploadToImgBB(dataUrl, apiKey) {
  if (!apiKey) throw new Error('ImgBB API key is required');
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');

  const formData = new FormData();
  formData.append('image', base64);
  formData.append('name', 'MAIH-Poster');

  const resp = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    body: formData,
  });

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || !json.data?.url) {
    throw new Error(json.error?.message || `ImgBB upload failed (${resp.status})`);
  }

  const directUrl = json.data.url;
  return {
    provider: 'imgbb',
    directDownloadUrl: directUrl,
    viewerUrl: json.data.url_viewer || directUrl,
    url: directUrl,
    isPublic: true,
  };
}

/**
 * Upload to Cloudinary using an unsigned upload preset
 */
export async function uploadToCloudinary(dataUrl, cloudName, uploadPreset) {
  if (!cloudName || !uploadPreset) throw new Error('Cloudinary cloud name and upload preset are required');

  const formData = new FormData();
  formData.append('file', dataUrl);
  formData.append('upload_preset', uploadPreset);

  const resp = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
    method: 'POST',
    body: formData,
  });

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || !json.secure_url) {
    throw new Error(json.error?.message || `Cloudinary upload failed (${resp.status})`);
  }

  const secureUrl = json.secure_url;
  // Cloudinary's fl_attachment flag forces browser file download on click/scan
  const directDownloadUrl = secureUrl.replace('/image/upload/', '/image/upload/fl_attachment:MAIH-Poster/');

  return {
    provider: 'cloudinary',
    directDownloadUrl,
    viewerUrl: secureUrl,
    url: directDownloadUrl,
    isPublic: true,
  };
}

/**
 * Upload to Imgur (anonymous API with Client-ID)
 */
export async function uploadToImgur(dataUrl, clientId) {
  if (!clientId) throw new Error('Imgur Client-ID is required');
  const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');

  const formData = new FormData();
  formData.append('image', base64);
  formData.append('type', 'base64');
  formData.append('title', 'Microsoft AI Innovators Hub Poster');

  const resp = await fetch('https://api.imgur.com/3/image', {
    method: 'POST',
    headers: {
      Authorization: `Client-ID ${clientId.trim()}`,
    },
    body: formData,
  });

  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || !json.data?.link) {
    throw new Error(json.data?.error || `Imgur upload failed (${resp.status})`);
  }

  const directUrl = json.data.link;
  return {
    provider: 'imgur',
    directDownloadUrl: directUrl,
    viewerUrl: directUrl,
    url: directUrl,
    isPublic: true,
  };
}

/**
 * Upload to generic custom endpoint (POST multipart/form-data)
 */
export async function uploadToCustomEndpoint(dataUrl, endpointUrl) {
  if (!endpointUrl) throw new Error('Endpoint URL is required');

  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const form = new FormData();
  form.append('image', blob, 'MAIH-Poster.png');

  const resp = await fetch(endpointUrl, { method: 'POST', body: form });
  if (!resp.ok) throw new Error(`Custom upload failed: ${resp.statusText}`);

  const json = await resp.json();
  const url = json?.data?.link || json?.data?.url || json?.url || json?.link;
  if (!url) throw new Error('Upload service did not return a valid image URL');

  return {
    provider: 'custom',
    directDownloadUrl: url,
    viewerUrl: url,
    url,
    isPublic: true,
  };
}

/**
 * Ensures poster image dataUrl is optimized for cloud transfer (< 1.5MB)
 * while preserving high-resolution quality (1446×2048).
 * Avoids serverless/cloud 413 Payload Too Large errors (Netlify 6MB hard limit).
 */
export async function getOptimizedUploadDataUrl(dataUrl) {
  if (!dataUrl) return dataUrl;
  // If already under 1.8MB base64 string length (~1.3MB binary), no compression needed
  if (dataUrl.length < 1800000) return dataUrl;

  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Image decode error'));
      img.src = dataUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0);

    // Export as high-quality JPEG (quality 0.93)
    const optJpg = canvas.toDataURL('image/jpeg', 0.93);
    if (optJpg && optJpg.length > 1000 && optJpg.length < dataUrl.length) {
      return optJpg;
    }
  } catch (err) {
    console.warn('Upload optimization fallback:', err.message);
  }
  return dataUrl;
}

/**
 * Upload to local photobooth server or Netlify backend (/api/poster)
 * Handles both public Cloudflare tunnel URLs, Netlify cloud, and local LAN WiFi fallback
 */
export async function uploadToLocalServer(dataUrl, customIp) {
  const payloadUrl = await getOptimizedUploadDataUrl(dataUrl);

  const resp = await fetch(LOCAL_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: payloadUrl, customIp: customIp || undefined }),
  });

  const contentType = resp.headers.get('content-type') || '';
  if (!resp.ok || !contentType.includes('application/json')) {
    const errorText = await resp.text().catch(() => '');
    throw new Error(`Upload server error (${resp.status}): ${errorText.slice(0, 100) || 'Server unavailable'}`);
  }

  const data = await resp.json();
  if (!data.url) throw new Error('Server did not return a valid URL');

  return {
    provider: 'local',
    directDownloadUrl: data.directDownloadUrl || `${data.url}?download=1`,
    viewerUrl: data.viewerUrl || data.url.replace(/\?.*$/, ''),
    localUrl: data.localUrl || data.url,
    url: data.directDownloadUrl || `${data.url}?download=1`,
    tunnelUrl: data.tunnelUrl || null,
    isPublic: !!data.isPublic || !!data.tunnelUrl,
    serverInfo: data,
  };
}
