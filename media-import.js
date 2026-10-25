const VIDEO_EXTENSIONS = /\.(?:mp4|m4v|mov|webm|mkv|avi|ogv|ogg|mpeg|mpg|mpe|mts|m2ts|ts|flv|wmv|3gp|3g2|asf|vob|divx|mxf|m2v|mpv|qt|f4v|rm|rmvb)$/i;
const ZIP_EXTENSIONS = /\.zip$/i;
const OTHER_ARCHIVE_EXTENSIONS = /\.(?:7z|rar|tar|gz|bz2|xz|zst|001)$/i;
const MAX_ARCHIVE_ENTRY_BYTES = 1.75 * 1024 ** 3;
const ZIP_JS_URL = "https://cdn.jsdelivr.net/npm/@zip.js/zip.js@2.20.0/index.js";

const MIME_BY_EXTENSION = {
  mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", qt: "video/quicktime",
  webm: "video/webm", mkv: "video/x-matroska", avi: "video/x-msvideo",
  ogv: "video/ogg", ogg: "video/ogg", mpeg: "video/mpeg", mpg: "video/mpeg",
  mpe: "video/mpeg", mts: "video/mp2t", m2ts: "video/mp2t", ts: "video/mp2t",
  flv: "video/x-flv", wmv: "video/x-ms-wmv", "3gp": "video/3gpp", "3g2": "video/3gpp2",
  asf: "video/x-ms-asf", vob: "video/mpeg", divx: "video/divx", mxf: "application/mxf",
  m2v: "video/mpeg", mpv: "video/mpeg", f4v: "video/mp4", rm: "application/vnd.rn-realmedia",
  rmvb: "application/vnd.rn-realmedia-vbr"
};

export function getImportKind(file) {
  const name = typeof file === "string" ? file : String(file?.name || "");
  const type = typeof file === "object" ? String(file?.type || "").toLowerCase() : "";
  if (ZIP_EXTENSIONS.test(name) || /(?:application\/zip|application\/x-zip-compressed)/i.test(type)) return "zip";
  if (OTHER_ARCHIVE_EXTENSIONS.test(name) || /(?:x-7z-compressed|x-rar-compressed|x-tar|gzip|x-bzip2)/i.test(type)) return "unsupported-archive";
  if (VIDEO_EXTENSIONS.test(name) || type.startsWith("video/")) return "video";
  return "unsupported";
}

export function getVideoMimeType(fileName, fallbackType = "") {
  const extension = String(fileName || "").match(/\.([a-z0-9]{1,8})$/i)?.[1]?.toLowerCase();
  return MIME_BY_EXTENSION[extension] || (String(fallbackType).startsWith("video/") ? fallbackType : "application/octet-stream");
}

