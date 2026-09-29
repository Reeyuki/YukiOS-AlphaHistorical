import { isEdgeSnapEnabled, isTransparencyEnabled } from "./settings.js";

const styleEl = document.getElementById("window-style");
let styleParent = styleEl.parentNode;

function hideTransparency() {
  if (styleEl.parentNode) {
    styleParent.removeChild(styleEl);
  }
}

function restoreTransparency() {
  if (!styleEl.parentNode) {
    styleParent.appendChild(styleEl);
  }
}

export class WindowManager {
  constructor() {
    this.openWindows = new Map();
    this.zIndexCounter = 1000;
    this.gameWindowCount = 0;
  }
  updateTransparency() {
    if (!isTransparencyEnabled()) {
      hideTransparency();
    } else if (this.gameWindowCount > 0) {
      hideTransparency();
    } else {
      restoreTransparency();
    }
  }
  createWindow(id, title, width = "80vw", height = "80vh", isGame = false) {
    const win = document.createElement("div");
    win.className = "window";
    win.id = id;
    win.dataset.fullscreen = "false";

    const widthStr = width != null ? String(width) : "80vw";
    const heightStr = height != null ? String(height) : "80vh";

    const vw = widthStr.includes("vw") ? (window.innerWidth * parseFloat(widthStr)) / 100 : parseInt(widthStr);
    const vh = heightStr.includes("vh") ? (window.innerHeight * parseFloat(heightStr)) / 100 : parseInt(heightStr);

    Object.assign(win.style, {
      width: `${vw}px`,
      height: `${vh}px`,
      left: `${(window.innerWidth - vw) / 2}px`,
      top: `${(window.innerHeight - vh) / 2}px`,
      position: "absolute",
      zIndex: this.zIndexCounter++
    });
    if (isGame) {
      this.gameWindowCount++;
    }
    this.updateTransparency();

    return win;
  }

  addToTaskbar(winId, title, iconUrl) {
    if (document.getElementById(`taskbar-${winId}`)) return;

    const taskbarItem = document.createElement("div");
    taskbarItem.id = `taskbar-${winId}`;
    taskbarItem.className = "taskbar-item";

    if (iconUrl) {
      const icon = document.createElement("img");
      icon.src = iconUrl;
      taskbarItem.appendChild(icon);
    }

    const text = document.createElement("span");
    text.textContent = title;
    taskbarItem.appendChild(text);

    taskbarItem.onclick = () => {
      const win = document.getElementById(winId);
      if (win) {
        if (win.style.display === "none") {
          win.style.display = "block";
          taskbarItem.classList.add("active");
        } else {
          this.bringToFront(win);
        }
      }
    };
    taskbarItem.oncontextmenu = (e) => {
      e.preventDefault();
      const existingMenu = document.getElementById("taskbar-context-menu");
      if (existingMenu) existingMenu.remove();

      const menu = document.createElement("div");
      menu.id = "taskbar-context-menu";
      menu.className = "kde-menu";

      const win = document.getElementById(winId);

      const addMenuItem = (text, action) => {
        const item = document.createElement("div");
        item.textContent = text;
        item.className = "kde-item";
        item.onclick = () => {
          action();
          menu.remove();
        };
        menu.appendChild(item);
      };

      addMenuItem(win.style.display === "none" ? "Restore" : "Minimize", () => {
        if (win.style.display === "none") win.style.display = "block";
        else this.minimizeWindow(win);
        this.bringToFront(win);
      });

      addMenuItem(win.dataset.fullscreen === "true" ? "Restore Size" : "Maximize", () => {
        this.toggleFullscreen(win);
        this.bringToFront(win);
      });

      addMenuItem("Bring to Front", () => this.bringToFront(win));

      addMenuItem("Properties", () => {
        const appInfo = this.openWindows.get(winId);
        if (!appInfo) return;

        const win = document.getElementById(winId);
        if (!win) return;

        const dataset = win.dataset;
        const rect = win.getBoundingClientRect();

        const infoLines = [
          `Window ID: ${winId}`,
          `Title: ${appInfo.title}`,
          dataset.appType ? `Type: ${dataset.appType}` : "",
          dataset.appId ? `App ID: ${dataset.appId}` : "",
          dataset.swf ? `SWF Path: ${dataset.swf}` : "",
          dataset.rom ? `ROM: ${dataset.rom}` : "",
          dataset.core ? `Core: ${dataset.core}` : "",
          dataset.externalUrl ? `URL: ${dataset.externalUrl}` : "",
          `Width: ${Math.round(rect.width)}px`,
          `Height: ${Math.round(rect.height)}px`,
          `Left: ${Math.round(rect.left)}px`,
          `Top: ${Math.round(rect.top)}px`,
          `Z-Index: ${win.style.zIndex}`,
          `Fullscreen: ${dataset.fullscreen === "true" ? "Yes" : "No"}`
        ].filter(Boolean);

        const contentHtml = infoLines.map((line) => `<div style="margin:2px 0;">${line}</div>`).join("");

        const propsWin = this.createWindow(`${winId}-props`, `Properties: ${appInfo.title}`, "40vw", "40vh");

        propsWin.innerHTML = `
          ${this.wm.getWindowHeader(`Properties: ${appInfo.title}`)}
          <div class="window-content" style="width:100%; height:100%; overflow:auto; user-select:text;">
            ${contentHtml}
          </div>
        `;

        desktop.appendChild(propsWin);
        this.makeDraggable(propsWin);
        this.makeResizable(propsWin);
        this.setupWindowControls(propsWin);
      });

      addMenuItem("Close Window", () => {
        this.removeFromTaskbar(winId);
        if (win) win.remove();
      });

      document.body.appendChild(menu);

      const rect = menu.getBoundingClientRect();
      let posX = e.pageX;
      let posBottom = window.innerHeight - e.pageY;

      if (posX + rect.width > window.innerWidth) posX = window.innerWidth - rect.width - 10;
      if (posBottom + rect.height > window.innerHeight) posBottom = 10;

      menu.style.setProperty("--ctx-left", `${posX}px`);
      menu.style.setProperty("--ctx-bottom", `${posBottom}px`);

      document.addEventListener("click", function removeMenu() {
        menu.remove();
        document.removeEventListener("click", removeMenu);
      });
    };

    const taskbarWindows = document.getElementById("taskbar-windows");
    taskbarWindows.appendChild(taskbarItem);
    this.openWindows.set(winId, { taskbarItem, title });
  }

