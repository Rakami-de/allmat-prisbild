// Persists the single active batch so an iOS app switch or kill never loses work.

const DB_NAME = 'allmat-prisbild';
const DB_VERSION = 1;
const STATE = 'state';
const PHOTOS = 'photos';
const BATCH_KEY = 'batch';

let db = null;
let dbPromise = null;

export function openStore() {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STATE);
      request.result.createObjectStore(PHOTOS);
    };
    request.onsuccess = () => { db = request.result; resolve(db); };
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function transact(database, storeNames, mode, action) {
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeNames, mode);
    const request = action(tx);
    tx.oncomplete = () => resolve(request?.result);
    tx.onabort = tx.onerror = () => {
      const error = tx.error ?? request?.error;
      reject(error?.name === 'QuotaExceededError' ? { code: 'quota' } : error);
    };
  });
}

// Once the database is open the transaction is created synchronously. That matters for the
// save fired from visibilitychange: iOS can freeze the page before an awaited open resolves.
function run(storeName, mode, action) {
  const start = (database) => transact(database, storeName, mode, (tx) => action(tx.objectStore(storeName)));
  return db ? start(db) : openStore().then(start);
}

// A new photo, its thumbnail and the batch that references them land together or not at all,
// so a kill or a full disk never leaves orphan blobs or an item without pixels.
export async function addPhoto(key, blob, thumb, batch) {
  const database = db ?? await openStore();
  return transact(database, [STATE, PHOTOS], 'readwrite', (tx) => {
    tx.objectStore(PHOTOS).put(blob, key);
    tx.objectStore(PHOTOS).put(thumb, `${key}:t`);
    return tx.objectStore(STATE).put(batch, BATCH_KEY);
  });
}

export const saveBatch = (batch) => run(STATE, 'readwrite', (s) => s.put(batch, BATCH_KEY));
export const loadBatch = () => run(STATE, 'readonly', (s) => s.get(BATCH_KEY));
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
