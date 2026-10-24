let transcriberPromise = null;

async function getTranscriber() {
  if (!transcriberPromise) {
    transcriberPromise = (async () => {
      const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2');
      env.useBrowserCache = true;
      env.allowLocalModels = false;
      return pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny', {
        dtype: 'q8',
        progress_callback: info => {
          const progress = Number(info?.progress);
          self.postMessage({ type: 'model-progress', status: String(info?.status || ''), progress: Number.isFinite(progress) ? progress : null });
        }
      });
    })().catch(error => { transcriberPromise = null; throw error; });
  }
  return transcriberPromise;
}

self.addEventListener('message', async event => {
  const message = event.data || {};
  if (message.type === 'load') {
    try { await getTranscriber(); self.postMessage({ type: 'ready' }); }
    catch (error) { self.postMessage({ type: 'fatal', message: error?.message || 'Could not load the subtitle model.' }); }
    return;
  }
  if (message.type !== 'transcribe') return;
  try {
    const transcriber = await getTranscriber();
    const audio = message.samples instanceof Float32Array ? message.samples : new Float32Array(message.samples);
    const options = { return_timestamps: 'word', chunk_length_s: 30, stride_length_s: 5, task: 'transcribe' };
    if (message.language && message.language !== 'auto') options.language = message.language;
    const output = await transcriber(audio, options);
    const chunks = Array.isArray(output?.chunks) ? output.chunks.map(item => ({
      timestamp: Array.isArray(item.timestamp) ? item.timestamp : [null, null],
      text: String(item.text || '').trim()
    })).filter(item => item.text) : [];
    self.postMessage({ type: 'result', requestId: message.requestId, text: String(output?.text || '').trim(), chunks });
  } catch (error) {
    self.postMessage({ type: 'request-error', requestId: message.requestId, message: error?.message || 'Transcription failed.' });
  }
});
