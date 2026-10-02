// js/notification-optin.js
// PashuSetu — "Enable Notifications" button, wired to POST /users/{id}/device-token.
//
// HONEST LIMITATION: a real push-notification device token normally comes
// from integrating Firebase Cloud Messaging's JS SDK (which needs your
// Firebase project config — apiKey, senderId, etc. — not included in the
// backend doc you shared). This widget requests browser notification
// PERMISSION for real, but generates a placeholder token string in place of
// a real FCM token. Swap generatePlaceholderToken() for real
// firebase.messaging().getToken() once your team wires up Firebase
// Messaging on the frontend.
//
// HOW TO USE:
// 1. Add this container wherever you want the button:
//      <div id="notification-optin-container"></div>
// 2. Add these script tags after your existing ones:
//      <script src="js/api-client-v2.js"></script>
//      <script src="js/notification-optin.js"></script>

(function () {
  const CONTAINER_ID = "notification-optin-container";
  const STYLE_ID = "notification-optin-styles";

  // Placeholder — replace with the real logged-in user's ID once auth exists.
  const USER_ID = "USER001";

  window.addEventListener("load", init);

  function init() {
    const container = document.getElementById(CONTAINER_ID);
    if (!container) return;

    injectStyles();
    container.innerHTML = buildSkeleton();

    document.getElementById("no-enable-btn").addEventListener("click", handleEnable);
    reflectCurrentPermission();
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .no-card {
        display: flex; align-items: center; justify-content: space-between; gap: 14px;
        background: #fff; border: 1px solid #E5E7EB; border-radius: 14px; padding: 16px 20px;
      }
      .no-text h4 { font-size: 13.5px; color: #1B2A4A; font-weight: 700; margin-bottom: 2px; }
      .no-text p { font-size: 11.5px; color: #5B6560; }
      .no-btn {
        padding: 9px 16px; border-radius: 8px; font-size: 12.5px; font-weight: 700;
        border: none; cursor: pointer; background: #B8863B; color: #fff; white-space: nowrap;
      }
      .no-btn:hover { background: #8B6525; }
      .no-btn:disabled { background: #10B981; cursor: default; }
      .no-btn.denied { background: #EF4444; cursor: not-allowed; }
    `;
    document.head.appendChild(style);
  }

  function buildSkeleton() {
    return `
      <div class="no-card">
        <div class="no-text">
          <h4>🔔 Withdrawal &amp; Compliance Alerts</h4>
          <p>Get notified when an animal's withdrawal period is ending</p>
        </div>
        <button class="no-btn" id="no-enable-btn">Enable Notifications</button>
      </div>
    `;
  }

  function reflectCurrentPermission() {
    const btn = document.getElementById("no-enable-btn");
    if (!("Notification" in window)) {
      btn.textContent = "Not supported in this browser";
      btn.disabled = true;
      return;
    }
    if (Notification.permission === "granted") {
      btn.textContent = "✅ Enabled";
      btn.disabled = true;
    } else if (Notification.permission === "denied") {
      btn.textContent = "🚫 Blocked in browser settings";
      btn.classList.add("denied");
    }
  }

  async function handleEnable() {
    const btn = document.getElementById("no-enable-btn");

    if (!("Notification" in window)) return;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      btn.textContent = permission === "denied" ? "🚫 Blocked in browser settings" : "Enable Notifications";
      if (permission === "denied") btn.classList.add("denied");
      return;
    }

    const token = generatePlaceholderToken();

    try {
      await ApiClientV2.saveDeviceToken(USER_ID, token);
      btn.textContent = "✅ Enabled";
      btn.disabled = true;
      new Notification("PashuSetu", { body: "Notifications enabled — you'll get withdrawal alerts here." });
    } catch (err) {
      btn.textContent = "Enable Notifications";
      alert(`Could not save your device token to the backend: ${err.message}`);
    }
  }

  // Placeholder only — see file header note about real FCM integration.
  function generatePlaceholderToken() {
    return `placeholder-token-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`;
  }
})();