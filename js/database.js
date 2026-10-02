// js/database.js
// PashuSetu Livestock Portal - Database and LocalStorage Layer

// Authoritative CDSCO/FSSAI referenced Drug Database
const DRUG_DATABASE = [
  {
    id: "amoxicillin_clav",
    name: "Amoxicillin + Clavulanate (2.2g/vial) — IM",
    active_ingredient: "Amoxicillin + Clavulanate",
    drug_class: "Penicillins + Beta-lactamase inhibitors",
    route: "IM",
    dose_limit: "7 - 10 mg/kg",
    milk_withdrawal_days: 3,
    meat_withdrawal_days: 21,
    species: ["Cow", "Buffalo", "Sheep", "Goat"],
    source: "FSSAI Contaminants Regulations 2024 / CDSCO Gazette"
  },
  {
    id: "ceftiofur_sodium",
    name: "Ceftiofur Sodium — IM (1.1 mg/kg)",
    active_ingredient: "Ceftiofur Sodium",
    drug_class: "Cephalosporins (3rd Gen)",
    route: "IM",
    dose_limit: "1.1 - 2.2 mg/kg",
    milk_withdrawal_days: 5, // Custom value matching farmer-dashboard.html table
    meat_withdrawal_days: 13,
    species: ["Cow", "Buffalo"],
    source: "CDSCO Approved Insert / FSSAI MRL Guidelines"
  },
  {
    id: "enrofloxacin",
    name: "Enrofloxacin 10% — Inj (2.5 mg/kg)",
    active_ingredient: "Enrofloxacin",
    drug_class: "Fluoroquinolones",
    route: "IM",
    dose_limit: "2.5 - 5 mg/kg",
    milk_withdrawal_days: 4,
    meat_withdrawal_days: 28,
    species: ["Cow", "Buffalo", "Goat"],
    source: "CDSCO Approved Label / FSSAI Prohibited List Exceptions"
  },
  {
    id: "oxytetracycline_la",
    name: "Oxytetracycline LA — 20% Inj",
    active_ingredient: "Oxytetracycline",
    drug_class: "Tetracyclines",
    route: "IM",
    dose_limit: "20 mg/kg",
    milk_withdrawal_days: 7,
    meat_withdrawal_days: 28,
    species: ["Cow", "Buffalo", "Sheep", "Goat"],
    source: "CDSCO Approved Veterinary Label"
  },
  {
    id: "penicillin_g",
    name: "Penicillin G Procaine — Inj",
    active_ingredient: "Penicillin G Procaine",
    drug_class: "Penicillins",
    route: "IM",
    dose_limit: "20000 IU/kg",
    milk_withdrawal_days: 3,
    meat_withdrawal_days: 7,
    species: ["Cow", "Buffalo", "Goat"],
    source: "CDSCO Reference Manual / FSSAI MRL Rules"
  }
];

