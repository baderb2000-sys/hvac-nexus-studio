(function () {
  "use strict";

  const E = window.HVACEngine;
  const STORE_KEY = "hvac-nexus-studio-state-v1";
  const tabs = [
    ["project", "Project Information", "PI"],
    ["weather", "Weather and EPW", "WX"],
    ["heat", "Heat Gains", "HG"],
    ["cooling", "Cooling Load", "CL"],
    ["ventilation", "Ventilation", "VA"],
    ["duct", "Duct Design", "DD"],
    ["diffuser", "Diffuser Selection", "DS"],
    ["comfort", "Thermal Comfort", "TC"],
    ["co2", "Indoor Air Quality", "IA"],
    ["report", "Results Report", "RP"],
  ];

  let state = loadState();
  let activeTab = location.hash ? location.hash.slice(1) : "project";
  if (!tabs.some(([id]) => id === activeTab)) activeTab = "project";

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      return mergeDeep(E.getDefaultState(), saved || {});
    } catch (err) {
      return E.getDefaultState();
    }
  }

  function saveState() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }

  function mergeDeep(base, patch) {
    if (!patch || typeof patch !== "object") return base;
    Object.keys(patch).forEach((key) => {
      if (patch[key] && typeof patch[key] === "object" && !Array.isArray(patch[key])) {
        base[key] = mergeDeep(base[key] || {}, patch[key]);
      } else {
        base[key] = patch[key];
      }
    });
    return base;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getPath(obj, path) {
    return path.split(".").reduce((acc, key) => acc == null ? undefined : acc[key], obj);
  }

  function setPath(obj, path, value) {
    const keys = path.split(".");
    let cursor = obj;
    keys.slice(0, -1).forEach((key) => {
      if (!cursor[key] || typeof cursor[key] !== "object") cursor[key] = {};
      cursor = cursor[key];
    });
    cursor[keys[keys.length - 1]] = value;
  }

  function fmt(value, digits = 1) {
    if (!Number.isFinite(Number(value))) return "n/a";
    return E.round(Number(value), digits).toLocaleString(undefined, {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    });
  }

  function kw(watts) {
    return fmt(watts / 1000, 2) + " kW";
  }

  function btuh(watts) {
    return fmt(watts * E.C.W_TO_BTUH, 0) + " Btu/hr";
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function control(label, path, options = {}) {
    const type = options.type || "number";
    const scale = options.scale || 1;
    let value = Object.prototype.hasOwnProperty.call(options, "value") ? options.value : getPath(state, path);
    const placeholder = options.placeholder != null ? ` placeholder="${esc(options.placeholder)}"` : "";
    const step = options.step != null ? ` step="${esc(options.step)}"` : "";
    const min = options.min != null ? ` min="${esc(options.min)}"` : "";
    const max = options.max != null ? ` max="${esc(options.max)}"` : "";
    const hint = options.hint ? `<div class="subtle">${esc(options.hint)}</div>` : "";
    const common = `data-path="${esc(path)}" data-type="${esc(type)}" data-scale="${esc(scale)}"`;
    if (type === "select") {
      const opts = (options.choices || []).map((choice) => {
        const val = Array.isArray(choice) ? choice[0] : choice;
        const labelText = Array.isArray(choice) ? choice[1] : choice;
        return `<option value="${esc(val)}" ${String(value) === String(val) ? "selected" : ""}>${esc(labelText)}</option>`;
      }).join("");
      return `<div class="field"><label>${esc(label)}</label><select ${common}>${opts}</select>${hint}</div>`;
    }
    if (type === "checkbox") {
      return `<div class="field"><label>${esc(label)}</label><label class="check-row"><input ${common} type="checkbox" ${value ? "checked" : ""}><span>${esc(options.text || "Enabled")}</span></label>${hint}</div>`;
    }
    if (type === "textarea") {
      return `<div class="field"><label>${esc(label)}</label><textarea ${common}${placeholder}>${esc(value || "")}</textarea>${hint}</div>`;
    }
    if (type === "text") {
      return `<div class="field"><label>${esc(label)}</label><input ${common} type="text" value="${esc(value || "")}"${placeholder}>${hint}</div>`;
    }
    if (value == null || value === "") value = "";
    else value = Number(value) * scale;
    return `<div class="field"><label>${esc(label)}</label><input ${common} type="number" value="${esc(value)}"${step}${min}${max}${placeholder}>${hint}</div>`;
  }

  function metric(label, value, tone = "") {
    return `<div class="metric ${tone}"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
  }

  function kpi(label, value) {
    return `<div class="kpi"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
  }

  function table(headers, rows) {
    return `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
  }

  function notes(items, warnItems) {
    const all = [];
    (items || []).forEach((x) => all.push([x, ""]));
    (warnItems || []).forEach((x) => all.push([x, "warn"]));
    if (!all.length) return "";
    return `<ul class="note-list">${all.map(([text, tone]) => `<li class="${tone}">${esc(text)}</li>`).join("")}</ul>`;
  }

  function renderTabs() {
    document.getElementById("tabs").innerHTML = tabs.map(([id, title, icon]) => (
      `<button class="tab-btn ${id === activeTab ? "active" : ""}" data-tab="${id}" type="button"><span class="tab-icon">${icon}</span><span>${esc(title)}</span></button>`
    )).join("");
  }

  function renderGlobalKpis() {
    const summary = E.summarizeResults(state);
    document.getElementById("globalKpis").innerHTML = [
      kpi("Design cooling", `${fmt(summary.cooling.designKw, 1)} kW`),
      kpi("System size", `${fmt(summary.cooling.recommendedTons, 1)} TR`),
      kpi("Supply airflow", `${fmt(summary.cooling.supplyAirflowCfm, 0)} CFM`),
      kpi("Outdoor air", `${fmt(summary.ventilation.outdoorAirCfm, 0)} CFM`),
    ].join("");
  }

  function render() {
    renderTabs();
    renderGlobalKpis();
    const current = tabs.find(([id]) => id === activeTab) || tabs[0];
    document.getElementById("screenTitle").textContent = current[1];
    const app = document.getElementById("app");
    const renderers = {
      project: renderProject,
      weather: renderWeather,
      heat: renderHeat,
      cooling: renderCooling,
      ventilation: renderVentilation,
      duct: renderDuct,
      diffuser: renderDiffuser,
      comfort: renderComfort,
      co2: renderCO2,
      report: renderReport,
    };
    app.innerHTML = renderers[activeTab]();
    requestAnimationFrame(drawActiveCharts);
  }

  function renderProject() {
    const g = E.calculateGeometry(state);
    return `
      <div class="grid">
        <section class="section">
          <h3>Building Geometry</h3>
          <div class="form-grid">
            ${control("Length", "geometry.lengthM", { step: 0.1, hint: "m" })}
            ${control("Width", "geometry.widthM", { step: 0.1, hint: "m" })}
            ${control("Height", "geometry.heightM", { step: 0.1, hint: "m" })}
            ${control("Occupancy density", "internal.occupancyDensityM2PerPerson", { step: 0.1, hint: "m2/person" })}
          </div>
          <h4>Window-to-Wall Ratio</h4>
          <div class="form-grid">
            ${control("North WWR", "geometry.wwr.north", { step: 1, scale: 100, min: 0, max: 95, hint: "%" })}
            ${control("South WWR", "geometry.wwr.south", { step: 1, scale: 100, min: 0, max: 95, hint: "%" })}
            ${control("East WWR", "geometry.wwr.east", { step: 1, scale: 100, min: 0, max: 95, hint: "%" })}
            ${control("West WWR", "geometry.wwr.west", { step: 1, scale: 100, min: 0, max: 95, hint: "%" })}
          </div>
        </section>
      </div>
      <div class="grid three" style="margin-top:14px">
        ${metric("Floor area", `${fmt(g.floorAreaM2, 1)} m2`, "teal")}
        ${metric("Zone volume", `${fmt(g.volumeM3, 1)} m3`, "blue")}
        ${metric("Design occupants", `${fmt(Math.ceil(g.floorAreaM2 / state.internal.occupancyDensityM2PerPerson), 0)} people`, "amber")}
      </div>
      <section class="section" style="margin-top:14px">
        <h3>Envelope Areas</h3>
        ${table(["Facade", "Gross wall m2", "Window m2", "Opaque wall m2", "WWR"], Object.keys(g.grossWalls).map((o) => [
          esc(o.toUpperCase()),
          fmt(g.grossWalls[o], 1),
          fmt(g.windows[o], 1),
          fmt(g.opaqueWalls[o], 1),
          `${fmt(state.geometry.wwr[o] * 100, 0)}%`,
        ]))}
      </section>
    `;
  }

  function renderWeather() {
    const weather = E.getWeather(state);
    const epw = state.epwSummary;
    return `
      <div class="grid sidebar-layout">
        <section class="section">
          <h3>City Design Conditions</h3>
          <div class="form-grid">
            ${control("Predefined city", "weather.city", { type: "select", choices: Object.keys(E.CITY_WEATHER) })}
            ${control("Custom dry bulb", "weather.custom.db", { step: 0.1, placeholder: weather.db, hint: "deg C, blank uses city preset" })}
            ${control("Custom wet bulb", "weather.custom.wb", { step: 0.1, placeholder: weather.wb, hint: "deg C, blank uses city preset" })}
            ${control("Custom pressure", "weather.custom.pressureKPa", { step: 0.1, placeholder: weather.pressureKPa, hint: "kPa, optional" })}
          </div>
          <div class="actions">
            <button class="btn" data-action="clear-weather" type="button">Reset city override</button>
          </div>
          <h4>EPW Weather File</h4>
          <label class="file-drop">
            <strong>Upload EPW file</strong>
            <span class="subtle">Used for hourly weather diagnostics and annual cooling degree-hours.</span>
            <input id="epwFile" type="file" accept=".epw,.txt">
          </label>
        </section>
        <section class="section">
          <h3>Psychrometric State</h3>
          <div class="metric-grid">
            ${metric("Outdoor DB", `${fmt(weather.db, 1)} deg C`, "coral")}
            ${metric("Outdoor WB", `${fmt(weather.wb, 1)} deg C`, "amber")}
            ${metric("Outdoor RH", `${fmt(weather.outdoorRH, 0)}%`, "blue")}
            ${metric("Humidity ratio", `${fmt(weather.outdoorW * 1000, 2)} g/kg`, "teal")}
            ${metric("Enthalpy", `${fmt(weather.outdoorEnthalpy, 1)} kJ/kg`, "")}
            ${metric("Pressure", `${fmt(weather.pressureKPa, 1)} kPa`, "")}
          </div>
          <h4>Assumption Note</h4>
          ${notes([weather.designNote || "Using custom user-entered design weather condition."], [])}
        </section>
      </div>
      <section class="section" style="margin-top:14px">
        <h3>EPW Hourly Analysis</h3>
        ${epw ? `
          <div class="metric-grid">
            ${metric("EPW location", `${epw.city}, ${epw.country}`, "teal")}
            ${metric("Hours parsed", fmt(epw.hours, 0), "blue")}
            ${metric("99.6% DB", `${fmt(epw.designDb996C, 1)} deg C`, "amber")}
            ${metric("Max DB", `${fmt(epw.maxDryBulbC, 1)} deg C`, "coral")}
            ${metric("Cooling degree-hours", `${fmt(epw.coolingDegreeHours, 0)} C-h`, "")}
            ${metric("Base temperature", `${fmt(state.indoor.coolingSetpointC, 1)} deg C`, "")}
          </div>
          <canvas id="epwChart" class="chart short" aria-label="EPW monthly dry-bulb chart"></canvas>
        ` : `<p>No EPW file loaded yet.</p>`}
      </section>
    `;
  }

  function renderHeat() {
    const h = E.calculateHeatGains(state);
    const componentRows = h.components.map((c) => [
      esc(c.label),
      esc(c.type),
      kw(c.watts),
      btuh(c.watts),
      `${fmt(c.watts / h.total * 100, 1)}%`,
    ]);
    return `
      <div class="grid sidebar-layout">
        <section class="section">
          <h3>Envelope and Internal Load Inputs</h3>
          <div class="form-grid">
            ${control("Window U-value", "envelope.windowU", { step: 0.01, hint: "W/m2.K" })}
            ${control("Window SHGC", "envelope.windowSHGC", { step: 0.01, min: 0, max: 1 })}
            ${control("Shading coefficient", "envelope.shadingCoefficient", { step: 0.01, min: 0, max: 1 })}
            ${control("Infiltration", "infiltration.ach", { step: 0.05, hint: "ACH" })}
            ${control("Lighting density", "internal.lightingWm2", { step: 0.5, hint: "W/m2" })}
            ${control("Equipment density", "internal.equipmentWm2", { step: 0.5, hint: "W/m2" })}
            ${control("People sensible", "internal.peopleSensibleW", { step: 1, hint: "W/person" })}
            ${control("People latent", "internal.peopleLatentW", { step: 1, hint: "W/person" })}
          </div>
          <h4>Calculated U-values</h4>
          <div class="pill-row">
            <span class="pill">Wall U = ${fmt(h.wallU, 3)} W/m2.K</span>
            <span class="pill">Roof U = ${fmt(h.roofU, 3)} W/m2.K</span>
            <span class="pill">Infiltration = ${fmt(h.infiltrationCfm, 0)} CFM</span>
          </div>
        </section>
        <section class="section">
          <h3>Heat Gain Results</h3>
          <div class="metric-grid">
            ${metric("Total sensible", kw(h.totalSensible), "teal")}
            ${metric("Total latent", kw(h.totalLatent), "blue")}
            ${metric("Total heat gain", kw(h.total), "amber")}
          </div>
          <canvas id="heatChart" class="chart" aria-label="Heat gain breakdown"></canvas>
        </section>
      </div>
      <section class="section" style="margin-top:14px">
        <h3>Component Breakdown</h3>
        ${table(["Component", "Type", "kW", "Btu/hr", "Share"], componentRows)}
      </section>
      <section class="section flat" style="margin-top:14px">
        <h3>Equations and Checks</h3>
        ${notes(h.formulas, h.warnings)}
      </section>
    `;
  }

  function renderCooling() {
    const c = E.calculateCoolingLoad(state);
    const rows = [
      ["Zone sensible load", kw(c.heat.totalSensible), btuh(c.heat.totalSensible)],
      ["Zone latent load", kw(c.heat.totalLatent), btuh(c.heat.totalLatent)],
      ["Mechanical ventilation sensible", kw(c.includeVentilationLoad ? c.mechVentLoad.sensible : 0), btuh(c.includeVentilationLoad ? c.mechVentLoad.sensible : 0)],
      ["Mechanical ventilation latent", kw(c.includeVentilationLoad ? c.mechVentLoad.latent : 0), btuh(c.includeVentilationLoad ? c.mechVentLoad.latent : 0)],
      ["Total calculated cooling", `${fmt(c.totalKw, 2)} kW`, `${fmt(c.totalBtuH, 0)} Btu/hr`],
      ["Design with safety factor", `${fmt(c.designKw, 2)} kW`, `${fmt(c.designBtuH, 0)} Btu/hr`],
    ];
    return `
      <div class="grid sidebar-layout">
        <section class="section">
          <h3>Cooling Load Inputs</h3>
          <div class="form-grid">
            ${control("Cooling setpoint", "indoor.coolingSetpointC", { step: 0.1, hint: "deg C" })}
            ${control("Supply air temperature", "indoor.supplyAirTempC", { step: 0.1, hint: "deg C" })}
            ${control("Design safety factor", "cooling.safetyFactor", { step: 1, scale: 100, hint: "%" })}
            ${control("Include mechanical ventilation load", "cooling.includeMechanicalVentilationLoad", { type: "checkbox", text: "Add outdoor air load to system capacity" })}
          </div>
          <h4>Formula Reference</h4>
          ${notes(c.formulas, c.warnings)}
        </section>
        <section class="section">
          <h3>Capacity and Airflow</h3>
          <div class="metric-grid">
            ${metric("Cooling load", `${fmt(c.totalKw, 2)} kW`, "teal")}
            ${metric("Cooling load", `${fmt(c.tons, 2)} TR`, "blue")}
            ${metric("Recommended size", `${fmt(c.recommendedTons, 1)} TR`, "amber")}
            ${metric("Supply airflow", `${fmt(c.supplyAirflowCfm, 0)} CFM`, "coral")}
            ${metric("Sensible heat ratio", fmt(c.sensibleW / c.totalW, 2), "")}
            ${metric("Fresh air", `${fmt(c.ventilation.freshAirPct, 1)}%`, "")}
          </div>
        </section>
      </div>
      <section class="section" style="margin-top:14px">
        <h3>Cooling Load Summary</h3>
        ${table(["Load item", "kW", "Btu/hr"], rows)}
      </section>
    `;
  }

  function renderVentilation() {
    const c = E.calculateCoolingLoad(state);
    const v = c.ventilation;
    return `
      <div class="grid sidebar-layout">
        <section class="section">
          <h3>ASHRAE 62.1 Inputs</h3>
          <div class="form-grid">
            ${control("Space type", "ventilation.spaceType", { type: "select", choices: Object.keys(E.VENTILATION_SPACES) })}
            ${control("Ventilation effectiveness Ez", "ventilation.ventilationEffectiveness", { step: 0.05, min: 0.1, max: 1.5 })}
          </div>
          <h4>Database Values</h4>
          <div class="pill-row">
            <span class="pill">Rp = ${fmt(v.rp, 2)} cfm/person</span>
            <span class="pill">Ra = ${fmt(v.ra, 3)} cfm/ft2</span>
            <span class="pill">Air class ${fmt(v.airClass, 0)}</span>
          </div>
          <p class="subtle">${esc(v.standard)}</p>
        </section>
        <section class="section">
          <h3>Outdoor Air Design</h3>
          <div class="metric-grid">
            ${metric("Breathing zone Vbz", `${fmt(v.vbzCfm, 0)} CFM`, "teal")}
            ${metric("Outdoor air Voz", `${fmt(v.outdoorAirCfm, 0)} CFM`, "blue")}
            ${metric("Fresh air percentage", `${fmt(v.freshAirPct, 1)}%`, "amber")}
            ${metric("Vent sensible", kw(c.mechVentLoad.sensible), "")}
            ${metric("Vent latent", kw(c.mechVentLoad.latent), "")}
            ${metric("Vent total", kw(c.mechVentLoad.total), "coral")}
          </div>
        </section>
      </div>
      <section class="section flat" style="margin-top:14px">
        <h3>Equations</h3>
        ${notes(v.formulas, [])}
      </section>
    `;
  }

  function renderDuct() {
    const d = E.calculateDuctDesign(state);
    const rows = d.sections.map((s) => [
      esc(s.name),
      fmt(s.lengthFt, 1),
      fmt(s.cfm, 0),
      fmt(s.diameterIn, 1),
      fmt(s.velocityFpm, 0),
      fmt(s.frictionInWgPer100Ft, 3),
      fmt(s.totalLossInWg, 3),
    ]);
    rows.push([
      "Typical branch",
      fmt(d.branch.lengthFt, 1),
      fmt(d.branch.cfm, 0),
      fmt(d.branch.diameterIn, 1),
      fmt(d.branch.velocityFpm, 0),
      fmt(d.branch.frictionInWgPer100Ft, 3),
      fmt(d.branch.totalLossInWg, 3),
    ]);
    return `
      <div class="grid sidebar-layout">
        <section class="section">
          <h3>Duct Layout Inputs</h3>
          <div class="form-grid">
            ${control("Number of diffusers", "duct.diffuserCount", { step: 1, min: 1 })}
            ${control("Main duct length", "duct.mainLengthFt", { step: 1, hint: "ft" })}
            ${control("Branch length", "duct.branchLengthFt", { step: 1, hint: "ft" })}
            ${control("Elbows per branch", "duct.elbowsPerBranch", { step: 1, min: 0 })}
            ${control("Equal friction target", "duct.equalFrictionInWgPer100Ft", { step: 0.01, hint: "in.wg/100 ft" })}
            ${control("Fan efficiency", "duct.fanEfficiency", { step: 1, scale: 100, hint: "%" })}
            ${control("Accessory static", "duct.accessoryStaticInWg", { step: 0.01, hint: "in.wg" })}
            ${control("Design method", "duct.method", { type: "select", choices: ["Equal friction", "Static regain placeholder"] })}
          </div>
        </section>
        <section class="section">
          <h3>Fan and Pressure Results</h3>
          <div class="metric-grid">
            ${metric("Total static pressure", `${fmt(d.totalStaticPressureInWg, 3)} in.wg`, "teal")}
            ${metric("Brake horsepower", `${fmt(d.fan.brakeHp, 2)} HP`, "blue")}
            ${metric("Motor selection", `${fmt(d.fan.recommendedMotorHp, 2)} HP`, "amber")}
            ${metric("Recommended RPM", d.fan.rpmBand, "")}
            ${metric("Main path loss", `${fmt(d.criticalMainLossInWg, 3)} in.wg`, "")}
            ${metric("Branch CFM", `${fmt(d.branchCfm, 0)} CFM`, "coral")}
          </div>
        </section>
      </div>
      <section class="section" style="margin-top:14px">
        <h3>Duct Section Schedule</h3>
        ${table(["Section", "Length ft", "CFM", "Diameter in", "Velocity fpm", "Friction in.wg/100ft", "Total loss in.wg"], rows)}
      </section>
      <section class="section flat" style="margin-top:14px">
        <h3>Equations and Checks</h3>
        ${notes(d.formulas, d.warnings)}
      </section>
    `;
  }

  function renderDiffuser() {
    const r = E.selectDiffuser(state);
    const s = r.selection;
    const rows = r.candidates.map((c) => [
      `${esc(c.manufacturer)} ${esc(c.model)}`,
      `${esc(c.moduleSize)} / ${fmt(c.neckIn, 0)} in neck`,
      fmt(c.airflowCfm, 0),
      fmt(c.nc, 0),
      fmt(c.x50Ft, 1),
      fmt(c.totalPressureInWg, 3),
      c.ncOk && c.throwOk && c.withinFlow ? '<span class="pill good">Pass</span>' : '<span class="pill warn">Review</span>',
    ]);
    return `
      <div class="grid sidebar-layout">
        <section class="section">
          <h3>Diffuser Criteria</h3>
          <div class="form-grid">
            ${control("Acceptable NC", "diffuser.acceptableNC", { step: 1, min: 10, max: 50 })}
            ${control("X50/L target", "diffuser.x50OverL", { step: 0.1, min: 0.5, max: 2.5 })}
            ${control("Number of diffusers", "duct.diffuserCount", { step: 1, min: 1 })}
          </div>
          <h4>Placement</h4>
          <div class="pill-row">
            <span class="pill">${fmt(r.placement.rows, 0)} rows</span>
            <span class="pill">${fmt(r.placement.columns, 0)} columns</span>
            <span class="pill">${fmt(r.placement.spacingLengthM, 1)} m x ${fmt(r.placement.spacingWidthM, 1)} m spacing</span>
          </div>
          <p class="subtle">${esc(r.placement.note)}</p>
        </section>
        <section class="section">
          <h3>Selected Diffuser</h3>
          <div class="metric-grid">
            ${metric("Type", "Group A ceiling", "teal")}
            ${metric("Model", s ? `${s.manufacturer} ${s.model}` : "n/a", "blue")}
            ${metric("Size", s ? `${s.moduleSize}, ${fmt(s.neckIn, 0)} in neck` : "n/a", "amber")}
            ${metric("CFM/diffuser", `${fmt(r.cfmEach, 0)} CFM`, "")}
            ${metric("NC", s ? fmt(s.nc, 0) : "n/a", s && s.ncOk ? "teal" : "coral")}
            ${metric("X50 throw", s ? `${fmt(s.x50Ft, 1)} ft` : "n/a", "")}
          </div>
        </section>
      </div>
      <section class="section" style="margin-top:14px">
        <h3>Catalog Candidates</h3>
        ${table(["Model", "Size", "CFM", "NC", "X50 ft", "Total pressure", "Decision"], rows)}
      </section>
      <section class="section flat" style="margin-top:14px">
        <h3>Source and Checks</h3>
        ${notes(r.formulas.concat([s ? s.source : "No catalog selection available."]), r.warnings)}
      </section>
    `;
  }

  function renderComfort() {
    const r = E.calculateThermalComfort(state);
    return `
      <div class="grid sidebar-layout">
        <section class="section">
          <h3>ASHRAE 55 Inputs</h3>
          <div class="form-grid">
            ${control("Indoor dry bulb", "indoor.coolingSetpointC", { step: 0.1, hint: "deg C" })}
            ${control("Relative humidity", "indoor.relativeHumidity", { step: 1, min: 0, max: 100, hint: "%" })}
            ${control("Air velocity", "indoor.airVelocity", { step: 0.01, hint: "m/s" })}
            ${control("Mean radiant temp", "indoor.meanRadiantTempC", { step: 0.1, hint: "deg C" })}
            ${control("Metabolic rate", "indoor.met", { step: 0.05, hint: "met" })}
            ${control("Clothing", "indoor.clo", { step: 0.05, hint: "clo" })}
          </div>
        </section>
        <section class="section">
          <h3>Comfort Decision</h3>
          <div class="metric-grid">
            ${metric("PMV", fmt(r.pmv, 2), r.compliant ? "teal" : "coral")}
            ${metric("PPD", `${fmt(r.ppd, 1)}%`, r.compliant ? "blue" : "amber")}
            ${metric("Compliance", r.compliant ? "Pass" : "Review", r.compliant ? "teal" : "coral")}
          </div>
          <h4>Corrective Actions</h4>
          ${notes(r.actions, [])}
        </section>
      </div>
      <section class="section" style="margin-top:14px">
        <h3>Psychrometric Comfort Chart</h3>
        <canvas id="psychChart" class="chart" aria-label="Psychrometric comfort chart"></canvas>
      </section>
      <section class="section flat" style="margin-top:14px">
        <h3>Equations</h3>
        ${notes(r.formulas, [])}
      </section>
    `;
  }

  function renderCO2() {
    const r = E.simulateCO2(state);
    const hourlyRows = r.hourly.map((x) => [fmt(x.hour, 0), fmt(x.ppm, 0)]);
    const effectRows = r.occupancyEffect.map((x) => [fmt(x.occupants, 0), fmt(x.steadyPpm, 0)]);
    return `
      <div class="grid sidebar-layout">
        <section class="section">
          <h3>Transient CO2 Inputs</h3>
          <div class="form-grid">
            ${control("Initial indoor CO2", "co2.initialPpm", { step: 10, hint: "ppm" })}
            ${control("Outdoor CO2", "co2.outdoorPpm", { step: 10, hint: "ppm" })}
            ${control("Activity type", "co2.activity", { type: "select", choices: Object.keys(E.CO2_ACTIVITIES) })}
            ${control("Time step", "co2.timeStepMinutes", { step: 1, min: 1, hint: "minutes" })}
            ${control("Simulation time", "co2.simulationHours", { step: 0.5, min: 1, hint: "hours" })}
            ${control("CO2 limit", "co2.limitPpm", { step: 50, hint: "ppm" })}
          </div>
        </section>
        <section class="section">
          <h3>IAQ Results</h3>
          <div class="metric-grid">
            ${metric("Peak CO2", `${fmt(r.peakPpm, 0)} ppm`, r.peakPpm <= state.co2.limitPpm ? "teal" : "coral")}
            ${metric("Steady state", `${fmt(r.steadyStatePpm, 0)} ppm`, "blue")}
            ${metric("Time to 95% steady", `${fmt(r.timeTo95PctSteadyHours, 1)} h`, "amber")}
            ${metric("Outdoor ACH", `${fmt(r.achOutdoor, 2)} 1/h`, "")}
            ${metric("Generation", `${fmt(r.generationM3hPerPerson * 1000, 1)} L/h.person`, "")}
            ${metric("Ventilation adjustment", `${fmt(r.ventilationAdjustmentCfm, 0)} CFM`, r.ventilationAdjustmentCfm > 0 ? "coral" : "teal")}
          </div>
        </section>
      </div>
      <section class="section" style="margin-top:14px">
        <h3>CO2 Concentration Versus Time</h3>
        <canvas id="co2Chart" class="chart" aria-label="CO2 line chart"></canvas>
      </section>
      <div class="grid two" style="margin-top:14px">
        <section class="section">
          <h3>Hourly CO2 Output</h3>
          ${table(["Hour", "Indoor CO2 ppm"], hourlyRows)}
        </section>
        <section class="section">
          <h3>Occupancy Effect</h3>
          ${table(["Occupants", "Steady-state CO2 ppm"], effectRows)}
        </section>
      </div>
      <section class="section flat" style="margin-top:14px">
        <h3>Equations</h3>
        ${notes(r.formulas, [])}
      </section>
    `;
  }

  function renderReport() {
    const report = buildReport();
    return `
      <section class="section">
        <h3>Technical Results Report</h3>
        <div class="actions">
          <button class="btn primary" data-action="print-report" type="button">Print / Save PDF</button>
          <button class="btn" data-action="copy-report" type="button">Copy report text</button>
          <button class="btn" data-action="download-json" type="button">Export model JSON</button>
          <button class="btn" data-action="reset-model" type="button">Reset defaults</button>
        </div>
      </section>
      <section class="section" style="margin-top:14px">
        <pre id="reportText" class="report">${esc(report)}</pre>
      </section>
    `;
  }

  function buildReport() {
    const r = E.summarizeResults(state);
    const weather = E.getWeather(state);
    const lines = [];
    lines.push(`${state.project.name}`);
    lines.push(`Engineer: ${state.project.engineer}`);
    lines.push("");
    lines.push("1. Project Description");
    lines.push(`Single-zone office building, ${fmt(r.heat.geometry.lengthM, 1)} m x ${fmt(r.heat.geometry.widthM, 1)} m x ${fmt(r.heat.geometry.heightM, 1)} m.`);
    lines.push(`Floor area: ${fmt(r.heat.geometry.floorAreaM2, 1)} m2. Volume: ${fmt(r.heat.geometry.volumeM3, 1)} m3. Design occupants: ${fmt(r.heat.occupantsDesign, 0)}.`);
    lines.push(`Schedule: ${state.internal.schedule}.`);
    lines.push("");
    lines.push("2. Weather and Indoor Design");
    lines.push(`City: ${weather.city}. Outdoor design: DB ${fmt(weather.db, 1)} deg C, WB ${fmt(weather.wb, 1)} deg C, RH ${fmt(weather.outdoorRH, 0)}%.`);
    lines.push(`Indoor cooling setpoint: ${fmt(state.indoor.coolingSetpointC, 1)} deg C and ${fmt(state.indoor.relativeHumidity, 0)}% RH.`);
    lines.push("");
    lines.push("3. Heat Gains");
    r.heat.components.forEach((c) => lines.push(`- ${c.label}: ${kw(c.watts)} (${btuh(c.watts)})`));
    lines.push(`Total sensible heat gain: ${kw(r.heat.totalSensible)}.`);
    lines.push(`Total latent heat gain: ${kw(r.heat.totalLatent)}.`);
    lines.push("");
    lines.push("4. Cooling Load");
    lines.push(`Calculated cooling load: ${fmt(r.cooling.totalKw, 2)} kW = ${fmt(r.cooling.tons, 2)} TR.`);
    lines.push(`Design load with safety factor: ${fmt(r.cooling.designKw, 2)} kW = ${fmt(r.cooling.designTons, 2)} TR.`);
    lines.push(`Recommended nominal system size: ${fmt(r.cooling.recommendedTons, 1)} TR.`);
    lines.push(`Required supply airflow: ${fmt(r.cooling.supplyAirflowCfm, 0)} CFM.`);
    lines.push("");
    lines.push("5. Mechanical Ventilation");
    lines.push(`ASHRAE 62.1 space type: ${r.ventilation.spaceType}. Rp=${fmt(r.ventilation.rp, 2)} cfm/person, Ra=${fmt(r.ventilation.ra, 3)} cfm/ft2, Ez=${fmt(r.ventilation.ez, 2)}.`);
    lines.push(`Required outdoor air: ${fmt(r.ventilation.outdoorAirCfm, 0)} CFM. Fresh air percentage: ${fmt(r.ventilation.freshAirPct, 1)}%.`);
    lines.push("");
    lines.push("6. Duct Design");
    lines.push(`Design method: ${state.duct.method}. Total static pressure: ${fmt(r.duct.totalStaticPressureInWg, 3)} in.wg.`);
    lines.push(`Fan: ${fmt(r.duct.fan.brakeHp, 2)} BHP, recommended motor ${fmt(r.duct.fan.recommendedMotorHp, 2)} HP, ${r.duct.fan.rpmBand}.`);
    lines.push(`Typical branch: ${fmt(r.duct.branch.cfm, 0)} CFM, ${fmt(r.duct.branch.diameterIn, 1)} in diameter, ${fmt(r.duct.branch.velocityFpm, 0)} fpm.`);
    lines.push("");
    lines.push("7. Diffuser Selection");
    if (r.diffuser.selection) {
      const s = r.diffuser.selection;
      lines.push(`Selected diffuser: Titus ${s.model}, ${s.moduleSize}, ${fmt(s.neckIn, 0)} in round neck.`);
      lines.push(`Performance: ${fmt(s.airflowCfm, 0)} CFM/diffuser, NC ${fmt(s.nc, 0)}, X50 ${fmt(s.x50Ft, 1)} ft, total pressure ${fmt(s.totalPressureInWg, 3)} in.wg.`);
    }
    lines.push(`Placement: ${fmt(r.diffuser.placement.rows, 0)} rows x ${fmt(r.diffuser.placement.columns, 0)} columns.`);
    lines.push("");
    lines.push("8. Thermal Comfort");
    lines.push(`PMV = ${fmt(r.comfort.pmv, 2)}, PPD = ${fmt(r.comfort.ppd, 1)}%. Compliance decision: ${r.comfort.compliant ? "Pass" : "Review"}.`);
    lines.push("");
    lines.push("9. Indoor Air Quality");
    lines.push(`Transient CO2 peak: ${fmt(r.co2.peakPpm, 0)} ppm. Steady state: ${fmt(r.co2.steadyStatePpm, 0)} ppm.`);
    lines.push(`Time to 95% steady state: ${fmt(r.co2.timeTo95PctSteadyHours, 1)} h. Required ventilation adjustment for ${fmt(state.co2.limitPpm, 0)} ppm limit: ${fmt(r.co2.ventilationAdjustmentCfm, 0)} CFM.`);
    lines.push("");
    lines.push("10. Core Equations");
    [...r.heat.formulas, ...r.cooling.formulas, ...r.ventilation.formulas, ...r.duct.formulas, ...r.diffuser.formulas, ...r.comfort.formulas, ...r.co2.formulas].forEach((f) => lines.push(`- ${f}`));
    lines.push("");
    lines.push("11. References");
    lines.push("- ASHRAE Handbook of Fundamentals: heat transfer, psychrometrics, cooling load principles.");
    lines.push("- ASHRAE Standard 62.1-2013 Table 6.2.2.1 for ventilation rate procedure values.");
    lines.push("- ASHRAE Standard 55 workflow for PMV/PPD thermal comfort evaluation.");
    lines.push("- Titus TMS Square Ceiling Round Neck High Performance diffuser catalog, 2017.");
    return lines.join("\n");
  }

  function parseNumberSeries(text) {
    return String(text || "")
      .split(/[\s,;]+/)
      .map(Number)
      .filter(Number.isFinite);
  }

  function drawActiveCharts() {
    if (activeTab === "heat") drawHeatChart();
    if (activeTab === "weather") drawEpwChart();
    if (activeTab === "comfort") drawPsychChart();
    if (activeTab === "co2") drawCO2Chart();
  }

  function setupCanvas(id) {
    const canvas = document.getElementById(id);
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, rect.width * dpr);
    canvas.height = Math.max(1, rect.height * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);
    return { canvas, ctx, width: rect.width, height: rect.height };
  }

  function drawAxes(ctx, width, height, pad, xLabel, yLabel) {
    ctx.strokeStyle = "#cfd8df";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, pad.top);
    ctx.lineTo(pad.left, height - pad.bottom);
    ctx.lineTo(width - pad.right, height - pad.bottom);
    ctx.stroke();
    ctx.fillStyle = "#657180";
    ctx.font = "12px Segoe UI, sans-serif";
    ctx.fillText(yLabel, pad.left, pad.top - 8);
    ctx.textAlign = "right";
    ctx.fillText(xLabel, width - pad.right, height - 8);
    ctx.textAlign = "left";
  }

  function drawHeatChart() {
    const setup = setupCanvas("heatChart");
    if (!setup) return;
    const { ctx, width, height } = setup;
    const data = E.calculateHeatGains(state).components.filter((x) => x.watts > 20);
    const pad = { left: 150, right: 22, top: 22, bottom: 34 };
    const max = Math.max(...data.map((x) => x.watts / 1000), 1);
    const barH = (height - pad.top - pad.bottom) / data.length - 6;
    const colors = ["#007f79", "#2667a5", "#c77700", "#c75043", "#2f7d4e", "#7b678f"];
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    data.forEach((item, i) => {
      const y = pad.top + i * (barH + 6);
      const val = item.watts / 1000;
      const w = (width - pad.left - pad.right) * val / max;
      ctx.fillStyle = "#42505c";
      ctx.font = "12px Segoe UI, sans-serif";
      ctx.fillText(item.label, 12, y + barH * 0.68);
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(pad.left, y, w, barH);
      const valueLabel = `${fmt(val, 2)} kW`;
      const labelOutsideX = pad.left + w + 8;
      if (labelOutsideX + 70 > width - pad.right) {
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "right";
        ctx.fillText(valueLabel, pad.left + w - 8, y + barH * 0.68);
        ctx.textAlign = "left";
      } else {
        ctx.fillStyle = "#16202a";
        ctx.fillText(valueLabel, labelOutsideX, y + barH * 0.68);
      }
    });
  }

  function drawLineChart(id, seriesList, options) {
    const setup = setupCanvas(id);
    if (!setup) return;
    const { ctx, width, height } = setup;
    const pad = { left: 54, right: 22, top: 24, bottom: 42 };
    const points = seriesList.flatMap((s) => s.points);
    if (!points.length) return;
    const xmin = Math.min(...points.map((p) => p.x));
    const xmax = Math.max(...points.map((p) => p.x));
    const ymin = Math.min(...points.map((p) => p.y), options.yMin ?? Infinity);
    const ymax = Math.max(...points.map((p) => p.y), options.yMax ?? -Infinity);
    const y0 = Number.isFinite(options.yMin) ? options.yMin : ymin;
    const y1 = Number.isFinite(options.yMax) ? options.yMax : ymax * 1.08;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    drawAxes(ctx, width, height, pad, options.xLabel || "", options.yLabel || "");
    ctx.strokeStyle = "#edf1f4";
    ctx.fillStyle = "#657180";
    ctx.font = "11px Segoe UI, sans-serif";
    for (let i = 0; i <= 4; i += 1) {
      const y = pad.top + (height - pad.top - pad.bottom) * i / 4;
      const val = y1 - (y1 - y0) * i / 4;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
      ctx.fillText(fmt(val, 0), 8, y + 4);
    }
    const xMap = (x) => pad.left + (x - xmin) / Math.max(xmax - xmin, 1e-9) * (width - pad.left - pad.right);
    const yMap = (y) => height - pad.bottom - (y - y0) / Math.max(y1 - y0, 1e-9) * (height - pad.top - pad.bottom);
    seriesList.forEach((series) => {
      ctx.strokeStyle = series.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      series.points.forEach((p, i) => {
        const x = xMap(p.x);
        const y = yMap(p.y);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.fillStyle = series.color;
      ctx.fillRect(width - pad.right - 150, pad.top + seriesList.indexOf(series) * 18, 10, 10);
      ctx.fillStyle = "#34434e";
      ctx.fillText(series.name, width - pad.right - 134, pad.top + 9 + seriesList.indexOf(series) * 18);
    });
  }

  function drawCO2Chart() {
    const co2 = E.simulateCO2(state);
    drawLineChart("co2Chart", [
      { name: "Indoor CO2", color: "#007f79", points: co2.rows.map((r) => ({ x: r.hour, y: r.ppm })) },
      { name: "Limit", color: "#c75043", points: [{ x: 0, y: state.co2.limitPpm }, { x: state.co2.simulationHours, y: state.co2.limitPpm }] },
    ], { xLabel: "time (h)", yLabel: "ppm", yMin: Math.min(state.co2.outdoorPpm, state.co2.initialPpm) - 50 });
  }

  function drawEpwChart() {
    if (!state.epwSummary) return;
    drawLineChart("epwChart", [
      { name: "Average DB", color: "#2667a5", points: state.epwSummary.monthly.map((m) => ({ x: m.month, y: m.avgDb })) },
      { name: "Max DB", color: "#c75043", points: state.epwSummary.monthly.map((m) => ({ x: m.month, y: m.maxDb })) },
    ], { xLabel: "month", yLabel: "deg C" });
  }

  function drawPsychChart() {
    const setup = setupCanvas("psychChart");
    if (!setup) return;
    const { ctx, width, height } = setup;
    const pad = { left: 58, right: 28, top: 22, bottom: 44 };
    const tMin = 10;
    const tMax = 40;
    const wMin = 0;
    const wMax = 0.026;
    const xMap = (t) => pad.left + (t - tMin) / (tMax - tMin) * (width - pad.left - pad.right);
    const yMap = (w) => height - pad.bottom - (w - wMin) / (wMax - wMin) * (height - pad.top - pad.bottom);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    drawAxes(ctx, width, height, pad, "dry bulb temperature (deg C)", "humidity ratio kg/kg");
    [30, 50, 70, 90].forEach((rh) => {
      ctx.beginPath();
      for (let t = tMin; t <= tMax; t += 0.5) {
        const w = E.psychrometrics.humidityRatioFromRH(t, rh);
        const x = xMap(t);
        const y = yMap(w);
        if (t === tMin) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = rh === 50 ? "#9bb0bd" : "#d5dde3";
      ctx.lineWidth = rh === 50 ? 1.5 : 1;
      ctx.stroke();
      ctx.fillStyle = "#657180";
      ctx.font = "11px Segoe UI, sans-serif";
      ctx.fillText(`${rh}% RH`, xMap(35), yMap(E.psychrometrics.humidityRatioFromRH(35, rh)) - 3);
    });
    const comfortPoly = [
      [20, E.psychrometrics.humidityRatioFromRH(20, 30)],
      [26, E.psychrometrics.humidityRatioFromRH(26, 30)],
      [26, E.psychrometrics.humidityRatioFromRH(26, 65)],
      [20, E.psychrometrics.humidityRatioFromRH(20, 65)],
    ];
    ctx.beginPath();
    comfortPoly.forEach(([t, w], i) => {
      if (i === 0) ctx.moveTo(xMap(t), yMap(w));
      else ctx.lineTo(xMap(t), yMap(w));
    });
    ctx.closePath();
    ctx.fillStyle = "rgba(0, 127, 121, 0.16)";
    ctx.fill();
    ctx.strokeStyle = "#007f79";
    ctx.stroke();
    const indoorW = E.psychrometrics.humidityRatioFromRH(state.indoor.coolingSetpointC, state.indoor.relativeHumidity);
    ctx.fillStyle = "#c75043";
    ctx.beginPath();
    ctx.arc(xMap(state.indoor.coolingSetpointC), yMap(indoorW), 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#16202a";
    ctx.font = "12px Segoe UI, sans-serif";
    ctx.fillText("Indoor condition", xMap(state.indoor.coolingSetpointC) + 10, yMap(indoorW) - 8);
  }

  document.addEventListener("click", (event) => {
    const tabButton = event.target.closest("[data-tab]");
    if (tabButton) {
      activeTab = tabButton.dataset.tab;
      history.replaceState(null, "", `#${activeTab}`);
      render();
      return;
    }
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (!action) return;
    if (action === "clear-weather") {
      state.weather.custom = null;
      saveState();
      render();
    }
    if (action === "print-report") window.print();
    if (action === "copy-report") {
      const text = document.getElementById("reportText")?.textContent || buildReport();
      navigator.clipboard && navigator.clipboard.writeText(text);
    }
    if (action === "download-json") {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "hvac-nexus-model.json";
      a.click();
      URL.revokeObjectURL(a.href);
    }
    if (action === "reset-model" && confirm("Reset all model inputs to defaults?")) {
      state = E.getDefaultState();
      saveState();
      render();
    }
  });

  document.addEventListener("change", async (event) => {
    if (event.target.id === "epwFile" && event.target.files && event.target.files[0]) {
      const text = await event.target.files[0].text();
      try {
        state.epwSummary = E.parseEpw(text, state.indoor.coolingSetpointC);
        saveState();
        render();
      } catch (err) {
        alert(err.message);
      }
      return;
    }
    const input = event.target.closest("[data-path]");
    if (!input) return;
    const type = input.dataset.type;
    const scale = Number(input.dataset.scale || 1);
    let value;
    if (type === "checkbox") value = input.checked;
    else if (type === "number") value = input.value === "" ? undefined : Number(input.value) / scale;
    else value = input.value;
    setPath(state, input.dataset.path, value);
    saveState();
    render();
  });

  window.addEventListener("resize", () => requestAnimationFrame(drawActiveCharts));
  window.addEventListener("hashchange", () => {
    const next = location.hash ? location.hash.slice(1) : "project";
    if (tabs.some(([id]) => id === next)) {
      activeTab = next;
      render();
    }
  });

  render();
})();
/* ============================================
SPLASH SCREEN
============================================ */

