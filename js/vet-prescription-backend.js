// js/vet-prescription-backend.js
// PashuSetu — Connects the Vet Console's real prescription form submission
// to the actual backend (POST /prescriptions), instead of local DB only.
//
// ASSUMPTION FLAGGED: the backend's Prescription model has a single "date"
// field, not a start/end range. This connector sends the COURSE END DATE
// (last dose) as "date", since that's what the withdrawal calculation
// actually needs. Confirm this with your backend teammate — if "date" is
// meant to be the issue date instead, change DATE_FIELD_SOURCE below to
// "start".
//
// Also flags: vetId is hardcoded to a placeholder test user until real
// login/auth exists (see VET_USER_ID below).
//
// HOW TO USE (does not require editing vet-dashboard.html's own script):
// Add these script tags after your existing ones, in this order:
//   <script src="js/api-client-v2.js"></script>
//   <script src="js/vet-prescription-backend.js"></script>

(function () {
  const VET_USER_ID = "USER001"; // placeholder — replace once real vet login exists
  const DATE_FIELD_SOURCE = "end"; // "end" = last dose date, "start" = course start date

  window.addEventListener("load", () => { const form = document.getElementById("vet-prescription-form"); if (!form) return; form.addEventListener("submit", (e) => { e.stopImmediatePropagation(); handleRealSubmit(e); }, true); });
  async function handleRealSubmit(e) {
    e.preventDefault();

    const animalId = document.getElementById("vet-animal").value;
    const drugId = document.getElementById("vet-drug").value;
    const dose = document.getElementById("vet-dose").value;
    const startVal = document.getElementById("vet-start-date").value;
    const endVal = document.getElementById("vet-end-date").value;
    const signCheck = document.getElementById("vet-sign-check");

    if (!animalId || !drugId || !dose || !startVal || !endVal) {
      alert("Please fill in Animal, Drug, Dose, and both dates.");
      return;
    }
    if (signCheck && !signCheck.checked) {
      alert("Please confirm the digital signature checkbox.");
      return;
    }

    const drug = (typeof DRUG_DATABASE !== "undefined")
      ? DRUG_DATABASE.find(d => d.id === drugId)
      : null;
    const drugName = drug ? drug.name : drugId;

    const dateToSend = DATE_FIELD_SOURCE === "end"
      ? new Date(endVal).toISOString()
      : new Date(startVal).toISOString();

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalLabel = submitBtn ? submitBtn.textContent : "";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Signing & Sending...";
    }

    try {
      const result = await ApiClientV2.createPrescription({
        vetId: VET_USER_ID,
        animalId,
        drugId,
        drugName,
        dosage: dose,
        date: dateToSend
      });

      alert(`✅ Prescription saved to backend.\nPrescription ID: ${result.prescriptionId || result.id || "—"}`);
      e.target.reset();
    } catch (err) {
      alert(`❌ Could not save prescription to backend: ${err.message}\n\nCheck that the Flask server is running and reachable.`);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
      }
    }
  }
})();