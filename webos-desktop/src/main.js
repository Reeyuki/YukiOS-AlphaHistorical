import { TerminalApp } from "./terminal.js";
import { ExplorerApp } from "./explorer.js";
import { WindowManager } from "./windowManager.js";
import { BrowserApp } from "./browser.js";
import { AppLauncher } from "./appLauncher.js";
import { NotepadApp } from "./notepad.js";
import { CameraApp } from "./camera.js";
import { CalculatorApp } from "./calculator.js";
import { EmojiApp } from "./emoji.js";
import { toggleCalendarPopup } from "./calendar.js";
import {
  SettingsApp,
  applyRuffleConfig,
  applyHideIcons,
  applyCustomCursor,
  applyWindowOpacity,
  applyStretchScroll,
  setIconFilterAppMap,
  getFlag,
  FLAG_AUTOSTART,
  FLAG_CYCLE_WALLPAPER
} from "./settings.js";
import { SystemUtilities } from "./system.js";
import { FileSystemManager, defaultStorage } from "./fs.js";
import { setupStartMenu, updateFavoritesUI } from "./startMenu.js";

class MusicPlayer {
  constructor() {}
  open(windowManager) {
    if (document.getElementById("music-win")) {
      console.log("bringing window to front");
      windowManager.bringToFront(document.getElementById("music-win"));
      return;
    }
    console.log("Creating window");
    const win = windowManager.createWindow("music-win", "MUSIC");

    win.innerHTML = `
    ${windowManager.getWindowHeader("MUSIC", "../static/icons/music.png")}
    <div class="window-content" style="width:100%; height:100%;">
      <div id="player-container" style="display:flex; flex-direction:column; align-items:center; gap:10px; padding:10px;"></div>
      </div>
    </div>`;

    desktop.appendChild(win);
    explorerApp.renderMusicPage(document.getElementById("player-container"));
    windowManager.makeDraggable(win);
    windowManager.makeResizable(win);
    windowManager.setupWindowControls(win);
    windowManager.addToTaskbar(win.id, "MUSIC", "../static/icons/music.png");
  }
}

class DesktopUI {
  constructor(appLauncher) {
    this.appLauncher = appLauncher;
    this.desktop = document.getElementById("desktop");
    this.startButton = document.getElementById("start-button");
    this.startMenu = document.getElementById("start-menu");
    this.contextMenu = document.getElementById("context-menu");
    this.selectionBox = document.getElementById("selection-box");
    this.clipboardCurrentCopied = null;
    this.isDragging = false;
    this.draggedIcons = [];
    this.dragOffsets = [];
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.startButton.addEventListener("click", (e) => {
      e.stopPropagation();
      this.startMenu.style.display = this.startMenu.style.display === "flex" ? "none" : "flex";
      updateFavoritesUI(this.appLauncher);
    });
    this.startMenu.addEventListener("click", (e) => e.stopPropagation());

    document.addEventListener("click", () => {
      this.startMenu.style.display = "none";
      this.contextMenu.style.display = "none";
    });

    this.desktop.addEventListener("contextmenu", (e) => {
      if (e.target.classList.contains("selectable")) {
        e.preventDefault();
        this.showIconContextMenu(e, e.target);
      } else if (e.target === this.desktop) {
        e.preventDefault();
        this.showDesktopContextMenu(e);
      }
    });

    this.setupIconHandlers();
    this.setupSelectionBox();
    this.setupStartMenu();
    this.setupDesktopScroll();
  }

  setupDesktopScroll() {
    // Plain mouse wheels only emit vertical deltas, which would do nothing on
    // a horizontally-scrolling desktop. Translate them sideways, but only when
    // there is no vertical room to scroll (never hijack real vertical scroll
    // or pinch-zoom, and never interfere with windows above the desktop).
    this.desktop.addEventListener(
      "wheel",
      (e) => {
        if (e.ctrlKey || e.metaKey) return;
        if (e.target !== this.desktop) return;
        const canH = this.desktop.scrollWidth > this.desktop.clientWidth + 1;
        if (!canH) return;
        if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
        const canV = this.desktop.scrollHeight > this.desktop.clientHeight + 1;
        if (canV) return;
        this.desktop.scrollLeft += e.deltaY + e.deltaX;
        e.preventDefault();
      },
      { passive: false }
    );
  }

