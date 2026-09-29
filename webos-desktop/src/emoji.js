const EMOJI_MART_URL = "https://cdn.jsdelivr.net/npm/emoji-mart@latest/dist/browser.js";

export class EmojiApp {
  constructor(windowManager) {
    this.wm = windowManager;
    this.previewTimer = null;
  }

  loadEmojiMart() {
    if (typeof window.EmojiMart !== "undefined") {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = EMOJI_MART_URL;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async copyEmoji(emoji) {
    const value = emoji?.native;
    if (!value) return false;

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch (error) {
        console.warn("[Emoji] Clipboard API failed:", error);
      }
    }

    return this.copyEmojiWithSelection(value);
  }

  copyEmojiWithSelection(value) {
    const textArea = document.createElement("textarea");
    textArea.value = value;
    textArea.readOnly = true;
    textArea.className = "emoji-selector-copy-buffer";
    document.body.appendChild(textArea);
    textArea.select();
    textArea.setSelectionRange(0, value.length);

    try {
      return document.execCommand("copy");
    } catch (error) {
      console.warn("[Emoji] Selection copy failed:", error);
      return false;
    } finally {
      textArea.remove();
    }
  }

  showPreview(win, message) {
    const preview = win.querySelector(".emoji-preview");
    if (!preview) return;

    clearTimeout(this.previewTimer);
    preview.textContent = message;
    preview.classList.add("visible");
    this.previewTimer = setTimeout(() => {
      preview.classList.remove("visible");
    }, 1500);
  }

  async initEmojiSelector(win) {
    try {
      await this.loadEmojiMart();
    } catch {
      this.showPreview(win, "Could not load emoji library (offline?)");
      return;
    }

    if (typeof window.EmojiMart !== "undefined") {
      const picker = new window.EmojiMart.Picker({
        onEmojiSelect: async (emoji) => {
          const copied = await this.copyEmoji(emoji);
          const label = copied ? "Copied" : "Saved";
          this.showPreview(win, `${label}: ${emoji.native}`);
        },
        theme: "dark",
        set: "native",
        skinTonePosition: "search",
        previewPosition: "none"
      });

      const container = win.querySelector("#emoji-mart-container");
      if (container) {
        container.appendChild(picker);
      }
    }
  }

  open() {
    const existing = document.getElementById("emoji-win");
    if (existing) {
      this.wm.bringToFront(existing);
      return;
    }

    const win = this.wm.createWindow("emoji-win", "Emoji", "355px", "500px");
    Object.assign(win.style, { left: "350px", top: "120px" });

    win.innerHTML = `
      ${this.wm.getWindowHeader("Emoji", "../static/icons/emoji.svg")}
      <div class="window-content">
        <div class="emoji-selector-container">
          <div id="emoji-mart-container" class="emoji-mart-container"></div>
          <div class="emoji-preview"></div>
        </div>
      </div>`;

    desktop.appendChild(win);
    this.wm.makeDraggable(win);
    this.wm.makeResizable(win);
    this.wm.setupWindowControls(win);
    this.wm.addToTaskbar(win.id, "Emoji", "../static/icons/emoji.svg");

    this.initEmojiSelector(win);
  }
}