window.addEventListener("load", () => {

    const splash = document.getElementById("splash-screen");

    setTimeout(() => {

        splash.style.opacity = "0";

        setTimeout(() => {

            splash.style.display = "none";

        }, 1000);

    }, 2500);

});

/* ============================================
PRESENTATION MODE
============================================ */

const presentationButton = document.createElement("button");

presentationButton.innerText = "🎤 Presentation Mode";

presentationButton.style.position = "fixed";
presentationButton.style.bottom = "30px";
presentationButton.style.right = "30px";
presentationButton.style.zIndex = "9999";

document.body.appendChild(presentationButton);

presentationButton.addEventListener("click", () => {

    document.body.classList.toggle("presentation-mode");

});

/* ============================================
AI HVAC RECOMMENDATIONS
============================================ */

function generateAIRecommendations(data){

    let recommendations = [];

    if(data.nc > 35){

        recommendations.push(
            "⚠ NC level is high. Increase diffuser quantity."
        );

    }

    if(data.cfm > 2000){

        recommendations.push(
            "⚠ High airflow detected. Consider additional supply branches."
        );

    }

    if(data.ppd > 10){

        recommendations.push(
            "⚠ Thermal comfort is outside ASHRAE comfort range."
        );

    }

    return recommendations;

}

/* ============================================
HEATMAP DEMO
============================================ */

