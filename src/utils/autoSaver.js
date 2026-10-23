/**
 * autoSaver.js
 *
 * Handles automatic saving of generated posters:
 * 1. File System Access API (Chrome/Edge): Saves directly into the dedicated
 *    "AI Innovators Hub Posters" folder on the user's filesystem.
 * 2. Directory Handle Persistence: Saves the directory handle in IndexedDB so the
 *    user only needs to select the folder once per session/browser.
 * 3. Duplicate Handling: Checks for existing files and appends incrementing suffixes.
 * 4. Browser Download Fallback: Automatically triggers browser download if the
 *    File System Access API is unavailable or folder permission is not yet granted.
 */

const DB_NAME = 'MAIH_PhotoBooth_DB';
const DB_VERSION = 1;
const STORE_NAME = 'settings';
const DIR_KEY = 'postersDirectoryHandle';
const FOLDER_NAME = 'AI Innovators Hub Posters';

// ---- Date / Filename Formatter ----
export function formatPosterFilename(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `AI_Poster_${yyyy}-${mm}-${dd}_${hh}-${min}-${ss}.png`;
}

// ---- Check browser support ----
export function isFileSystemAccessSupported() {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

// ---- IndexedDB Helper ----
function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getStoredDirectoryHandle() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(DIR_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function storeDirectoryHandle(handle) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(handle, DIR_KEY);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Failed to store directory handle in IndexedDB:', err);
    return false;
  }
}

export async function clearStoredDirectoryHandle() {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(DIR_KEY);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return false;
  }
}

// ---- Verify / Request Permission ----
export async function verifyPermission(fileHandle, readWrite = true) {
  if (!fileHandle) return false;
  const options = {};
  if (readWrite) options.mode = 'readwrite';

  try {
    if ((await fileHandle.queryPermission(options)) === 'granted') {
      return true;
    }
    // Only attempt requestPermission if user interaction is currently active (prevents SecurityError)
    if (typeof navigator !== 'undefined' && navigator.userActivation && !navigator.userActivation.isActive) {
      return false;
    }
    if ((await fileHandle.requestPermission(options)) === 'granted') {
      return true;
    }
  } catch (err) {
    console.warn('Permission query/request error:', err?.message || err);
  }
  return false;
}

// ---- Request User to Pick Folder ----
export async function pickPostersDirectory() {
  if (!isFileSystemAccessSupported()) {
    throw new Error('File System Access API is not supported in this browser. Fallback automatic downloads will be used.');
  }

  // Open directory picker
  const chosenHandle = await window.showDirectoryPicker({
    id: 'maih-posters-dir',
    mode: 'readwrite',
    startIn: 'pictures',
  });

  // If the user selected a folder that is NOT already named "AI Innovators Hub Posters",
  // automatically create / use a subfolder named "AI Innovators Hub Posters" inside it
  let targetHandle = chosenHandle;
  if (chosenHandle.name !== FOLDER_NAME) {
    try {
      targetHandle = await chosenHandle.getDirectoryHandle(FOLDER_NAME, { create: true });
    } catch {
      // If creating subfolder fails, save directly in chosen directory
      targetHandle = chosenHandle;
    }
  }

  await storeDirectoryHandle(targetHandle);
  return targetHandle;
}

// ---- Convert Data URL to Blob ----
export function dataUrlToBlob(dataUrl) {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const binary = atob(parts[1]);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    array[i] = binary.charCodeAt(i);
  }
  return new Blob([array], { type: mime });
}

// ---- Save Poster directly to Directory Handle ----
export async function savePosterToDirectory(dirHandle, dataUrl, preferredFilename) {
  const filename = preferredFilename || formatPosterFilename();

  // Find a non-conflicting filename
  const baseName = filename.replace(/\.png$/i, '');
  let finalFilename = filename;
  let counter = 1;

  while (true) {
    try {
      // Attempt to check if file already exists
      await dirHandle.getFileHandle(finalFilename, { create: false });
      // Exists! Increment filename
      finalFilename = `${baseName}_${counter}.png`;
      counter++;
    } catch {
      // NotFoundError means the filename is available
      break;
    }
  }

  // Create and write to file
  const fileHandle = await dirHandle.getFileHandle(finalFilename, { create: true });
  const writable = await fileHandle.createWritable();
  const blob = dataUrlToBlob(dataUrl);
  await writable.write(blob);
  await writable.close();

  return {
    success: true,
    filename: finalFilename,
    folderName: dirHandle.name,
    method: 'filesystem',
  };
}

// ---- Fallback: Programmatic Browser Download ----
export function savePosterFallback(dataUrl, preferredFilename) {
  const filename = preferredFilename || formatPosterFilename();
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  return {
    success: true,
    filename,
    folderName: 'Downloads',
    method: 'fallback',
  };
}

// ---- Main Auto-Save Dispatcher ----
export async function autoSavePoster(dataUrl, preferredDirHandle = null) {
  let dirHandle = preferredDirHandle;

  if (!dirHandle && isFileSystemAccessSupported()) {
    const stored = await getStoredDirectoryHandle();
    if (stored) {
      const hasPermission = await verifyPermission(stored, true);
      if (hasPermission) {
        dirHandle = stored;
      }
    }
  }

  // If valid directory handle available, write silently directly into it
  if (dirHandle) {
    try {
      return await savePosterToDirectory(dirHandle, dataUrl);
    } catch (err) {
      console.warn('Failed to save to directory handle, falling back to browser download:', err);
    }
  }

  // Fallback: Trigger instant automatic download
  return savePosterFallback(dataUrl);
}
