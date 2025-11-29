/**
 * NotificationManager - DOM-based notification system for CodeMaster
 *
 * Provides a simple notification system for displaying user-facing messages.
 * Works in browser context only; gracefully handles background/service worker context.
 */

class NotificationManager {
  constructor() {
    this.container = null;
    this.notifications = new Map();
    this.isBackgroundContext = typeof document === "undefined";
    if (!this.isBackgroundContext) {
      this.init();
    }
  }

  init() {
    if (this.isBackgroundContext) {
      return;
    }

    if (!document.getElementById("codemaster-notifications")) {
      this.container = document.createElement("div");
      this.container.id = "codemaster-notifications";
      this.container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        max-width: 400px;
        pointer-events: none;
      `;
      document.body.appendChild(this.container);
    } else {
      this.container = document.getElementById("codemaster-notifications");
    }
  }

  show(options) {
    if (this.isBackgroundContext) {
      const { _title = "Notification", _message = "", type = "info" } = options;
      const _logMethod =
        type === "error" ? "error" : type === "warning" ? "warn" : "log";
      return `background-${Date.now()}`;
    }

    const {
      id = `notification-${Date.now()}`,
      title = "Notification",
      message = "",
      type = "info",
      duration = 5000,
      persistent = false,
      actions = [],
    } = options;

    if (this.notifications.has(id)) {
      this.hide(id);
    }

    const notification = this.createNotification({
      id,
      title,
      message,
      type,
      actions,
    });

    this.container.appendChild(notification);
    this.notifications.set(id, notification);

    setTimeout(() => {
      notification.style.transform = "translateX(0)";
      notification.style.opacity = "1";
    }, 10);

    if (!persistent && duration > 0) {
      setTimeout(() => this.hide(id), duration);
    }

    return id;
  }

  createNotification({ id, title, message, type, actions }) {
    const notification = document.createElement("div");
    notification.id = id;
    notification.style.cssText = `
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      margin-bottom: 12px;
      padding: 16px;
      transform: translateX(100%);
      transition: all 0.3s ease;
      opacity: 0;
      pointer-events: auto;
      position: relative;
      ${this.getTypeStyles(type)}
    `;

    const header = document.createElement("div");
    header.style.cssText =
      "display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;";

    const titleEl = document.createElement("div");
    titleEl.style.cssText = `
      font-weight: 600;
      font-size: 14px;
      color: ${this.getTypeColor(type)};
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    titleEl.innerHTML = this.getTypeIcon(type);
    const titleText = document.createTextNode(` ${title}`);
    titleEl.appendChild(titleText);

    const closeBtn = document.createElement("button");
    closeBtn.style.cssText = `
      background: none;
      border: none;
      font-size: 18px;
      cursor: pointer;
      color: #666;
      padding: 0;
      width: 20px;
      height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    closeBtn.innerHTML = "×";
    closeBtn.onclick = () => this.hide(id);

    header.appendChild(titleEl);
    header.appendChild(closeBtn);

    if (message) {
      const messageEl = document.createElement("div");
      messageEl.style.cssText =
        "font-size: 13px; color: #555; margin-bottom: 12px; line-height: 1.4;";
      messageEl.textContent = message;
      notification.appendChild(header);
      notification.appendChild(messageEl);
    } else {
      notification.appendChild(header);
    }

    if (actions && actions.length > 0) {
      const actionsEl = document.createElement("div");
      actionsEl.style.cssText = "display: flex; gap: 8px; margin-top: 12px;";

      actions.forEach((action) => {
        const btn = document.createElement("button");
        btn.style.cssText = `
          background: ${
            action.primary ? this.getTypeColor(type) : "transparent"
          };
          color: ${action.primary ? "white" : this.getTypeColor(type)};
          border: 1px solid ${this.getTypeColor(type)};
          padding: 6px 12px;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
          transition: opacity 0.2s;
        `;
        btn.textContent = action.label;
        btn.onclick = () => {
          if (action.onClick) action.onClick();
          if (action.closeOnClick !== false) this.hide(id);
        };
        actionsEl.appendChild(btn);
      });

      notification.appendChild(actionsEl);
    }

    return notification;
  }

  hide(id) {
    if (this.isBackgroundContext) {
      this.notifications.delete(id);
      return;
    }

    const notification = this.notifications.get(id);
    if (notification) {
      notification.style.transform = "translateX(100%)";
      notification.style.opacity = "0";

      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
        this.notifications.delete(id);
      }, 300);
    }
  }

  hideAll() {
    if (this.isBackgroundContext) {
      this.notifications.clear();
      return;
    }
    this.notifications.forEach((_, id) => this.hide(id));
  }

  getTypeStyles(type) {
    const styles = {
      info: "border-left: 4px solid #339af0;",
      success: "border-left: 4px solid #51cf66;",
      warning: "border-left: 4px solid #ffd43b;",
      error: "border-left: 4px solid #ff6b6b;",
    };
    return styles[type] || styles.info;
  }

  getTypeColor(type) {
    const colors = {
      info: "#339af0",
      success: "#51cf66",
      warning: "#fd7e14",
      error: "#ff6b6b",
    };
    return colors[type] || colors.info;
  }

  getTypeIcon(type) {
    const icons = {
      info: "🔵",
      success: "✅",
      warning: "⚠️",
      error: "❌",
    };
    return icons[type] || icons.info;
  }
}

export default NotificationManager;