function createHeatmap(){

    const heatmap = document.createElement("div");

    heatmap.className = "panel";

    heatmap.innerHTML = `

        <h2>🔥 Thermal Heatmap</h2>

        <canvas id="heatCanvas" height="300"></canvas>

    `;

    document.querySelector(".panel-host").appendChild(heatmap);

}

createHeatmap();

/* ============================================
WORKFLOW ANIMATION
============================================ */

document.querySelectorAll(".tabs button").forEach((button,index)=>{

    button.style.animation = `
        fadeUp 0.6s ease ${index * 0.1}s forwards
    `;

});

/* ============================================
3D AIRFLOW PLACEHOLDER
============================================ */

function create3DViewer(){

    const viewer = document.createElement("div");

    viewer.className = "panel";

    viewer.innerHTML = `

        <h2>🌪 3D Airflow Viewer</h2>

        <div style="
            height:500px;
            border-radius:25px;
            background:
            radial-gradient(circle,#0ea5e933,transparent),
            #020617;
            display:flex;
            align-items:center;
            justify-content:center;
            font-size:28px;
            color:#38bdf8;
            box-shadow:inset 0 0 60px #0ea5e944;
        ">

        CFD-Style Airflow Visualization

        </div>

    `;

    document.querySelector(".panel-host").appendChild(viewer);

}

create3DViewer();