  setupIconHandlers() {
    document.querySelectorAll(".icon.selectable").forEach((icon) => {
      this.makeIconDraggable(icon);
    });
  }

  makeIconDraggable(icon) {
    icon.draggable = false;
    Object.assign(icon.style, { userSelect: "none", webkitUserDrag: "none" });

    icon.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      this.appLauncher.launch(icon.dataset.app, icon);
    });

    let mouseDownTime = 0;
    let mouseDownPos = { x: 0, y: 0 };

    icon.addEventListener("mousedown", (e) => {
      mouseDownTime = Date.now();
      mouseDownPos = { x: e.clientX, y: e.clientY };

      if (!e.ctrlKey) {
        if (!icon.classList.contains("selected")) {
          document.querySelectorAll(".icon.selectable").forEach((i) => i.classList.remove("selected"));
          icon.classList.add("selected");
        }
      } else {
        icon.classList.toggle("selected");
      }

      const selectedIcons = Array.from(document.querySelectorAll(".icon.selectable.selected"));
      this.draggedIcons = selectedIcons;
      this.dragOffsets = selectedIcons.map((i) => ({
        x: e.clientX - i.offsetLeft,
        y: e.clientY - i.offsetTop
      }));

      const onMouseMove = (e) => {
        const distance = Math.sqrt(Math.pow(e.clientX - mouseDownPos.x, 2) + Math.pow(e.clientY - mouseDownPos.y, 2));

        if (distance > 5 && !this.isDragging) {
          this.isDragging = true;
          this.draggedIcons.forEach((i) => {
            i.style.opacity = "0.7";
            i.style.zIndex = "1000";
          });
        }

        if (this.isDragging) {
          this.draggedIcons.forEach((draggedIcon, index) => {
            const newLeft = e.clientX - this.dragOffsets[index].x;
            const newTop = e.clientY - this.dragOffsets[index].y;

            draggedIcon.style.left = `${Math.max(0, newLeft)}px`;
            draggedIcon.style.top = `${Math.max(0, newTop)}px`;
          });
        }
      };

      const onMouseUp = (e) => {
        if (this.isDragging) {
          const ICON_WIDTH = 80;
          const ICON_HEIGHT = 100;
          const GAP = 5;

          this.draggedIcons.forEach((draggedIcon) => {
            const currentLeft = parseInt(draggedIcon.style.left);
            const currentTop = parseInt(draggedIcon.style.top);

            const columnWidth = ICON_WIDTH + GAP;
            const rowHeight = ICON_HEIGHT + GAP;

            let snappedLeft = Math.round(currentLeft / columnWidth) * columnWidth + GAP;
            let snappedTop = Math.round(currentTop / rowHeight) * rowHeight + GAP;

            while (this.isPositionOccupied(snappedLeft, snappedTop, draggedIcon)) {
              const desktopHeight = this.desktop.clientHeight;
              snappedTop += rowHeight;

              if (snappedTop + ICON_HEIGHT > desktopHeight) {
                snappedTop = GAP;
                snappedLeft += columnWidth;
              }
            }

            draggedIcon.style.left = `${snappedLeft}px`;
            draggedIcon.style.top = `${snappedTop}px`;
            draggedIcon.style.opacity = "1";
            draggedIcon.style.zIndex = "1";
          });
          this.isDragging = false;
        }

        this.draggedIcons = [];
        this.dragOffsets = [];

        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
  }
  isPositionOccupied(left, top, excludeIcon) {
    const icons = Array.from(document.querySelectorAll(".icon.selectable"));
    const tolerance = 10;

    return icons.some((icon) => {
      if (icon === excludeIcon) return false;

      const iconLeft = parseInt(icon.style.left) || 0;
      const iconTop = parseInt(icon.style.top) || 0;

      return Math.abs(iconLeft - left) < tolerance && Math.abs(iconTop - top) < tolerance;
    });
  }
  showIconContextMenu(e, icon) {
    const selectedIcons = Array.from(document.querySelectorAll(".icon.selectable.selected"));
    if (!selectedIcons.includes(icon)) {
      document.querySelectorAll(".icon.selectable").forEach((i) => i.classList.remove("selected"));
      icon.classList.add("selected");
    }

    const lastSelected = Array.from(document.querySelectorAll(".icon.selectable.selected")).pop();

    this.contextMenu.innerHTML = `
      <div id="ctx-open">Open</div>
      <div id="ctx-cut">Cut</div>
      <div id="ctx-copy">Copy</div>
      <div id="ctx-delete">Delete</div>
      <div id="ctx-properties">Properties</div>
    `;

    document.getElementById("ctx-open").onclick = () => {
      this.contextMenu.style.display = "none";
      this.appLauncher.launch(lastSelected.dataset.app, lastSelected);
    };

    document.getElementById("ctx-cut").onclick = () => {
      this.clipboardCurrentCopied = {
        action: "cut",
        icons: selectedIcons.map((i) => ({
          element: i,
          data: {
            app: i.dataset.app,
            name: i.dataset.name,
            path: i.dataset.path,
            innerHTML: i.innerHTML,
            className: i.className
          }
        }))
      };
      this.contextMenu.style.display = "none";
    };

    document.getElementById("ctx-copy").onclick = () => {
      this.clipboardCurrentCopied = {
        action: "copy",
        icons: selectedIcons.map((i) => ({
          data: {
            app: i.dataset.app,
            name: i.dataset.name,
            path: i.dataset.path,
            innerHTML: i.innerHTML,
            className: i.className
          }
        }))
      };
      this.contextMenu.style.display = "none";
    };

    document.getElementById("ctx-delete").onclick = () => {
      selectedIcons.forEach((i) => {
        i.remove();
      });
      this.contextMenu.style.display = "none";
    };

    document.getElementById("ctx-properties").onclick = () => {
      this.showPropertiesDialog(lastSelected);
      this.contextMenu.style.display = "none";
    };

    Object.assign(this.contextMenu.style, {
      left: `${e.pageX}px`,
      top: `${e.pageY}px`,
      display: "block"
    });
  }

  showPropertiesDialog(icon) {
    const winId = icon.id || `icon-${Date.now()}`;
    const dataset = icon.dataset;
    const rect = icon.getBoundingClientRect();
    const appId = dataset.app;

    const appInfo = this.appLauncher?.appMap?.[appId] || {};

    const infoLines = [
      `Name: ${dataset.name || "Unknown"}`,
      `Type: ${dataset.app || "Application"}`,
      dataset.path ? `Path: ${dataset.path}` : "",
      appInfo.type ? `App Type: ${appInfo.type}` : "",
      appInfo.swf ? `SWF Path: ${appInfo.swf}` : "",
      appInfo.url ? `URL: ${appInfo.url}` : "",
      dataset.core ? `Core: ${dataset.core}` : "",
      `Width: ${Math.round(rect.width)}px`,
      `Height: ${Math.round(rect.height)}px`,
      `Left: ${Math.round(rect.left)}px`,
      `Top: ${Math.round(rect.top)}px`,
      `Z-Index: ${icon.style.zIndex || "0"}`
    ].filter(Boolean);

    const contentHtml = infoLines.map((line) => `<div style="margin:2px 0;">${line}</div>`).join("");

    const propsWin = this.appLauncher.wm.createWindow(
      `${winId}-props`,
      `Properties: ${dataset.name || "Unknown"}`,
      "300px",
      "auto"
    );

    propsWin.innerHTML = `
        ${this.appLauncher.wm.getWindowHeader(`Properties: ${dataset.name || "Unknown"}`)}
        <div class="window-content" style="width:100%; height:100%; overflow:auto; user-select:text; padding:10px;">
            ${contentHtml}
        </div>
    `;

    desktop.appendChild(propsWin);
    this.appLauncher.wm.makeDraggable(propsWin);
    this.appLauncher.wm.makeResizable(propsWin);
    this.appLauncher.wm.setupWindowControls(propsWin);
  }

  showDesktopContextMenu(e) {
    const isFullscreen = !!document.fullscreenElement;
    const menuItems = [
      `<div id="ctx-new-notepad">New Notepad</div>`,
      `<div id="ctx-open-explorer">Open File Explorer</div>`,
      `<div id="ctx-open-terminal">Open Terminal</div>`
    ];

    if (this.clipboardCurrentCopied) {
      menuItems.push(`<div id="ctx-paste">Paste</div>`);
    }

    menuItems.push(
      `<hr>`,
      `<div class="ctx-submenu" id="ctx-sort">Sort icons <span class="submenu-arrow">▶</span>
        <div class="ctx-flyout">
          <div id="ctx-sort-name">By Name</div>
          <div id="ctx-sort-restore">Restore order</div>
        </div>
      </div>`,
      `<div class="ctx-submenu" id="ctx-background">Background <span class="submenu-arrow">▶</span>
        <div class="ctx-flyout" id="ctx-wallpaper-list"></div>
      </div>`,
      `<div id="ctx-fullscreen">${isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}</div>`,
      `<hr>`,
      `<div id="ctx-refresh">Refresh</div>`
    );

    this.contextMenu.innerHTML = menuItems.join("");

    document.getElementById("ctx-new-notepad").onclick = () => {
      this.contextMenu.style.display = "none";
      notepadApp.open();
    };

    document.getElementById("ctx-open-explorer").onclick = () => {
      this.contextMenu.style.display = "none";
      explorerApp.open();
    };

    document.getElementById("ctx-open-terminal").onclick = () => {
      this.contextMenu.style.display = "none";
      terminalApp.open();
    };

    if (this.clipboardCurrentCopied) {
      document.getElementById("ctx-paste").onclick = () => {
        this.pasteIcons(e.pageX, e.pageY);
        this.contextMenu.style.display = "none";
      };
    }

    document.getElementById("ctx-sort-name").onclick = () => {
      this.sortDesktopIconsByName();
      this.contextMenu.style.display = "none";
    };

    document.getElementById("ctx-sort-restore").onclick = () => {
      this.restoreDesktopIconOrder();
      this.contextMenu.style.display = "none";
    };

    this.buildWallpaperList();

    document.getElementById("ctx-fullscreen").onclick = () => {
      this.contextMenu.style.display = "none";
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        document.documentElement.requestFullscreen();
      }
    };

    document.getElementById("ctx-refresh").onclick = () => {
      this.contextMenu.style.display = "none";
      location.reload();
    };

    Object.assign(this.contextMenu.style, {
      left: `${e.pageX}px`,
      top: `${e.pageY}px`,
      display: "block"
    });

    this.contextMenu.querySelectorAll(".ctx-submenu").forEach((sub) => {
      sub.addEventListener("mouseenter", () => {
        const flyout = sub.querySelector(".ctx-flyout");
        if (!flyout) return;
        flyout.style.left = "100%";
        flyout.style.right = "auto";
        const rect = flyout.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
          flyout.style.left = "auto";
          flyout.style.right = "100%";
        }
      });
    });
  }

  getDesktopIconLabel(icon) {
    return icon.querySelector("div")?.textContent?.trim() || "";
  }

  snapshotDesktopIconOrder() {
    if (!originalDesktopIconOrder) {
      originalDesktopIconOrder = Array.from(desktop.querySelectorAll(".icon"));
    }
  }

  reflowDesktopIcons() {
    desktop.querySelectorAll(".icon").forEach((icon) => {
      icon.style.left = "";
      icon.style.top = "";
    });
    layoutIcons();
  }

  sortDesktopIconsByName() {
    this.snapshotDesktopIconOrder();
    const sorted = Array.from(desktop.querySelectorAll(".icon")).sort((a, b) =>
      this.getDesktopIconLabel(a).localeCompare(this.getDesktopIconLabel(b))
    );
    sorted.forEach((icon) => desktop.appendChild(icon));
    this.reflowDesktopIcons();
  }

  restoreDesktopIconOrder() {
    this.snapshotDesktopIconOrder();
    originalDesktopIconOrder.forEach((icon) => {
      if (icon.isConnected) desktop.appendChild(icon);
    });
    this.reflowDesktopIcons();
  }

  buildWallpaperList() {
    const list = document.getElementById("ctx-wallpaper-list");
    if (!list) return;
    list.innerHTML = "";

    const pictures = defaultStorage.home.reeyuki.Pictures || {};
    const currentSrc = document.getElementById("wallpaper-img")?.src || "";

    Object.entries(pictures)
      .filter(([, item]) => item.kind === "image")
      .forEach(([name, item]) => {
        const entry = document.createElement("div");
        const isCurrent = currentSrc.endsWith(item.content);
        entry.textContent = `${isCurrent ? "✓ " : ""}${name}`;
        entry.onclick = () => {
          SystemUtilities.setWallpaper(item.content);
          this.contextMenu.style.display = "none";
        };
        list.appendChild(entry);
      });

    const randomEntry = document.createElement("div");
    randomEntry.textContent = "Random wallpaper";
    randomEntry.onclick = () => {
      SystemUtilities.setRandomWallpaper();
      this.contextMenu.style.display = "none";
    };
    list.appendChild(randomEntry);
  }

  pasteIcons(x, y) {
    if (!this.clipboardCurrentCopied) return;

    const { action, icons } = this.clipboardCurrentCopied;

    icons.forEach((iconData, index) => {
      const newIcon = document.createElement("div");
      newIcon.className = iconData.data.className;
      newIcon.innerHTML = iconData.data.innerHTML;
      newIcon.dataset.app = iconData.data.app;
      newIcon.dataset.name = iconData.data.name;
      newIcon.dataset.path = iconData.data.path;

      Object.assign(newIcon.style, {
        position: "absolute",
        left: `${x + index * 10}px`,
        top: `${y + index * 10}px`,
        userSelect: "none",
        webkitUserDrag: "none"
      });

      this.makeIconDraggable(newIcon);

      this.desktop.appendChild(newIcon);

      if (action === "cut" && iconData.element) {
        iconData.element.remove();
      }
    });

    if (action === "cut") {
      this.clipboardCurrentCopied = null;
    }
  }

  setupSelectionBox() {
    let startX, startY;
    this.desktop.addEventListener("mousedown", (e) => {
      if (e.target !== this.desktop) return;

      startX = e.pageX;
      startY = e.pageY;

      Object.assign(this.selectionBox.style, {
        left: `${startX}px`,
        top: `${startY}px`,
        width: "0px",
        height: "0px",
        display: "block"
      });

      const selectableIcons = document.querySelectorAll(".icon.selectable");
      selectableIcons.forEach((icon) => icon.classList.remove("selected"));

      const onMouseMove = (e) => {
        const width = Math.abs(e.pageX - startX);
        const height = Math.abs(e.pageY - startY);
        const left = Math.min(e.pageX, startX);
        const top = Math.min(e.pageY, startY);

        Object.assign(this.selectionBox.style, {
          width: `${width}px`,
          height: `${height}px`,
          left: `${left}px`,
          top: `${top}px`
        });

        const boxRect = this.selectionBox.getBoundingClientRect();
        selectableIcons.forEach((icon) => {
          const iconRect = icon.getBoundingClientRect();
          const isOverlapping = !(
            iconRect.right < boxRect.left ||
            iconRect.left > boxRect.right ||
            iconRect.bottom < boxRect.top ||
            iconRect.top > boxRect.bottom
          );

          if (isOverlapping) {
            icon.classList.add("selected");
          } else {
            icon.classList.remove("selected");
          }
        });
      };

      const onMouseUp = () => {
        this.selectionBox.style.display = "none";
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    });
  }

  setupStartMenu() {
    this.startMenu.querySelectorAll(".start-item").forEach((item) => {
      item.onclick = (e) => {
        e.stopPropagation();
        const app = item.dataset.app;
        if (app === "documents") {
          explorerApp.open();
          explorerApp.navigate(["home", "reeyuki", "Documents"]);
        } else if (app === "pictures") {
          explorerApp.open();
          explorerApp.navigate(["home", "reeyuki", "Pictures"]);
        } else if (app === "notes") {
          notepadApp.open();
        }

        this.startMenu.style.display = "none";
      };
    });
  }
}

