# Project instructions

This is a desktop-mouse, single-player pixel RTS prototype. User-facing text is Russian.

- Run locally by opening index.html; preserve file:// support and offline operation.
- No build tools, remote assets, telemetry, dependencies or external fonts.
- Keep simulation in engine.js independent of DOM and rendering, export to both window.RTS and CommonJS.
- Keep controls and Canvas rendering in game.js. Use native Canvas drawing for pixel assets.
- World coordinates use tiles; rendering uses 24 pixels/tile. World grid: 144×96, partitioned into 12 seeded territories; viewport adapts to the available battlefield area at 24 pixels per tile, with a scrollable camera and minimap.
- Use fixed/delta simulation time rather than wall-clock timers for gameplay.
- Validate changes with `node --test tests/*.test.cjs`.
- Review gameplay and layout in a desktop browser after UI changes.
- Keep README.md honest about implemented features and limitations.
- Do not migrate engines or add multiplayer without an explicit project decision.

- Keep menu/selection/global-map UI in game.js. Territory ownership and capture rules belong in engine.js.
- Captures require military units (isMilitary) at an adjacent territory outpost. Outposts are invulnerable, non-shooting control points; command cores take damage only after their territory is captured.

- Construction advances only with its reserved worker adjacent to the site; queued sites wait for an idle carrier and never steal production workers.
- Workers inside workplaces stay in population/upkeep but are excluded from rendering, picking, selection and combat targets. Release them through the building or when it is destroyed.

- Setting: Russian-language cosmic cyberpunk «Неоновый предел / Протокол Гелиос». Display composite, regolith, biogel, titanium, xenocrystals; keep stable internal resource/entity keys. Workers are autonomous drones.
- Military classes are soldier (ranged marine), assault (armored melee), medic (healing only), grenadier (siege). Use isMilitary() across population, upkeep, capture, AI and UI; unitCosts defines class-specific prices. Medics must never deal damage. Both factions obey the same economic rules.