  registerCloseWindow(closeButton, winId) {
    closeButton.addEventListener("click", () => {
      const win = document.getElementById(winId);
      if (win) {
        win.remove();
      } else return;
      this.removeFromTaskbar(winId);
    });
  }

  removeFromTaskbar(winId) {
    const taskbarItem = document.getElementById(`taskbar-${winId}`);
    if (taskbarItem) taskbarItem.remove();
    this.openWindows.delete(winId);
  }

  bringToFront(win) {
    if (win) win.style.zIndex = this.zIndexCounter++;
  }

  minimizeWindow(win) {
    win.style.display = "none";
    const taskbarItem = document.getElementById(`taskbar-${win.id}`);
    if (taskbarItem) taskbarItem.style.background = "#1a1a1a";
  }

  toggleFullscreen(win) {
    const wasFullscreen = win.dataset.fullscreen === "true";
    const header = win.querySelector(".window-header");

    if (wasFullscreen) {
      if (document.fullscreenElement === win) {
        document.exitFullscreen();
      }

      Object.assign(win.style, {
        width: win.dataset.prevWidth,
        height: win.dataset.prevHeight,
        left: win.dataset.prevLeft,
        top: win.dataset.prevTop
      });

      if (header) header.style.display = "";
      win.dataset.fullscreen = "false";
    } else {
      Object.assign(win.dataset, {
        prevWidth: win.style.width,
        prevHeight: win.style.height,
        prevLeft: win.style.left,
        prevTop: win.style.top
      });

      const makeFullscreen = () => {
        Object.assign(win.style, {
          width: "100vw",
          height: "100vh",
          left: "0",
          top: "0"
        });
        if (header) header.style.display = "none";
      };

      if (win.requestFullscreen) {
        win.requestFullscreen().then(makeFullscreen).catch(makeFullscreen);
      } else {
        makeFullscreen();
      }

      win.dataset.fullscreen = "true";

      const onFullscreenChange = () => {
        if (!document.fullscreenElement) {
          if (header) header.style.display = "";
          win.dataset.fullscreen = "false";
          document.removeEventListener("fullscreenchange", onFullscreenChange);
        }
      };

      document.addEventListener("fullscreenchange", onFullscreenChange);
    }
  }

  setupWindowControls(win) {
    win.querySelector(".close-btn").onclick = () => {
      this.removeFromTaskbar(win.id);
      win.remove();
      const isGame = win.dataset.isGame === "true";
      if (isGame) {
        this.gameWindowCount = Math.max(0, this.gameWindowCount - 1);
      }
      this.updateTransparency();
    };
    win.querySelector(".minimize-btn").onclick = () => this.minimizeWindow(win);
    win.querySelector(".maximize-btn").onclick = () => this.toggleFullscreen(win);
    win.querySelector(".download-btn").onclick = () => this.downloadWindowContent(win);
    const closeBtn = win.querySelector(".close-btn");
    if (closeBtn) this.registerCloseWindow(closeBtn);
    win.addEventListener("mousedown", () => this.bringToFront(win));
  }