export function formatMediaBytes(value) {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let size = bytes / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 100 ? 0 : size >= 10 ? 1 : 2)} ${units[unit]}`;
}

function chooseArchiveEntry(file, entries) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "archive-picker-backdrop";
    backdrop.innerHTML = `
      <section class="archive-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="archivePickerTitle">
        <div class="archive-picker-header">
          <span class="archive-picker-mark" aria-hidden="true">ZIP</span>
          <button type="button" class="archive-picker-close" aria-label="Close episode picker">×</button>
        </div>
        <h2 id="archivePickerTitle">Choose one episode</h2>
        <p class="archive-picker-copy">Pick a video from this archive. ClipSmith reads the ZIP index and extracts only the episode you select — not the entire folder.</p>
        <div class="archive-picker-summary"><span data-archive-count></span><span data-archive-size></span></div>
        <label class="archive-picker-search-label" for="archivePickerSearch">Find an episode</label>
        <input id="archivePickerSearch" class="archive-picker-search" type="search" placeholder="Search filenames or folders…" autocomplete="off">
        <div class="archive-picker-list" role="listbox" aria-label="Video episodes"></div>
        <div class="archive-picker-footer">
          <p class="archive-picker-status" role="status" aria-live="polite">Select one episode to continue.</p>
          <div><button type="button" class="archive-picker-cancel">Cancel</button><button type="button" class="archive-picker-use" disabled>Use episode</button></div>
        </div>
      </section>`;
    const search = backdrop.querySelector("#archivePickerSearch");
    const list = backdrop.querySelector(".archive-picker-list");
    const counter = backdrop.querySelector("[data-archive-count]");
    const archiveSize = backdrop.querySelector("[data-archive-size]");
    const status = backdrop.querySelector(".archive-picker-status");
    const useButton = backdrop.querySelector(".archive-picker-use");
    const sortedEntries = [...entries].sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true, sensitivity: "base" }));
    let selected = null;
    let finished = false;

    const finish = (entry) => {
      if (finished) return;
      finished = true;
      document.removeEventListener("keydown", onKeyDown);
      backdrop.remove();
      document.body.classList.remove("archive-picker-open");
      resolve(entry || null);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish(null);
      }
    };
    const render = () => {
      const query = search.value.trim().toLocaleLowerCase();
      const visible = sortedEntries.filter((entry) => entry.filename.toLocaleLowerCase().includes(query));
      list.replaceChildren();
      counter.textContent = `${visible.length.toLocaleString()} of ${sortedEntries.length.toLocaleString()} episodes`;
      if (selected && !visible.includes(selected)) selected = null;
      useButton.disabled = !selected;
      for (const entry of visible) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "archive-episode-row";
        row.setAttribute("role", "option");
        row.setAttribute("aria-selected", String(entry === selected));
        row.classList.toggle("selected", entry === selected);
        const name = document.createElement("span");
        name.className = "archive-episode-name";
        name.textContent = entry.filename;
        const meta = document.createElement("span");
        meta.className = "archive-episode-meta";
        meta.textContent = formatMediaBytes(entry.uncompressedSize);
        row.append(name, meta);
        row.addEventListener("click", () => {
          selected = entry;
          status.textContent = `Selected ${entry.filename.split(/[\\/]/).pop()} · ${formatMediaBytes(entry.uncompressedSize)}`;
          render();
          const active = [...list.querySelectorAll(".archive-episode-row")].find((item) => item.getAttribute("aria-selected") === "true");
          active?.focus({ preventScroll: true });
        });
        list.append(row);
      }
      if (!visible.length) {
        const empty = document.createElement("p");
        empty.className = "archive-picker-empty";
        empty.textContent = "No episodes match that search.";
        list.append(empty);
      }
    };

    archiveSize.textContent = `Archive · ${formatMediaBytes(file.size)}`;
    backdrop.querySelector(".archive-picker-close").addEventListener("click", () => finish(null));
    backdrop.querySelector(".archive-picker-cancel").addEventListener("click", () => finish(null));
    useButton.addEventListener("click", () => finish(selected));
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) finish(null);
    });
    search.addEventListener("input", render);
    document.addEventListener("keydown", onKeyDown);
    document.body.append(backdrop);
    document.body.classList.add("archive-picker-open");
    render();
    search.focus();
  });
}

/**
 * Lists video entries from a ZIP archive, then materializes only the chosen entry.
 * BlobReader lets zip.js seek to the central directory/entry without inflating every
 * episode into memory. The selected episode remains a local File; nothing is uploaded.
 */
export async function chooseVideoFromZip(file, { onStatus = () => {}, onBeforeExtract = async () => true } = {}) {
  if (!file || getImportKind(file) !== "zip") throw new Error("Choose a .zip archive.");
  onStatus("Reading ZIP index…", "loading");

  let zipReader;
  try {
    const { BlobReader, BlobWriter, ZipReader } = await import(ZIP_JS_URL);
    zipReader = new ZipReader(new BlobReader(file));
    const entries = await zipReader.getEntries();
    const videos = entries.filter((entry) => !entry.directory && VIDEO_EXTENSIONS.test(entry.filename));
    if (!videos.length) {
      throw new Error("No video episodes were found in this ZIP. Try a ZIP containing MP4, MKV, AVI, MOV, WebM or another common video format.");
    }

    const entry = await chooseArchiveEntry(file, videos);
    if (!entry) {
      onStatus("ZIP selection cancelled.", "info");
      return null;
    }
    const size = Number(entry.uncompressedSize) || 0;
    if (size > MAX_ARCHIVE_ENTRY_BYTES) {
      throw new Error("That episode is too large for safe in-browser processing (ClipSmith's current limit is 1.75 GB). Choose a smaller episode.");
    }

    // Ask the host to run its memory-safety check before allocating the
    // entire uncompressed entry as a Blob. A post-extraction warning is too late
    // for large ZIP entries, which can briefly exist alongside the archive in RAM.
    const allowed = await onBeforeExtract({ fileSize: size, filename: entry.filename });
    if (!allowed) {
      onStatus("ZIP extraction cancelled before allocating the selected episode.", "info");
      return null;
    }
    onStatus(`Extracting selected episode: ${entry.filename.split(/[\\/]/).pop()}…`, "loading");
    const mime = getVideoMimeType(entry.filename);
    const blob = await entry.getData(new BlobWriter(mime), {
      onprogress(progress, total) {
        if (total > 0) onStatus(`Extracting selected episode… ${Math.min(100, Math.round(progress / total * 100))}%`, "loading");
      }
    });
    const name = entry.filename.split(/[\\/]/).pop() || "selected-episode.mp4";
    return new File([blob], name, { type: mime, lastModified: file.lastModified || Date.now() });
  } catch (error) {
    const message = String(error?.message || error || "Unknown ZIP error");
    if (/failed to fetch|import|network|load/i.test(message)) {
      throw new Error("The ZIP reader could not load. Check your internet connection, then retry. Your archive stays on this device.");
    }
    if (/password|encrypted|ERR_INVALID_PASSWORD|ERR_ENCRYPTED/i.test(message)) {
      throw new Error("This ZIP is password-protected or encrypted. Password-protected ZIP episodes are not supported yet.");
    }
    throw new Error(message);
  } finally {
    if (zipReader) {
      try { await zipReader.close(); } catch {}
    }
  }
}
