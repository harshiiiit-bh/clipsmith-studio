/* Desktop-only workspace controls. The editing engine remains in app.js. */
const shell = document.querySelector(".app-shell");
const focusButton = document.getElementById("focusPreviewBtn");
const desktopViewport = window.matchMedia("(min-width: 821px)");

if (shell && focusButton) {
  const buttonLabel = focusButton.querySelector("b");

  const syncFocusControl = () => {
    const active = desktopViewport.matches && shell.classList.contains("focus-preview");
    focusButton.setAttribute("aria-pressed", String(active));
    focusButton.setAttribute(
      "aria-label",
      active ? "Exit preview focus mode" : "Enter preview focus mode"
    );
    focusButton.title = active
      ? "Return to the full editing workspace"
      : "Expand the preview workspace";
    if (buttonLabel) buttonLabel.textContent = active ? "Exit focus" : "Focus";
  };

  focusButton.addEventListener("click", () => {
    if (!desktopViewport.matches) return;
    shell.classList.toggle("focus-preview");
    syncFocusControl();
  });

  desktopViewport.addEventListener("change", syncFocusControl);

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const isTyping = target instanceof HTMLElement && (
      target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
    );

    if (event.key === "Escape" && shell.classList.contains("focus-preview")) {
      shell.classList.remove("focus-preview");
      syncFocusControl();
      return;
    }

    if (
      !isTyping &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      event.key.toLowerCase() === "f" &&
      desktopViewport.matches
    ) {
      event.preventDefault();
      shell.classList.toggle("focus-preview");
      syncFocusControl();
    }
  });

  syncFocusControl();
}
