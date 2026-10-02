
(function () {
  const STYLE_ID = "countdown-widget-styles";
  const CONTAINER_ID = "countdown-widget-container";

  let tickInterval = null;
  let refreshInterval = null;
  let selectedAnimalId = null;
  let cachedEndDate = null; // Date object, cached so we don't recompute every second
  let cachedStartRef = null; // reference point for progress % (treatment end_date)

  window.addEventListener("load", init);

  function init() {
    const container = document.getElementById(CONTAINER_ID);
    if (!container) return; // not on this page, do nothing

    injectStyles();
    container.innerHTML = buildSkeleton();

    document.getElementById("cw-animal-select").addEventListener("change", (e) => {
      selectedAnimalId = e.target.value || null;
      refresh();
    });

    refresh();
    refreshInterval = setInterval(refresh, 5000); // re-sync with DB every 5s
    tickInterval = setInterval(tick, 1000);         // tick the visible clock every 1s
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .cw-card {
        background: linear-gradient(160deg, #1B2A4A 0%, #14213B 60%, #0F1A2E 100%);
        border-radius: 16px;
        padding: 26px 24px;
        color: #fff;
        position: relative;
        overflow: hidden;
      }
      .cw-card::before {
        content: '';
        position: absolute;
        top: -50px; right: -50px;
        width: 200px; height: 200px;
        background: radial-gradient(circle, rgba(184,134,59,0.18), transparent 70%);
        pointer-events: none;
      }
      .cw-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        margin-bottom: 18px;
        flex-wrap: wrap;
      }
      .cw-head h3 { font-size: 15px; font-weight: 700; }
      .cw-head select {
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.16);
        color: #fff;
        border-radius: 8px;
        padding: 7px 10px;
        font-size: 12px;
        font-family: inherit;
        max-width: 220px;
      }
      .cw-head select option { color: #1F2A24; }
      .cw-body {
        display: flex;
        align-items: center;
        gap: 24px;
        flex-wrap: wrap;
        justify-content: center;
      }
      .cw-ring-wrap { position: relative; width: 150px; height: 150px; flex-shrink: 0; }
      .cw-ring-wrap svg { transform: rotate(-90deg); }
      .cw-ring-bg { fill: none; stroke: rgba(255,255,255,0.1); stroke-width: 10; }
      .cw-ring-fill {
        fill: none;
        stroke-width: 10;
        stroke-linecap: round;
        transition: stroke-dashoffset 0.6s ease, stroke 0.3s ease;
      }
      .cw-ring-pct {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        font-weight: 800;
      }
      .cw-details { flex: 1; min-width: 220px; }
      .cw-animal-name { font-size: 17px; font-weight: 700; margin-bottom: 2px; }
      .cw-animal-sub { font-size: 11.5px; color: #9FB0CC; margin-bottom: 14px; }
      .cw-clock {
        display: flex;
        gap: 10px;
        margin-bottom: 10px;
      }
      .cw-unit { text-align: center; }
      .cw-unit-val {
        font-family: 'Courier New', monospace;
        font-size: 30px;
        font-weight: 800;
        background: rgba(255,255,255,0.07);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 8px;
        padding: 4px 10px;
        min-width: 44px;
        display: inline-block;
      }
      .cw-unit-label {
        font-size: 9px;
        color: #8E9BB3;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-top: 4px;
        font-weight: 700;
      }
      .cw-status-line {
        font-size: 12px;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 5px 10px;
        border-radius: 20px;
      }
      .cw-status-red { background: rgba(239,68,68,0.18); color: #FCA5A5; }
      .cw-status-amber { background: rgba(245,158,11,0.18); color: #FCD34D; }
      .cw-status-green { background: rgba(16,185,129,0.18); color: #6EE7B7; }
      .cw-empty {
        text-align: center;
        padding: 20px 10px;
        color: #B7C1D6;
        font-size: 13px;
      }
    `;
    document.head.appendChild(style);
  }

  function buildSkeleton() {
    return `
      <div class="cw-card">
        <div class="cw-head">
          <h3>⏳ Live Withdrawal Countdown</h3>
          <select id="cw-animal-select"><option value="">Auto (most urgent)</option></select>
        </div>
        <div id="cw-body-content"></div>
      </div>
    `;
  }

  function refresh() {
    const animals = DB.getAnimals();
    const treatments = DB.getTreatments();
    const labResults = DB.getLabResults();

    populateSelect(animals, treatments, labResults);

    const restricted = animals
      .map(a => ({ animal: a, status: ComplianceEngine.evaluateAnimalStatus(a, treatments, labResults) }))
      .filter(r =>
        r.status.status === "Just Started — DO NOT SELL" ||
        r.status.status === "Withdrawal In Progress"
      )
      .filter(r => r.status.worstWithdrawalEnd);

    let target = null;
    if (selectedAnimalId) {
      target = restricted.find(r => r.animal.id === selectedAnimalId) || null;
    }
    if (!target && restricted.length > 0) {
      target = restricted.sort((a, b) =>
        new Date(a.status.worstWithdrawalEnd) - new Date(b.status.worstWithdrawalEnd)
      )[0];
    }

    const bodyEl = document.getElementById("cw-body-content");
    if (!target) {
      cachedEndDate = null;
      bodyEl.innerHTML = `<div class="cw-empty">✅ No animals currently under an active withdrawal countdown.</div>`;
      return;
    }

    cachedEndDate = new Date(target.status.worstWithdrawalEnd);
    cachedStartRef = target.status.activeTx ? new Date(target.status.activeTx.end_date) : null;

    const isUrgent = target.status.status === "Just Started — DO NOT SELL";
    const statusClass = isUrgent ? "cw-status-red" : "cw-status-amber";
    const statusText = isUrgent ? "🔴 Active treatment — DO NOT SELL" : "🟡 Withdrawal in progress";

    bodyEl.innerHTML = `
      <div class="cw-body">
        <div class="cw-ring-wrap">
          <svg width="150" height="150" viewBox="0 0 150 150">
            <circle class="cw-ring-bg" cx="75" cy="75" r="62"></circle>
            <circle class="cw-ring-fill" id="cw-ring-fill" cx="75" cy="75" r="62"
              stroke="${isUrgent ? '#EF4444' : '#F59E0B'}"
              stroke-dasharray="${2 * Math.PI * 62}"
              stroke-dashoffset="${2 * Math.PI * 62}"></circle>
          </svg>
          <div class="cw-ring-pct" id="cw-ring-pct">0%</div>
        </div>
        <div class="cw-details">
          <div class="cw-animal-name">${target.animal.name}</div>
          <div class="cw-animal-sub">#${target.animal.id} · ${target.animal.breed}</div>
          <div class="cw-clock" id="cw-clock">
            <div class="cw-unit"><div class="cw-unit-val" id="cw-days">--</div><div class="cw-unit-label">Days</div></div>
            <div class="cw-unit"><div class="cw-unit-val" id="cw-hours">--</div><div class="cw-unit-label">Hrs</div></div>
            <div class="cw-unit"><div class="cw-unit-val" id="cw-mins">--</div><div class="cw-unit-label">Min</div></div>
            <div class="cw-unit"><div class="cw-unit-val" id="cw-secs">--</div><div class="cw-unit-label">Sec</div></div>
          </div>
          <span class="cw-status-line ${statusClass}">${statusText}</span>
        </div>
      </div>
    `;

    tick(); // paint immediately instead of waiting up to 1s
  }

  function populateSelect(animals, treatments, labResults) {
    const select = document.getElementById("cw-animal-select");
    const prevValue = select.value;
    const restrictedIds = new Set(
      animals
        .map(a => ({ a, s: ComplianceEngine.evaluateAnimalStatus(a, treatments, labResults) }))
        .filter(r => r.s.status === "Just Started — DO NOT SELL" || r.s.status === "Withdrawal In Progress")
        .map(r => r.a.id)
    );

    select.innerHTML = '<option value="">Auto (most urgent)</option>';
    animals.forEach(a => {
      if (!restrictedIds.has(a.id)) return;
      const opt = document.createElement("option");
      opt.value = a.id;
      opt.textContent = a.name;
      select.appendChild(opt);
    });
    select.value = prevValue;
  }

  function tick() {
    if (!cachedEndDate) return;

    const now = new Date();
    const remainingMs = cachedEndDate.getTime() - now.getTime();

    const daysEl = document.getElementById("cw-days");
    const hoursEl = document.getElementById("cw-hours");
    const minsEl = document.getElementById("cw-mins");
    const secsEl = document.getElementById("cw-secs");
    const pctEl = document.getElementById("cw-ring-pct");
    const ringFill = document.getElementById("cw-ring-fill");
    if (!daysEl) return; // DOM not ready this tick (e.g. mid-refresh swap)

    if (remainingMs <= 0) {
      daysEl.textContent = "00";
      hoursEl.textContent = "00";
      minsEl.textContent = "00";
      secsEl.textContent = "00";
      if (pctEl) pctEl.textContent = "100%";
      if (ringFill) ringFill.setAttribute("stroke-dashoffset", "0");
      return;
    }

    const totalSeconds = Math.floor(remainingMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    daysEl.textContent = String(days).padStart(2, "0");
    hoursEl.textContent = String(hours).padStart(2, "0");
    minsEl.textContent = String(mins).padStart(2, "0");
    secsEl.textContent = String(secs).padStart(2, "0");

    if (pctEl && ringFill) {
      let pct = 0;
      if (cachedStartRef) {
        const totalWindow = cachedEndDate.getTime() - cachedStartRef.getTime();
        const elapsed = now.getTime() - cachedStartRef.getTime();
        pct = totalWindow > 0 ? Math.max(0, Math.min(100, Math.round((elapsed / totalWindow) * 100))) : 0;
      }
      pctEl.textContent = `${pct}%`;
      const circumference = 2 * Math.PI * 62;
      const offset = circumference - (pct / 100) * circumference;
      ringFill.setAttribute("stroke-dashoffset", String(offset));
    }
  }
})();