(() => {
  "use strict";
  const BUILD = "20261024-power3";
  let ready = false;
  let reported = false;
  let timer = 0;

  function showRecovery(reason) {
    if (ready || reported || !document.body) return;
    reported = true;
    const panel = document.createElement("aside");
    panel.id = "clipsmithStartupRecovery";
    panel.setAttribute("role", "alert");
    panel.setAttribute("aria-live", "assertive");
    panel.innerHTML = '<div class="clipsmith-recovery-copy"><strong>ClipSmith could not start correctly</strong><span></span><small>Recent button failures have come from a startup error stopping the editor from binding its controls. This build now reports that failure instead of leaving dead buttons silently.</small></div><button type="button">Reload fresh build</button><button type="button" aria-label="Dismiss startup warning">×</button>';
    panel.querySelector("span").textContent = reason || "The editor did not finish starting.";
    const [reload, dismiss] = panel.querySelectorAll("button");
    reload.addEventListener("click", () => {
      const url = new URL(window.location.href);
      url.searchParams.set("clipsmith-recovery", String(Date.now()));
      window.location.replace(url.toString());
    });
    dismiss.addEventListener("click", () => panel.remove());
    document.body.appendChild(panel);
  }

  function onReady() {
    ready = true;
    if (timer) window.clearTimeout(timer);
    const panel = document.getElementById("clipsmithStartupRecovery");
    if (panel) panel.remove();
  }

  window.addEventListener("clipsmith:app-ready", onReady, { once: true });
  window.addEventListener("error", (event) => {
    if (ready) return;
    const filename = String(event.filename || event.target?.src || "");
    const scriptName = filename.split(/[?#]/)[0].split("/").pop();
    const localScript = /^(?:app|workspace-controls|power-tools|runtime-guard)\.js$/i.test(scriptName);
    if (localScript || event.error?.name === "SyntaxError") {
      showRecovery(event.message || "A JavaScript module failed to load.");
    }
  }, true);
  window.addEventListener("unhandledrejection", (event) => {
    if (!ready) showRecovery(event.reason?.message || "An editor module failed while starting.");
  });
  timer = window.setTimeout(() => {
    if (!ready && !window.ClipSmithStudio) {
      showRecovery("Editor startup timed out. A stale or mismatched cached module may be preventing the controls from binding.");
    }
  }, 12000);
  document.documentElement.dataset.clipsmithBuild = BUILD;
})();
