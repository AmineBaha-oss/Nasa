---
name: mission-demo-qa
description: Cross-check scientific labels, accessible interactive controls, cross-system agreement, deployment status, licenses and NASA submission readiness.
---

# Release gate

1. Read `docs/MASTER_PLAN.md`, `docs/INTERFACES.md`, `docs/DEMO_AND_SUBMISSION.md`, and `docs/SOURCES_AND_LICENSES.md`.
2. Reproduce two sites and two date ranges with actual named input files and ephemeris sources. Confirm displayed Sun/Earth positions and charts use identical source samples as the hardware engine.
3. Browser-test changing site, date, lander heading 0/90/180/270, fixed vs tracker panels, antenna conditions, and all fail/unknown warnings. Collect browser errors, runtime logs and relevant screenshots.
4. Check that power output, antenna contact and deployment labels include assumptions, no distant-terrain guarantee, no radio-link certification and no 5-m terrain 'safe landing' certification.
5. Test accessibility: keyboard slider, focus, meaningful labels, contrast and mobile layout. Prefer automated Playwright plus manual review, not screenshot alone.
6. Review third-party source ledger and required MIT/Apache/asset notices. Review current NASA challenge resources and exactly which listed NASA data is used.
7. Verify submission format and latest official deadline from the current form. Check demo video or slide restrictions against current event instructions, rather than relying on memory.
8. Do not post, merge, deploy or submit without human approval. Return a checklist with PASS/FAIL/UNKNOWN, commands/results and release-blocking issues.
