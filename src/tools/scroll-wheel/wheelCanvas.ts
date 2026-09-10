import type { WheelSample } from './types';
export function drawSignal(canvas: HTMLCanvasElement, samples: WheelSample[]) {
  const rect = canvas.getBoundingClientRect(); const ratio = window.devicePixelRatio || 1; const width = Math.max(1, rect.width); const height = Math.max(1, rect.height);
  canvas.width = width * ratio; canvas.height = height * ratio; const ctx = canvas.getContext('2d'); if (!ctx) return; ctx.scale(ratio, ratio); ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, width, height); ctx.strokeStyle = '#dbe4ea'; ctx.lineWidth = 1; for (let y = 40; y < height; y += 48) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
  if (!samples.length) { ctx.fillStyle = '#64748b'; ctx.font = '14px system-ui'; ctx.textAlign = 'center'; ctx.fillText('Your scroll signal will appear here', width / 2, height / 2); return; }
  let position = 0; const positions = samples.map((sample) => { position += Math.sign(sample.deltaY) * Math.min(18, Math.max(3, Math.abs(sample.deltaY) / 4)); return position; }); const min = Math.min(...positions, -20); const max = Math.max(...positions, 20); const range = max - min || 1;
  samples.forEach((sample, index) => { const x = samples.length === 1 ? width / 2 : 20 + (index / (samples.length - 1)) * (width - 40); const y = 20 + ((positions[index] - min) / range) * (height - 40); if (index) { const pX = 20 + ((index - 1) / (samples.length - 1)) * (width - 40); const pY = 20 + ((positions[index - 1] - min) / range) * (height - 40); ctx.beginPath(); ctx.strokeStyle = sample.expected ? '#16835c' : '#c2413a'; ctx.lineWidth = 3; ctx.moveTo(pX, pY); ctx.lineTo(x, y); ctx.stroke(); } });
}
