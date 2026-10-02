// js/app.js
// PashuSetu Livestock Portal - Client-Side App Controller & DOM Bindings

(function() {
  // Cache DOM elements
  const animalGrid = document.getElementById("animal-grid-container");
  const notifList = document.getElementById("notif-list-container");
  const historyTbody = document.getElementById("treatment-history-tbody");
  const treatmentForm = document.getElementById("new-treatment-form");
  const previewContainer = document.getElementById("preview-results-container");

  const statTotal = document.getElementById("stat-total-animals");
  const statWithdrawal = document.getElementById("stat-active-withdrawal");
  const statOngoing = document.getElementById("stat-ongoing-treatment");
  const statProcured = document.getElementById("stat-procured-passes");

  const selectAnimal = document.getElementById("form-animal");
  const selectDrug = document.getElementById("form-drug");

  // Keep track of the currently selected animal for QR display
  let selectedAnimalId = null;

  // Initialize page bindings
  window.addEventListener("load", () => {
    initFormSelects();
    renderDashboard();
    setupEventListeners();

    // Live ticker: Recalculate status and tick timers every 5 seconds
    setInterval(() => {
      renderDashboard(true); // silent refresh (retains input focus)
    }, 5000);
  });

  // Populate Select drop downs dynamically
  function initFormSelects() {
    if (!selectAnimal || !selectDrug) return;

    // Reset selects
    selectAnimal.innerHTML = '<option value="">-- Select Animal --</option>';
    selectDrug.innerHTML = '<option value="">-- Select CDSCO Approved Drug --</option>';

    // Load animals
    const animals = DB.getAnimals();
    animals.forEach(a => {
      const opt = document.createElement("option");
      opt.value = a.id;
      opt.textContent = `${a.name} (#${a.id}) — ${a.breed}`;
      selectAnimal.appendChild(opt);
    });

    // Load CDSCO drugs
    DRUG_DATABASE.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = `${d.name}`;
      selectDrug.appendChild(opt);
    });

    // Auto-fill dates with current time on load
    const now = new Date();
    const tzoffset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(now - tzoffset)).toISOString().slice(0, 16);
    
    const startInput = document.getElementById("form-start-date");
    const endInput = document.getElementById("form-end-date");
    if (startInput) startInput.value = localISOTime;
    if (endInput) endInput.value = localISOTime;
  }

  // Setup UI Event handlers
  function setupEventListeners() {
    // 1. Add Animal click intercept
    const addAnimalBtn = document.querySelector('a[href="#new-animal"]');
    if (addAnimalBtn) {
      addAnimalBtn.addEventListener("click", (e) => {
        e.preventDefault();
        addNewAnimalPrompt();
      });
    }

    // 2. Preview button click
    const previewBtn = document.getElementById("btn-preview-withdrawal");
    if (previewBtn) {
      previewBtn.addEventListener("click", () => {
        showTreatmentPreview();
      });
    }

    // 3. Form submission
    if (treatmentForm) {
      treatmentForm.addEventListener("submit", (e) => {
        e.preventDefault();
        saveNewTreatment();
      });
    }

    // 4. Notifications unread click clear
    if (notifList) {
      notifList.addEventListener("click", (e) => {
        const item = e.target.closest(".notif-item");
        if (item && item.classList.contains("unread")) {
          item.classList.remove("unread");
          // Update in DB
          const notifs = DB.getNotifications();
          const title = item.querySelector("b").innerText;
          const matched = notifs.find(n => n.title === title);
          if (matched) {
            matched.unread = false;
            DB.saveNotifications(notifs);
          }
        }
      });
    }
  }

  // Intercept and prompt for adding a new animal
  function addNewAnimalPrompt() {
    const name = prompt("Enter Animal Name (e.g. Gauri):");
    if (!name) return;

    const speciesRaw = prompt("Enter Species (Cow or Buffalo):", "Cow");
    if (!speciesRaw) return;
    const species = speciesRaw.charAt(0).toUpperCase() + speciesRaw.slice(1).toLowerCase();

    const breed = prompt("Enter Breed (e.g. Sahiwal):");
    if (!breed) return;

    const weightRaw = prompt("Enter Animal Weight in kg (e.g. 450):", "450");
    const weight = parseInt(weightRaw) || 400;

    const age = prompt("Enter Animal Age (e.g. 4 yrs):", "4 yrs");

    const animals = DB.getAnimals();
    
    // Generate unique ID and Aadhaar tag
    const prefix = species === "Buffalo" ? "B" : "C";
    const num = String(animals.length + 20).padStart(4, "0");
    const id = `${prefix}-${num}`;
    
    const randomAadhaarNum = Math.floor(1000 + Math.random() * 9000);
    const pashu_aadhaar = `PA · 8923 · 4451 · ${randomAadhaarNum}`;

    const newAnimal = {
      id,
      pashu_aadhaar,
      name,
      species,
      breed,
      age,
      weight,
      status: "No Active Treatment"
    };

    animals.push(newAnimal);
    DB.saveAnimals(animals);

    // Create a notification
    const notifications = DB.getNotifications();
    notifications.unshift({
      id: `NF-${Date.now()}`,
      icon: "🐄",
      class: "ni-blue",
      title: `${name} Registered Successfully`,
      body: `New ${breed} (${id}) added to Pashu Aadhaar records. No active treatment logged.`,
      time: "Just now",
      unread: true
    });
    DB.saveNotifications(notifications);

    // Reset selects and refresh dashboard
    initFormSelects();
    renderDashboard();
  }

  // Previews calculated withdrawal and risk scoring before committing
  function showTreatmentPreview() {
    if (!previewContainer) return;

    const animalId = selectAnimal.value;
    const drugId = selectDrug.value;
    const startDateVal = document.getElementById("form-start-date").value;
    const endDateVal = document.getElementById("form-end-date").value;
    const dose = document.getElementById("form-dose").value;
    const notes = document.getElementById("form-notes").value;

    if (!animalId || !drugId || !startDateVal || !endDateVal) {
      alert("Please fill in Animal, Drug, and Treatment start/end dates to preview.");
      return;
    }

    const animals = DB.getAnimals();
    const animal = animals.find(a => a.id === animalId);
    const drug = DRUG_DATABASE.find(d => d.id === drugId);

    // Build temporary treatment mock object
    const mockTx = {
      animal_id: animalId,
      drug_id: drugId,
      drug_name: drug.name,
      start_date: new Date(startDateVal).toISOString(),
      end_date: new Date(endDateVal).toISOString(),
      affected_product: drug.milk_withdrawal_days > 0 ? "Milk/Meat" : "Meat"
    };

    // Calculate details
    const compliance = ComplianceEngine.calculateTreatmentWithdrawal(mockTx, animal);
    const risk = RiskModel.calculateRisk(animal, DB.getTreatments(), DB.getLabResults(), mockTx);

    // Determine risk visual colors
    let riskColorClass = "pf-green";
    let riskText = "LOW RISK";
    if (risk.score > 30 && risk.score <= 70) {
      riskColorClass = "pf-amber";
      riskText = "MEDIUM RISK";
    } else if (risk.score > 70) {
      riskColorClass = "pf-red";
      riskText = "HIGH RISK";
    }

    // Construct Preview Content HTML
    let contentHtml = `
      <h4 style="font-size:14px; color:#1B2A4A; font-weight:700; margin-bottom:12px; display:flex; align-items:center; gap:6px;">
        📊 Pre-Submission Regulatory & AI Analytics
      </h4>
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; margin-bottom:12px;">
        
        <div>
          <p style="font-size:11px; color:#5B6560; font-weight:500;">Calculated Withdrawal Period</p>
          <p style="font-size:16px; font-weight:800; color:#1B2A4A; margin-top:2px;">
            ${compliance.withdrawal_days} Days <span style="font-size:12px; font-weight:600; color:#B8863B;">(${drug.active_ingredient})</span>
          </p>
          <p style="font-size:11px; color:#2F4A3C; margin-top:4px; font-weight:500;">
            📅 Eligible: <strong>${new Date(compliance.withdrawal_end_date).toLocaleString()}</strong>
          </p>
          <p style="font-size:10px; color:#8E9BB3; margin-top:2px; font-style:italic;">
            Source: ${compliance.notes}
          </p>
        </div>

        <div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <p style="font-size:11px; color:#5B6560; font-weight:500;">AMR / MRL Risk Index</p>
            <span style="font-size:10px; font-weight:700; color:${risk.score > 70 ? '#DC2626' : (risk.score > 30 ? '#B8863B' : '#2F4A3C')};">${riskText}</span>
          </div>
          <div style="font-size:22px; font-weight:900; color:#1B2A4A; margin-top:2px; display:flex; align-items:baseline; gap:4px;">
            ${risk.score}<span style="font-size:12px; font-weight:500; color:#5B6560;">/100</span>
          </div>
          <div class="progress-track" style="height:6px; margin-top:6px;">
            <div class="progress-fill ${riskColorClass}" style="width: ${risk.score}%"></div>
          </div>
        </div>

      </div>

      <div style="border-top:1px solid #E5E7EB; padding-top:10px; margin-top:8px;">
        <p style="font-size:11.5px; font-weight:700; color:#1B2A4A; margin-bottom:6px;">Explainable SHAP Contributions:</p>
        <ul style="list-style:none; padding-left:0; font-size:11px; line-height:1.5; color:#5B6560;">
    `;

    risk.explanations.forEach(exp => {
      contentHtml += `<li style="margin-bottom:4px; display:flex; align-items:flex-start; gap:6px;">
        <span style="color:#B8863B;">•</span> <span>${exp}</span>
      </li>`;
    });

    contentHtml += `
        </ul>
      </div>
    `;

    previewContainer.innerHTML = contentHtml;
    previewContainer.style.display = "block";
  }

  // Commits and saves new treatment to local storage
  function saveNewTreatment() {
    const animalId = selectAnimal.value;
    const drugId = selectDrug.value;
    const startDateVal = document.getElementById("form-start-date").value;
    const endDateVal = document.getElementById("form-end-date").value;
    const dose = document.getElementById("form-dose").value;
    const vet = document.getElementById("form-vet").value;
    const prescriptionId = document.getElementById("form-prescription-id").value || `RX-${Math.floor(1000 + Math.random() * 9000)}`;
    const notes = document.getElementById("form-notes").value;

    const animals = DB.getAnimals();
    const animal = animals.find(a => a.id === animalId);
    const drug = DRUG_DATABASE.find(d => d.id === drugId);

    const newTx = {
      id: `TX-${Date.now()}`,
      animal_id: animalId,
      condition: document.getElementById("form-diagnosis").value,
      drug_id: drugId,
      drug_name: drug.name,
      dose: dose,
      start_date: new Date(startDateVal).toISOString(),
      end_date: new Date(endDateVal).toISOString(),
      vet: vet,
      prescription_id: prescriptionId,
      status: "Active",
      affected_product: drug.milk_withdrawal_days > 0 ? "Milk" : "Meat"
    };

    const treatments = DB.getTreatments();
    treatments.unshift(newTx);
    DB.saveTreatments(treatments);

    // Trigger compliance check to generate an alert notification if risk is high
    const risk = RiskModel.calculateRisk(animal, treatments, DB.getLabResults(), newTx);
    const compliance = ComplianceEngine.calculateTreatmentWithdrawal(newTx, animal);

    const notifications = DB.getNotifications();
    notifications.unshift({
      id: `NF-${Date.now()}`,
      icon: "💊",
      class: "ni-blue",
      title: `Treatment Logged for ${animal.name}`,
      body: `${drug.active_ingredient} prescribed by ${vet.split('·')[0]}. Computed milk withdrawal: ${compliance.withdrawal_days} days.`,
      time: "Just now",
      unread: true
    });

    if (risk.score > 60) {
      notifications.unshift({
        id: `NF-RISK-${Date.now()}`,
        icon: "🚨",
        class: "ni-red",
        title: `High Risk Score flagged: ${animal.name}`,
        body: `AMR Risk index at ${risk.score}/100. Priority testing requested at next milk procurement.`,
        time: "Just now",
        unread: true
      });
    }
    DB.saveNotifications(notifications);

    // Reset Form
    treatmentForm.reset();
    if (previewContainer) {
      previewContainer.style.display = "none";
      previewContainer.innerHTML = "";
    }

    // Refresh selects and render
    initFormSelects();
    renderDashboard();
  }

  // Core renderer
  function renderDashboard(silent = false) {
    const animals = DB.getAnimals();
    const treatments = DB.getTreatments();
    const labResults = DB.getLabResults();
    const notifications = DB.getNotifications();

    // If selectedAnimalId hasn't been set yet, set it to the first animal
    if (!selectedAnimalId && animals.length > 0) {
      selectedAnimalId = animals[0].id;
    }

    let activeWithdrawalCount = 0;
    let ongoingTxCount = 0;

    // 1. Evaluate statuses & Render Animal cards
    if (animalGrid) {
      // Remember scroll position
      const scrollPos = animalGrid.scrollTop;
      animalGrid.innerHTML = "";

      animals.forEach(a => {
        const evalResult = ComplianceEngine.evaluateAnimalStatus(a, treatments, labResults);
        
        // Save evaluated status back to animal object
        a.status = evalResult.status;

        if (evalResult.status === "Withdrawal In Progress" || evalResult.status === "Manual Review Required") {
          activeWithdrawalCount++;
        } else if (evalResult.status === "Just Started — DO NOT SELL") {
          ongoingTxCount++;
          activeWithdrawalCount++;
        }

        const isSelected = a.id === selectedAnimalId;
        const activeClass = isSelected ? " style='border-color: #1B2A4A; box-shadow: 0 8px 24px rgba(27,42,74,0.12); border-width: 2.5px;'" : "";

        const card = document.createElement("div");
        card.className = `animal-card ${evalResult.cardClass}`;
        card.style = isSelected ? "border-color: #1B2A4A; box-shadow: 0 8px 24px rgba(27,42,74,0.12); border-width: 2px;" : "";
        
        // Define details dynamically
        let drugLabel = "✅ No Active Treatment";
        let fillClass = "pf-green";
        if (evalResult.activeTx) {
          const drug = DRUG_DATABASE.find(d => d.id === evalResult.activeTx.drug_id);
          if (drug) {
            const milkW = drug.milk_withdrawal_days;
            const meatW = drug.meat_withdrawal_days;
            drugLabel = `💊 ${drug.active_ingredient} · Milk: ${milkW}d${meatW > 0 ? ` / Meat: ${meatW}d` : ''}`;
          } else {
            drugLabel = `💊 ${evalResult.activeTx.drug_name}`;
          }

          if (evalResult.status.includes("DO NOT SELL")) fillClass = "pf-red";
          else if (evalResult.status.includes("Withdrawal")) fillClass = "pf-amber";
        }

        card.innerHTML = `
          <div class="animal-top">
            <div>
              <div class="animal-name">${a.name}</div>
              <div class="animal-sub">${a.breed} · ${a.age} · ${a.weight} kg</div>
            </div>
            <div class="animal-tag">#${a.id}</div>
          </div>
          <span class="status-pill ${evalResult.cssClass}">${evalResult.status}</span>
          <div class="withdrawal-info">
            <div class="drug-name">${drugLabel}</div>
            <div class="progress-track">
              <div class="progress-fill ${fillClass}" style="width: ${evalResult.progress}%"></div>
            </div>
            <div class="countdown-row">
              <span class="countdown-left">${evalResult.status.includes("Eligible") ? "Procurement cleared" : "Withdrawal End Date"}</span>
              <span class="countdown-val ${evalResult.cssClass === 'pill-red' ? 'red' : (evalResult.cssClass === 'pill-amber' ? 'amber' : '')}">
                ${evalResult.countdown || "Ready for Dairy"}
              </span>
            </div>
          </div>
        `;

        card.addEventListener("click", () => {
          selectedAnimalId = a.id;
          renderDashboard();
        });

        animalGrid.appendChild(card);
      });

      animalGrid.scrollTop = scrollPos;
    }

    // Save animal updates to DB
    DB.saveAnimals(animals);

    // 2. Render Stats Grid Numbers
    if (!silent) {
      if (statTotal) statTotal.textContent = animals.length;
      if (statWithdrawal) statWithdrawal.textContent = activeWithdrawalCount;
      if (statOngoing) statOngoing.textContent = ongoingTxCount;
      if (statProcured) statProcured.textContent = 24 + (treatments.filter(t => t.status === "Completed").length);
    }

    // 3. Render Notifications
    if (notifList) {
      notifList.innerHTML = "";
      // Only show top 4 notifications
      notifications.slice(0, 4).forEach(n => {
        const item = document.createElement("div");
        item.className = `notif-item ${n.unread ? "unread" : ""}`;
        item.innerHTML = `
          <div class="notif-icon ${n.class}">${n.icon}</div>
          <div class="notif-body">
            <b>${n.title}</b>
            <p>${n.body}</p>
          </div>
          <div class="notif-time">${n.time}</div>
        `;
        notifList.appendChild(item);
      });
      // Update unread count badge on sidebar
      const badge = document.querySelector(".nav-badge");
      if (badge) {
        const unreadCount = notifications.filter(n => n.unread).length;
        if (unreadCount > 0) {
          badge.textContent = unreadCount;
          badge.style.display = "inline-block";
        } else {
          badge.style.display = "none";
        }
      }
    }

    // 4. Render Treatment History Table
    if (historyTbody) {
      historyTbody.innerHTML = "";
      treatments.forEach(t => {
        const anim = animals.find(a => a.id === t.animal_id) || { name: "Unknown", id: t.animal_id, breed: "Livestock" };
        
        let pillClass = "pill-green";
        let label = "Completed";

        const now = new Date();
        const start = new Date(t.start_date);
        const end = new Date(t.end_date);
        
        // Find drug withdrawal
        const compliance = ComplianceEngine.calculateTreatmentWithdrawal(t, anim);

        if (compliance && compliance.is_off_label) {
          pillClass = "pill-amber";
          label = "Under Review";
        } else if (compliance && compliance.withdrawal_end_date) {
          const wEnd = new Date(compliance.withdrawal_end_date);
          if (now >= start && now <= end) {
            pillClass = "pill-red";
            label = "Active Course";
          } else if (now > end && now <= wEnd) {
            pillClass = "pill-amber";
            label = "Countdown";
          }
        }

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>
            <div class="tbl-animal">
              <div class="tbl-avatar">🐄</div>
              <div>
                <b>${anim.name}</b>
                <div class="tbl-vet">#${anim.id} · ${anim.breed}</div>
              </div>
            </div>
          </td>
          <td>
            ${t.drug_name}<br>
            <span class="tbl-date">${compliance ? `${compliance.withdrawal_days}d Milk` : 'No withdrawal'}</span>
          </td>
          <td>
            ${new Date(t.start_date).toLocaleDateString()} — ${new Date(t.end_date).toLocaleDateString()}<br>
            <span class="tbl-date">${t.condition}</span>
          </td>
          <td>
            ${t.vet.split(" · ")[0]}<br>
            <span class="tbl-vet">${t.vet.split(" · ")[1] || ""}</span>
          </td>
          <td>
            <span class="status-pill ${pillClass}">${label}</span>
          </td>
        `;
        historyTbody.appendChild(tr);
      });
    }

    // 5. Update QR Code section for the selected animal
    if (selectedAnimalId) {
      const selectedAnimal = animals.find(a => a.id === selectedAnimalId);
      if (selectedAnimal) {
        // Render seed-based QR Code
        renderQRForAnimal(selectedAnimal);
        
        // Update labels
        const qrTitle = document.getElementById("qr-title");
        const qrSubtitle = document.getElementById("qr-subtitle");
        if (qrTitle) qrTitle.textContent = `${selectedAnimal.name} Batch Compliance QR`;
        if (qrSubtitle) qrSubtitle.textContent = selectedAnimal.pashu_aadhaar;
      }
    }
  }

  // Generates a seed-based, dynamic QR pattern for a selected animal
  function renderQRForAnimal(animal) {
    const qr = document.getElementById("qrPattern");
    if (!qr) return;

    // Clear old divs
    qr.innerHTML = "";

    // Generate seed from animal ID digits
    let seed = 12345;
    const digits = animal.id.replace(/\D/g, "");
    if (digits) {
      seed = parseInt(digits) * 7823;
    } else {
      seed = animal.name.charCodeAt(0) * 8923;
    }

    let s = seed;
    for (let i = 0; i < 49; i++) {
      const div = document.createElement("div");
      s = (s * 9301 + 49297) % 233280;
      const rnd = s / 233280;
      // High-risk or active withdrawal animals get different QR layout (slightly modified)
      const threshold = (animal.status.includes("DO NOT SELL") || animal.status.includes("Withdrawal")) ? 0.44 : 0.52;
      if (rnd > threshold) div.className = "filled";
      qr.appendChild(div);
    }

    // Corners always filled (finder patterns)
    const corners = [0, 1, 2, 7, 9, 14, 15, 16, 42, 43, 44, 46, 48];
    corners.forEach(i => qr.children[i] && (qr.children[i].className = "filled"));
    const clearCenter = [24, 28, 20];
    clearCenter.forEach(i => qr.children[i] && (qr.children[i].className = ""));
  }

})();
