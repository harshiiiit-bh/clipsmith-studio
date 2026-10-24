const cleanCueText = value => String(value ?? '').replace(/[\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Group word-level ASR timestamps into readable subtitle lines. */
export function groupSubtitleWords(words, options = {}) {
  const maxWords = Math.max(1, Math.floor(Number(options.maxWords) || 7));
  const maxDuration = Math.max(0.5, Number(options.maxDuration) || 3.2);
  const maxChars = Math.max(12, Math.floor(Number(options.maxChars) || 42));
  const minDuration = Math.max(0.1, Number(options.minDuration) || 0.35);
  const normalized = (Array.isArray(words) ? words : []).map(item => ({
    start: Number(item?.start), end: Number(item?.end), text: cleanCueText(item?.text)
  })).filter(item => Number.isFinite(item.start) && Number.isFinite(item.end) && item.end > item.start && item.start >= 0 && item.text);
  const result = []; let group = [];
  const flush = () => {
    if (!group.length) return;
    const start = group[0].start, end = Math.max(start + minDuration, group[group.length - 1].end);
    result.push({ start: Number(start.toFixed(3)), end: Number(end.toFixed(3)), text: group.map(x => x.text).join(' ').replace(/\s+([,.!?;:])/g, '$1') });
    group = [];
  };
  for (const item of normalized) {
    const candidate = [...group, item];
    const text = candidate.map(x => x.text).join(' ');
    const duration = item.end - (group[0]?.start ?? item.start);
    if (group.length && (candidate.length > maxWords || text.length > maxChars || duration > maxDuration)) flush();
    group.push(item);
    if (item.text.match(/[.!?。！？]$/) || group.length >= maxWords) flush();
  }
  flush();
  return result;
}

export function formatSrtTimestamp(seconds) {
  const millis = Math.max(0, Math.round((Number(seconds) || 0) * 1000));
  const h = Math.floor(millis / 3600000), m = Math.floor(millis % 3600000 / 60000), s = Math.floor(millis % 60000 / 1000), ms = millis % 1000;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms).padStart(3,'0')}`;
}

export function createSrt(cues) {
  return (Array.isArray(cues) ? cues : []).filter(cue => Number.isFinite(Number(cue?.start)) && Number.isFinite(Number(cue?.end)) && Number(cue.end) > Number(cue.start) && cleanCueText(cue.text)).map((cue, index) => `${index + 1}\n${formatSrtTimestamp(cue.start)} --> ${formatSrtTimestamp(cue.end)}\n${cleanCueText(cue.text)}`).join('\n\n') + ((cues ?? []).length ? '\n' : '');
}

/** Decode little-endian signed PCM16 WAV produced by FFmpeg's audio extractor. */
export function wavToFloat32(input) {
  const buffer = input instanceof ArrayBuffer ? input : input?.buffer?.slice(input.byteOffset, input.byteOffset + input.byteLength);
  if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 44) throw new Error('The extracted audio chunk is not a valid WAV file.');
  const view = new DataView(buffer);
  const fourCC = offset => String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
  if (fourCC(0) !== 'RIFF' || fourCC(8) !== 'WAVE') throw new Error('Unsupported WAV header.');
  let offset = 12, dataStart = -1, dataSize = 0, format = 0, bits = 0, channels = 0;
  while (offset + 8 <= buffer.byteLength) {
    const id = fourCC(offset), size = view.getUint32(offset + 4, true), body = offset + 8;
    if (body + size > buffer.byteLength) break;
    if (id === 'fmt ' && size >= 16) { format = view.getUint16(body, true); channels = view.getUint16(body + 2, true); bits = view.getUint16(body + 14, true); }
    if (id === 'data') { dataStart = body; dataSize = size; break; }
    offset = body + size + (size % 2);
  }
  if (format !== 1 || bits !== 16 || channels < 1 || dataStart < 0) throw new Error('Auto subtitles need PCM16 WAV audio; try a supported video format.');
  const count = Math.floor(dataSize / 2), pcm = new Float32Array(count);
  for (let i = 0; i < count; i++) pcm[i] = view.getInt16(dataStart + i * 2, true) / 32768;
  if (!pcm.length) throw new Error('No audio samples were found in this chunk.');
  if (channels === 1) return pcm;
  const mono = new Float32Array(Math.floor(pcm.length / channels));
  for (let i = 0; i < mono.length; i++) { let sum = 0; for (let ch = 0; ch < channels; ch++) sum += pcm[i * channels + ch]; mono[i] = sum / channels; }
  return mono;
}

const assSafeText = value => String(value ?? '').replace(/\u0000/g, '').replace(/\r\n?/g, '\n').replace(/\\/g, '\\\\').replace(/\{/g, '\\{').replace(/\}/g, '\\}').replace(/\n/g, '\\N').trim();
const assColor = value => { const hex = String(value || '#ffffff').replace('#','').padEnd(6,'f').slice(0,6); const r=hex.slice(0,2),g=hex.slice(2,4),b=hex.slice(4,6); return `&H00${b}${g}${r}`.toUpperCase(); };
const assTime = value => { const cs=Math.max(0,Math.round((Number(value)||0)*100)); const h=Math.floor(cs/360000),m=Math.floor(cs%360000/6000),s=Math.floor(cs%6000/100),fraction=cs%100; return `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}.${String(fraction).padStart(2,'0')}`; };

/** Create a portable ASS subtitle track with a persistent heading and timecoded captions. */
export function createAssDocument({ title = '', duration = 0, width = 1280, height = 720, cues = [], titleStyle = {}, subtitleStyle = {} } = {}) {
  const w=Math.max(2,Math.round(Number(width)||1280)),h=Math.max(2,Math.round(Number(height)||720));
  const titleSize=Math.max(14,Math.min(108,Number(titleStyle.size)||32)),captionSize=Math.max(14,Math.min(64,Number(subtitleStyle.size)||Math.min(42,h*.035)));
  const titleFont=String(titleStyle.font||'Inter').replace(/[^\w -]/g,'').slice(0,48)||'Arial',captionFont=String(subtitleStyle.font||'Inter').replace(/[^\w -]/g,'').slice(0,48)||'Arial';
  const titleColor=assColor(titleStyle.color||'#ffffff'),titleOutline=assColor(titleStyle.outline||'#000000'),captionColor=assColor(subtitleStyle.highlight||'#9e83ff');
  const titleLine=assSafeText(title),total=Math.max(.5,Number(duration)||.5),marginL=Math.round(w*.055),marginV=Math.round(h*(100-clampAssPosition(titleStyle.positionY,17))/100);
  const captionMargin=Math.round(h*(100-clampAssPosition(subtitleStyle.positionY,82))/100);
  const header=`[Script Info]\nScriptType: v4.00+\nPlayResX: ${w}\nPlayResY: ${h}\nScaledBorderAndShadow: yes\nWrapStyle: 2\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Heading,${titleFont},${Math.round(titleSize)},${titleColor},${titleColor},${titleOutline},&H88000000,-1,0,0,0,100,100,0,0,1,${Math.max(1,Math.round(titleSize*.09))},2,8,${marginL},${marginL},${marginV},1\nStyle: Captions,${captionFont},${Math.round(captionSize)},${captionColor},${captionColor},&H00000000,&HAA000000,-1,0,0,0,100,100,0,0,1,2,1,2,${marginL},${marginL},${captionMargin},1\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;
  const events=[];
  if(titleLine)events.push(`Dialogue: 0,${assTime(0)},${assTime(total)},Heading,,0,0,0,,${titleLine}`);
  for(const cue of (Array.isArray(cues)?cues:[])){const start=Number(cue?.start),end=Number(cue?.end),text=assSafeText(cue?.text);if(!text||!Number.isFinite(start)||!Number.isFinite(end)||end<=start)continue;events.push(`Dialogue: 1,${assTime(start)},${assTime(end)},Captions,,0,0,0,,${text}`)}
  return `${header}\n${events.join('\n')}\n`;
}
function clampAssPosition(value,fallback){const n=Number(value);return Number.isFinite(n)?Math.max(0,Math.min(100,n)):fallback}
