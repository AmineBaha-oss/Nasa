# MCP examples — read before using

These files are **examples**, not a guarantee that an unauthenticated server will work. They have not been installed or tested here. Only the two software/documentation and browser MCPs are included. Check client versions, inspect server permissions, authenticate as needed, and preferably pin package versions after the first successful test.

- `claude.project.mcp.json` → at project root `.mcp.json` **after event start**; Claude requires `type:"http"` for remote servers; project approval required.
- `cursor.project.mcp.json` → `.cursor/mcp.json` **after event start**.
- `codex.config.toml` → trusted `.codex/config.toml` or local user config, according to installed Codex docs; confirm by listing enabled servers.
- **GitHub server:** use provider's official authentication flow; worker connections should be read-only and restricted to `repos,issues,pull_requests`. See https://github.com/github/github-mcp-server . Do not paste PATs into committed JSON. Use manual `gh` and `git` if MCP login takes too long.
- Context7: `https://mcp.context7.com/mcp`, higher limits may require API key. Use `npx ctx7 setup` CLI+skills **instead of** MCP if preferred, not both by default.
- Playwright: multiple agents sharing one persistent browser profile can conflict. Have QA own a browser session or use isolated profiles.

Checks after setup: show all connected servers, ask Context7 for the installed version of Vite/React docs, open the local app with Playwright and read the app title, query one upstream GitHub README via read-only server (if enabled). Do not infer successful integration from a config file existing.
