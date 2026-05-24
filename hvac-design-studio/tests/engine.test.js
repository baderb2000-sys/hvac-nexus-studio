const assert = require("node:assert");
const E = require("../engineering.js");

function near(actual, expected, tolerance, label) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${label}: expected ${expected} +/- ${tolerance}, got ${actual}`
  );
}

const state = E.getDefaultState();
const geometry = E.calculateGeometry(state);
near(geometry.floorAreaM2, 432, 0.001, "floor area");
near(geometry.volumeM3, 1512, 0.001, "volume");
assert.strictEqual(Math.ceil(geometry.floorAreaM2 / state.internal.occupancyDensityM2PerPerson), 44);

const heat = E.calculateHeatGains(state);
assert.ok(heat.totalSensible > 50000, "sensible heat gain should be substantial for Riyadh design day");
assert.ok(heat.totalLatent > 1000, "latent heat gain should include occupants and humidity sources");
assert.ok(heat.wallU > 0.45 && heat.wallU < 0.60, "wall U-value in expected range");
assert.ok(heat.roofU > 0.35 && heat.roofU < 0.55, "roof U-value in expected range");

const cooling = E.calculateCoolingLoad(state);
assert.ok(cooling.supplyAirflowCfm > 8000, "supply airflow should be sized from sensible load");
assert.ok(cooling.designTons > cooling.tons, "safety factor should increase design tons");
assert.ok(cooling.ventilation.outdoorAirCfm > 450 && cooling.ventilation.outdoorAirCfm < 550, "ASHRAE office outdoor air");

const duct = E.calculateDuctDesign(state);
assert.ok(duct.totalStaticPressureInWg > 0.3, "duct static pressure should be positive");
assert.ok(duct.fan.recommendedMotorHp >= duct.fan.brakeHp, "selected motor should cover brake horsepower");

const diffuser = E.selectDiffuser(state);
assert.ok(diffuser.selection, "diffuser should be selected");
assert.ok(diffuser.selection.manufacturer === "Titus", "diffuser catalog manufacturer");

const comfort = E.calculateThermalComfort(state);
assert.ok(Number.isFinite(comfort.pmv), "PMV should be finite");
assert.ok(comfort.ppd >= 5 && comfort.ppd <= 100, "PPD in valid range");

const co2 = E.simulateCO2(state);
assert.ok(co2.rows.length > 10, "CO2 transient series should contain time steps");
assert.ok(co2.peakPpm > state.co2.initialPpm, "CO2 should rise with occupancy");
assert.ok(co2.requiredOutdoorAirCfmForLimit > 0, "required ventilation should be calculable");

const metrics = E.validationMetrics([1000, 1100, 1200], [1000, 1000, 1000]);
near(metrics.rmse, Math.sqrt((0 + 10000 + 40000) / 3), 1e-9, "RMSE");

console.log("All engineering tests passed.");
