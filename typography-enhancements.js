/* ClipSmith typography discovery and safety utilities. */
const presetRoot = document.querySelector(".title-preset-grid-extended");
const presetCards = [...document.querySelectorAll("[data-preset-card]")];
const presetSearch = document.getElementById("titlePresetSearch");
const presetCategory = document.getElementById("titlePresetCategory");
const presetFavoritesToggle = document.getElementById("showFavoritePresetsBtn");
const presetResultsCount = document.getElementById("presetResultsCount");
const resetStyleButton = document.getElementById("resetHeadingStyleBtn");
const FAVORITES_KEY = "clipsmith.typography.favorites.v1";

let favoritePresets = new Set();
let onlyFavorites = false;
let lastAppliedPreset = "";
let emptyState = null;

try {
  const saved = JSON.parse(localStorage.getItem(FAVORITES_KEY) || "[]");
  if (Array.isArray(saved)) favoritePresets = new Set(saved.filter(value => typeof value === "string"));
} catch {
  // Local storage can be unavailable in private or restricted browser contexts.
}

const presetLabels = new Map(presetCards.map(card => [
  card.dataset.presetCard,
  card.querySelector("[data-title-preset] b")?.textContent?.trim() || card.dataset.presetCard
]));

function syncFavoriteButton(button, active) {
  button.setAttribute("aria-pressed", String(active));
  const name = presetLabels.get(button.dataset.presetFavorite) || button.dataset.presetFavorite;
  button.textContent = active ? "★" : "☆";
  button.setAttribute("aria-label", (active ? "Remove " : "Add ") + name + (active ? " from" : " to") + " favourites");
  button.title = active ? "Remove from favourites" : "Save to favourites";
}

function refreshPresetLibrary() {
  if (!presetRoot) return;
  const query = String(presetSearch?.value || "").trim().toLocaleLowerCase();
  const category = presetCategory?.value || "all";
  let visible = 0;

  for (const card of presetCards) {
    const key = card.dataset.presetCard || "";
    const label = presetLabels.get(key) || key;
    const categoryMatch = category === "all" || card.dataset.presetCategory === category;
    const queryMatch = !query || (label + " " + key + " " + (card.dataset.presetCategory || "")).toLocaleLowerCase().includes(query);
    const favoriteMatch = !onlyFavorites || favoritePresets.has(key);
    const show = categoryMatch && queryMatch && favoriteMatch;
    card.hidden = !show;
    if (show) visible++;
  }

  if (emptyState) emptyState.remove();
  emptyState = null;
  if (!visible) {
    emptyState = document.createElement("div");
    emptyState.className = "preset-empty-state";
    emptyState.textContent = onlyFavorites
      ? "No saved favourites match these filters. Star a style to keep it here."
      : "No matching styles. Try another search or choose All styles.";
    presetRoot.appendChild(emptyState);
  }

  if (presetResultsCount) {
    presetResultsCount.textContent = visible + " of " + presetCards.length + " styles shown" + (favoritePresets.size ? " · " + favoritePresets.size + " saved" : "");
  }
  presetCards.forEach(card => {
    const fav = card.querySelector("[data-preset-favorite]");
    if (fav) syncFavoriteButton(fav, favoritePresets.has(fav.dataset.presetFavorite));
  });
  if (presetFavoritesToggle) {
    presetFavoritesToggle.setAttribute("aria-pressed", String(onlyFavorites));
    presetFavoritesToggle.textContent = onlyFavorites ? "★ Favourites only" : "☆ Favourites";
  }
}

presetSearch?.addEventListener("input", refreshPresetLibrary);
presetCategory?.addEventListener("change", refreshPresetLibrary);
presetFavoritesToggle?.addEventListener("click", () => {
  onlyFavorites = !onlyFavorites;
  refreshPresetLibrary();
});

presetRoot?.addEventListener("click", event => {
  const favoriteButton = event.target.closest("[data-preset-favorite]");
  if (favoriteButton) {
    event.preventDefault();
    event.stopPropagation();
    const key = favoriteButton.dataset.presetFavorite;
    if (!key) return;
    if (favoritePresets.has(key)) favoritePresets.delete(key);
    else favoritePresets.add(key);
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favoritePresets]));
    } catch {
      // Favorites still work for this page session if storage is blocked.
    }
    refreshPresetLibrary();
    return;
  }

  const presetButton = event.target.closest("[data-title-preset]");
  if (!presetButton) return;
  lastAppliedPreset = presetButton.dataset.titlePreset || "";
  presetCards.forEach(card => {
    const button = card.querySelector("[data-title-preset]");
    const active = card.dataset.presetCard === lastAppliedPreset;
    card.classList.toggle("is-current", active);
    if (button) button.setAttribute("aria-pressed", String(active));
  });
});

const resetDefaults = {
  titleFont: "Inter",
  titleSize: "30",
  titleColor: "#ffffff",
  titleOutline: "#000000",
  titleOpacity: "1",
  titleBold: true,
  titleItalic: false,
  titleSpacing: "0",
  titleShadow: "6",
  titleWeight: "800",
  titleTransform: "none",
  titleAlign: "center",
  titleDecoration: "none",
  titleOutlineWidth: "2",
  titleShadowColor: "#000000",
  titleGlow: "0",
  titleGlowColor: "#8b5cf6",
  titleBgEnabled: false,
  titleBgColor: "#111827",
  titleBgOpacity: ".72",
  titleBgPadding: "10",
  titleBgRadius: "10",
  titleRotation: "0",
  titleLineHeight: "1.08",
  titlePositionY: "17"
};

resetStyleButton?.addEventListener("click", () => {
  for (const [id, value] of Object.entries(resetDefaults)) {
    const control = document.getElementById(id);
    if (!control) continue;
    if (control.type === "checkbox") control.checked = Boolean(value);
    else control.value = String(value);
  }

  // Existing editor listeners own the actual project state and persistence.
  for (const id of Object.keys(resetDefaults)) {
    const control = document.getElementById(id);
    if (control) control.dispatchEvent(new Event("input", { bubbles: true }));
  }

  presetCards.forEach(card => {
    card.classList.remove("is-current");
    card.querySelector("[data-title-preset]")?.setAttribute("aria-pressed", "false");
  });
  lastAppliedPreset = "";
  if (presetResultsCount) presetResultsCount.textContent = "Heading style reset to ClipSmith defaults.";
});

refreshPresetLibrary();
