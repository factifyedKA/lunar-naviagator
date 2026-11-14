// Web Worker: runs the heavy calculations off the main thread so the page never freezes.
// Messages in:  { id, type: 'series' | 'mask', args }
// Messages out: { id, ok: true, result } or { id, ok: false, error }
import { runJob } from './jobs.js';

self.onmessage = async (ev) => {
  const { id, type, args } = ev.data;
  try {
    const { result, transfer } = await runJob(type, args);
    self.postMessage({ id, ok: true, result }, transfer);
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err && err.message ? err.message : err) });
  }
};
