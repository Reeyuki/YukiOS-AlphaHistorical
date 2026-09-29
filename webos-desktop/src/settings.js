import { defaultStorage } from "./fs.js";
import { SystemUtilities } from "./system.js";

const RUFFLE_KEY = "retroRuffleConfig";

export const RUFFLE_DEFAULTS = {
  letterbox: "on",
  scale: "showAll",
  backgroundColor: "#000000",
  splashScreen: true,
  autoplay: "auto",
  maxExecutionDuration: 15
};

export function loadRuffleConfig() {
  try {
    const raw = localStorage.getItem(RUFFLE_KEY);
    if (!raw) return { ...RUFFLE_DEFAULTS };
    return { ...RUFFLE_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...RUFFLE_DEFAULTS };
  }
}

export function saveRuffleConfig(patch) {
  const next = { ...loadRuffleConfig(), ...patch };
  try {
    localStorage.setItem(RUFFLE_KEY, JSON.stringify(next));
  } catch {}
  applyRuffleConfig();
  return next;
}

export function applyRuffleConfig() {
  const cfg = loadRuffleConfig();
  try {
    window.RufflePlayer = window.RufflePlayer || {};
    window.RufflePlayer.config = {
      letterbox: cfg.letterbox,
      scale: cfg.scale,
      backgroundColor: cfg.backgroundColor || null,
      splashScreen: !!cfg.splashScreen,
      autoplay: cfg.autoplay,
      maxExecutionDuration: Number(cfg.maxExecutionDuration) || 15
    };
  } catch {}
}

export function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export const FLAG_SNAP = "retroEdgeSnap";
export const FLAG_TRANSPARENCY = "retroTransparency";
export const FLAG_HIDE_ICONS = "retroHideIcons";
export const FLAG_HIDE_GAMES = "retroHideGames";
export const FLAG_HIDE_APPS = "retroHideApps";
export const FLAG_ANALYTICS = "retroAnalytics";
export const FLAG_AUTOSTART = "retroAutostart";
export const FLAG_NO_STRETCH = "retroNoStretchScroll";
export const FLAG_CYCLE_WALLPAPER = "retroCycleWallpaper";
export const FLAG_CUSTOM_CURSOR = "retroCustomCursor";
export const FLAG_WINDOW_OPACITY = "retroWindowOpacity";

export const TOGGLE_KEYS = [
  FLAG_SNAP,
  FLAG_TRANSPARENCY,
  FLAG_HIDE_ICONS,
  FLAG_HIDE_GAMES,
  FLAG_HIDE_APPS,
  FLAG_ANALYTICS,
  FLAG_NO_STRETCH,
  FLAG_CYCLE_WALLPAPER
];

export function getFlag(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === "1";
  } catch {
    return fallback;
  }
}

export function setFlag(key, value) {
  try {
    localStorage.setItem(key, value ? "1" : "0");
  } catch {}
}

export function isEdgeSnapEnabled() {
  return getFlag(FLAG_SNAP, true);
}

export function isTransparencyEnabled() {
  return getFlag(FLAG_TRANSPARENCY, true);
}

export function areIconsHidden() {
  return getFlag(FLAG_HIDE_ICONS, false);
}

const GAME_TYPES = new Set(["game", "swf", "gba", "nds"]);
const APP_TYPES = new Set(["system", "html", "remote"]);

let iconFilterAppMap = null;

export function setIconFilterAppMap(appMap) {
  iconFilterAppMap = appMap || null;
}

export function applyHideIcons() {
  const hideAll = areIconsHidden();
  const hideGames = getFlag(FLAG_HIDE_GAMES, false);
  const hideApps = getFlag(FLAG_HIDE_APPS, false);
  document.querySelectorAll("#desktop > .icon").forEach((icon) => {
    if (hideAll) {
      icon.style.display = "none";
      return;
    }
    const type = iconFilterAppMap?.[icon.dataset.app]?.type;
    if (hideGames && GAME_TYPES.has(type)) {
      icon.style.display = "none";
      return;
    }
    if (hideApps && APP_TYPES.has(type)) {
      icon.style.display = "none";
      return;
    }
    icon.style.display = "";
  });
}

