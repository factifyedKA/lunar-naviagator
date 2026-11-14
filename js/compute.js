// Front door for heavy calculations: sends jobs to the Web Worker and returns Promises.
// Falls back to running on the main thread if the worker cannot start (very old browsers).

import { runJob } from './jobs.js';

let worker = null;
let workerBroken = false;
let seq = 0;
const pending = new Map();

function startWorker() {
  try {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (ev) => {
      const job = pending.get(ev.data.id);
      if (!job) return;
      pending.delete(ev.data.id);
      if (ev.data.ok) job.resolve(ev.data.result); else job.reject(new Error(ev.data.error));
    };
    worker.onerror = (ev) => {
      // the worker could not load: finish every waiting job on the main thread instead
      if (ev && ev.preventDefault) ev.preventDefault();
      workerBroken = true;
      worker = null;
      for (const [id, job] of pending) {
        pending.delete(id);
        runJob(job.type, job.args).then((r) => job.resolve(r.result), job.reject);
      }
    };
  } catch {
    workerBroken = true;
  }
}

function call(type, args) {
  if (!worker && !workerBroken) startWorker();
  if (workerBroken) return runJob(type, args).then((r) => r.result);
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject, type, args });
    worker.postMessage({ id, type, args });
  });
}

/** Visibility time series for site models: see computeSeries() in js/metrics.js. */
export const seriesJob = (models, start, hours, emin) => call('series', { models, start, hours, emin });
/** Terrain horizon mask for a custom point: { mask: Float32Array(360), height }. */
export const maskJob = (lat, lon) => call('mask', { lat, lon });