  makeDraggable(win) {
    const header = win.querySelector(".window-header");
    header.onmousedown = (e) => {
      if (e.target.closest("button")) return;
      if (win.dataset.snapped) this.unsnapWindow(win);
      const ox = e.clientX - win.offsetLeft;
      const oy = e.clientY - win.offsetTop;
      document.onmousemove = (e) => {
        win.style.left = `${e.clientX - ox}px`;
        win.style.top = `${e.clientY - oy}px`;
        if (isEdgeSnapEnabled()) this.updateSnapPreview(win, e.clientX, e.clientY);
      };
      document.onmouseup = (e) => {
        document.onmousemove = null;
        if (isEdgeSnapEnabled()) {
          this.applySnap(win, e.clientX, e.clientY);
        } else {
          const ghost = document.getElementById("snap-preview");
          if (ghost) ghost.style.display = "none";
          win.dataset.snapZone = "";
        }
      };
    };
  }

  getWorkArea() {
    const taskbarH = document.getElementById("taskbar")?.offsetHeight || 40;
    return { width: window.innerWidth, height: window.innerHeight - taskbarH };
  }

  getSnapZone(x, y) {
    const edge = 12;
    if (y <= edge) return "top";
    if (x <= edge) return "left";
    if (x >= window.innerWidth - edge) return "right";
    return null;
  }

  getSnapRect(zone) {
    const area = this.getWorkArea();
    if (zone === "left") {
      return { left: 0, top: 0, width: Math.floor(area.width / 2), height: area.height };
    }
    if (zone === "right") {
      return { left: Math.ceil(area.width / 2), top: 0, width: Math.floor(area.width / 2), height: area.height };
    }
    return { left: 0, top: 0, width: area.width, height: area.height };
  }

  getSnapPreviewEl() {
    let ghost = document.getElementById("snap-preview");
    if (!ghost) {
      ghost = document.createElement("div");
      ghost.id = "snap-preview";
      document.body.appendChild(ghost);
    }
    return ghost;
  }

  updateSnapPreview(win, x, y) {
    const ghost = this.getSnapPreviewEl();
    const zone = this.getSnapZone(x, y);
    if (!zone) {
      ghost.style.display = "none";
      win.dataset.snapZone = "";
      return;
    }
    const rect = this.getSnapRect(zone);
    Object.assign(ghost.style, {
      display: "block",
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`
    });
    win.dataset.snapZone = zone;
  }

  applySnap(win, x, y) {
    const ghost = document.getElementById("snap-preview");
    if (ghost) ghost.style.display = "none";
    const zone = win.dataset.snapZone;
    win.dataset.snapZone = "";
    if (!zone) return;

    if (!win.dataset.snapped) {
      win.dataset.snapPrevWidth = win.style.width;
      win.dataset.snapPrevHeight = win.style.height;
      win.dataset.snapPrevLeft = win.style.left;
      win.dataset.snapPrevTop = win.style.top;
    }
    const rect = this.getSnapRect(zone);
    Object.assign(win.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`
    });
    win.dataset.snapped = zone;
  }

  unsnapWindow(win) {
    if (win.dataset.snapPrevWidth) {
      Object.assign(win.style, {
        width: win.dataset.snapPrevWidth,
        height: win.dataset.snapPrevHeight,
        left: win.dataset.snapPrevLeft,
        top: win.dataset.snapPrevTop
      });
    }
    delete win.dataset.snapped;
    delete win.dataset.snapPrevWidth;
    delete win.dataset.snapPrevHeight;
    delete win.dataset.snapPrevLeft;
    delete win.dataset.snapPrevTop;
  }

