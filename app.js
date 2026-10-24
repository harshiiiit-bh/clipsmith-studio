// ClipSmith runtime hotfix loader.
// The AI upgrade accidentally used the ID helper on `.export-mode`; that exception
// happened during module initialization and prevented every later click handler from binding.
// Load the last known-good runtime, patch only that selector bug, and keep its module URLs resolvable.
const BASE = "https://harshiiiit-bh.github.io/clipsmith-studio/";
const SOURCE = "https://raw.githubusercontent.com/harshiiiit-bh/clipsmith-studio/a4c79e9061001ef108bfe5f49718873200736d/app.js";

const source = await fetch(SOURCE).then(async response => {
  if (!response.ok) throw new Error(`ClipSmith runtime fetch failed (${response.status})`);
  return response.text();
});

const patched = source
  .replaceAll("$('.export-mode')", "$$('.export-mode')")
  .replace('from "./creator-assistant.js?v=20261024-cs3"', `from "${BASE}creator-assistant.js?v=20261024-cs3"`)
  .replace('from "./editor-tools.js?v=20261024-cs3"', `from "${BASE}editor-tools.js?v=20261024-cs3"`)
  .replace('from "./subtitle-tools.js?v=20261024-ai1"', `from "${BASE}subtitle-tools.js?v=20261024-ai1"`)
  .replace('from "./ai-creator-tools.js?v=20261024-ai1"', `from "${BASE}ai-creator-tools.js?v=20261024-ai1"`)
  .replace('new URL("./transcribe-worker.js?v=20261024-cs3",import.meta.url)', `new URL("${BASE}transcribe-worker.js?v=20261024-cs3")`);

await import(URL.createObjectURL(new Blob([patched], { type: "text/javascript" })));
