// Turns a camera/library file into a small, correctly oriented JPEG blob.
// Decoding goes through <img> because it honours EXIF orientation on iOS;
// createImageBitmap(blob) has an open WebKit bug that ignores it.

const MAX_EDGE = 2160;
const STORED_QUALITY = 0.9;
const THUMB_EDGE = 360;

export async function loadImage(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    // The decoded image keeps its pixels; the URL is only needed until decode() settles.
    URL.revokeObjectURL(url);
  }
}

export async function decodePhoto(file) {
  let img;
  try {
    img = await loadImage(file);
  } catch {
    throw { code: 'photo' };
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(img, 0, 0, width, height);
  const blob = await canvasToBlob(canvas, STORED_QUALITY);

  // Grid thumbnails: showing fifteen 2160px JPEGs at once is what gets a PWA killed on iOS.
  const thumbScale = THUMB_EDGE / Math.min(width, height);
  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = Math.round(width * thumbScale);
  thumbCanvas.height = Math.round(height * thumbScale);
  thumbCanvas.getContext('2d').drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
  const thumb = await canvasToBlob(thumbCanvas, 0.8);

  releaseCanvas(canvas);
  releaseCanvas(thumbCanvas);
  return { blob, thumb, width, height };
}

export function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject({ code: 'photo' })), 'image/jpeg', quality);
  });
}

// iOS keeps canvas backing stores alive until they are shrunk; do it explicitly.
export function releaseCanvas(canvas) {
  canvas.width = 0;
  canvas.height = 0;
}
