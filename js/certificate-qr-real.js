// js/certificate-qr-real.js
// PashuSetu — Replaces the decorative mock QR pattern on farmer-dashboard.html
// with a REAL scannable QR code, rendered from GET /animals/{id}/certificate.
//
// REQUIRES a QR-rendering library. Use the LOCAL copy (js/qrcode.min.js) —
// a CDN was tried first but failed with ERR_NAME_NOT_RESOLVED on this
// network, so this library is now bundled locally instead, no internet
// dependency needed.
//
// HOW TO USE:
// Add these script tags after your existing ones, in this order:
//   <script src="js/api-client-v2.js"></script>
//   <script src="js/qrcode.min.js"></script>
//   <script src="js/certificate-qr-real.js"></script>
//
// This does NOT remove the existing mock QR box — it looks for the same
// #qrPattern element and, if a real certificate is available, replaces its
// contents with a real QR code. If the backend call fails (not running,
// animal has no certificate yet, etc.), the original mock pattern is left
// alone so the page doesn't break.

(function () {
  window.addEventListener("load", () => {
    const qrBox = document.getElementById("qrPattern");
    if (!qrBox) return; // not on this page

    // Try the currently-selected animal if the page tracks one, else the
    // backend's known test animal.
    const animalId = window.currentSelectedAnimalId || "ANIMAL001";
    loadRealCertificate(animalId, qrBox);
  });

  async function loadRealCertificate(animalId, qrBox) {
    if (typeof ApiClientV2 === "undefined") {
      console.warn("certificate-qr-real.js: ApiClientV2 not loaded, skipping real QR render.");
      return;
    }
    if (typeof QRCode === "undefined") {
      console.warn("certificate-qr-real.js: QRCode library not loaded — add the cdnjs qrcodejs script tag before this file.");
      return;
    }

    try {
      const cert = await ApiClientV2.getCertificate(animalId);
      if (!cert || !cert.qrData) {
        console.warn("certificate-qr-real.js: backend returned no qrData, keeping mock pattern.");
        return;
      }

      // Clear the mock 7x7 grid pattern and render a real QR code in its place.
      qrBox.innerHTML = "";
      qrBox.style.display = "flex";
      qrBox.style.alignItems = "center";
      qrBox.style.justifyContent = "center";

      new QRCode(qrBox, {
        text: cert.qrData,
        width: 148,
        height: 148,
        colorDark: "#1B2A4A",
        colorLight: "#ffffff"
      });

      // Update the label under the QR box if those elements exist
      const titleEl = document.getElementById("qr-title");
      const subEl = document.getElementById("qr-subtitle");
      if (titleEl) titleEl.textContent = "Verified Compliance Certificate";
      if (subEl) subEl.textContent = `Cert ID: ${cert.certificateId || "—"}`;
    } catch (err) {
      console.warn("certificate-qr-real.js: could not fetch real certificate, keeping mock pattern:", err.message);
    }
  }
})();