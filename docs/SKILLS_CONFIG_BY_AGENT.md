# Agent skills setup and activation recipes

Use `docs/SKILLS_AND_MCPS.md` first, then the per-agent prompt. **These are future setup steps, not executed installations.**

## Core external skills to inspect

From Vercel's official collection (verify installer/source before enabling):

```sh
# Example only; run after the official hackathon start if approved
npx skills add vercel-labs/agent-skills --skill react-best-practices
npx skills add vercel-labs/agent-skills --skill web-design-guidelines
```

Registry documentation: https://vercel.com/docs/agent-resources/skills

Consider choosing **either** Context7 MCP **or** `npx ctx7 setup` with CLI+skills, and **either** Playwright MCP **or** Playwright CLI with deterministic tests. Avoid paying the cost of both modes unnecessarily.

## Useful task-specific invocations

- Agent 1: `Use lunar-science-validation. Audit the true lunar projected CRS, raster transforms, azimuth conventions, ephemeris kernels and far-horizon availability; provide PASS/FAIL/UNKNOWN and sources.`
- Agent 2: `Use hardware-orientation-audit. Implement tests for body yaw, conservation of total active PV area, true panel normals, reserve threshold handling and tracking limits.`
- Agent 3: `Use hardware-orientation-audit. Validate fixed and gimballed antenna cone tests with known vectors and physically correct Earth visibility limits.`
- Agent 4: `Use lunar-science-validation. Check slope raster georeferencing, footprint resolution limits and status UNKNOWN for unresolved rocks.`
- Agent 5: `Use react-best-practices and web-design-guidelines. Consult Context7 for installed library versions and test the public interactive view using Playwright.`
- Agent 6: `Use mission-demo-qa and open-source-reuse-audit; run the required browser and science checks before preparing submission claims.`

## MCP setup

- The examples under `mcp_examples/` illustrate **Context7 and Playwright only**. They do not include unverified personal credentials or grant GitHub write rights by default.
- For the GitHub MCP install, use the official provider's installer or client guide: https://github.com/github/github-mcp-server . Set read-only and `repos,issues,pull_requests` toolsets for workers. Grant write actions only to a reviewed lead configuration. Browser-based OAuth is preferable when supported.
- Shared Claude config belongs in `.mcp.json`, shared Cursor config in `.cursor/mcp.json`. Codex can use a trusted repo `.codex/config.toml` or per-user config; confirm which one is honored by the version installed.
- Avoid having 5 agents each attach a persistent browser profile to the same running app; use one QA browser session and deterministic Playwright tests in CI.

## Agent prompt appendix to paste after each specialized prompt

> Before using tools, inspect the relevant `SKILL.md` instructions and installed MCP permissions. Use the minimum tools necessary for this task. Do not install or configure tools without the human lead's approval. Query official/versioned library docs (via Context7 if enabled). For scientific work, validate using direct NASA/NAIF/Horizons sources and deterministic tests rather than trusting MCP summaries. When reusing external code, first inspect the exact license and file at a pinned commit, record provenance, then run tests. Report: skills used, MCPs used, files modified, tests, source identifiers, unknowns, blockers. Never merge, deploy, publish or change shared contracts without human approval.