const desktop = document.getElementById("desktop");

const fileSystemManager = new FileSystemManager();
const windowManager = new WindowManager();
const notepadApp = new NotepadApp(fileSystemManager, windowManager, null);
const explorerApp = new ExplorerApp(fileSystemManager, windowManager, notepadApp);
const browserApp = new BrowserApp(windowManager);
notepadApp.setExplorer(explorerApp);
const terminalApp = new TerminalApp(fileSystemManager, windowManager);
const musicPlayer = new MusicPlayer();
const cameraApp = new CameraApp(windowManager);
const calculatorApp = new CalculatorApp(windowManager);
const emojiApp = new EmojiApp(windowManager);
const settingsApp = new SettingsApp(windowManager);
const appLauncher = new AppLauncher(
  windowManager,
  fileSystemManager,
  musicPlayer,
  explorerApp,
  terminalApp,
  notepadApp,
  browserApp,
  cameraApp,
  calculatorApp,
  emojiApp,
  settingsApp
);
settingsApp.appLauncher = appLauncher;
setIconFilterAppMap(appLauncher.appMap);
applyRuffleConfig();
applyHideIcons();
applyCustomCursor();
applyWindowOpacity();
applyStretchScroll();
const desktopUI = new DesktopUI(appLauncher);
window.__appLauncher = appLauncher;

