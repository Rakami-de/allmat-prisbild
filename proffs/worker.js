// Runs the segmentation model off the main thread so the page never freezes.
import * as ort from 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/ort.wasm.min.mjs';

ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/';
// GitHub Pages cannot send the COOP/COEP headers that threads need, so stay single-threaded.
ort.env.wasm.numThreads = 1;

const CACHE = 'allmat-proffs-models-v1';
const sessions = new Map();

async function fetchModel(url) {
  const cache = await caches.open(CACHE).catch(() => null);
  const hit = await cache?.match(url);
  if (hit) return { bytes: new Uint8Array(await hit.arrayBuffer()), cached: true };

  const response = await fetch(url);
  if (!response.ok) throw new Error(`model download failed (${response.status})`);
  const total = Number(response.headers.get('content-length')) || 0;
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    postMessage({ type: 'download', received, total });
  }
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  // Best effort: a full disk must not break the run that already has the bytes.
  await cache?.put(url, new Response(bytes.slice().buffer, { headers: { 'content-type': 'application/octet-stream' } })).catch(() => {});
  return { bytes, cached: false };
}

async function sessionFor(model) {
  if (sessions.has(model.id)) return { session: sessions.get(model.id), loadMs: 0, cached: true };
  const started = performance.now();
  const { bytes, cached } = await fetchModel(model.url);
  postMessage({ type: 'status', status: 'starting' });
  const session = await ort.InferenceSession.create(bytes, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' });
  // Only one model stays in memory: an iPhone tab has little to spare.
  for (const [id, old] of sessions) { await old.release?.(); sessions.delete(id); }
  sessions.set(model.id, session);
  return { session, loadMs: performance.now() - started, cached };
}

onmessage = async ({ data }) => {
  if (data.type !== 'run') return;
  try {
    const { model, input, size } = data;
    const { session, loadMs, cached } = await sessionFor(model);
    postMessage({ type: 'status', status: 'running' });
    const started = performance.now();
    const tensor = new ort.Tensor('float32', input, [1, 3, size, size]);
    const result = await session.run({ [session.inputNames[0]]: tensor });
    const mask = result[session.outputNames[0]].data;
    const out = new Float32Array(mask.length);
    // Stretch to the full 0…1 range; the models rarely reach either end on their own.
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < mask.length; i += 1) { if (mask[i] < min) min = mask[i]; if (mask[i] > max) max = mask[i]; }
    const span = max - min || 1;
    for (let i = 0; i < mask.length; i += 1) out[i] = (mask[i] - min) / span;
    postMessage({ type: 'done', mask: out, loadMs, runMs: performance.now() - started, cached }, [out.buffer]);
  } catch (error) {
    postMessage({ type: 'error', message: String(error?.message ?? error) });
  }
};
