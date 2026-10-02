// js/withdrawal-status-backend.js
// PashuSetu — Overlays REAL backend withdrawal-status data onto the animal
// cards on farmer-dashboard.html, alongside (not replacing) the local
// calculation.
//
// WHY OVERLAY INSTEAD OF REPLACE: the backend's GET /withdrawal-status
// returns { awareCategory, withdrawlDays, withdrawlEndDate } — a simpler
// shape than your local engine's { status, progress, countdown, cssClass }.
// Forcing the backend's data into the local card's status pill/progress bar
// would mean guessing at a mapping that doesn't actually exist. Instead this
// adds a small, clearly-labeled "🔗 Backend" line to each card so you can
// see both side by side and compare — this is also useful for confirming
// whether your local ComplianceEngine and the backend's withdrawal engine
// agree once both are finished.
//
// HOW TO USE:
// Add this script tag AFTER js/app.js and js/api-client-v2.js:
//   <script src="js/withdrawal-status-backend.js"></script>

(function () {
  const POLL_INTERVAL_MS = 8000;

  window.addEventListener("load", () => {
    if (typeof ApiClientV2 === "undefined") {
      console.warn("withdrawal-status-backend.js: ApiClientV2 not loaded, skipping.");
      return;
    }
    // Give app.js's own render a moment to paint the cards first
    setTimeout(overlayAll, 800);
    setInterval(overlayAll, POLL_INTERVAL_MS);
  });

  function overlayAll() {
    let animals = [];
    try { animals = (typeof DB !== "undefined") ? DB.getAnimals() : []; } catch (_) { animals = []; }
    animals.forEach(a => overlayOne(a));
  }

  async function overlayOne(animal) {
    const card = findCardForAnimal(animal.id);
    if (!card) return; // card not rendered yet or not on this page

    let badge = card.querySelector(".backend-status-badge");
    if (!badge) {
      badge = document.createElement("div");
      badge.className = "backend-status-badge";
      badge.style.cssText = "margin-top:8px; padding-top:8px; border-top:1px dashed #E5E7EB; font-size:10.5px; color:#5B6560;";
      card.appendChild(badge);
    }

    try {
      const result = await ApiClientV2.getWithdrawalStatus(animal.id);
      const category = result.awareCategory || "—";
      const days = (result.withdrawlDays !== undefined && result.withdrawlDays !== null) ? result.withdrawlDays : "—";
      const endDate = result.withdrawlEndDate ? new Date(result.withdrawlEndDate).toLocaleDateString() : "—";
      badge.innerHTML = `🔗 <strong>Backend:</strong> ${category} · ${days}d · ends ${endDate}`;
      badge.style.color = "#2F4A3C";
    } catch (err) {
      badge.innerHTML = `🔗 Backend unreachable for #${animal.id}`;
      badge.style.color = "#991B1B";
    }
  }

  function findCardForAnimal(animalId) {
    const cards = document.querySelectorAll(".animal-card");
    for (const card of cards) {
      const tagEl = card.querySelector(".animal-tag");
      if (tagEl && tagEl.textContent.trim() === `#${animalId}`) {
        return card;
      }
    }
    return null;
  }
})();