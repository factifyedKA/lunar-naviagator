// Export helpers: download text (CSV) and pictures (PNG), and share the current link.

/** Offers a file for download (works in Safari on iPad). */
export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const cell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Builds CSV text.
 * @param meta  lines of background information, written first as "# ..." comment rows
 * @param rows  array of arrays; the first row is the header
 */
export function toCsv(meta, rows) {
  return [...meta.map((m) => `# ${m}`), ...rows.map((r) => r.map(cell).join(','))].join('\r\n') + '\r\n';
}

export function downloadCsv(filename, meta, rows) {
  downloadBlob(filename, new Blob([toCsv(meta, rows)], { type: 'text/csv;charset=utf-8' }));
}

/**
 * Saves one or more canvases as a single PNG with a dark background, a title and a
 * credit line (the canvases themselves are transparent between their parts).
 * @param blocks [{ canvas, label }] stacked top to bottom
 */
export function downloadPng(filename, title, blocks, footnote = '') {
  const scale = 2;
  const pad = 20;
  const width = Math.max(...blocks.map((b) => b.canvas.clientWidth)) + pad * 2;
  const height = pad + 34 + blocks.reduce((a, b) => a + b.canvas.clientHeight + (b.label ? 26 : 0) + 12, 0) + 34 + pad;
  const out = document.createElement('canvas');
  out.width = width * scale;
  out.height = height * scale;
  const ctx = out.getContext('2d');
  ctx.scale(scale, scale);
  ctx.fillStyle = '#0b0f1a';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#e8eef8';
  ctx.textBaseline = 'top';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText(title, pad, pad);
  let y = pad + 34;
  for (const b of blocks) {
    if (b.label) {
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillText(b.label, pad, y);
      y += 26;
    }
    ctx.drawImage(b.canvas, pad, y, b.canvas.clientWidth, b.canvas.clientHeight);
    y += b.canvas.clientHeight + 12;
  }
  ctx.fillStyle = '#9aa7bd';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText(`${footnote} Lunar Landing Site Navigator · terrain: NASA LRO/LOLA · ephemeris: astronomy-engine`.trim(), pad, y + 6);
  out.toBlob((blob) => { if (blob) downloadBlob(filename, blob); }, 'image/png');
}

/** Copies the page link (which holds the whole app state); falls back to the share sheet. */
export async function shareLink(url, say) {
  try {
    await navigator.clipboard.writeText(url);
    say('Link copied. Anyone who opens it sees exactly this view.');
    return;
  } catch { /* clipboard not allowed: try the share sheet */ }
  try {
    if (navigator.share) { await navigator.share({ title: 'Lunar Landing Site Navigator', url }); return; }
  } catch { return; /* the user closed the share sheet */ }
  say('Copy the address from the browser bar to share this view.');
}

/** "Malapert Massif" -> "malapert-massif" for file names. */
export const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
