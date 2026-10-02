// js/landing.js
// PashuSetu Landing Portal - Controller for simulated Hero App Preview Card

(function() {
  const watchBadge = document.getElementById("watch-badge");
  const pAnimalName = document.getElementById("preview-animal-name");
  const pAnimalTag = document.getElementById("preview-animal-tag");
  const pAnimalCode = document.getElementById("preview-animal-code");
  const pProgressLabel = document.getElementById("preview-progress-label");
  const pProgressPercent = document.getElementById("preview-progress-percent");
  const pProgressFill = document.getElementById("preview-progress-fill");
  const pCountdownText = document.getElementById("preview-countdown-text");
  const pCountdownDate = document.getElementById("preview-countdown-date");
  const pQrBox = document.getElementById("preview-qr-box");
  const landingCard = document.getElementById("landing-animal-card");

  window.addEventListener("load", () => {
    renderLandingPreview();

    // Auto refresh landing page countdown every 5 seconds
    setInterval(() => {
      renderLandingPreview();
    }, 5000);
  });

  function renderLandingPreview() {
    const animals = DB.getAnimals();
    const treatments = DB.getTreatments();
    const labResults = DB.getLabResults();

    if (animals.length === 0) return;

    let underWatchCount = 0;
    let selectedAnimal = null;
    let selectedEval = null;

    // Evaluate all animals
    const evaluatedAnimals = animals.map(a => {
      const result = ComplianceEngine.evaluateAnimalStatus(a, treatments, labResults);
      if (result.status.includes("Withdrawal") || result.status.includes("DO NOT SELL") || result.status.includes("Manual")) {
        underWatchCount++;
        if (!selectedAnimal) {
          selectedAnimal = a;
          selectedEval = result;
        }
      }
      return { animal: a, result: result };
    });

    // Fallback: if no animals are under watch, select the first animal in database to show
    if (!selectedAnimal && evaluatedAnimals.length > 0) {
      selectedAnimal = evaluatedAnimals[0].animal;
      selectedEval = evaluatedAnimals[0].result;
    }

    if (!selectedAnimal || !selectedEval) return;

    // 1. Render badge
    if (watchBadge) {
      watchBadge.textContent = `${underWatchCount} Animal${underWatchCount !== 1 ? 's' : ''} Under Watch`;
    }

    // 2. Render animal details
    if (pAnimalName) pAnimalName.textContent = `${selectedAnimal.name} — ${selectedAnimal.breed}`;
    if (pAnimalTag) pAnimalTag.textContent = `Tag: ${selectedAnimal.pashu_aadhaar}`;
    if (pAnimalCode) pAnimalCode.textContent = `#${selectedAnimal.id}`;

    // 3. Render Card styling
    if (landingCard) {
      landingCard.className = `animal-card ${selectedEval.cardClass}`;
    }

    // 4. Render progress and label details
    let drugNameStr = "No Active Treatment";
    let fillClass = "pf-green";
    
    if (selectedEval.activeTx) {
      const drug = DRUG_DATABASE.find(d => d.id === selectedEval.activeTx.drug_id);
      drugNameStr = drug ? drug.active_ingredient : selectedEval.activeTx.drug_name;
      
      if (selectedEval.status.includes("DO NOT SELL")) fillClass = "pf-red";
      else if (selectedEval.status.includes("Withdrawal")) fillClass = "pf-amber";
    }

    if (pProgressLabel) {
      pProgressLabel.textContent = selectedEval.activeTx 
        ? `Withdrawal Progress — ${drugNameStr}, Milk`
        : "No Active Withdrawal / Clear";
    }

    if (pProgressPercent) {
      pProgressPercent.textContent = `${selectedEval.progress}%`;
    }

    if (pProgressFill) {
      pProgressFill.style.width = `${selectedEval.progress}%`;
      pProgressFill.className = `progress-fill ${fillClass}`;
    }

    // 5. Render countdown
    if (pCountdownText) {
      if (selectedEval.status.includes("Eligible")) {
        pCountdownText.innerHTML = `✅ <strong>Fully Eligible</strong>`;
      } else if (selectedEval.status.includes("DO NOT SELL")) {
        pCountdownText.innerHTML = `🛑 <strong>DO NOT SELL MILK</strong>`;
      } else if (selectedEval.status.includes("Manual")) {
        pCountdownText.innerHTML = `⚠️ <strong>Manual Review</strong>`;
      } else {
        pCountdownText.innerHTML = `⏰ Eligible in <strong>${selectedEval.countdown}</strong>`;
      }
    }

    if (pCountdownDate) {
      if (selectedEval.worstWithdrawalEnd) {
        const dateObj = new Date(selectedEval.worstWithdrawalEnd);
        const dateStr = dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
        const timeStr = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
        pCountdownDate.textContent = `Window closes ${dateStr} · ${timeStr}`;
      } else {
        pCountdownDate.textContent = selectedEval.countdown || "Procurement Cleared";
      }
    }

    // 6. Render 3x3 QR Pattern based on animal ID seed
    if (pQrBox) {
      pQrBox.innerHTML = "";

      let seed = 12345;
      const digits = selectedAnimal.id.replace(/\D/g, "");
      if (digits) {
        seed = parseInt(digits) * 7823;
      } else {
        seed = selectedAnimal.name.charCodeAt(0) * 8923;
      }

      let s = seed;
      for (let i = 0; i < 9; i++) {
        const div = document.createElement('div');
        s = (s * 9301 + 49297) % 233280;
        const rnd = s / 233280;
        
        // Random check matching selected animal
        if (rnd > 0.45) {
          div.style.background = "#1B2A4A";
        } else {
          div.style.background = "transparent";
        }
        pQrBox.appendChild(div);
      }
      
      // Always fill center and some corners for preview visual consistency
      if (pQrBox.children[0]) pQrBox.children[0].style.background = "#1B2A4A";
      if (pQrBox.children[4]) pQrBox.children[4].style.background = "#1B2A4A";
      if (pQrBox.children[8]) pQrBox.children[8].style.background = "#1B2A4A";
    }
  }
})();
