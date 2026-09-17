// Persists the single active batch so an iOS app switch or kill never loses work.

const DB_NAME = 'allmat-prisbild';
const DB_VERSION = 1;
const STATE = 'state';
const PHOTOS = 'photos';
const BATCH_KEY = 'batch';

let dbPromise = null;

function openStore() {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STATE);
      request.result.createObjectStore(PHOTOS);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

async function run(storeName, mode, action) {
  const db = await openStore();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const request = action(tx.objectStore(storeName));
    tx.oncomplete = () => resolve(request?.result);
    tx.onabort = tx.onerror = () => {
      const error = tx.error ?? request?.error;
      reject(error?.name === 'QuotaExceededError' ? { code: 'quota' } : error);
    };
  });
}

export const saveBatch = (batch) => run(STATE, 'readwrite', (s) => s.put(batch, BATCH_KEY));
export const loadBatch = () => run(STATE, 'readonly', (s) => s.get(BATCH_KEY));
export const putPhoto = (key, blob) => run(PHOTOS, 'readwrite', (s) => s.put(blob, key));
export const getPhoto = (key) => run(PHOTOS, 'readonly', (s) => s.get(key));
export const deletePhoto = (key) => run(PHOTOS, 'readwrite', (s) => s.delete(key));

export async function clearAll() {
  await run(STATE, 'readwrite', (s) => s.clear());
  await run(PHOTOS, 'readwrite', (s) => s.clear());
}

export async function requestPersistence() {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
