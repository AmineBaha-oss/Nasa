---
name: hardware-orientation-audit
description: Review lander yaw, solar panel normals, antenna boresight and gimbals, battery energy accounting and shared science assumptions with deterministic vector tests.
---

# Validate lander-specific calculations

1. Read `docs/INTERFACES.md` first. World ENU = `[east,north,up]`; lander body = `[right,forward,up]`. Yaw is degrees clockwise from north. Verify yaw 0/90/180/270/360 with exact vectors.
2. Solar power uses normalized vectors and `max(0,dot(panel,sun))`, with terrain visibility and explicitly labeled electrical assumptions. Maintain equal total cell area across hardware configurations.
3. For trackers, apply real mechanical pointing limits; an ideal tracker must be labeled as an ideal upper bound. If the Sun is geometrically blocked, a tracker cannot recover direct sunlight.
4. Validate battery simulation with no-input, constant-surplus, constant-deficit and timestep-convergence cases. Check reserve-crossing before clamping at zero, nonnegative stored energy and maximum capacity.
5. Antenna pointing test: Earth above terrain skyline **and** within the antenna cone/gimbal range. Distinguish geometric visibility from a true communications link budget; never invent dB link margins.
6. The deployment check is slope-scale screening only; 5-m DEM cannot certify ramp/boulder safety. If the data cannot resolve relevant hazards, return `unknown` with an explanation.
7. Include negative tests such as all-tracking arrays + unconstrained gimbals, where yaw sensitivity may legitimately disappear.
8. Report unit-test fixtures, exact expected results, computed results and integration blockers. No arbitrary scoring masquerading as a physical law.
