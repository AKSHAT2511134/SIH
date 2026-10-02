// js/feed-log-widget.js
// PashuSetu — Farmer Feed AMU Log form.
// Matches your flowchart's "FARMER FEED AMU LOG" box, which had no UI at all
// until now. Wired to the real backend's POST /feed-logs (marked "Done").
//
// NOTE: there is no GET /feed-logs endpoint in the current backend doc, so
// this widget can only show logs submitted THIS session (kept in memory) —
// it cannot fetch past history. Ask your backend teammate for a GET
// endpoint if a real history view is needed later.
//
// HOW TO USE:
// 1. Add this container wherever you want the form:
//      <div id="feed-log-widget-container"></div>
// 2. Add these two script tags, in this order, after your other scripts:
//      <script src="js/api-client-v2.js"></script>
//      <script src="js/feed-log-widget.js"></script>

(function () {
  const CONTAINER_ID = "feed-log-widget-container";
  const STYLE_ID = "feed-log-widget-styles";

  // Placeholder — replace with the real logged-in farmer's userId once auth exists.
  const FARMER_ID = "USER001";

  const sessionLogs = [];

  window.addEventListener("load", init);

  function init() {
    const container = document.getElementById(CONTAINER_ID);
    if (!container) return;

    injectStyles();
    container.innerHTML = buildSkeleton();

    const form = document.getElementById("fl-form");
    form.addEventListener("submit", handleSubmit);

    // Pre-fill today's date
    document.getElementById("fl-date").value = new Date().toISOString().slice(0, 10);

    renderSessionLogs();
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .fl-card { background: #fff; border: 1px solid #E5E7EB; border-radius: 14px; overflow: hidden; }
      .fl-head { padding: 18px 20px; border-bottom: 1px solid #F2F2EF; }
      .fl-head h3 { font-size: 15px; color: #1B2A4A; font-weight: 700; }
      .fl-head p { font-size: 11.5px; color: #5B6560; margin-top: 3px; }
      .fl-body { padding: 20px; }
      .fl-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .fl-field label { display:block; font-size:12px; color:#1B2A4A; font-weight:600; margin-bottom:6px; }
      .fl-field input, .fl-field select {
        width:100%; padding:10px 12px; border:1.5px solid #E5E7EB; border-radius:9px;
        font-size:13px; font-family:inherit; color:#1B2A4A; outline:none;
      }
      .fl-field input:focus, .fl-field select:focus { border-color:#1B2A4A; }
      .fl-full { grid-column: 1 / -1; }
      .fl-actions { margin-top: 16px; display:flex; justify-content:flex-end; }
      .fl-btn {
        padding: 9px 18px; border-radius: 8px; font-size: 12.5px; font-weight: 700;
        border: none; cursor: pointer; background: #2F4A3C; color: #fff;
      }
      .fl-btn:hover { background: #24382F; }
      .fl-btn:disabled { background: #9CA3AF; cursor: not-allowed; }
      .fl-status { font-size: 12px; margin-top: 10px; display:none; padding: 8px 10px; border-radius: 8px; }
      .fl-status.ok { background: #DCE8DE; color: #2F4A3C; display:block; }
      .fl-status.err { background: #FEE2E2; color: #991B1B; display:block; }
      .fl-log-list { margin-top: 16px; border-top: 1px solid #F2F2EF; padding-top: 14px; }
      .fl-log-title { font-size: 11px; font-weight: 700; color: #5B6560; text-transform: uppercase; margin-bottom: 8px; }
      .fl-log-item { font-size: 12px; color: #1F2A24; padding: 6px 0; border-bottom: 1px dashed #F2F2EF; }
      .fl-log-empty { font-size: 12px; color: #8E9BB3; }
    `;
    document.head.appendChild(style);
  }

  function buildSkeleton() {
    return `
      <div class="fl-card">
        <div class="fl-head">
          <h3>🌾 Log Feed / AMU Product</h3>
          <p>Record antimicrobial-containing feed given to an animal</p>
        </div>
        <div class="fl-body">
          <form id="fl-form" class="fl-grid">
            <div class="fl-field">
              <label>Animal ID <span style="color:#EF4444;">*</span></label>
              <select id="fl-animal-id" required>
                <option value="">-- Select Animal --</option>
              </select>
            </div>
            <div class="fl-field">
              <label>Product Name <span style="color:#EF4444;">*</span></label>
              <input type="text" id="fl-product-name" placeholder="e.g. Medicated Feed Premix" required>
            </div>
            <div class="fl-field">
              <label>Quantity <span style="color:#EF4444;">*</span></label>
              <input type="text" id="fl-quantity" placeholder="e.g. 2 kg" required>
            </div>
            <div class="fl-field">
              <label>Date <span style="color:#EF4444;">*</span></label>
              <input type="date" id="fl-date" required>
            </div>
            <div class="fl-field fl-full">
              <div id="fl-status" class="fl-status"></div>
            </div>
            <div class="fl-actions fl-full">
              <button type="submit" class="fl-btn" id="fl-submit-btn">📝 Log Feed Entry</button>
            </div>
          </form>
          <div class="fl-log-list">
            <div class="fl-log-title">Logged this session</div>
            <div id="fl-session-log"></div>
          </div>
        </div>
      </div>
    `;
  }

  function populateAnimalSelect() {
    const select = document.getElementById("fl-animal-id");
    // Local DB is still the source of animal records until the backend
    // exposes a GET /animals endpoint — falls back to the known test ID if
    // the local DB isn't present on this page.
    let animals = [];
    try { animals = (typeof DB !== "undefined") ? DB.getAnimals() : []; } catch (_) { animals = []; }

    select.innerHTML = '<option value="">-- Select Animal --</option>';
    if (animals.length === 0) {
      const opt = document.createElement("option");
      opt.value = "ANIMAL001";
      opt.textContent = "ANIMAL001 (backend test animal)";
      select.appendChild(opt);
      return;
    }
    animals.forEach(a => {
      const opt = document.createElement("option");
      opt.value = a.id;
      opt.textContent = `${a.name} (#${a.id})`;
      select.appendChild(opt);
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById("fl-submit-btn");
    const statusEl = document.getElementById("fl-status");

    const animalId = document.getElementById("fl-animal-id").value;
    const productName = document.getElementById("fl-product-name").value.trim();
    const quantity = document.getElementById("fl-quantity").value.trim();
    const date = document.getElementById("fl-date").value;

    if (!animalId || !productName || !quantity || !date) {
      showStatus(statusEl, "err", "Please fill in all fields.");
      return;
    }

    btn.disabled = true;
    btn.textContent = "Saving...";

    try {
      const result = await ApiClientV2.createFeedLog({
        farmerId: FARMER_ID,
        animalId,
        productName,
        quantity,
        date
      });
      showStatus(statusEl, "ok", "✅ Feed log saved to backend.");
      sessionLogs.unshift({ animalId, productName, quantity, date, id: result.logId || result.id || "—" });
      renderSessionLogs();
      e.target.reset();
      document.getElementById("fl-date").value = new Date().toISOString().slice(0, 10);
    } catch (err) {
      showStatus(statusEl, "err", `❌ Could not save: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = "📝 Log Feed Entry";
    }
  }

  function showStatus(el, cls, text) {
    el.className = `fl-status ${cls}`;
    el.textContent = text;
  }

  function renderSessionLogs() {
    const el = document.getElementById("fl-session-log");
    if (!el) return;
    if (sessionLogs.length === 0) {
      el.innerHTML = `<div class="fl-log-empty">No feed logs submitted yet this session.</div>`;
      return;
    }
    el.innerHTML = sessionLogs.map(l =>
      `<div class="fl-log-item"><strong>#${l.animalId}</strong> — ${l.productName} (${l.quantity}) on ${l.date}</div>`
    ).join("");
  }

  // Populate animal dropdown once DOM + (optionally) DB are ready
  window.addEventListener("load", populateAnimalSelect);
})();