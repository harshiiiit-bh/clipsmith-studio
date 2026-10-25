const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Number(n) || 0));
const fontName = value => String(value || "Inter").replace(/["\\]/g, "").trim().slice(0, 48) || "Inter";
function textCase(value, mode) {
  const text = String(value || "");
  if (mode === "uppercase") return text.toLocaleUpperCase();
  if (mode === "lowercase") return text.toLocaleLowerCase();
  if (mode === "capitalize") return text.toLocaleLowerCase().replace(/(^|[\s-])([a-z])/g, (_, gap, letter) => gap + letter.toLocaleUpperCase());
  return text;
}
function wrap(ctx, value, maxWidth) {
  const lines = [];
  String(value || "").replace(/\r/g, "").split("\n").forEach(paragraph => {
    let line = "";
    paragraph.split(/\s+/).filter(Boolean).forEach(word => {
      const next = line ? line + " " + word : word;
      if (line && ctx.measureText(next).width > maxWidth) { lines.push(line); line = word; }
      else line = next;
    });
    if (line || !paragraph) lines.push(line);
  });
  return lines.length ? lines : [""];
}
function rounded(ctx, x, y, w, h, r) {
  const radius = Math.min(Math.max(0, r), w / 2, h / 2);
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, radius);
  else {
    ctx.moveTo(x + radius, y); ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius); ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
  }
  ctx.closePath();
}
function alphaColor(value, alpha) {
  const match = String(value || "#111827").match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!match) return String(value || "#111827");
  let h = match[1]; if (h.length === 3) h = h.split("").map(c => c + c).join("");
  return "rgba(" + parseInt(h.slice(0, 2), 16) + "," + parseInt(h.slice(2, 4), 16) + "," + parseInt(h.slice(4, 6), 16) + "," + clamp(alpha, 0, 1) + ")";
}
function drawHeading(ctx, text, style, width, height) {
  if (!String(text || "").trim()) return;
  const scale = width / 420, size = Math.max(12, Number(style.size) || 30) * scale;
  const align = style.align === "left" || style.align === "right" ? style.align : "center";
  const panel = Boolean(style.bgEnabled), pad = panel ? clamp(style.bgPadding == null ? 10 : style.bgPadding, 0, 30) * scale : 0;
  const maxWidth = Math.max(24, width * 0.9 - pad * 2);
  ctx.save();
  const weight = style.weight == null ? (style.bold === false ? 500 : 800) : clamp(style.weight, 100, 900);
  ctx.font = (style.italic ? "italic " : "") + weight + " " + size + "px \"" + fontName(style.font) + "\", sans-serif";
  if ("letterSpacing" in ctx) ctx.letterSpacing = (clamp(style.spacing, -2, 10) * scale) + "px";
  const lines = wrap(ctx, textCase(text, style.transform), maxWidth);
  const lineHeight = size * clamp(style.lineHeight == null ? 1.08 : style.lineHeight, 0.8, 1.5);
  const widths = lines.map(line => ctx.measureText(line).width);
  const boxWidth = Math.min(width * 0.92, Math.max(1, ...widths) + pad * 2);
  const boxHeight = lineHeight * lines.length, x = panel ? width / 2 : align === "left" ? width * 0.05 : align === "right" ? width * 0.95 : width / 2;
  const y = height * clamp(style.positionY == null ? 17 : style.positionY, 4, 90) / 100;
  ctx.translate(x, y); ctx.rotate(clamp(style.rotation, -180, 180) * Math.PI / 180);
  if (panel) {
    ctx.save(); ctx.globalAlpha = clamp(style.bgOpacity == null ? 0.72 : style.bgOpacity, 0, 1);
    ctx.fillStyle = style.bgColor || "#111827";
    rounded(ctx, -boxWidth / 2, -pad, boxWidth, boxHeight + pad * 2, clamp(style.bgRadius == null ? 10 : style.bgRadius, 0, 24) * scale);
    ctx.fill(); ctx.restore();
  }
  const textX = panel ? align === "left" ? -boxWidth / 2 + pad : align === "right" ? boxWidth / 2 - pad : 0 : 0;
  ctx.textAlign = align; ctx.textBaseline = "top"; ctx.globalAlpha = clamp(style.opacity == null ? 1 : style.opacity, 0, 1);
  ctx.fillStyle = style.color || "#ffffff"; ctx.strokeStyle = style.outline || "#000000";
  ctx.lineWidth = Math.max(0, Number(style.outlineWidth) || 0) * scale; ctx.lineJoin = "round";
  const shadow = Math.max(0, Number(style.shadow) || 0) * scale, glow = Math.max(0, Number(style.glow) || 0) * scale;
  ctx.shadowColor = glow > shadow ? style.glowColor || "#8b5cf6" : style.shadowColor || "#000000";
  ctx.shadowBlur = Math.max(shadow, glow); ctx.shadowOffsetY = shadow ? 2 * scale : 0;
  lines.forEach((line, index) => {
    const ly = index * lineHeight;
    if (ctx.lineWidth) ctx.strokeText(line, textX, ly, maxWidth);
    ctx.fillText(line, textX, ly, maxWidth);
    if (style.decoration === "underline" || style.decoration === "line-through") {
      const measured = Math.min(maxWidth, widths[index]);
      const start = align === "center" ? textX - measured / 2 : align === "right" ? textX - measured : textX;
      ctx.save(); ctx.shadowBlur = 0; ctx.strokeStyle = style.color || "#fff"; ctx.lineWidth = Math.max(1, scale);
      const yy = ly + size * (style.decoration === "underline" ? 1.04 : 0.52);
      ctx.beginPath(); ctx.moveTo(start, yy); ctx.lineTo(start + measured, yy); ctx.stroke(); ctx.restore();
    }
  });
  ctx.restore();
}
function drawCaption(ctx, text, style, width, height) {
  if (!String(text || "").trim()) return;
  const variant = String(style.style || "Classic");
  if (variant === "Karaoke") text = String(text).toLocaleUpperCase();
  const size = Math.max(14, Math.min(64, Number(style.size) || Math.min(42, height * 0.035)));
  const maxWidth = width * 0.88;
  ctx.save(); ctx.font = (variant === "Cinematic" ? "500 " : "700 ") + size + "px \"" + fontName(style.font || (variant === "Cinematic" ? "Georgia" : "Inter")) + "\", sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  if (variant === "Karaoke" && "letterSpacing" in ctx) ctx.letterSpacing = (size * 0.01) + "px";
  const lines = wrap(ctx, text, maxWidth), lineHeight = size * (variant === "Cinematic" ? 1.2 : 1.15);
  const blockHeight = lines.length * lineHeight, centerY = height * clamp(style.positionY == null ? 78 : style.positionY, 0, 100) / 100;
  if (variant === "Pop") {
    const px = size * 0.34, py = size * 0.22;
    const widest = Math.min(maxWidth, Math.max(1, ...lines.map(line => ctx.measureText(line).width)));
    ctx.fillStyle = alphaColor("#0a0b10", 0.79);
    rounded(ctx, width / 2 - widest / 2 - px, centerY - blockHeight / 2 - py, widest + 2 * px, blockHeight + 2 * py, size * 0.15);
    ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.fillStyle = style.highlight || "#9e83ff"; ctx.strokeStyle = variant === "Pop" ? "#0a0b10" : "rgba(0,0,0,.82)";
  ctx.lineWidth = variant === "Pop" ? Math.max(4, Math.min(20, size * 0.28)) : 2; ctx.lineJoin = "round";
  ctx.shadowColor = "#000"; ctx.shadowBlur = variant === "Pop" ? 0 : 2; ctx.shadowOffsetY = variant === "Pop" ? 0 : 1;
  lines.forEach((line, index) => {
    const y = centerY - blockHeight / 2 + lineHeight * (index + 0.5);
    if (variant !== "Cinematic") ctx.strokeText(line, width / 2, y, maxWidth);
    ctx.fillText(line, width / 2, y, maxWidth);
  });
  ctx.restore();
}
function drawWatermark(ctx, item, width, height) {
  const text = String(item && item.text || "").trim().slice(0, 80); if (!text) return;
  const size = Math.max(12, Math.min(100, Number(item.size) || 28)) * height / 720;
  const margin = Math.max(12, Math.min(width, height) * 0.035), pos = String(item.position || "bottom-right");
  const left = pos.endsWith("left"), center = pos.endsWith("center"), top = pos.startsWith("top");
  const x = center ? width / 2 : left ? margin : width - margin, y = top ? margin : height - margin;
  ctx.save(); ctx.font = "600 " + size + "px Inter, sans-serif"; ctx.textAlign = center ? "center" : left ? "left" : "right";
  ctx.textBaseline = top ? "top" : "bottom"; ctx.globalAlpha = clamp(item.opacity == null ? 0.72 : item.opacity, 0, 1);
  ctx.fillStyle = item.color || "#fff"; ctx.shadowColor = "rgba(0,0,0,.7)"; ctx.shadowBlur = Math.max(1, size * 0.12);
  ctx.fillText(text, x, y, width * 0.8); ctx.restore();
}
function toPng(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("Could not prepare the export overlay image.")), "image/png"));
}
export async function createExportOverlayPng(options) {
  const width = Math.max(2, Math.round(Number(options && options.width) || 0));
  const height = Math.max(2, Math.round(Number(options && options.height) || 0));
  if (!width || !height) throw new Error("The export frame has invalid dimensions.");
  if (document.fonts && document.fonts.ready) await document.fonts.ready.catch(() => {});
  if (document.fonts && document.fonts.load) {
    const fonts = [];
    if (options.title) fonts.push("800 30px \"" + fontName(options.titleStyle && options.titleStyle.font) + "\"");
    if (options.caption) fonts.push("700 24px \"" + fontName(options.captionStyle && options.captionStyle.font) + "\"");
    await Promise.all(fonts.map(font => document.fonts.load(font).catch(() => [])));
  }
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) throw new Error("Could not create the transparent export overlay.");
  ctx.clearRect(0, 0, width, height);
  if (options.title) drawHeading(ctx, options.title, options.titleStyle || {}, width, height);
  if (options.caption) drawCaption(ctx, options.caption, options.captionStyle || {}, width, height);
  if (options.watermark && options.watermark.text) drawWatermark(ctx, options.watermark, width, height);
  return toPng(canvas);
}
