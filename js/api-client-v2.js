// js/api-client-v2.js
// PashuSetu — API client for the REAL backend (Python + Flask + Firebase Firestore).
// This targets the actual spec your backend teammate shared — NOT the earlier
// FastAPI prompt. Field names below match their Firestore schema exactly,
// including the spelling "withdrawlDays" / "withdrawlEndDate" (not a typo on
// our end — the doc says to use these exact spellings).
//
// Only the 7 endpoints marked "Done" in their doc are implemented as real
// calls. Everything else (QR generation, hash-chain, withdrawal engine,
// compliance decision, ComplianceScans, regulator dashboard, auth) is stubbed
// with a clear error so calling code fails loudly instead of pretending to
// work — flip each stub to a real call once that endpoint exists.

const ApiClientV2 = {
  BASE_URL: "http://127.0.0.1:5000",

  async _request(path, options = {}) {
    const res = await fetch(`${this.BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {})
      }
    });

    if (!res.ok) {
      let detail = `Request failed (${res.status})`;
      try {
        const body = await res.json();
        if (body && body.error) detail = body.error;
        else if (body && body.message) detail = body.message;
      } catch (_) { /* ignore parse failure */ }
      throw new Error(detail);
    }
    return res.json();
  },

  _notImplemented(name) {
    return Promise.reject(
      new Error(`${name} is not implemented on the backend yet — listed as "requires coordination". Do not build local logic to fake this; wait for the real endpoint.`)
    );
  },

  // ============================================================
  // DONE — these 7 endpoints exist and are safe to call.
  // ============================================================

  // POST /prescriptions
  // body: { vetId, animalId, drugId, drugName, dosage, date }
  // NOTE: only ONE date field, not a start/end range like our old local
  // model used. Decide with the vet whether "date" means the last-dose date
  // (matches our withdrawal calc) or the prescription-issued date.
  async createPrescription({ vetId, animalId, drugId, drugName, dosage, date }) {
    return this._request("/prescriptions", {
      method: "POST",
      body: JSON.stringify({ vetId, animalId, drugId, drugName, dosage, date })
    });
  },

  // POST /feed-logs
  // body: { farmerId, animalId, productName, quantity, date }
  async createFeedLog({ farmerId, animalId, productName, quantity, date }) {
    return this._request("/feed-logs", {
      method: "POST",
      body: JSON.stringify({ farmerId, animalId, productName, quantity, date })
    });
  },

  // POST /amu-records
  // body: { animalId, prescriptionIds: [...], feedLogIds: [...] }
  // awareCategory / withdrawlDays / withdrawlEndDate are set by the
  // withdrawal engine server-side, not sent by the frontend.
  async createAmuRecord({ animalId, prescriptionIds, feedLogIds }) {
    return this._request("/amu-records", {
      method: "POST",
      body: JSON.stringify({ animalId, prescriptionIds, feedLogIds })
    });
  },

  // GET /amu-records/{amuRecordId}
  async getAmuRecord(amuRecordId) {
    return this._request(`/amu-records/${amuRecordId}`);
  },

  // GET /animals/{animalId}/withdrawal-status
  // Returns whatever shape AMURecords currently holds: awareCategory,
  // withdrawlDays, withdrawlEndDate. Treat these values with caution until
  // the withdrawal engine itself is confirmed finished (see doc section 7).
  async getWithdrawalStatus(animalId) {
    return this._request(`/animals/${animalId}/withdrawal-status`);
  },

  // POST /users/{userId}/device-token
  // body: { deviceToken }
  async saveDeviceToken(userId, deviceToken) {
    return this._request(`/users/${userId}/device-token`, {
      method: "POST",
      body: JSON.stringify({ deviceToken })
    });
  },

  // GET /animals/{animalId}/certificate
  // Returns { certificateId, animalId, qrData, createdAt }.
  // Render qrData with a real QR-rendering library once this returns live
  // data — don't keep using the decorative mock pattern for this animal.
  async getCertificate(animalId) {
    return this._request(`/animals/${animalId}/certificate`);
  },

  // ============================================================
  // NOT YET AVAILABLE — "requires coordination" per the doc.
  // Calling these will reject with a clear message instead of silently
  // returning fake data. Replace the body with a real _request() call the
  // moment the backend exposes each one.
  // ============================================================

  // Will eventually be: POST /compliance-scans
  // body: { certificateId, animalId, collectorId, decision, reason }
  async submitComplianceScan(_payload) {
    return this._notImplemented("ComplianceScans submission");
  },

  // Will eventually be some GET /regulator/... aggregate endpoint
  async getRegulatorDashboardData() {
    return this._notImplemented("Regulator dashboard data");
  },

  // No login/signup endpoint exists anywhere in the current doc at all —
  // this isn't just "pending", it's unclear if/how auth is planned. Confirm
  // with the backend owner before building against a guessed shape.
  async login(_userId, _password) {
    return this._notImplemented("Login/auth (no endpoint defined yet — confirm with backend owner)");
  },
  async signup(_payload) {
    return this._notImplemented("Signup/auth (no endpoint defined yet — confirm with backend owner)");
  }
};

window.ApiClientV2 = ApiClientV2;