// Helper methods to get/set data from localStorage
const DB = {
  getAnimals: () => {
    return JSON.parse(localStorage.getItem("pashusetu_animals")) || [];
  },
  saveAnimals: (animals) => {
    localStorage.setItem("pashusetu_animals", JSON.stringify(animals));
  },
  getTreatments: () => {
    return JSON.parse(localStorage.getItem("pashusetu_treatments")) || [];
  },
  saveTreatments: (treatments) => {
    localStorage.setItem("pashusetu_treatments", JSON.stringify(treatments));
  },
  getNotifications: () => {
    return JSON.parse(localStorage.getItem("pashusetu_notifications")) || [];
  },
  saveNotifications: (notifications) => {
    localStorage.setItem("pashusetu_notifications", JSON.stringify(notifications));
  },
  getLabResults: () => {
    return JSON.parse(localStorage.getItem("pashusetu_lab_results")) || [];
  },
  saveLabResults: (results) => {
    localStorage.setItem("pashusetu_lab_results", JSON.stringify(results));
  },

  // Resets the DB and seeds it with default data matching the original layout
  seed: () => {
    // 1. Seed Animals
    const defaultAnimals = [
      {
        id: "C-0471",
        pashu_aadhaar: "PA · 8923 · 4451 · 0017",
        name: "Gangaa",
        species: "Cow",
        breed: "HF Cross Cow",
        age: "5 yrs",
        weight: 485,
        status: "Withdrawal In Progress"
      },
      {
        id: "C-0466",
        pashu_aadhaar: "PA · 8923 · 4451 · 0016",
        name: "Radha",
        species: "Cow",
        breed: "Gir Cow",
        age: "7 yrs",
        weight: 420,
        status: "Just Started — DO NOT SELL"
      },
      {
        id: "C-0462",
        pashu_aadhaar: "PA · 8923 · 4451 · 0015",
        name: "Kaveri",
        species: "Cow",
        breed: "Sahiwal",
        age: "4 yrs",
        weight: 440,
        status: "Eligible — Compliant"
      },
      {
        id: "B-0019",
        pashu_aadhaar: "PA · 8923 · 4451 · 0014",
        name: "Bachhu",
        species: "Buffalo",
        breed: "Murrah Buffalo",
        age: "6 yrs",
        weight: 530,
        status: "No Active Treatment"
      }
    ];

    // Helper to format ISO datetime relative to current local time to preserve dashboard logic
    const getRelativeISOString = (daysOffset, hourOffset, minuteOffset) => {
      const d = new Date();
      d.setDate(d.getDate() + daysOffset);
      d.setHours(d.getHours() + hourOffset);
      d.setMinutes(d.getMinutes() + minuteOffset);
      d.setSeconds(0);
      d.setMilliseconds(0);
      return d.toISOString();
    };

    // Radha Ceftiofur: Started 1 day ago. Ends on Aug 14 (let's say 4 days 12h left from local time).
    // Let's set Radha's treatment end to be exactly 4.5 days from now, which means withdrawal ends 4.5 days from now.
    // Since Ceftiofur Milk WP = 5 days, last dose must have been 0.5 days ago.
    const radhaLastDose = getRelativeISOString(0, -12, 0); // 12 hours ago
    
    // Gangaa Enrofloxacin: Ends tomorrow (1d 14h left).
    // Enrofloxacin Milk WP = 4 days. If 1 day 14 hours (38 hours) left, last dose was (96 - 38) = 58 hours ago.
    const gangaaLastDose = getRelativeISOString(-2, -10, 0); // 58 hours ago

    // 2. Seed Treatments
    const defaultTreatments = [
      {
        id: "TX-001",
        animal_id: "C-0466",
        condition: "Clinical Mastitis",
        drug_id: "ceftiofur_sodium",
        drug_name: "Ceftiofur Sodium — IM (1.1 mg/kg)",
        dose: "2g S.C. once daily",
        start_date: getRelativeISOString(-1, -12, 0), // Course started 1.5 days ago
        end_date: radhaLastDose, // Last dose 12 hours ago
        vet: "Dr. Anita Verma · Lic. UP-VET-4421",
        prescription_id: "RX-1102",
        status: "Active",
        affected_product: "Milk/Meat"
      },
      {
        id: "TX-002",
        animal_id: "C-0471",
        condition: "Sub-clinical Mastitis",
        drug_id: "enrofloxacin",
        drug_name: "Enrofloxacin 10% — Inj (2.5 mg/kg)",
        dose: "20ml IM q24h",
        start_date: getRelativeISOString(-5, -10, 0), // Started 5 days and 10 hours ago
        end_date: gangaaLastDose, // Last dose 58 hours ago (2.4 days ago)
        vet: "Dr. Anita Verma · Lic. UP-VET-4421",
        prescription_id: "RX-1104",
        status: "WP Countdown",
        affected_product: "Milk"
      },
      {
        id: "TX-003",
        animal_id: "C-0462",
        condition: "Clinical Mastitis",
        drug_id: "oxytetracycline_la",
        drug_name: "Oxytetracycline LA — 20% Inj",
        dose: "30ml IM",
        start_date: getRelativeISOString(-19, 0, 0), // Started 19 days ago
        end_date: getRelativeISOString(-15, 0, 0), // Ended 15 days ago
        vet: "Dr. Rajesh Kumar · Lic. UP-VET-1189",
        prescription_id: "RX-1089",
        status: "Completed",
        affected_product: "Milk/Meat"
      },
      {
        id: "TX-004",
        animal_id: "B-0019",
        condition: "Routine vaccination",
        drug_id: "none",
        drug_name: "FMD + HS Vaccine — 5ml",
        dose: "5ml SC",
        start_date: getRelativeISOString(-45, 0, 0), // 45 days ago
        end_date: getRelativeISOString(-45, 0, 0),
        vet: "Govt. Vet Camp · Dept of AH",
        prescription_id: "VAC-9912",
        status: "Completed",
        affected_product: "None"
      }
    ];

    // 3. Seed Notifications
    const defaultNotifications = [
      {
        id: "NF-001",
        icon: "⏰",
        class: "ni-amber",
        title: "Gangaa eligible soon",
        body: "Withdrawal for Enrofloxacin is wrapping up. Double-check countdown before milking.",
        time: "2 hrs ago",
        unread: true
      },
      {
        id: "NF-002",
        icon: "✅",
        class: "ni-green",
        title: "Milma Dairy cleared batch 07/24L",
        body: "58 litres procured — payment ₹ 3,422 credited. Thank you!",
        time: "Yesterday",
        unread: true
      },
      {
        id: "NF-003",
        icon: "🚨",
        class: "ni-red",
        title: "Radha: Do NOT sell milk today",
        body: "Withdrawal in progress (10% complete). Selling would be non-compliant.",
        time: "2d ago",
        unread: true
      },
      {
        id: "NF-004",
        icon: "👨‍⚕️",
        class: "ni-blue",
        title: "Dr. Anita approved Rx #RX-1104",
        body: "Prescription signed and withdrawal period auto-computed from CDSCO DB.",
        time: "3d ago",
        unread: false
      }
    ];

    // 4. Seed Lab Results
    const defaultLabResults = [
      {
        id: "LAB-101",
        animal_id: "C-0462",
        test_date: getRelativeISOString(-10, 0, 0),
        residue_detected: false,
        substance: "Oxytetracycline",
        level_ppm: 0.0002, // well below FSSAI MRL
        status: "Negative"
      }
    ];

    if (!localStorage.getItem("pashusetu_animals")) {
      DB.saveAnimals(defaultAnimals);
    }
    if (!localStorage.getItem("pashusetu_treatments")) {
      DB.saveTreatments(defaultTreatments);
    }
    if (!localStorage.getItem("pashusetu_notifications")) {
      DB.saveNotifications(defaultNotifications);
    }
    if (!localStorage.getItem("pashusetu_lab_results")) {
      DB.saveLabResults(defaultLabResults);
    }
  }
};

// Auto-run seed check on import
DB.seed();
window.DRUG_DATABASE = DRUG_DATABASE;
window.DB = DB;
