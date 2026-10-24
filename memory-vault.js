const DB_NAME = "clipsmith-memory-v1";
const DB_VERSION = 1;
const SESSION_KEY = "current-session";
const MEDIA_KEY = "current-source";
let dbPromise;
let snapshotTimer;
let mediaWriteQueue = Promise.resolve();

function openDatabase() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!("indexedDB" in globalThis)) {
      reject(new Error("IndexedDB is unavailable in this browser"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("sessions")) db.createObjectStore("sessions", { keyPath: "id" });
      if (!db.objectStoreNames.contains("media")) db.createObjectStore("media", { keyPath: "id" });
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = undefined;
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error || new Error("Could not open local memory"));
    request.onblocked = () => reject(new Error("Local memory is busy in another ClipSmith tab"));
  });
  dbPromise.catch(() => { dbPromise = undefined; });
  return dbPromise;
}

async function runRequest(storeName, mode, action) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let request;
    try {
      request = action(store);
    } catch (error) {
      reject(error);
      return;
    }
    tx.oncomplete = () => resolve(request?.result ?? null);
    tx.onerror = () => reject(tx.error || request?.error || new Error("Local memory transaction failed"));
    tx.onabort = () => reject(tx.error || new Error("Local memory transaction was aborted"));
  });
}

export function scheduleCurrentSession(snapshot) {
  clearTimeout(snapshotTimer);
  snapshotTimer = setTimeout(() => {
    saveCurrentSession(snapshot).catch(() => {
      // The app's synchronous localStorage recovery remains a fallback.
    });
  }, 550);
}

export async function saveCurrentSession(snapshot) {
  return runRequest("sessions", "readwrite", store => store.put({
    id: SESSION_KEY,
    snapshot: structuredClone(snapshot),
    updatedAt: Date.now()
  }));
}

export async function loadCurrentSession() {
  return runRequest("sessions", "readonly", store => store.get(SESSION_KEY));
}

async function writeCurrentMedia(file) {
  if (!(file instanceof Blob)) throw new TypeError("A video file is required to remember media");
  return runRequest("media", "readwrite", store => store.put({
    id: MEDIA_KEY,
    blob: file.slice(0, file.size, file.type || "application/octet-stream"),
    name: typeof file.name === "string" ? file.name : "video.mp4",
    type: file.type || "video/mp4",
    size: file.size,
    lastModified: Number(file.lastModified) || Date.now(),
    savedAt: Date.now()
  }));
}

export function storeCurrentMedia(file) {
  // Serialize writes so quickly switching files cannot leave an older file as the saved source.
  mediaWriteQueue = mediaWriteQueue.catch(() => {}).then(() => writeCurrentMedia(file));
  return mediaWriteQueue;
}

export async function loadCurrentMedia() {
  return runRequest("media", "readonly", store => store.get(MEDIA_KEY));
}

export async function getCurrentMemoryInfo() {
  const [session, media, estimate] = await Promise.all([
    loadCurrentSession(),
    loadCurrentMedia(),
    navigator.storage?.estimate?.().catch(() => null) ?? Promise.resolve(null)
  ]);
  return {
    hasSession: Boolean(session?.snapshot),
    hasMedia: Boolean(media?.blob),
    mediaName: media?.name || "",
    mediaBytes: Number(media?.size) || 0,
    usageBytes: Number(estimate?.usage) || 0,
    quotaBytes: Number(estimate?.quota) || 0
  };
}

export async function clearCurrentMemory() {
  clearTimeout(snapshotTimer);
  snapshotTimer = undefined;
  await mediaWriteQueue.catch(() => {});
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["sessions", "media"], "readwrite");
    tx.objectStore("sessions").clear();
    tx.objectStore("media").clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Could not clear local memory"));
    tx.onabort = () => reject(tx.error || new Error("Clearing local memory was cancelled"));
  });
}

export async function flushCurrentSession(snapshot) {
  clearTimeout(snapshotTimer);
  return saveCurrentSession(snapshot);
}
