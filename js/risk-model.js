// js/risk-model.js
// PashuSetu Livestock Portal - Explainable ML Risk Scoring Pipeline

const RiskModel = {
  // Weights (coefficients) calibrated for a tabular log-odds model
  WEIGHTS: {
    intercept: -2.5, // Base log-odds (corresponds to ~7.6% base risk)
    tx_frequency_60d: 0.7, // Heavy impact for multiple treatments in quick succession
    class_diversity: 0.5,  // Risk increases with rotation of different drug classes
    historical_violations: 1.6, // Very high multiplier if farmer had past residue issues
    recent_treatment: 1.1, // Added risk if another treatment ended in the last 14 days
    monsoon_season: 0.4, // Higher environmental pathogen exposure during monsoon (Jul-Sep)
    off_label_use: 1.8 // Severe risk indicator
  },

  // Evaluates risk score (0-100) and extracts SHAP-like feature contributions
  calculateRisk: (animal, treatments, labResults, newTx = null) => {
    if (!animal) return { score: 10, explanations: ["Baseline animal health profile."] };

    const now = new Date();
    const sixtyDaysAgo = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000));
    const fourteenDaysAgo = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000));

    // Get animal's existing historical treatments
    let history = treatments.filter(t => t.animal_id === animal.id);

    // Feature 1: Treatment Frequency (count in last 60 days)
    const tx60d = history.filter(t => new Date(t.end_date) >= sixtyDaysAgo);
    let freqCount = tx60d.length;
    if (newTx) freqCount += 1;

    // Feature 2: Antibiotic Class Diversity
    const classes = new Set();
    tx60d.forEach(t => {
      const drug = DRUG_DATABASE.find(d => d.name === t.drug_name || d.id === t.drug_id);
      if (drug) classes.add(drug.drug_class);
    });
    if (newTx) {
      const newDrug = DRUG_DATABASE.find(d => d.name === newTx.drug_name || d.id === newTx.drug_id);
      if (newDrug) classes.add(newDrug.drug_class);
    }
    const classDiv = classes.size;

    // Feature 3: Historical Violations (positive residue tests)
    const animalLabs = labResults.filter(l => l.animal_id === animal.id);
    const violations = animalLabs.filter(l => l.status === "Positive" || l.residue_detected === true).length;

    // Feature 4: Recent treatment ending < 14 days ago
    let recentTx = 0;
    history.forEach(t => {
      const end = new Date(t.end_date);
      if (end >= fourteenDaysAgo && end <= now) {
        recentTx = 1;
      }
    });

    // Feature 5: Seasonality (Monsoon months: July, August, September in India)
    const month = now.getMonth(); // 0-indexed (6 = July, 7 = August, 8 = September)
    const isMonsoon = (month === 6 || month === 7 || month === 8) ? 1 : 0;

    // Feature 6: Off-Label Flag
    let offLabel = 0;
    if (newTx) {
      const result = ComplianceEngine.calculateTreatmentWithdrawal(newTx, animal);
      if (result && result.is_off_label) offLabel = 1;
    }

    // Logistic Regression prediction calculation: log-odds (z)
    let z = RiskModel.WEIGHTS.intercept;
    z += freqCount * RiskModel.WEIGHTS.tx_frequency_60d;
    z += Math.max(0, classDiv - 1) * RiskModel.WEIGHTS.class_diversity;
    z += violations * RiskModel.WEIGHTS.historical_violations;
    z += recentTx * RiskModel.WEIGHTS.recent_treatment;
    z += isMonsoon * RiskModel.WEIGHTS.monsoon_season;
    z += offLabel * RiskModel.WEIGHTS.off_label_use;

    // Sigmoid function to map to probability (0 to 1)
    const probability = 1 / (1 + Math.exp(-z));
    const score = Math.round(probability * 100);

    // Calculate SHAP explanations
    const explanations = [];

    // Base risk context
    const baseProb = 1 / (1 + Math.exp(-RiskModel.WEIGHTS.intercept));
    const basePercent = Math.round(baseProb * 100);

    const fFreqVal = freqCount * RiskModel.WEIGHTS.tx_frequency_60d;
    const fDivVal = Math.max(0, classDiv - 1) * RiskModel.WEIGHTS.class_diversity;
    const fViolVal = violations * RiskModel.WEIGHTS.historical_violations;
    const fRecentVal = recentTx * RiskModel.WEIGHTS.recent_treatment;
    const fMonsoonVal = isMonsoon * RiskModel.WEIGHTS.monsoon_season;
    const fOffLabelVal = offLabel * RiskModel.WEIGHTS.off_label_use;

    const sumPosWeights = fFreqVal + fDivVal + fViolVal + fRecentVal + fMonsoonVal + fOffLabelVal;
    const scoreIncrease = Math.max(0, score - basePercent);

    const getContribution = (featureVal) => {
      if (sumPosWeights === 0 || scoreIncrease === 0) return 0;
      return Math.round((featureVal / sumPosWeights) * scoreIncrease);
    };

    if (freqCount > 1) {
      const contribution = getContribution(fFreqVal);
      explanations.push(`+${contribution}% risk: High treatment frequency (${freqCount} courses in 60d) increases AMR risk.`);
    }
    if (classDiv > 1) {
      const contribution = getContribution(fDivVal);
      explanations.push(`+${contribution}% risk: Multiple antibiotic classes rotated (${classDiv} classes used).`);
    }
    if (violations > 0) {
      const contribution = getContribution(fViolVal);
      explanations.push(`+${contribution}% risk: ${violations} historical milk/meat residue violation(s) on file.`);
    }
    if (recentTx === 1) {
      const contribution = getContribution(fRecentVal);
      explanations.push(`+${contribution}% risk: Animal underwent another treatment ending in the last 14 days.`);
    }
    if (isMonsoon === 1) {
      const contribution = getContribution(fMonsoonVal);
      explanations.push(`+${contribution}% risk: Monsoon seasonality associated with increased environmental pathogen load.`);
    }
    if (offLabel === 1) {
      const contribution = getContribution(fOffLabelVal);
      explanations.push(`+${contribution}% risk: Off-label drug parameters detected (requires manual regulatory audit).`);
    }

    // Default if no risk factors triggered
    if (explanations.length === 0) {
      explanations.push("Compliant profile: No active risk factors detected. Standard testing recommended.");
    }

    return {
      score: score,
      explanations: explanations
    };
  }
};

window.RiskModel = RiskModel;