SystemUtilities.startClock();
if (getFlag(FLAG_CYCLE_WALLPAPER, true)) {
  SystemUtilities.setRandomWallpaper();
} else {
  SystemUtilities.loadWallpaper();
}

document.getElementById("date")?.addEventListener("click", (e) => {
  e.stopPropagation();
  toggleCalendarPopup();
});

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);

const game = urlParams.get("game");
if (game) {
  setTimeout(() => {
    appLauncher.launch(game);
  }, 100);
} else {
  let autostart = null;
  try {
    autostart = localStorage.getItem(FLAG_AUTOSTART) || null;
  } catch {}
  if (autostart && appLauncher.appMap[autostart]) {
    setTimeout(() => {
      appLauncher.launch(autostart);
    }, 100);
  }
}

const ICON_WIDTH = 80;
const ICON_HEIGHT = 100;
const GAP = 5;

let originalDesktopIconOrder = null;

const icons = desktop.querySelectorAll(".icon");

function layoutIcons() {
  const desktopHeight = desktop.clientHeight;
  const ICON_WIDTH = 80;
  const ICON_HEIGHT = 100;
  const GAP = 5;

  let x = GAP;
  let y = GAP;

  icons.forEach((icon) => {
    if (!icon.style.left || !icon.style.top) {
      icon.style.position = "absolute";
      icon.style.left = `${x}px`;
      icon.style.top = `${y}px`;

      y += ICON_HEIGHT + GAP;

      if (y + ICON_HEIGHT > desktopHeight) {
        y = GAP;
        x += ICON_WIDTH + GAP;
      }
    }
  });
}

window.addEventListener("load", layoutIcons);
window.addEventListener("resize", layoutIcons);

setupStartMenu();
