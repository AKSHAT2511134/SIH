// js/compliance-engine.js
// PashuSetu Livestock Portal - Regulatory Compliance & MRL Rule Engine

const ComplianceEngine = {
  // Calculates the withdrawal end date and information for a specific treatment
  calculateTreatmentWithdrawal: (treatment, animal) => {
    if (!treatment) return null;

    // Find the drug in the database
    const drug = DRUG_DATABASE.find(d => d.name === treatment.drug_name || d.id === treatment.drug_id);
    
    // Default fallback if drug is not in our database or marked as "none"
    if (treatment.drug_id === "none" || treatment.drug_name.toLowerCase().includes("vaccine")) {
      return {
        withdrawal_days: 0,
        withdrawal_end_date: new Date(treatment.end_date).toISOString(),
        is_off_label: false,
        status: "Eligible — Compliant",
        notes: "Routine preventative treatment/vaccine. No withdrawal period required."
      };
    }

    if (!drug) {
      return {
        withdrawal_days: null,
        withdrawal_end_date: null,
        is_off_label: true,
        status: "Manual Review Required",
        notes: "Drug not found in authoritative CDSCO database. Flagged for veterinary review."
      };
    }

    let isOffLabel = false;
    let notes = `Validated against ${drug.source}.`;

    // 1. Check Species off-label mismatch
    if (animal && drug.species && !drug.species.some(s => s.toLowerCase() === animal.species.toLowerCase())) {
      isOffLabel = true;
      notes += ` Species mismatch (${animal.species} using drug approved for ${drug.species.join(", ")}).`;
    }

    // 2. Determine withdrawal days based on affected product
    let withdrawalDays = 0;
    if (treatment.affected_product === "Milk" || treatment.affected_product === "Milk/Meat") {
      withdrawalDays = drug.milk_withdrawal_days;
    } else if (treatment.affected_product === "Meat") {
      withdrawalDays = drug.meat_withdrawal_days;
    }

    // If off-label, standard protocol mandates immediate veterinary review, and we flag it
    if (isOffLabel) {
      return {
        withdrawal_days: withdrawalDays,
        withdrawal_end_date: null,
        is_off_label: true,
        status: "Manual Review Required",
        notes: notes + " Off-label use automatically halts digital auto-clearing."
      };
    }

    // 3. Calculate Date Arithmetic
    const lastDoseDate = new Date(treatment.end_date);
    if (isNaN(lastDoseDate.getTime())) {
      return {
        withdrawal_days: withdrawalDays,
        withdrawal_end_date: null,
        is_off_label: true,
        status: "Manual Review Required",
        notes: "Invalid or missing treatment end date."
      };
    }

    const withdrawalEnd = new Date(lastDoseDate.getTime() + (withdrawalDays * 24 * 60 * 60 * 1000));

    return {
      withdrawal_days: withdrawalDays,
      withdrawal_end_date: withdrawalEnd.toISOString(),
      is_off_label: false,
      status: "Calculated",
      notes: notes
    };
  },

  // Evaluates the overall live status of an animal based on treatments and lab results
  evaluateAnimalStatus: (animal, treatments, labResults) => {
    const animalTxs = treatments.filter(t => t.animal_id === animal.id);
    const animalLabs = labResults.filter(l => l.animal_id === animal.id);

    if (animalTxs.length === 0) {
      return {
        status: "No Active Treatment",
        cssClass: "pill-gray",
        cardClass: "",
        activeTx: null,
        countdown: null,
        progress: 100
      };
    }

    const now = new Date();
    let overallStatus = "No Active Treatment";
    let cssClass = "pill-gray";
    let cardClass = "";
    let activeTx = null;
    let worstWithdrawalEnd = null;
    let manualReviewReason = null;

    // Check if there are any active blocks from lab confirmations (this overrides everything else)
    const positiveLabs = animalLabs.filter(l => l.status === "Positive" || l.residue_detected === true);
    if (positiveLabs.length > 0) {
      return {
        status: "Blocked — Non-Compliant",
        cssClass: "pill-red",
        cardClass: "danger",
        activeTx: null,
        countdown: "Blocked by Chemical Residue Lab Test",
        progress: 0,
        details: `Lab test detected residue above MRL. Blocked on: ${new Date(positiveLabs[0].test_date).toLocaleDateString()}`
      };
    }

    for (const tx of animalTxs) {
      const result = ComplianceEngine.calculateTreatmentWithdrawal(tx, animal);
      if (!result) continue;

      if (result.is_off_label) {
        overallStatus = "Manual Review Required";
        cssClass = "pill-amber";
        cardClass = "alert";
        manualReviewReason = result.notes;
        activeTx = tx;
        break; // Manual review flags the whole animal immediately
      }

      const startDate = new Date(tx.start_date);
      const endDate = new Date(tx.end_date);
      const withdrawalEnd = new Date(result.withdrawal_end_date);

      // Check if treatment course is currently running (today is between start and end date)
      if (now >= startDate && now <= endDate) {
        overallStatus = "Just Started — DO NOT SELL";
        cssClass = "pill-red";
        cardClass = "danger";
        activeTx = tx;
        worstWithdrawalEnd = withdrawalEnd;
        // Don't break yet, we want to check if there are manual reviews or worse
      }
      // Check if inside withdrawal countdown period (today is after end date, but before withdrawal end)
      else if (now > endDate && now <= withdrawalEnd) {
        // Only upgrade status if we aren't already in "Just Started"
        if (overallStatus !== "Just Started — DO NOT SELL") {
          overallStatus = "Withdrawal In Progress";
          cssClass = "pill-amber";
          cardClass = "alert";
          activeTx = tx;
          if (!worstWithdrawalEnd || withdrawalEnd > worstWithdrawalEnd) {
            worstWithdrawalEnd = withdrawalEnd;
          }
        }
      }
      // Treatment complete and cleared withdrawal window
      else if (now > withdrawalEnd) {
        // If this is the only treatment or others are completed, we are eligible
        if (overallStatus === "No Active Treatment") {
          // Check if lab-verified
          const matchingLab = animalLabs.find(l => l.substance.toLowerCase() === tx.drug_name.toLowerCase() || (tx.drug_id && l.substance.toLowerCase().includes(tx.drug_id)));
          if (matchingLab && matchingLab.status === "Negative") {
            overallStatus = "Lab-verified compliant";
            cssClass = "pill-green";
          } else {
            overallStatus = "Eligible — Compliant";
            cssClass = "pill-green";
          }
          activeTx = tx;
        }
      }
    }

    // Calculate progress percentage and countdown string for active/withdrawal statuses
    let countdown = null;
    let progress = 100;

    if (overallStatus === "Just Started — DO NOT SELL" && activeTx) {
      countdown = "Active Treatment Course";
      progress = 0;
    } else if (overallStatus === "Withdrawal In Progress" && activeTx && worstWithdrawalEnd) {
      const totalWithdrawalMs = (worstWithdrawalEnd.getTime() - new Date(activeTx.end_date).getTime());
      const elapsedMs = (now.getTime() - new Date(activeTx.end_date).getTime());
      
      progress = Math.max(0, Math.min(100, Math.round((elapsedMs / totalWithdrawalMs) * 100)));

      const remainingMs = worstWithdrawalEnd.getTime() - now.getTime();
      const totalHours = Math.floor(remainingMs / (1000 * 60 * 60));
      const days = Math.floor(totalHours / 24);
      const hours = totalHours % 24;

      if (days > 0) {
        countdown = `${days}d ${hours}h left`;
      } else {
        const mins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        countdown = `${hours}h ${mins}m left`;
      }
    } else if (overallStatus === "Manual Review Required") {
      countdown = manualReviewReason || "Awaiting Review";
      progress = 50;
    }

    return {
      status: overallStatus,
      cssClass: cssClass,
      cardClass: cardClass,
      activeTx: activeTx,
      countdown: countdown,
      progress: progress,
      worstWithdrawalEnd: worstWithdrawalEnd ? worstWithdrawalEnd.toISOString() : null
    };
  }
};

window.ComplianceEngine = ComplianceEngine;
