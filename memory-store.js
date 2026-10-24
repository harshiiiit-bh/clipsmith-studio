const DB_NAME = "clipsmith-device-memory";
const DB_VERSION = 1;
const WORKSPACE_KEY = "workspace";
const SOURCE_KEY = "source-video";
let dbPromise;
let saveTimer;

function openDatabase() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error("IndexedDB is unavailable in this browser."));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("records")) db.createObjectStore("records");
      if (!db.objectStoreNames.contains("media")) db.createObjectStore("media");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error || new Error("Could not open local memory."));
    };
    request.onblocked = () => {
      dbPromise = null;
      reject(new Error("Local memory is blocked by another open tab. Close other ClipSmith tabs and retry."));
    };
  });
  return dbPromise;
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Local memory request failed."));
  });
}

function completeTransaction(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Local memory save failed."));
    transaction.onabort = () => reject(transaction.error || new Error("Local memory save was aborted."));
  });
}

export async function saveWorkspaceMemory(record) {
  const db = await openDatabase();
  const tx = db.transaction("records", "readwrite");
  tx.objectStore("records").put(record, WORKSPACE_KEY);
  await completeTransaction(tx);
}

export function queueWorkspaceMemory(record) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveWorkspaceMemory(record).catch(() => {
      // localStorage remains the immediate, small-state fallback if IndexedDB is unavailable.
    });
  }, 250);
}

export async function readWorkspaceMemory() {
  const db = await openDatabase();
  const tx = db.transaction("records", "readonly");
  const record = await requestResult(tx.objectStore("records").get(WORKSPACE_KEY));
  await completeTransaction(tx);
  return record || null;
}

export async function saveSourceMemory(file) {
  if (!file || typeof file.slice !== "function") throw new TypeError("A video file is required.");
  const db = await openDatabase();
  const record = {
    name: String(file.name || "video"),
    type: String(file.type || "application/octet-stream"),
    lastModified: Number(file.lastModified) || Date.now(),
    size: Number(file.size) || 0,
    savedAt: Date.now(),
    blob: file.slice(0, file.size, file.type || "application/octet-stream")
  };
  const tx = db.transaction("media", "readwrite");
  tx.objectStore("media").put(record, SOURCE_KEY);
  await completeTransaction(tx);
  return { name: record.name, size: record.size, savedAt: record.savedAt };
}

export async function readSourceMemory() {
  const db = await openDatabase();
  const tx = db.transaction("media", "readonly");
  const record = await requestResult(tx.objectStore("media").get(SOURCE_KEY));
  await completeTransaction(tx);
  if (!record?.blob) return null;
  return new File([record.blob], record.name || "video", {
    type: record.type || record.blob.type || "application/octet-stream",
    lastModified: Number(record.lastModified) || Date.now()
  });
}

export async function getMemoryStatus() {
  const [workspace, source] = await Promise.all([
    readWorkspaceMemory().catch(() => null),
    (async () => {
      try {
        const db = await openDatabase();
        const tx = db.transaction("media", "readonly");
        const value = await requestResult(tx.objectStore("media").get(SOURCE_KEY));
        await completeTransaction(tx);
        return value || null;
      } catch {
        return null;
      }
    })()
  ]);
  let usage = null, quota = null, persistent = null;
  try {
    const estimate = await navigator.storage?.estimate?.();
    if (estimate) {
      usage = Number.isFinite(estimate.usage) ? estimate.usage : null;
      quota = Number.isFinite(estimate.quota) ? estimate.quota : null;
    }
    if (navigator.storage?.persisted) persistent = await navigator.storage.persisted();
  } catch {}
  return {
    hasWorkspace: Boolean(workspace?.snapshot),
    workspaceUpdatedAt: Number(workspace?.updatedAt) || 0,
    hasSource: Boolean(source?.blob),
    sourceName: source?.name || "",
    sourceSize: Number(source?.size) || 0,
    sourceSavedAt: Number(source?.savedAt) || 0,
    usage, quota, persistent
  };
}

export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {}
  return false;
}

export async function clearSavedMemory() {
  clearTimeout(saveTimer);
  const db = await openDatabase();
  const tx = db.transaction(["records", "media"], "readwrite");
  tx.objectStore("records").clear();
  tx.objectStore("media").clear();
  await completeTransaction(tx);
}
