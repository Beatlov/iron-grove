# Project instructions

This is a desktop-mouse, single-player pixel RTS prototype. User-facing text is Russian.

- Run locally by opening index.html; preserve file:// support and offline operation.
- No build tools, remote assets, telemetry, dependencies or external fonts.
- Keep simulation in engine.js independent of DOM and rendering, export to both window.RTS and CommonJS.
- Keep controls and Canvas rendering in game.js. Use native Canvas drawing for pixel assets.
- World coordinates use tiles; rendering uses 24 pixels/tile. Grid: 42×26.
- Use fixed/delta simulation time rather than wall-clock timers for gameplay.
- Validate changes with `node --test tests/*.test.cjs`.
- Review gameplay and layout in a desktop browser after UI changes.
- Keep README.md honest about implemented features and limitations.
- Do not migrate engines or add multiplayer without an explicit project decision.