export function applyCustomCursor() {
  let url = null;
  try {
    url = localStorage.getItem(FLAG_CUSTOM_CURSOR) || null;
  } catch {}
  const cursor = url ? `url("${url}") 2 2, auto` : "";
  document.documentElement.style.cursor = cursor;
  document.body.style.cursor = cursor;
}

export function applyWindowOpacity() {
  let pct = 100;
  try {
    const raw = localStorage.getItem(FLAG_WINDOW_OPACITY);
    if (raw !== null) pct = Math.min(100, Math.max(20, Number(raw) || 100));
  } catch {}
  try {
    document.documentElement.style.setProperty("--win-opacity", String(pct / 100));
  } catch {}
}

export function applyStretchScroll() {
  const locked = getFlag(FLAG_NO_STRETCH, true);
  const desktop = document.getElementById("desktop");
  if (!desktop) return;
  // Sidelines (horizontal) always scrollable so off-screen icon columns stay reachable.
  desktop.style.overflowX = "auto";
  desktop.style.overflowY = locked ? "hidden" : "auto";
}

function downloadBlob(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

export class SettingsApp {
  constructor(windowManager, appLauncher = null) {
    this.wm = windowManager;
    this.appLauncher = appLauncher;
  }

  static NAV = [
    { id: "system", title: "System", icon: "fas fa-desktop", pane: "pane-system" },
    { id: "desktop", title: "Desktop", icon: "fas fa-house", pane: "pane-desktop" },
    { id: "appearance", title: "Appearance", icon: "fas fa-paintbrush", pane: "pane-appearance" },
    { id: "flash", title: "Flash", icon: "fas fa-bolt", pane: "pane-ruffle" },
    { id: "tools", title: "Tools", icon: "fas fa-toolbox", pane: "pane-tools" },
    { id: "data", title: "Data", icon: "fas fa-database", pane: "pane-data" },
    { id: "about", title: "About", icon: "fas fa-circle-info", pane: "pane-about" }
  ];

  open(section = "appearance") {
    const existing = document.getElementById("settings-win");
    if (existing) {
      this.wm.bringToFront(existing);
      if (section) this.showSection(existing, section);
      return;
    }

    const win = this.wm.createWindow("settings-win", "Settings", "760px", "540px");
    Object.assign(win.style, { left: "200px", top: "80px" });

    const navHtml = SettingsApp.NAV.map(
      (item) =>
        `<li data-target="${item.pane}" data-section="${item.id}"><i class="${item.icon}"></i> ${item.title}</li>`
    ).join("");

    win.innerHTML = `
      ${this.wm.getWindowHeader("Settings", "../static/icons/settings.svg")}
      <div class="window-content">
        <div class="yuki-settings-layout">
          <div class="yuki-settings-sidebar">
            <div class="yuki-settings-search">
              <input type="text" id="settingsSearch" placeholder="Find a setting..." autocomplete="off">
            </div>
            <ul class="yuki-settings-nav">${navHtml}</ul>
          </div>
          <div class="yuki-settings-content">
            <span id="settingsStatus" class="settings-saved-badge-float">Saved</span>
            <div id="pane-system" class="settings-category-pane" data-pane="system"></div>
            <div id="pane-desktop" class="settings-category-pane" data-pane="desktop"></div>
            <div id="pane-appearance" class="settings-category-pane" data-pane="appearance"></div>
            <div id="pane-ruffle" class="settings-category-pane" data-pane="flash"></div>
            <div id="pane-tools" class="settings-category-pane" data-pane="tools"></div>
            <div id="pane-data" class="settings-category-pane" data-pane="data"></div>
            <div id="pane-about" class="settings-category-pane" data-pane="about"></div>
          </div>
        </div>
      </div>`;

    desktop.appendChild(win);
    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.addToTaskbar(win.id, "Settings", "../static/icons/settings.svg");

    win.querySelectorAll(".yuki-settings-nav li").forEach((navItem) => {
      navItem.onclick = () => {
        if (navItem.dataset.section) this.showSection(win, navItem.dataset.section);
      };
    });

    win.querySelector("#settingsSearch").addEventListener("input", (e) => {
      this.filterSettings(win, e.target.value.toLowerCase().trim());
    });

    this.renderSystem(win);
    this.renderDesktop(win);
    this.renderAppearance(win);
    this.renderFlash(win);
    this.renderTools(win);
    this.renderData(win);
    this.renderAbout(win);
    this.showSection(win, section);
  }

  showSection(win, section) {
    win.querySelectorAll(".yuki-settings-nav li").forEach((n) => {
      n.classList.toggle("active", n.dataset.section === section);
    });
    win.querySelectorAll(".settings-category-pane").forEach((p) => {
      p.classList.toggle("active", p.dataset.pane === section);
    });
    this.resetFilter(win);
  }

  resetFilter(win) {
    const search = win.querySelector("#settingsSearch");
    if (search) search.value = "";
    win.querySelector(".yuki-settings-layout")?.classList.remove("is-searching");
    win.querySelectorAll(".settings-category-pane").forEach((p) => {
      p.classList.remove("no-match");
    });
    win.querySelectorAll(".settings-row").forEach((row) => {
      row.classList.remove("is-hidden");
    });
    win.querySelectorAll(".yuki-settings-nav li").forEach((n) => {
      n.classList.remove("is-hidden");
    });
  }

  filterSettings(win, query) {
    const layout = win.querySelector(".yuki-settings-layout");
    if (!query) {
      const active = win.querySelector(".yuki-settings-nav li.active");
      const section = active?.dataset.section || "appearance";
      this.resetFilter(win);
      win.querySelectorAll(".yuki-settings-nav li").forEach((n) => {
        n.classList.toggle("active", n.dataset.section === section);
      });
      win.querySelectorAll(".settings-category-pane").forEach((p) => {
        p.classList.toggle("active", p.dataset.pane === section);
      });
      return;
    }
    layout?.classList.add("is-searching");
    win.querySelectorAll(".settings-category-pane").forEach((pane) => {
      let visible = 0;
      pane.querySelectorAll(".settings-row").forEach((row) => {
        const match = row.textContent.toLowerCase().includes(query);
        row.classList.toggle("is-hidden", !match);
        if (match) visible++;
      });
      pane.classList.remove("active");
      pane.classList.toggle("no-match", visible === 0);
      const navItem = win.querySelector(`.yuki-settings-nav li[data-target="${pane.id}"]`);
      if (navItem) navItem.classList.toggle("is-hidden", visible === 0);
    });
  }

  flashSaved(win) {
    const badge = win.querySelector("#settingsStatus");
    if (!badge) return;
    badge.classList.add("show");
    clearTimeout(this._savedTimer);
    this._savedTimer = setTimeout(() => badge.classList.remove("show"), 1200);
  }

  toggleRow(id, title, desc, checked) {
    return `
      <div class="settings-row">
        <div class="settings-label-group">
          <span class="settings-label-title">${title}</span>
          <span class="settings-label-desc">${desc}</span>
        </div>
        <label class="settings-toggle">
          <input type="checkbox" id="${id}"${checked ? " checked" : ""}>
          <span class="settings-track"><span class="settings-thumb"></span></span>
        </label>
      </div>`;
  }

  selectRow(id, title, desc, options, value) {
    return `
      <div class="settings-row">
        <div class="settings-label-group">
          <span class="settings-label-title">${title}</span>
          <span class="settings-label-desc">${desc}</span>
        </div>
        <select class="settings-select" id="${id}">
          ${options.map((o) => `<option value="${o.value}"${o.value === value ? " selected" : ""}>${o.label}</option>`).join("")}
        </select>
      </div>`;
  }

  renderSystem(win) {
    const pane = win.querySelector("#pane-system");
    const autostart = (() => {
      try {
        return localStorage.getItem(FLAG_AUTOSTART) || "";
      } catch {
        return "";
      }
    })();
    const apps = this.appLauncher ? Object.keys(this.appLauncher.appMap).sort() : [];
    const labelFor = (app) => {
      const el = document.querySelector(`#desktop div[data-app="${app}"] div`);
      return el ? el.textContent : app;
    };

    pane.innerHTML = `
      <div class="settings-category-header">System</div>
      <div class="settings-row">
        <div class="settings-label-group">
          <span class="settings-label-title">Autostart</span>
          <span class="settings-label-desc">Open an app automatically on load</span>
        </div>
        <select class="settings-select" id="settingsAutostart">
          <option value="">None</option>
          ${apps.map((a) => `<option value="${a}"${a === autostart ? " selected" : ""}>${labelFor(a)}</option>`).join("")}
        </select>
      </div>`;

    pane.querySelector("#settingsAutostart").onchange = (e) => {
      try {
        localStorage.setItem(FLAG_AUTOSTART, e.target.value);
      } catch {}
      this.flashSaved(win);
    };
  }

  renderDesktop(win) {
    const pane = win.querySelector("#pane-desktop");

    pane.innerHTML = `
      <div class="settings-category-header">Desktop</div>
      ${this.toggleRow("settingsEdgeSnap", "Edge snap", "Scale windows dragged to screen borders", isEdgeSnapEnabled())}
      ${this.toggleRow("settingsTransparency", "Transparency effects", "Glass blur on windows", isTransparencyEnabled())}
      ${this.toggleRow("settingsHideIcons", "Hide desktop icons", "Hide all icons on the desktop", areIconsHidden())}
      ${this.toggleRow("settingsNoStretch", "Disable vertical desktop scroll", "Only sideways scrolling stays on", getFlag(FLAG_NO_STRETCH, true))}`;

    pane.querySelector("#settingsEdgeSnap").onchange = (e) => {
      setFlag(FLAG_SNAP, e.target.checked);
      this.flashSaved(win);
    };
    pane.querySelector("#settingsTransparency").onchange = (e) => {
      setFlag(FLAG_TRANSPARENCY, e.target.checked);
      this.wm.updateTransparency();
      this.flashSaved(win);
    };
    pane.querySelector("#settingsHideIcons").onchange = (e) => {
      setFlag(FLAG_HIDE_ICONS, e.target.checked);
      applyHideIcons();
      this.flashSaved(win);
    };
    pane.querySelector("#settingsNoStretch").onchange = (e) => {
      setFlag(FLAG_NO_STRETCH, e.target.checked);
      applyStretchScroll();
      this.flashSaved(win);
    };
  }

  renderAppearance(win) {
    const pane = win.querySelector("#pane-appearance");
    const pictures = defaultStorage.home.reeyuki.Pictures || {};
    const entries = Object.entries(pictures).filter(([, item]) => item.kind === "image");
    const currentSrc = document.getElementById("wallpaper-img")?.src || "";
    const cycle = getFlag(FLAG_CYCLE_WALLPAPER, true);
    const opacity = (() => {
      try {
        const raw = localStorage.getItem(FLAG_WINDOW_OPACITY);
        return raw !== null ? Math.min(100, Math.max(20, Number(raw) || 100)) : 100;
      } catch {
        return 100;
      }
    })();
    const hasCursor = (() => {
      try {
        return !!localStorage.getItem(FLAG_CUSTOM_CURSOR);
      } catch {
        return false;
      }
    })();

    pane.innerHTML = `
      <div class="settings-category-header">Appearance</div>
      <div class="settings-card">
        <div class="settings-card-header"><i class="fas fa-images"></i> Wallpaper</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Random wallpaper</span>
            <span class="settings-label-desc">Pick a random built-in wallpaper</span>
          </div>
          <button class="settings-btn" id="settingsRandomWall">Random</button>
        </div>
        ${this.toggleRow("settingsCycleWallpaper", "Cycle wallpapers on start", "Automatically switch wallpapers on boot", cycle)}
        <div class="settings-wall-grid" id="settingsWallGrid"></div>
      </div>
      <div class="settings-card">
        <div class="settings-card-header"><i class="fas fa-eye"></i> Windows</div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Window Transparency</span>
            <span class="settings-label-desc">Adjust window opacity</span>
          </div>
          <div class="settings-range-group">
            <input id="settingsWindowOpacity" type="range" min="20" max="100" step="1" value="${opacity}">
            <span id="settingsWindowOpacityValue" class="settings-range-value">${opacity}%</span>
          </div>
        </div>
      </div>
      <div class="settings-card">
        <div class="settings-card-header"><i class="fas fa-mouse-pointer"></i> Cursor</div>
        <div class="settings-row settings-row--stacked">
          <div class="settings-label-group">
            <span class="settings-label-title">Custom Cursor</span>
            <span class="settings-label-desc">Upload a PNG/JPG/GIF/WEBP cursor image</span>
          </div>
          <div class="settings-button-group" style="margin-top: 10px;">
            <button class="settings-btn" id="settingsCursorUploadBtn"><i class="fas fa-upload"></i> Upload</button>
            <button class="settings-btn settings-btn-warning" id="settingsCursorClearBtn"${hasCursor ? "" : " disabled"}><i class="fas fa-xmark"></i> Clear</button>
            <span id="settingsCursorStatus" class="settings-status-text">${hasCursor ? "Custom cursor active" : "Default cursor"}</span>
          </div>
        </div>
      </div>`;

    const grid = pane.querySelector("#settingsWallGrid");
    entries.forEach(([name, item]) => {
      const cell = document.createElement("div");
      cell.className = "settings-wall-cell" + (currentSrc.endsWith(item.content) ? " current" : "");
      cell.title = name;
      const img = document.createElement("img");
      img.src = item.icon || item.content;
      img.alt = name;
      img.loading = "lazy";
      const label = document.createElement("span");
      label.textContent = name;
      cell.appendChild(img);
      cell.appendChild(label);
      cell.onclick = () => {
        SystemUtilities.setWallpaper(item.content);
        grid.querySelectorAll(".settings-wall-cell").forEach((el) => el.classList.remove("current"));
        cell.classList.add("current");
        this.flashSaved(win);
      };
      grid.appendChild(cell);
    });

    pane.querySelector("#settingsRandomWall").onclick = () => {
      SystemUtilities.setRandomWallpaper();
      grid.querySelectorAll(".settings-wall-cell").forEach((el) => el.classList.remove("current"));
      this.flashSaved(win);
    };

    pane.querySelector("#settingsCycleWallpaper").onchange = (e) => {
      setFlag(FLAG_CYCLE_WALLPAPER, e.target.checked);
      this.flashSaved(win);
    };

    const opRange = pane.querySelector("#settingsWindowOpacity");
    const opValue = pane.querySelector("#settingsWindowOpacityValue");
    opRange.oninput = () => {
      opValue.textContent = `${opRange.value}%`;
      try {
        localStorage.setItem(FLAG_WINDOW_OPACITY, opRange.value);
      } catch {}
      applyWindowOpacity();
    };
    opRange.onchange = () => this.flashSaved(win);

    pane.querySelector("#settingsCursorUploadBtn").onclick = () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/png,image/jpeg,image/gif,image/webp";
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return;
        if (file.size > 262144) {
          pane.querySelector("#settingsCursorStatus").textContent = "Image too large (max 256KB)";
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          try {
            localStorage.setItem(FLAG_CUSTOM_CURSOR, reader.result);
          } catch {
            pane.querySelector("#settingsCursorStatus").textContent = "Could not save (quota?)";
            return;
          }
          applyCustomCursor();
          pane.querySelector("#settingsCursorStatus").textContent = "Custom cursor active";
          pane.querySelector("#settingsCursorClearBtn").disabled = false;
          this.flashSaved(win);
        };
        reader.readAsDataURL(file);
      };
      input.click();
    };

    pane.querySelector("#settingsCursorClearBtn").onclick = (e) => {
      try {
        localStorage.removeItem(FLAG_CUSTOM_CURSOR);
      } catch {}
      applyCustomCursor();
      pane.querySelector("#settingsCursorStatus").textContent = "Default cursor";
      e.target.closest("button").disabled = true;
      this.flashSaved(win);
    };
  }

  renderFlash(win) {
    const pane = win.querySelector("#pane-ruffle");
    const cfg = loadRuffleConfig();

    pane.innerHTML = `
      <div class="settings-category-header">Flash (Ruffle)</div>
      <div class="settings-card">
        <div class="settings-card-header"><i class="fas fa-display"></i> Display</div>
        ${this.selectRow(
          "settingsRuffleLetterbox",
          "Letterbox",
          "How the stage fits the window",
          [
            { value: "off", label: "Off stretches to fill" },
            { value: "on", label: "On keeps aspect ratio" },
            { value: "fullscreen", label: "Fullscreen fills viewport" }
          ],
          cfg.letterbox
        )}
        ${this.selectRow(
          "settingsRuffleScale",
          "Scale Mode",
          "SWF stage scaling",
          [
            { value: "showAll", label: "Show All" },
            { value: "noBorder", label: "No Border" },
            { value: "exactFit", label: "Exact Fit" },
            { value: "noScale", label: "No Scale" }
          ],
          cfg.scale
        )}
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Background Color</span>
            <span class="settings-label-desc">Stage background when letterboxed</span>
          </div>
          <input type="color" id="settingsRuffleBg" value="${cfg.backgroundColor}">
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Splash Screen</span>
            <span class="settings-label-desc">Show Ruffle loading animation</span>
          </div>
          <label class="settings-toggle">
            <input type="checkbox" id="settingsRuffleSplash"${cfg.splashScreen ? " checked" : ""}>
            <span class="settings-track"><span class="settings-thumb"></span></span>
          </label>
        </div>
      </div>
      <div class="settings-card">
        <div class="settings-card-header"><i class="fas fa-play"></i> Playback</div>
        ${this.selectRow(
          "settingsRuffleAutoplay",
          "Autoplay",
          "Start SWF without user gesture",
          [
            { value: "on", label: "On" },
            { value: "off", label: "Off" },
            { value: "auto", label: "Auto" }
          ],
          cfg.autoplay
        )}
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-title">Max Execution Duration</span>
            <span class="settings-label-desc">Seconds before runaway scripts stop</span>
          </div>
          <input type="number" id="settingsRuffleMaxExec" class="settings-input" min="1" max="120" step="1" value="${cfg.maxExecutionDuration}">
        </div>
        <div class="settings-row">
          <div class="settings-label-group">
            <span class="settings-label-desc">Applies to games opened after changing</span>
          </div>
        </div>
      </div>`;

    const save = (patch) => {
      saveRuffleConfig(patch);
      this.flashSaved(win);
    };
    pane.querySelector("#settingsRuffleLetterbox").onchange = (e) => save({ letterbox: e.target.value });
    pane.querySelector("#settingsRuffleScale").onchange = (e) => save({ scale: e.target.value });
    pane.querySelector("#settingsRuffleAutoplay").onchange = (e) => save({ autoplay: e.target.value });
    const bg = pane.querySelector("#settingsRuffleBg");
    bg.onchange = () => save({ backgroundColor: bg.value });
    bg.oninput = () => save({ backgroundColor: bg.value });
    pane.querySelector("#settingsRuffleSplash").onchange = (e) => save({ splashScreen: e.target.checked });
    pane.querySelector("#settingsRuffleMaxExec").onchange = (e) => {
      const n = Math.min(120, Math.max(1, Number(e.target.value) || 15));
      e.target.value = n;
      save({ maxExecutionDuration: n });
    };
  }

  renderTools(win) {
    const pane = win.querySelector("#pane-tools");

    pane.innerHTML = `
      <div class="settings-category-header">Tools</div>
      <div class="settings-row">
        <div class="settings-label-group">
          <span class="settings-label-title">Hide Games</span>
          <span class="settings-label-desc">Toggle visibility of game icons on desktop</span>
        </div>
        <button class="settings-btn" id="settingsHideGamesBtn"><i class="fas fa-eye-slash"></i> Toggle</button>
      </div>
      <div class="settings-row">
        <div class="settings-label-group">
          <span class="settings-label-title">Hide System Apps</span>
          <span class="settings-label-desc">Toggle visibility of system apps on desktop</span>
        </div>
        <button class="settings-btn" id="settingsHideAppsBtn"><i class="fas fa-eye-slash"></i> Toggle</button>
      </div>
      <div class="settings-row">
        <div class="settings-label-group">
          <span class="settings-label-title">Download Page</span>
          <span class="settings-label-desc">Save a local copy of this site</span>
        </div>
        <button class="settings-btn" id="settingsDownloadPageBtn"><i class="fas fa-download"></i> Download</button>
      </div>`;

    pane.querySelector("#settingsHideGamesBtn").onclick = () => {
      setFlag(FLAG_HIDE_GAMES, !getFlag(FLAG_HIDE_GAMES, false));
      applyHideIcons();
      this.flashSaved(win);
    };
    pane.querySelector("#settingsHideAppsBtn").onclick = () => {
      setFlag(FLAG_HIDE_APPS, !getFlag(FLAG_HIDE_APPS, false));
      applyHideIcons();
      this.flashSaved(win);
    };
    pane.querySelector("#settingsDownloadPageBtn").onclick = () => {
      const blob = new Blob(["<!doctype html>\n" + document.documentElement.outerHTML], { type: "text/html" });
      downloadBlob(blob, "yukiretropage.html");
      this.flashSaved(win);
    };
  }

  renderData(win) {
    const pane = win.querySelector("#pane-data");

    pane.innerHTML = `
      <div class="settings-category-header">Data &amp; Storage</div>
      <div class="settings-row">
        <div class="settings-label-group">
          <span class="settings-label-title">Export Data</span>
          <span class="settings-label-desc">Backup your saved settings and data</span>
        </div>
        <button class="settings-btn" id="btnExportData"><i class="fas fa-file-export"></i> Export</button>
      </div>
      <div class="settings-row">
        <div class="settings-label-group">
          <span class="settings-label-title">Import Data</span>
          <span class="settings-label-desc">Restore a previously saved backup</span>
        </div>
        <button class="settings-btn" id="btnImportData"><i class="fas fa-file-import"></i> Import</button>
      </div>
      <div class="settings-row">
        <div class="settings-label-group">
          <span class="settings-label-title">Reset Toggles</span>
          <span class="settings-label-desc">Revert all OS switches back to default</span>
        </div>
        <button class="settings-btn settings-btn-warning" id="btnResetToggles"><i class="fas fa-sliders"></i> Reset</button>
      </div>
      <div class="settings-row">
        <div class="settings-label-group">
          <span class="settings-label-title" style="color: #ff4d4f;">Delete All Data</span>
          <span class="settings-label-desc">Permanently wipe all saves, files, and settings</span>
        </div>
        <button class="settings-btn danger" id="btnDeleteAllData"><i class="fas fa-trash"></i> Wipe</button>
      </div>`;

    pane.querySelector("#btnExportData").onclick = () => {
      const out = {};
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k) out[k] = localStorage.getItem(k);
        }
      } catch {}
      downloadBlob(
        new Blob([JSON.stringify({ version: 1, localStorage: out })], { type: "application/json" }),
        "yukiretro-backup.json"
      );
      this.flashSaved(win);
    };

    pane.querySelector("#btnImportData").onclick = () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json,.json";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;
        try {
          const payload = JSON.parse(await file.text());
          const data = payload.localStorage || payload;
          if (!data || typeof data !== "object") throw new Error("bad backup");
          if (!confirm("Restore backup? This replaces current settings and data.")) return;
          try {
            localStorage.clear();
          } catch {}
          for (const [k, v] of Object.entries(data)) {
            if (typeof k === "string") {
              try {
                localStorage.setItem(k, v);
              } catch {}
            }
          }
          location.reload();
        } catch {
          alert("Import failed. The file might be damaged.");
        }
      };
      input.click();
    };

    pane.querySelector("#btnResetToggles").onclick = () => {
      if (!confirm("Reset all OS switches to defaults?")) return;
      [...TOGGLE_KEYS, FLAG_AUTOSTART, FLAG_CUSTOM_CURSOR, FLAG_WINDOW_OPACITY].forEach((k) => {
        try {
          localStorage.removeItem(k);
        } catch {}
      });
      applyHideIcons();
      applyCustomCursor();
      applyWindowOpacity();
      applyStretchScroll();
      this.renderDesktop(win);
      this.renderAppearance(win);
      this.renderSystem(win);
      this.flashSaved(win);
    };

    pane.querySelector("#btnDeleteAllData").onclick = () => {
      if (!confirm("Permanently wipe all saves, files, and settings? No take-backs.")) return;
      try {
        localStorage.clear();
      } catch {}
      location.reload();
    };
  }

  renderAbout(win) {
    const pane = win.querySelector("#pane-about");

    pane.innerHTML = `
      <div class="settings-category-header">About</div>
      <div class="settings-row" style="flex-direction: column; align-items: flex-start; gap: 10px;">
        <h2 style="margin:0;font-size:1.4em;"><a href="https://github.com/Reeyuki/YukiOS-EarlyAlphaPrehistoric" target="_blank" rel="noopener" style="color:inherit;">Yuki OS</a></h2>
        <p style="margin:0;color:rgba(255,255,255,0.8);font-size:0.95em;">
          Retro browser desktop with apps, Flash games, and emulators.
        </p>
      </div>
      <div class="settings-row">
        <div class="settings-label-group">
          <span class="settings-label-title">Browser storage used</span>
          <span class="settings-label-desc" id="settingsStorageInfo">Measuring…</span>
        </div>
      </div>
      <div class="settings-disk-progress"><div class="settings-disk-progress-fill" id="settingsStorageFill" style="width:0%"></div></div>
      <div class="settings-row">
        <div class="settings-label-group">
          <span class="settings-label-title">Source code</span>
          <span class="settings-label-desc">github.com/Reeyuki/YukiOS-EarlyAlphaPrehistoric</span>
        </div>
        <a href="https://github.com/Reeyuki/YukiOS-EarlyAlphaPrehistoric" target="_blank" rel="noopener" class="settings-btn" style="text-decoration:none;">GitHub</a>
      </div>`;

    if (navigator.storage?.estimate) {
      navigator.storage
        .estimate()
        .then((est) => {
          const used = est.usage || 0;
          const quota = est.quota || 0;
          const info = pane.querySelector("#settingsStorageInfo");
          const fill = pane.querySelector("#settingsStorageFill");
          if (info) info.textContent = `${formatSize(used)}${quota ? ` of ${formatSize(quota)}` : ""}`;
          if (fill && quota) fill.style.width = `${Math.min((used / quota) * 100, 100)}%`;
        })
        .catch(() => {
          const info = pane.querySelector("#settingsStorageInfo");
          if (info) info.textContent = "Unavailable";
        });
    } else {
      const info = pane.querySelector("#settingsStorageInfo");
      if (info) info.textContent = "Unavailable";
    }
  }
}