  makeResizable(win) {
    const margin = 10;

    const getDirection = (e) => {
      const rect = win.getBoundingClientRect();
      let dir = "";
      if (e.clientY - rect.top < margin) dir += "n";
      else if (rect.bottom - e.clientY < margin) dir += "s";
      if (e.clientX - rect.left < margin) dir += "w";
      else if (rect.right - e.clientX < margin) dir += "e";
      return dir;
    };

    win.addEventListener("mousemove", (e) => {
      const dir = getDirection(e);
      const cursorMap = {
        n: "n-resize",
        s: "s-resize",
        w: "w-resize",
        e: "e-resize",
        nw: "nw-resize",
        ne: "ne-resize",
        sw: "sw-resize",
        se: "se-resize",
        "": "default"
      };
      win.style.cursor = cursorMap[dir] || "default";
    });

    win.addEventListener("mousedown", (e) => {
      const direction = getDirection(e);
      if (!direction) return;

      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const rect = win.getBoundingClientRect();
      const startWidth = rect.width;
      const startHeight = rect.height;
      const startLeft = rect.left;
      const startTop = rect.top;

      const doDrag = (e) => {
        let newWidth = startWidth;
        let newHeight = startHeight;
        let newLeft = startLeft;
        let newTop = startTop;

        if (direction.includes("e")) newWidth = startWidth + (e.clientX - startX);
        if (direction.includes("s")) newHeight = startHeight + (e.clientY - startY);
        if (direction.includes("w")) {
          newWidth = startWidth - (e.clientX - startX);
          newLeft = startLeft + (e.clientX - startX);
        }
        if (direction.includes("n")) {
          newHeight = startHeight - (e.clientY - startY);
          newTop = startTop + (e.clientY - startY);
        }
        const MIN_SIZE = 300;

        if (newWidth > MIN_SIZE) {
          win.style.width = `${newWidth}px`;
          win.style.left = `${newLeft}px`;
        }
        if (newHeight > MIN_SIZE) {
          win.style.height = `${newHeight}px`;
          win.style.top = `${newTop}px`;
        }
      };

      const stopDrag = () => {
        document.removeEventListener("mousemove", doDrag);
        document.removeEventListener("mouseup", stopDrag);
      };

      document.addEventListener("mousemove", doDrag);
      document.addEventListener("mouseup", stopDrag);
    });
  }
  getWindowControls() {
    return `<div class="window-controls">
      <button class="minimize-btn" title="Minimize"><svg viewBox="0 0 10 1" xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v1H0z"></path></svg></button>
      <button class="download-btn" title="Download">
        <svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><path d="M5 7L1.5 3.5h2V0h3v3.5h2L5 7zM0 9h10v1H0z"></path></svg>
      </button>
      <button class="maximize-btn" title="Maximize"><svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><path d="M0 0v10h10V0H0zm1 1h8v8H1V1z"></path></svg></button>
      <button class="close-btn" title="Close"><svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><path d="M10.2.7L9.5 0 5.1 4.4.7 0 0 .7l4.4 4.4L0 9.5l.7.7 4.4-4.4 4.4 4.4.7-.7-4.4-4.4z"></path></svg></button>
    </div>
    `;
  }

  getWindowHeader(title, iconUrl, extraControls = "") {
    const icon = iconUrl
      ? `<img class="window-title-icon" src="${iconUrl}" alt="" />`
      : `<i class="fas fa-desktop" style="color:white;margin-right:6px;font-size:30px;vertical-align:middle;"></i>`;
    return `<div class="window-header">
        <span>${icon}${title}</span>
        <div class="window-controls">
          <button class="minimize-btn" title="Minimize"><svg viewBox="0 0 10 1" xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v1H0z"></path></svg></button>
          ${extraControls}
          <button class="download-btn" title="Download">
            <svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><path d="M5 7L1.5 3.5h2V0h3v3.5h2L5 7zM0 9h10v1H0z"></path></svg>
          </button>
          <button class="maximize-btn" title="Maximize"><svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><path d="M0 0v10h10V0H0zm1 1h8v8H1V1z"></path></svg></button>
          <button class="close-btn" title="Close"><svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><path d="M10.2.7L9.5 0 5.1 4.4.7 0 0 .7l4.4 4.4L0 9.5l.7.7 4.4-4.4 4.4 4.4.7-.7-4.4-4.4z"></path></svg></button>
        </div>
      </div>
    `;
  }

  downloadWindowContent(win) {
    const title = win.querySelector(".window-header > span")?.textContent?.trim() || win.id || "window";
    const content = win.querySelector(".window-content")?.innerHTML || "";
    const blob = new Blob(
      [`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body>${content}</body></html>`],
      { type: "text/html" }
    );
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${title.replace(/[^\w\-]+/g, "_")}.html`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 1000);
  }

  showPopup(text) {
    const popup = document.createElement("div");
    popup.textContent = text;
    Object.assign(popup.style, {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      padding: "20px 40px",
      backgroundColor: "rgba(0,0,0,0.8)",
      color: "#fff",
      fontSize: "18px",
      borderRadius: "10px",
      textAlign: "center",
      zIndex: 9999,
      cursor: "pointer",
      boxShadow: "0 4px 15px rgba(0,0,0,0.3)"
    });
    popup.addEventListener("click", () => {
      popup.remove();
    });
    document.body.appendChild(popup);
  }
}
