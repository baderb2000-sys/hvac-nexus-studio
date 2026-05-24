(function (root, factory) {
  const engine = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = engine;
  }
  root.HVACEngine = engine;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const C = {
    W_TO_BTUH: 3.412141633,
    BTUH_TO_W: 0.29307107,
    KW_PER_TON: 3.5168525,
    M2_TO_FT2: 10.7639104167,
    M3_TO_FT3: 35.3146667215,
    M3S_TO_CFM: 2118.880003,
    CFM_TO_M3S: 0.00047194745,
    M3H_TO_CFM: 0.58857777,
    PA_PER_INWG: 249.08891,
    RHO_AIR: 1.2,
    CP_AIR: 1006,
    HFG_WATER: 2450000,
    ATM_PRESSURE_KPA: 101.325,
  };

  const CITY_WEATHER = {
    Riyadh: {
      city: "Riyadh",
      db: 45.0,
      wb: 23.5,
      elevationM: 612,
      pressureKPa: 94.4,
      designNote: "Preloaded hot-dry Saudi inland design condition. Replace with ASHRAE city data if your instructor provides exact values.",
      solar: { north: 120, south: 520, east: 620, west: 720, roof: 850 },
      solAirDelta: { north: 4, south: 8, east: 10, west: 12, roof: 18 },
    },
    Jeddah: {
      city: "Jeddah",
      db: 39.0,
      wb: 29.0,
      elevationM: 12,
      pressureKPa: 101.2,
      designNote: "Preloaded hot-humid Red Sea design condition. Replace with ASHRAE city data if your instructor provides exact values.",
      solar: { north: 110, south: 470, east: 560, west: 650, roof: 800 },
      solAirDelta: { north: 3, south: 7, east: 9, west: 11, roof: 16 },
    },
    Dammam: {
      city: "Dammam",
      db: 43.0,
      wb: 29.0,
      elevationM: 10,
      pressureKPa: 101.2,
      designNote: "Preloaded Gulf coast design condition with high latent risk. Replace with ASHRAE city data if your instructor provides exact values.",
      solar: { north: 115, south: 500, east: 590, west: 690, roof: 830 },
      solAirDelta: { north: 4, south: 8, east: 10, west: 12, roof: 17 },
    },
    Abha: {
      city: "Abha",
      db: 32.0,
      wb: 19.0,
      elevationM: 2270,
      pressureKPa: 77.8,
      designNote: "Preloaded high-altitude mild Saudi design condition. Replace with ASHRAE city data if your instructor provides exact values.",
      solar: { north: 100, south: 430, east: 520, west: 590, roof: 760 },
      solAirDelta: { north: 3, south: 6, east: 8, west: 9, roof: 14 },
    },
  };

  const VENTILATION_SPACES = {
    "Office space": { rp: 5, ra: 0.06, ez: 1.0, densityPer100m2: 5, airClass: 1, standard: "ASHRAE 62.1-2013 Table 6.2.2.1" },
    "Conference/meeting": { rp: 5, ra: 0.06, ez: 1.0, densityPer100m2: 50, airClass: 1, standard: "ASHRAE 62.1-2013 Table 6.2.2.1" },
    "Reception areas": { rp: 5, ra: 0.06, ez: 1.0, densityPer100m2: 30, airClass: 1, standard: "ASHRAE 62.1-2013 Table 6.2.2.1" },
    "Main entry lobbies": { rp: 5, ra: 0.06, ez: 1.0, densityPer100m2: 10, airClass: 1, standard: "ASHRAE 62.1-2013 Table 6.2.2.1" },
    "Breakrooms": { rp: 5, ra: 0.12, ez: 1.0, densityPer100m2: 50, airClass: 1, standard: "ASHRAE 62.1-2013 Table 6.2.2.1" },
    "Telephone/data entry": { rp: 5, ra: 0.06, ez: 1.0, densityPer100m2: 60, airClass: 1, standard: "ASHRAE 62.1-2013 Table 6.2.2.1" },
  };

  const CO2_ACTIVITIES = {
    "Seated quiet work": { m3h: 0.018, label: "Seated quiet work" },
    "Office work": { m3h: 0.02323, label: "Office work, class note value 0.0106 cfm/person" },
    Walking: { m3h: 0.04, label: "Walking" },
    "Light exercise": { m3h: 0.06, label: "Light exercise" },
  };

  const STANDARD_MOTOR_HP = [0.25, 0.33, 0.5, 0.75, 1, 1.5, 2, 3, 5, 7.5, 10, 15, 20, 25, 30];

  const DIFFUSER_CATALOG = [
    makeDiffuser("TMS", "24 x 24", 6, [79, 98, 118, 137, 157, 196, 236, 275, 314], [0.016, 0.025, 0.035, 0.048, 0.063, 0.099, 0.142, 0.193, 0.252], [8, 8, 8, 12, 16, 22, 28, 32, 36], ["1-2-4", "1-2-4", "2-3-5", "2-3-6", "2-4-7", "3-4-9", "4-5-11", "4-6-12", "5-7-13"]),
    makeDiffuser("TMS", "24 x 24", 8, [140, 175, 209, 244, 279, 349, 419, 489, 559], [0.016, 0.025, 0.036, 0.049, 0.064, 0.101, 0.145, 0.197, 0.257], [8, 8, 11, 15, 19, 26, 31, 36, 40], ["2-3-5", "2-3-7", "3-4-8", "3-5-9", "4-5-11", "4-7-13", "5-8-14", "6-9-16", "7-11-17"]),
    makeDiffuser("TMS", "24 x 24", 10, [218, 273, 327, 382, 436, 545, 654, 764, 873], [0.017, 0.026, 0.037, 0.051, 0.066, 0.103, 0.149, 0.202, 0.264], [8, 8, 14, 18, 22, 29, 34, 39, 43], ["2-4-7", "3-5-9", "4-5-11", "4-6-13", "5-7-14", "6-9-17", "7-11-18", "8-13-20", "10-14-21"]),
    makeDiffuser("TMS", "24 x 24", 12, [314, 393, 471, 550, 628, 785, 942, 1100, 1257], [0.017, 0.027, 0.038, 0.052, 0.068, 0.106, 0.153, 0.208, 0.272], [8, 11, 16, 21, 24, 31, 36, 41, 45], ["3-5-9", "4-6-11", "5-7-14", "5-8-16", "6-9-18", "8-11-20", "9-14-22", "11-16-23", "12-18-25"]),
    makeDiffuser("TMS", "24 x 24", 14, [428, 535, 641, 748, 855, 1069, 1283, 1497, 1710], [0.018, 0.028, 0.04, 0.054, 0.071, 0.11, 0.159, 0.216, 0.282], [8, 13, 18, 22, 26, 33, 38, 43, 47], ["4-5-11", "5-7-14", "5-8-16", "6-10-19", "7-11-21", "9-14-23", "11-16-25", "13-19-27", "14-21-29"]),
    makeDiffuser("TMS", "24 x 24", 15, [491, 614, 736, 859, 982, 1227, 1473, 1718, 1963], [0.018, 0.028, 0.04, 0.055, 0.072, 0.112, 0.162, 0.22, 0.287], [8, 13, 19, 23, 27, 34, 39, 44, 48], ["4-6-12", "5-7-15", "6-9-18", "7-10-21", "8-12-22", "10-15-25", "12-18-27", "14-21-29", "16-22-31"]),
  ];

  function makeDiffuser(model, moduleSize, neckIn, airflow, pressure, nc, throwText) {
    return { model, moduleSize, neckIn, airflow, pressure, nc, throwText };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function round(value, digits = 2) {
    const factor = 10 ** digits;
    return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
  }

  function safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function cToF(tc) {
    return (tc * 9) / 5 + 32;
  }

  function fToC(tf) {
    return ((tf - 32) * 5) / 9;
  }

  function saturationPressureKPa(tC) {
    // Magnus equation, accurate enough for HVAC design range.
    return 0.61094 * Math.exp((17.625 * tC) / (tC + 243.04));
  }

  function humidityRatioFromRH(tC, rhPercent, pressureKPa = C.ATM_PRESSURE_KPA) {
    const pws = saturationPressureKPa(tC);
    const pv = clamp(rhPercent, 0, 100) / 100 * pws;
    return 0.62198 * pv / Math.max(pressureKPa - pv, 0.001);
  }

  function humidityRatioFromWetBulb(tdbC, twbC, pressureKPa = C.ATM_PRESSURE_KPA) {
    const pwsWb = saturationPressureKPa(twbC);
    const gamma = 0.00066 * (1 + 0.00115 * twbC) * pressureKPa;
    const pv = Math.max(0.05, pwsWb - gamma * (tdbC - twbC));
    return 0.62198 * pv / Math.max(pressureKPa - pv, 0.001);
  }

  function rhFromHumidityRatio(tC, w, pressureKPa = C.ATM_PRESSURE_KPA) {
    const pv = pressureKPa * w / (0.62198 + w);
    return clamp((pv / saturationPressureKPa(tC)) * 100, 0, 100);
  }

  function enthalpyMoistAir(tC, w) {
    return 1.006 * tC + w * (2501 + 1.86 * tC);
  }

  function dewPointFromHumidityRatio(w, pressureKPa = C.ATM_PRESSURE_KPA) {
    const pv = pressureKPa * w / (0.62198 + w);
    const ln = Math.log(Math.max(pv, 0.001) / 0.61094);
    return (243.04 * ln) / (17.625 - ln);
  }

  function pressureFromElevation(elevationM) {
    return C.ATM_PRESSURE_KPA * Math.pow(1 - 2.25577e-5 * elevationM, 5.25588);
  }

  function getDefaultState() {
    return {
      project: {
        name: "AREN 351 HVAC Design Studio",
        engineer: "Student Engineer",
        notes: "Single-zone small office building final design project.",
      },
      geometry: {
        lengthM: 24,
        widthM: 18,
        heightM: 3.5,
        longSideOrientation: "north-south",
        wwr: { north: 0.30, south: 0.45, east: 0.50, west: 0.50 },
      },
      envelope: {
        wallLayers: [
          { name: "Exterior plaster", thicknessM: 0.02, k: 0.72 },
          { name: "Hollow concrete block", thicknessM: 0.20, k: 0.51 },
          { name: "Thermal insulation", thicknessM: 0.05, k: 0.04 },
          { name: "Gypsum board", thicknessM: 0.015, k: 0.16 },
        ],
        roofLayers: [
          { name: "Roof tiles", thicknessM: 0.02, k: 1.00 },
          { name: "Reinforced concrete slab", thicknessM: 0.20, k: 1.70 },
          { name: "Thermal insulation", thicknessM: 0.075, k: 0.04 },
          { name: "Gypsum ceiling", thicknessM: 0.015, k: 0.16 },
        ],
        windowU: 2.7,
        windowSHGC: 0.35,
        windowVT: 0.50,
        shadingCoefficient: 1.0,
      },
      indoor: {
        coolingSetpointC: 24,
        relativeHumidity: 50,
        supplyAirTempC: 13,
        meanRadiantTempC: 24,
        airVelocity: 0.12,
        met: 1.1,
        clo: 0.57,
      },
      internal: {
        occupancyDensityM2PerPerson: 10,
        peopleSensibleW: 75,
        peopleLatentW: 55,
        lightingWm2: 10,
        equipmentWm2: 15,
        schedule: "Sunday-Thursday, 8:00 AM-5:00 PM",
      },
      infiltration: {
        ach: 0.5,
      },
      weather: {
        city: "Riyadh",
        custom: null,
      },
      cooling: {
        safetyFactor: 1.10,
        includeMechanicalVentilationLoad: true,
      },
      ventilation: {
        spaceType: "Office space",
        ventilationEffectiveness: 1.0,
      },
      duct: {
        diffuserCount: 12,
        mainLengthFt: 75,
        branchLengthFt: 14,
        elbowsPerBranch: 2,
        equalFrictionInWgPer100Ft: 0.1,
        method: "Equal friction",
        fanEfficiency: 0.60,
        accessoryStaticInWg: 0.20,
      },
      diffuser: {
        acceptableNC: 30,
        x50OverL: 1.2,
      },
      co2: {
        initialPpm: 600,
        outdoorPpm: 420,
        activity: "Office work",
        timeStepMinutes: 5,
        simulationHours: 10,
        limitPpm: 1100,
      },
    };
  }

  function getWeather(state) {
    const selected = state.weather && state.weather.city ? state.weather.city : "Riyadh";
    const base = CITY_WEATHER[selected] || CITY_WEATHER.Riyadh;
    const custom = state.weather && state.weather.custom ? state.weather.custom : {};
    const weather = Object.assign({}, base, custom);
    weather.pressureKPa = weather.pressureKPa || pressureFromElevation(weather.elevationM || 0);
    weather.outdoorW = humidityRatioFromWetBulb(weather.db, weather.wb, weather.pressureKPa);
    weather.outdoorRH = rhFromHumidityRatio(weather.db, weather.outdoorW, weather.pressureKPa);
    weather.outdoorEnthalpy = enthalpyMoistAir(weather.db, weather.outdoorW);
    return weather;
  }

  function calculateGeometry(state) {
    const g = state.geometry;
    const length = safeNumber(g.lengthM, 24);
    const width = safeNumber(g.widthM, 18);
    const height = safeNumber(g.heightM, 3.5);
    const floorArea = length * width;
    const volume = floorArea * height;
    const longWallArea = length * height;
    const shortWallArea = width * height;
    const grossWalls = {
      north: longWallArea,
      south: longWallArea,
      east: shortWallArea,
      west: shortWallArea,
    };
    const windows = {};
    const opaqueWalls = {};
    Object.keys(grossWalls).forEach((o) => {
      const ratio = clamp(safeNumber(g.wwr && g.wwr[o], 0), 0, 0.95);
      windows[o] = grossWalls[o] * ratio;
      opaqueWalls[o] = grossWalls[o] - windows[o];
    });
    const totalWindowArea = Object.values(windows).reduce((a, b) => a + b, 0);
    const totalOpaqueWallArea = Object.values(opaqueWalls).reduce((a, b) => a + b, 0);
    return {
      lengthM: length,
      widthM: width,
      heightM: height,
      floorAreaM2: floorArea,
      floorAreaFt2: floorArea * C.M2_TO_FT2,
      volumeM3: volume,
      volumeFt3: volume * C.M3_TO_FT3,
      roofAreaM2: floorArea,
      grossWalls,
      windows,
      opaqueWalls,
      totalWindowAreaM2: totalWindowArea,
      totalOpaqueWallAreaM2: totalOpaqueWallArea,
    };
  }

  function uValue(layers, insideFilm = 0.12, outsideFilm = 0.04) {
    const layerR = (layers || []).reduce((sum, layer) => {
      const t = Math.max(safeNumber(layer.thicknessM), 0);
      const k = Math.max(safeNumber(layer.k), 0.001);
      return sum + t / k;
    }, 0);
    const rTotal = insideFilm + outsideFilm + layerR;
    return {
      rTotal,
      u: 1 / rTotal,
    };
  }

  function calculateHeatGains(state) {
    const geometry = calculateGeometry(state);
    const weather = getWeather(state);
    const indoor = state.indoor;
    const envelope = state.envelope;
    const internal = state.internal;
    const infiltration = state.infiltration;
    const wallU = uValue(envelope.wallLayers).u;
    const roofU = uValue(envelope.roofLayers, 0.10, 0.04).u;
    const indoorW = humidityRatioFromRH(indoor.coolingSetpointC, indoor.relativeHumidity, weather.pressureKPa);
    const deltaT = Math.max(0, weather.db - indoor.coolingSetpointC);
    const wallsByOrientation = {};
    let wallConduction = 0;
    Object.keys(geometry.opaqueWalls).forEach((o) => {
      const solAir = safeNumber(weather.solAirDelta && weather.solAirDelta[o], 0);
      const q = wallU * geometry.opaqueWalls[o] * (deltaT + solAir);
      wallsByOrientation[o] = q;
      wallConduction += q;
    });
    const roofConduction = roofU * geometry.roofAreaM2 * (deltaT + safeNumber(weather.solAirDelta && weather.solAirDelta.roof, 0));
    const windowConduction = safeNumber(envelope.windowU, 2.7) * geometry.totalWindowAreaM2 * deltaT;
    const solarByOrientation = {};
    let solarWindow = 0;
    Object.keys(geometry.windows).forEach((o) => {
      const irradiance = safeNumber(weather.solar && weather.solar[o], 0);
      const q = geometry.windows[o] * safeNumber(envelope.windowSHGC, 0.35) * safeNumber(envelope.shadingCoefficient, 1) * irradiance;
      solarByOrientation[o] = q;
      solarWindow += q;
    });
    const occupantsExact = geometry.floorAreaM2 / Math.max(safeNumber(internal.occupancyDensityM2PerPerson, 10), 0.1);
    const occupantsDesign = Math.ceil(occupantsExact);
    const peopleSensible = occupantsDesign * safeNumber(internal.peopleSensibleW, 75);
    const peopleLatent = occupantsDesign * safeNumber(internal.peopleLatentW, 55);
    const lighting = geometry.floorAreaM2 * safeNumber(internal.lightingWm2, 10);
    const equipment = geometry.floorAreaM2 * safeNumber(internal.equipmentWm2, 15);
    const infiltrationM3s = geometry.volumeM3 * safeNumber(infiltration.ach, 0.5) / 3600;
    const infiltrationMass = C.RHO_AIR * infiltrationM3s;
    const infiltrationSensible = infiltrationMass * C.CP_AIR * deltaT;
    const deltaW = Math.max(0, weather.outdoorW - indoorW);
    const infiltrationLatent = infiltrationMass * C.HFG_WATER * deltaW;
    const totalSensible = wallConduction + roofConduction + windowConduction + solarWindow + infiltrationSensible + peopleSensible + lighting + equipment;
    const totalLatent = infiltrationLatent + peopleLatent;
    const total = totalSensible + totalLatent;
    const components = [
      { key: "walls", label: "Opaque wall conduction", watts: wallConduction, type: "sensible" },
      { key: "roof", label: "Roof conduction", watts: roofConduction, type: "sensible" },
      { key: "windowConduction", label: "Window conduction", watts: windowConduction, type: "sensible" },
      { key: "solar", label: "Solar through glazing", watts: solarWindow, type: "sensible" },
      { key: "infiltrationSensible", label: "Infiltration sensible", watts: infiltrationSensible, type: "sensible" },
      { key: "infiltrationLatent", label: "Infiltration latent", watts: infiltrationLatent, type: "latent" },
      { key: "occupancySensible", label: "Occupancy sensible", watts: peopleSensible, type: "sensible" },
      { key: "occupancyLatent", label: "Occupancy latent", watts: peopleLatent, type: "latent" },
      { key: "lighting", label: "Lighting", watts: lighting, type: "sensible" },
      { key: "equipment", label: "Equipment", watts: equipment, type: "sensible" },
    ];
    const warnings = [];
    if (deltaT <= 0) warnings.push("Outdoor dry-bulb is not above indoor setpoint; envelope sensible cooling load is zero.");
    if (deltaW <= 0) warnings.push("Outdoor humidity ratio is not above indoor humidity ratio; infiltration latent load is zero.");
    return {
      geometry,
      weather,
      wallU,
      roofU,
      indoorW,
      outdoorW: weather.outdoorW,
      occupantsExact,
      occupantsDesign,
      infiltrationM3s,
      infiltrationCfm: infiltrationM3s * C.M3S_TO_CFM,
      wallsByOrientation,
      solarByOrientation,
      components,
      totalSensible,
      totalLatent,
      total,
      warnings,
      formulas: [
        "Envelope conduction: Q = U x A x deltaT, with sol-air correction for sun-exposed opaque surfaces.",
        "Window solar: Q = A_window x SHGC x shading coefficient x solar irradiance.",
        "Infiltration sensible: Qs = m_dot x cp x deltaT.",
        "Infiltration latent: Ql = m_dot x h_fg x deltaW.",
        "People loads use class-note defaults: 75 W sensible and 55 W latent per person.",
      ],
    };
  }

  function calculateVentilation(state, supplyCfm) {
    const geometry = calculateGeometry(state);
    const ventilation = state.ventilation || {};
    const type = ventilation.spaceType || "Office space";
    const data = VENTILATION_SPACES[type] || VENTILATION_SPACES["Office space"];
    const pz = Math.ceil(geometry.floorAreaM2 / Math.max(state.internal.occupancyDensityM2PerPerson, 0.1));
    const azFt2 = geometry.floorAreaFt2;
    const ez = Math.max(safeNumber(ventilation.ventilationEffectiveness, data.ez), 0.1);
    const vbz = data.rp * pz + data.ra * azFt2;
    const voz = vbz / ez;
    const freshAirPct = supplyCfm ? (voz / supplyCfm) * 100 : 0;
    return {
      spaceType: type,
      rp: data.rp,
      ra: data.ra,
      ez,
      airClass: data.airClass,
      standard: data.standard,
      occupants: pz,
      areaFt2: azFt2,
      vbzCfm: vbz,
      outdoorAirCfm: voz,
      outdoorAirM3s: voz * C.CFM_TO_M3S,
      freshAirPct,
      formulas: [
        "ASHRAE 62.1 ventilation rate procedure: Vbz = Rp x Pz + Ra x Az.",
        "Single-zone outdoor airflow: Voz = Vbz / Ez.",
      ],
    };
  }

  function calculateMechanicalVentilationLoad(state) {
    const weather = getWeather(state);
    const indoor = state.indoor;
    const vent = calculateVentilation(state, null);
    const indoorW = humidityRatioFromRH(indoor.coolingSetpointC, indoor.relativeHumidity, weather.pressureKPa);
    const deltaT = Math.max(0, weather.db - indoor.coolingSetpointC);
    const deltaW = Math.max(0, weather.outdoorW - indoorW);
    const mDot = C.RHO_AIR * vent.outdoorAirM3s;
    const sensible = mDot * C.CP_AIR * deltaT;
    const latent = mDot * C.HFG_WATER * deltaW;
    return { sensible, latent, total: sensible + latent, vent };
  }

  function calculateCoolingLoad(state) {
    const heat = calculateHeatGains(state);
    const indoor = state.indoor;
    const supplyC = safeNumber(indoor.supplyAirTempC, 13);
    const zoneC = safeNumber(indoor.coolingSetpointC, 24);
    const deltaTF = Math.max(cToF(zoneC) - cToF(supplyC), 0.1);
    const sensibleBtuH = heat.totalSensible * C.W_TO_BTUH;
    const supplyCfm = sensibleBtuH / (1.08 * deltaTF);
    const vent = calculateVentilation(state, supplyCfm);
    const mechVentLoad = calculateMechanicalVentilationLoad(state);
    const includeVent = !!(state.cooling && state.cooling.includeMechanicalVentilationLoad);
    const totalW = heat.total + (includeVent ? mechVentLoad.total : 0);
    const sensibleW = heat.totalSensible + (includeVent ? mechVentLoad.sensible : 0);
    const latentW = heat.totalLatent + (includeVent ? mechVentLoad.latent : 0);
    const totalKw = totalW / 1000;
    const safety = Math.max(safeNumber(state.cooling && state.cooling.safetyFactor, 1.1), 1);
    const designKw = totalKw * safety;
    const tons = totalKw / C.KW_PER_TON;
    const designTons = designKw / C.KW_PER_TON;
    const recommendedTons = Math.ceil(designTons * 2) / 2;
    const warnings = [];
    if (supplyC >= zoneC) warnings.push("Supply air temperature must be below zone setpoint for cooling airflow sizing.");
    if (vent.freshAirPct > 35) warnings.push("Fresh air percentage is high; verify ventilation load and dehumidification capacity.");
    return {
      heat,
      ventilation: vent,
      mechVentLoad,
      includeVentilationLoad: includeVent,
      supplyAirflowCfm: supplyCfm,
      totalW,
      sensibleW,
      latentW,
      totalBtuH: totalW * C.W_TO_BTUH,
      totalKw,
      tons,
      designKw,
      designBtuH: designKw * 1000 * C.W_TO_BTUH,
      designTons,
      recommendedTons,
      safetyFactor: safety,
      warnings,
      formulas: [
        "Supply airflow: CFM = sensible load (Btu/hr) / [1.08 x (T_zone - T_supply) in F].",
        "Cooling tons: TR = kW / 3.5168525.",
        "Recommended size = calculated total load x design safety factor.",
      ],
    };
  }

  function haalandFrictionFactor(re, roughnessM, diameterM) {
    if (re < 2300) return 64 / Math.max(re, 1);
    const term = Math.pow(roughnessM / (3.7 * diameterM), 1.11) + 6.9 / re;
    return Math.pow(-1.8 * Math.log10(term), -2);
  }

  function ductPressurePerM(cfm, diameterM) {
    const q = cfm * C.CFM_TO_M3S;
    const area = Math.PI * diameterM * diameterM / 4;
    const velocity = q / Math.max(area, 1e-8);
    const re = velocity * diameterM / 1.5e-5;
    const f = haalandFrictionFactor(re, 0.00015, diameterM);
    const dpPerM = f * (C.RHO_AIR * velocity * velocity / 2) / Math.max(diameterM, 1e-5);
    return { dpPerM, velocity, re, f };
  }

  function solveDuctDiameter(cfm, targetInWgPer100Ft) {
    const targetPaPerM = targetInWgPer100Ft * C.PA_PER_INWG / 30.48;
    let lo = 0.05;
    let hi = 2.5;
    for (let i = 0; i < 80; i += 1) {
      const mid = (lo + hi) / 2;
      const calc = ductPressurePerM(cfm, mid);
      if (calc.dpPerM > targetPaPerM) lo = mid;
      else hi = mid;
    }
    const d = (lo + hi) / 2;
    return Object.assign({ diameterM: d, diameterIn: d * 39.3701 }, ductPressurePerM(cfm, d));
  }

  function pressureLossInWg(cfm, diameterM, lengthFt, fittingK = 0) {
    const calc = ductPressurePerM(cfm, diameterM);
    const lengthM = lengthFt * 0.3048;
    const straightPa = calc.dpPerM * lengthM;
    const dynamicPa = C.RHO_AIR * calc.velocity * calc.velocity / 2;
    const fittingPa = fittingK * dynamicPa;
    const totalPa = straightPa + fittingPa;
    return {
      straightInWg: straightPa / C.PA_PER_INWG,
      fittingInWg: fittingPa / C.PA_PER_INWG,
      totalInWg: totalPa / C.PA_PER_INWG,
      velocityFpm: calc.velocity * 196.850394,
      frictionFactor: calc.f,
      reynolds: calc.re,
    };
  }

  function nextMotorHp(hp) {
    return STANDARD_MOTOR_HP.find((x) => x >= hp) || Math.ceil(hp);
  }

  function calculateDuctDesign(state) {
    const cooling = calculateCoolingLoad(state);
    const duct = state.duct || {};
    const diffuserCount = Math.max(1, Math.round(safeNumber(duct.diffuserCount, 12)));
    const branchCfm = cooling.supplyAirflowCfm / diffuserCount;
    const mainLength = Math.max(safeNumber(duct.mainLengthFt, 75), 1);
    const branchLength = Math.max(safeNumber(duct.branchLengthFt, 14), 1);
    const sectionLength = mainLength / diffuserCount;
    const frictionRate = Math.max(safeNumber(duct.equalFrictionInWgPer100Ft, 0.1), 0.02);
    const sections = [];
    let criticalMainLoss = 0;
    for (let i = 0; i < diffuserCount; i += 1) {
      const cfm = branchCfm * (diffuserCount - i);
      const size = solveDuctDiameter(cfm, frictionRate);
      const fittingK = i === 0 ? 0.15 : 0.25;
      const loss = pressureLossInWg(cfm, size.diameterM, sectionLength, fittingK);
      criticalMainLoss += loss.totalInWg;
      sections.push({
        name: `Main ${i + 1}`,
        cfm,
        lengthFt: sectionLength,
        diameterIn: size.diameterIn,
        velocityFpm: loss.velocityFpm,
        frictionInWgPer100Ft: loss.straightInWg / sectionLength * 100,
        straightLossInWg: loss.straightInWg,
        fittingLossInWg: loss.fittingInWg,
        totalLossInWg: loss.totalInWg,
      });
    }
    const branchSize = solveDuctDiameter(branchCfm, frictionRate);
    const elbowK = Math.max(0, Math.round(safeNumber(duct.elbowsPerBranch, 2))) * 0.35;
    const branchLoss = pressureLossInWg(branchCfm, branchSize.diameterM, branchLength, elbowK);
    const diffuser = selectDiffuser(state, cooling.supplyAirflowCfm);
    const diffuserPressure = diffuser.selection ? diffuser.selection.totalPressureInWg : 0.08;
    const accessory = Math.max(safeNumber(duct.accessoryStaticInWg, 0.2), 0);
    const totalStatic = criticalMainLoss + branchLoss.totalInWg + diffuserPressure + accessory;
    const fanEfficiency = clamp(safeNumber(duct.fanEfficiency, 0.6), 0.15, 0.85);
    const brakeHp = cooling.supplyAirflowCfm * totalStatic / (6356 * fanEfficiency);
    const recommendedMotorHp = nextMotorHp(brakeHp * 1.15);
    const rpmBand = totalStatic < 1.2 ? "900-1200 RPM" : totalStatic < 2.5 ? "1200-1800 RPM" : "1800 RPM class";
    return {
      cooling,
      diffuserCount,
      branchCfm,
      sections,
      branch: {
        name: "Typical branch",
        cfm: branchCfm,
        lengthFt: branchLength,
        diameterIn: branchSize.diameterIn,
        velocityFpm: branchLoss.velocityFpm,
        frictionInWgPer100Ft: branchLoss.straightInWg / branchLength * 100,
        straightLossInWg: branchLoss.straightInWg,
        fittingLossInWg: branchLoss.fittingInWg,
        totalLossInWg: branchLoss.totalInWg,
      },
      criticalMainLossInWg: criticalMainLoss,
      diffuserPressureInWg: diffuserPressure,
      accessoryStaticInWg: accessory,
      totalStaticPressureInWg: totalStatic,
      fan: {
        brakeHp,
        recommendedMotorHp,
        efficiency: fanEfficiency,
        rpmBand,
      },
      warnings: sections.some((s) => s.velocityFpm > 2000) ? ["One or more duct sections exceed the 2000 fpm equal-friction class limit."] : [],
      formulas: [
        "Duct sizing uses equal friction with Darcy-Weisbach pressure loss and Haaland friction factor.",
        "Velocity pressure and fitting losses are added with K coefficients.",
        "Fan BHP = CFM x total static pressure / (6356 x fan efficiency).",
      ],
    };
  }

  function interpolate(x, xs, ys) {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
    for (let i = 0; i < xs.length - 1; i += 1) {
      if (x >= xs[i] && x <= xs[i + 1]) {
        const ratio = (x - xs[i]) / (xs[i + 1] - xs[i]);
        return ys[i] + ratio * (ys[i + 1] - ys[i]);
      }
    }
    return ys[ys.length - 1];
  }

  function throw50FromText(text) {
    const parts = String(text).split("-").map(Number).filter(Number.isFinite);
    return parts.length ? parts[parts.length - 1] : 0;
  }

  function selectDiffuser(state, supplyCfmOverride) {
    const geometry = calculateGeometry(state);
    const cooling = supplyCfmOverride ? null : calculateCoolingLoad(state);
    const supplyCfm = supplyCfmOverride || cooling.supplyAirflowCfm;
    const diffuserCount = Math.max(1, Math.round(safeNumber(state.duct && state.duct.diffuserCount, 12)));
    const cfmEach = supplyCfm / diffuserCount;
    const acceptableNC = Math.max(10, safeNumber(state.diffuser && state.diffuser.acceptableNC, 30));
    const subzoneAreaFt2 = geometry.floorAreaFt2 / diffuserCount;
    const characteristicLengthFt = Math.sqrt(subzoneAreaFt2) / 2;
    const targetX50 = characteristicLengthFt * safeNumber(state.diffuser && state.diffuser.x50OverL, 1.2);
    const candidates = DIFFUSER_CATALOG.map((row) => {
      const nc = interpolate(cfmEach, row.airflow, row.nc);
      const pressure = interpolate(cfmEach, row.airflow, row.pressure);
      const throws = row.throwText.map(throw50FromText);
      const x50 = interpolate(cfmEach, row.airflow, throws);
      const min = row.airflow[0];
      const max = row.airflow[row.airflow.length - 1];
      const withinFlow = cfmEach >= min && cfmEach <= max;
      const ncOk = nc <= acceptableNC;
      const throwOk = x50 >= targetX50 * 0.85 && x50 <= targetX50 * 1.8;
      const score = (ncOk ? 0 : 100 + (nc - acceptableNC) * 2) + (throwOk ? 0 : Math.abs(x50 - targetX50)) + (withinFlow ? 0 : 50);
      return {
        manufacturer: "Titus",
        model: row.model,
        moduleSize: row.moduleSize,
        neckIn: row.neckIn,
        airflowCfm: cfmEach,
        nc,
        totalPressureInWg: pressure,
        x50Ft: x50,
        targetX50Ft: targetX50,
        withinFlow,
        ncOk,
        throwOk,
        score,
        source: "Titus TMS performance diffuser catalog, 2017. Values interpolated from catalog table.",
      };
    }).sort((a, b) => a.score - b.score || a.neckIn - b.neckIn);
    const selection = candidates[0];
    const warnings = [];
    if (selection && !selection.ncOk) warnings.push("Selected diffuser exceeds target NC. Increase diffuser count or accept a higher NC criterion.");
    if (selection && !selection.throwOk) warnings.push("Catalog throw does not closely match the target X50/L criterion. Adjust diffuser count or layout.");
    if (selection && !selection.withinFlow) warnings.push("CFM per diffuser is outside the catalog data range; result uses nearest catalog interpolation endpoint.");
    return {
      diffuserCount,
      cfmEach,
      acceptableNC,
      characteristicLengthFt,
      targetX50Ft: targetX50,
      selection,
      candidates: candidates.slice(0, 6),
      placement: recommendDiffuserPlacement(geometry, diffuserCount),
      warnings,
      formulas: [
        "CFM per diffuser = total supply airflow / number of diffusers.",
        "Group A design criterion: X50 = (X50/L) x characteristic length.",
        "Diffuser chosen from Titus TMS catalog by airflow, NC, pressure, and throw.",
      ],
    };
  }

  function recommendDiffuserPlacement(geometry, count) {
    const cols = Math.ceil(Math.sqrt(count * geometry.lengthM / geometry.widthM));
    const rows = Math.ceil(count / cols);
    return {
      rows,
      columns: cols,
      spacingLengthM: geometry.lengthM / cols,
      spacingWidthM: geometry.widthM / rows,
      note: "Place ceiling diffusers near the center of each subzone with return air path kept clear.",
    };
  }

  function calculateThermalComfort(state) {
    const indoor = state.indoor;
    const pmv = pmvPpd(
      safeNumber(indoor.coolingSetpointC, 24),
      safeNumber(indoor.meanRadiantTempC, indoor.coolingSetpointC),
      safeNumber(indoor.airVelocity, 0.12),
      safeNumber(indoor.relativeHumidity, 50),
      safeNumber(indoor.met, 1.1),
      safeNumber(indoor.clo, 0.57),
      0
    );
    const rhOk = indoor.relativeHumidity >= 30 && indoor.relativeHumidity <= 65;
    const compliant = Math.abs(pmv.pmv) <= 0.5 && pmv.ppd <= 10 && rhOk;
    const actions = [];
    if (pmv.pmv > 0.5) actions.push("Condition feels warm. Lower setpoint, reduce mean radiant temperature, or increase air movement.");
    if (pmv.pmv < -0.5) actions.push("Condition feels cool. Raise setpoint or reduce supply air draft.");
    if (!rhOk) actions.push("Adjust humidity control toward the 30-65% comfort band used in class notes.");
    if (!actions.length) actions.push("Maintain current setpoint, humidity control, and low-draft air distribution.");
    return {
      pmv: pmv.pmv,
      ppd: pmv.ppd,
      compliant,
      actions,
      formulas: [
        "Thermal comfort uses the Fanger PMV/PPD heat-balance model used by ASHRAE Standard 55 workflows.",
        "Compliance target used here: -0.5 <= PMV <= +0.5 and PPD <= 10%.",
      ],
    };
  }

  function pmvPpd(tdb, tr, vr, rh, met, clo, wme) {
    const pa = rh * 10 * Math.exp(16.6536 - 4030.183 / (tdb + 235));
    const icl = 0.155 * clo;
    const m = met * 58.15;
    const w = wme * 58.15;
    const mw = m - w;
    const fcl = icl <= 0.078 ? 1 + 1.29 * icl : 1.05 + 0.645 * icl;
    const hcf = 12.1 * Math.sqrt(Math.max(vr, 0.001));
    const taa = tdb + 273;
    const tra = tr + 273;
    let tcla = taa + (35.5 - tdb) / (3.5 * icl + 0.1);
    const p1 = icl * fcl;
    const p2 = p1 * 3.96;
    const p3 = p1 * 100;
    const p4 = p1 * taa;
    const p5 = 308.7 - 0.028 * mw + p2 * Math.pow(tra / 100, 4);
    let xn = tcla / 100;
    let xf = xn;
    let hc = hcf;
    for (let i = 0; i < 150; i += 1) {
      xf = (xf + xn) / 2;
      const hcn = 2.38 * Math.pow(Math.abs(100 * xf - taa), 0.25);
      hc = Math.max(hcf, hcn);
      xn = (p5 + p4 * hc - p2 * Math.pow(xf, 4)) / (100 + p3 * hc);
      if (Math.abs(xn - xf) <= 0.00015) break;
    }
    const tcl = 100 * xn - 273;
    const hl1 = 3.05e-3 * (5733 - 6.99 * mw - pa);
    const hl2 = mw > 58.15 ? 0.42 * (mw - 58.15) : 0;
    const hl3 = 1.7e-5 * m * (5867 - pa);
    const hl4 = 0.0014 * m * (34 - tdb);
    const hl5 = 3.96 * fcl * (Math.pow(xn, 4) - Math.pow(tra / 100, 4));
    const hl6 = fcl * hc * (tcl - tdb);
    const ts = 0.303 * Math.exp(-0.036 * m) + 0.028;
    const pmv = ts * (mw - hl1 - hl2 - hl3 - hl4 - hl5 - hl6);
    const ppd = 100 - 95 * Math.exp(-0.03353 * Math.pow(pmv, 4) - 0.2179 * pmv * pmv);
    return { pmv, ppd };
  }

  function simulateCO2(state) {
    const geometry = calculateGeometry(state);
    const cooling = calculateCoolingLoad(state);
    const vent = cooling.ventilation;
    const co2 = state.co2 || {};
    const activity = CO2_ACTIVITIES[co2.activity] || CO2_ACTIVITIES["Office work"];
    const occupants = Math.ceil(geometry.floorAreaM2 / Math.max(state.internal.occupancyDensityM2PerPerson, 0.1));
    const qM3h = vent.outdoorAirCfm / C.M3H_TO_CFM;
    const volume = geometry.volumeM3;
    const gM3h = occupants * activity.m3h;
    const initial = safeNumber(co2.initialPpm, 600);
    const outdoor = safeNumber(co2.outdoorPpm, 420);
    const limit = safeNumber(co2.limitPpm, 1100);
    const dtH = Math.max(safeNumber(co2.timeStepMinutes, 5), 1) / 60;
    const hours = Math.max(safeNumber(co2.simulationHours, 10), dtH);
    const steady = qM3h > 0 ? outdoor + (gM3h / qM3h) * 1e6 : Infinity;
    const ach = qM3h / volume;
    const rows = [];
    let c = initial;
    for (let t = 0; t <= hours + 1e-9; t += dtH) {
      rows.push({ hour: t, ppm: c });
      if (qM3h > 0) {
        c = steady + (c - steady) * Math.exp(-ach * dtH);
      } else {
        c = c + (gM3h / volume) * 1e6 * dtH;
      }
    }
    const hourly = [];
    for (let h = 0; h <= Math.floor(hours); h += 1) {
      const nearest = rows.reduce((best, row) => Math.abs(row.hour - h) < Math.abs(best.hour - h) ? row : best, rows[0]);
      hourly.push({ hour: h, ppm: nearest.ppm });
    }
    const peak = rows.reduce((m, row) => Math.max(m, row.ppm), -Infinity);
    const timeToSteady = ach > 0 ? -Math.log(0.05) / ach : Infinity;
    const qReqM3h = limit > outdoor ? (gM3h * 1e6) / (limit - outdoor) : Infinity;
    const qReqCfm = qReqM3h * C.M3H_TO_CFM;
    const adjustmentCfm = Math.max(0, qReqCfm - vent.outdoorAirCfm);
    const occupancyEffect = [0.5, 1, 1.5, 2].map((factor) => {
      const g = occupants * factor * activity.m3h;
      const ss = qM3h > 0 ? outdoor + (g / qM3h) * 1e6 : Infinity;
      return { occupants: occupants * factor, steadyPpm: ss };
    });
    return {
      geometry,
      cooling,
      ventilation: vent,
      activity: co2.activity || "Office work",
      generationM3hPerPerson: activity.m3h,
      occupants,
      qOutdoorM3h: qM3h,
      achOutdoor: ach,
      sourceM3h: gM3h,
      steadyStatePpm: steady,
      timeTo95PctSteadyHours: timeToSteady,
      peakPpm: peak,
      requiredOutdoorAirCfmForLimit: qReqCfm,
      ventilationAdjustmentCfm: adjustmentCfm,
      rows,
      hourly,
      occupancyEffect,
      formulas: [
        "Transient balance: dC/dt = (Q/V)(C_out - C_zone) + (G/V) x 1,000,000.",
        "Class note source value for office work: 0.02323 m3/hr per person, equal to about 0.0106 cfm/person.",
        "Required ventilation for limit: Q = G x 1,000,000 / (C_limit - C_out).",
      ],
    };
  }

  function parseEpw(text, indoorBaseC = 24) {
    const lines = String(text || "").split(/\r?\n/).filter(Boolean);
    if (lines.length < 10 || !lines[0].startsWith("LOCATION")) {
      throw new Error("This does not look like an EPW file. The first line should start with LOCATION.");
    }
    const location = lines[0].split(",");
    const city = location[1] || "Unknown";
    const country = location[3] || "";
    const dataLines = lines.slice(8);
    const rows = dataLines.map((line) => {
      const f = line.split(",");
      return {
        month: safeNumber(f[1], 1),
        day: safeNumber(f[2], 1),
        hour: safeNumber(f[3], 1),
        dryBulbC: safeNumber(f[6], NaN),
        dewPointC: safeNumber(f[7], NaN),
        rh: safeNumber(f[8], NaN),
        pressurePa: safeNumber(f[9], NaN),
        ghi: safeNumber(f[13], 0),
        dni: safeNumber(f[14], 0),
        dhi: safeNumber(f[15], 0),
        windSpeed: safeNumber(f[21], 0),
      };
    }).filter((r) => Number.isFinite(r.dryBulbC));
    const dbs = rows.map((r) => r.dryBulbC).sort((a, b) => a - b);
    const p996 = dbs[Math.max(0, Math.min(dbs.length - 1, Math.floor(dbs.length * 0.996)))];
    const maxDryBulb = dbs[dbs.length - 1];
    const coolingDegreeHours = rows.reduce((sum, r) => sum + Math.max(0, r.dryBulbC - indoorBaseC), 0);
    const monthly = Array.from({ length: 12 }, (_, i) => {
      const monthRows = rows.filter((r) => r.month === i + 1);
      const avgDb = monthRows.reduce((s, r) => s + r.dryBulbC, 0) / Math.max(monthRows.length, 1);
      const maxDb = monthRows.reduce((m, r) => Math.max(m, r.dryBulbC), -Infinity);
      return { month: i + 1, avgDb, maxDb };
    });
    return {
      city,
      country,
      rows,
      hours: rows.length,
      designDb996C: p996,
      maxDryBulbC: maxDryBulb,
      coolingDegreeHours,
      monthly,
    };
  }

  function validationMetrics(software, reference) {
    const n = Math.min(software.length, reference.length);
    if (!n) return { n: 0, rmse: NaN, cvRmse: NaN, mbe: NaN };
    let sumSq = 0;
    let sumErr = 0;
    let refSum = 0;
    for (let i = 0; i < n; i += 1) {
      const err = safeNumber(software[i]) - safeNumber(reference[i]);
      sumSq += err * err;
      sumErr += err;
      refSum += safeNumber(reference[i]);
    }
    const rmse = Math.sqrt(sumSq / n);
    const meanRef = refSum / n;
    return {
      n,
      rmse,
      cvRmse: meanRef ? rmse / meanRef * 100 : NaN,
      mbe: sumErr / n,
      meanReference: meanRef,
    };
  }

  function summarizeResults(state) {
    const heat = calculateHeatGains(state);
    const cooling = calculateCoolingLoad(state);
    const ventilation = cooling.ventilation;
    const duct = calculateDuctDesign(state);
    const diffuser = selectDiffuser(state, cooling.supplyAirflowCfm);
    const comfort = calculateThermalComfort(state);
    const co2 = simulateCO2(state);
    return { heat, cooling, ventilation, duct, diffuser, comfort, co2 };
  }

  return {
    C,
    CITY_WEATHER,
    VENTILATION_SPACES,
    CO2_ACTIVITIES,
    DIFFUSER_CATALOG,
    getDefaultState,
    getWeather,
    calculateGeometry,
    uValue,
    calculateHeatGains,
    calculateVentilation,
    calculateMechanicalVentilationLoad,
    calculateCoolingLoad,
    calculateDuctDesign,
    selectDiffuser,
    calculateThermalComfort,
    simulateCO2,
    parseEpw,
    validationMetrics,
    summarizeResults,
    psychrometrics: {
      cToF,
      fToC,
      saturationPressureKPa,
      humidityRatioFromRH,
      humidityRatioFromWetBulb,
      rhFromHumidityRatio,
      enthalpyMoistAir,
      dewPointFromHumidityRatio,
      pressureFromElevation,
    },
    round,
  };
});
