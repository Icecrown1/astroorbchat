// Шаринг-карточки: рисуем PNG на canvas в фирменном стиле и отправляем
// нативной карточкой Telegram (фото + кнопка с реф-ссылкой) через /api/share/image.
import { apiRequest } from '@/lib/queryClient';

export const SHARE_W = 1080;
export const SHARE_H = 1350;

const BG = '#0B0D14';
const INK = '#EDEAF5';
const MUTED = '#8B8A99';
const GOLD = '#E8C36B';
const IRIS = '#7C5CFC';

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Фон: тёмный космос, туманность, звёздная пыль */
export function drawCosmicBg(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, SHARE_W, SHARE_H);

  const neb = ctx.createRadialGradient(SHARE_W / 2, 140, 60, SHARE_W / 2, 140, 760);
  neb.addColorStop(0, 'rgba(124,92,252,0.32)');
  neb.addColorStop(0.55, 'rgba(124,92,252,0.10)');
  neb.addColorStop(1, 'rgba(124,92,252,0)');
  ctx.fillStyle = neb;
  ctx.fillRect(0, 0, SHARE_W, SHARE_H);

  let seed = 42;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 110; i++) {
    const x = rnd() * SHARE_W, y = rnd() * SHARE_H;
    const r = rnd() < 0.75 ? 1.6 : 2.6;
    ctx.globalAlpha = 0.18 + rnd() * 0.5;
    ctx.fillStyle = rnd() < 0.72 ? GOLD : '#C8BEFF';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  maxWidth: number, lineHeight: number, maxLines = 3
): number {
  const words = text.split(/\s+/);
  let line = '', lines: string[] = [];
  for (const w of words) {
    const probe = line ? `${line} ${w}` : w;
    if (ctx.measureText(probe).width > maxWidth && line) {
      lines.push(line); line = w;
      if (lines.length === maxLines) break;
    } else line = probe;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && ctx.measureText(lines[maxLines - 1]).width > maxWidth - 40) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s?\S+$/, '…');
  }
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return y + lines.length * lineHeight;
}

function roundedPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Карта таро с рамкой и скруглением; reversed — вверх ногами */
export async function drawTarotCard(
  ctx: CanvasRenderingContext2D,
  cardId: string, cx: number, cy: number, w: number, rotationDeg: number, reversed: boolean
) {
  const h = w * 1.5;
  let img: HTMLImageElement | null = null;
  try { img = await loadImage(`/tarot/${cardId}.webp`); } catch { /* noop */ }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotationDeg * Math.PI) / 180);
  if (reversed) ctx.rotate(Math.PI);
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 26; ctx.shadowOffsetY = 10;
  roundedPath(ctx, -w / 2, -h / 2, w, h, 16);
  ctx.fillStyle = '#141824'; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.save();
  roundedPath(ctx, -w / 2, -h / 2, w, h, 16);
  ctx.clip();
  if (img) ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
  roundedPath(ctx, -w / 2, -h / 2, w, h, 16);
  ctx.strokeStyle = 'rgba(232,195,107,0.65)'; ctx.lineWidth = 3; ctx.stroke();
  ctx.restore();
}

/** Подвал: CTA + вордмарк */
export async function drawFooter(ctx: CanvasRenderingContext2D, cta: string) {
  ctx.textAlign = 'center';
  ctx.fillStyle = MUTED;
  ctx.font = '30px Inter, sans-serif';
  ctx.fillText(cta, SHARE_W / 2, SHARE_H - 130);
  try {
    const wm = await loadImage('/brand/wordmark.svg');
    const w = 320, h = w * (wm.height / wm.width || 0.23);
    ctx.drawImage(wm, (SHARE_W - w) / 2, SHARE_H - 100, w, h);
  } catch {
    ctx.fillStyle = INK;
    ctx.font = '36px Prata, serif';
    ctx.fillText('astroorbi', SHARE_W / 2, SHARE_H - 60);
  }
}

export async function fontsReady() {
  try {
    await Promise.all([
      (document as any).fonts.load('44px Prata'),
      (document as any).fonts.load('30px Inter'),
      (document as any).fonts.ready,
    ]);
  } catch { /* noop */ }
}

export function makeCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = SHARE_W; canvas.height = SHARE_H;
  const ctx = canvas.getContext('2d')!;
  return { canvas, ctx };
}

/** Отправка: Telegram-карточка либо скачивание файла (dev-браузер) */
export async function sendShareImage(canvas: HTMLCanvasElement, caption: string, locale: string): Promise<'shared' | 'downloaded' | 'failed'> {
  const dataUrl = canvas.toDataURL('image/png');
  const wa = (window as any).Telegram?.WebApp;
  let url: string | null = null;
  try {
    const resp = await apiRequest('POST', '/api/share/image', { image: dataUrl, caption, locale });
    url = resp?.data?.url || null;
    if (resp.ok && resp.data?.preparedMessageId && wa?.shareMessage) {
      wa.shareMessage(resp.data.preparedMessageId);
      return 'shared';
    }
  } catch { /* фолбэк ниже */ }
  // Телефон в Telegram: сохранение в галерею через нативный downloadFile (Bot API 7.10+)
  if (url && wa?.downloadFile) {
    try { wa.downloadFile({ url, file_name: 'astroorbi.png' }); return 'downloaded'; } catch { /* дальше */ }
  }
  try {
    const a = document.createElement('a');
    a.href = dataUrl; a.download = 'astroorbi.png'; a.click();
    return 'downloaded';
  } catch { return 'failed'; }
}

export const shareColors = { BG, INK, MUTED, GOLD, IRIS };
