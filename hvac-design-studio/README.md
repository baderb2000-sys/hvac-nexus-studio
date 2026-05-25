# HVAC Nexus Studio

Integrated HVAC design software for the AREN 351 final take-home design project.

## What is included

- Project information and single-zone building geometry.
- Weather and city selection for Jeddah, Riyadh, Dammam, and Abha.
- EPW upload and hourly weather diagnostics.
- Heat gains analysis with envelope, solar, infiltration, occupancy, lighting, and equipment components.
- Cooling load sizing in kW, Btu/hr, and tons of refrigeration.
- ASHRAE 62.1 ventilation rate procedure module.
- Equal-friction duct sizing with pressure losses and fan selection.
- Titus TMS diffuser selection using catalog performance data.
- ASHRAE 55 style PMV/PPD thermal comfort evaluation.
- Psychrometric comfort chart bonus feature.
- Transient indoor CO2 model with hourly output, steady-state time, and ventilation adjustment.
- Results report tab for presentation and technical report drafting.

## Run in Visual Studio Code

Open this folder in VS Code:

```powershell
C:\Users\Msi\Documents\Eng B\hvac-design-studio
```

Then run a local server:

```powershell
python -m http.server 5173
```

Open:

```text
http://127.0.0.1:5173/index.html
```

If `python` is not on PATH, use the bundled Codex Python path:

```powershell
C:\Users\Msi\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe -m http.server 5173
```

## Engineering basis

The calculation engine is in `engineering.js`. The GUI is intentionally separate in `app.js`.

Core equations used:

- Envelope conduction: `Q = U x A x deltaT`.
- Window solar gain: `Q = A_window x SHGC x shading coefficient x solar irradiance`.
- Infiltration sensible: `Qs = m_dot x cp x deltaT`.
- Infiltration latent: `Ql = m_dot x h_fg x deltaW`.
- Supply airflow: `CFM = sensible load / [1.08 x (T_zone - T_supply)]`.
- ASHRAE 62.1 ventilation: `Vbz = Rp x Pz + Ra x Az`, `Voz = Vbz / Ez`.
- Duct sizing: Darcy-Weisbach pressure loss with Haaland friction factor.
- Fan power: `BHP = CFM x total static pressure / (6356 x fan efficiency)`.
- CO2 transient model: `dC/dt = (Q/V)(C_out - C_zone) + (G/V) x 1,000,000`.
- Thermal comfort: Fanger PMV/PPD heat-balance model.

## Important notes for final submission

The city weather values are preloaded engineering design assumptions. If the instructor gives exact ASHRAE climatic design values, enter them in the Weather tab as custom DB/WB/pressure values.

The interface is configured for direct project presentation without an external-software review screen.

## Quick test

Run:

```powershell
node tests/engine.test.js
```

Or with the bundled Codex Node:

```powershell
C:\Users\Msi\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe tests/engine.test.js
```
