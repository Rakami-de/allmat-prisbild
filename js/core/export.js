import { loadImage, canvasToBlob, releaseCanvas } from './photo.js';
import { loadRenderAssets, renderItem, renderCollagePage } from './render.js';
import { planPages } from './collage.js';
import { getPhoto } from './storage.js';
import { readyItems } from './batch.js';
import { STORE } from '../config/store.js';

const JPEG_QUALITY = 0.92;

function fileName(index, date = new Date()) {
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
  return `${STORE.filePrefix}-${stamp}-${String(index + 1).padStart(2, '0')}.jpg`;
}

// Renders strictly one photo at a time and drops each decoded image before the next,
// so a 15-photo batch never holds more than one full-size bitmap.
export async function generateAll(batch, { onProgress = () => {}, signal } = {}) {
  const assets = await loadRenderAssets();
  const items = readyItems(batch);
  const canvas = document.createElement('canvas');
  const files = [];
  const loadPhoto = async (item) => {
    const blob = await getPhoto(item.photoKey);
    if (!blob) throw { code: 'photo' };
    return loadImage(blob);
  };
  try {
    if (batch.template === 'lista') {
      // One sheet per page of products; progress still counts products, which is what takes time.
      const pages = planPages(items.length);
      let done = 0;
      for (const [index, page] of pages.entries()) {
        if (signal?.aborted) throw { code: 'cancelled' };
        const pageItems = items.slice(page.start, page.end);
        await renderCollagePage(canvas, {
          items: pageItems, batch, assets,
          pageLabel: pages.length > 1 ? `${index + 1}/${pages.length}` : '',
          loadPhoto: async (item) => {
            if (signal?.aborted) throw { code: 'cancelled' };
            onProgress(done, items.length);
            done += 1;
            return loadPhoto(item);
          },
        });
        const jpeg = await canvasToBlob(canvas, JPEG_QUALITY);
        files.push(new File([jpeg], fileName(index), { type: 'image/jpeg' }));
      }
      onProgress(items.length, items.length);
      return files;
    }

    for (const [index, item] of items.entries()) {
      if (signal?.aborted) throw { code: 'cancelled' };
      onProgress(index, items.length);
      const photo = await loadPhoto(item);
      renderItem(canvas, { item, photo, colorway: batch.colorway, template: batch.template, assets });
      photo.src = '';
      const jpeg = await canvasToBlob(canvas, JPEG_QUALITY);
      files.push(new File([jpeg], fileName(index), { type: 'image/jpeg' }));
    }
    onProgress(items.length, items.length);
    return files;
  } finally {
    releaseCanvas(canvas);
  }
}

export function canShareFiles(files) {
  try {
    return Boolean(navigator.canShare?.({ files }));
  } catch {
    return false;
  }
}

// Must be called synchronously from a tap handler: Safari drops the share permission
// if any slow work happens between the tap and this call.
export async function shareFiles(files) {
  try {
    await navigator.share({ files });
    return 'shared';
  } catch (error) {
    if (error?.name === 'AbortError') return 'dismissed';
    throw { code: 'share', cause: error };
  }
}
