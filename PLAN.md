# Implementation Plan: Unified Routes & MCP Integration

## Current Session Tasks ✅

### 1. Unified Route Parameters
- [x] Create `endpoint.yaml` - replaces `browser.yaml` with `:endpoint` param, add port scanning
- [x] Create `context.yaml` - replaces `instance.yaml` with `:endpoint/:context` params
- [x] Update `target.yaml` - rename params to `:endpoint/:context/:target`
- [x] Update `node.yaml` - rename params to `:endpoint/:context/:target/:node`
- [x] Update `root.yaml` - add `src/` prefix to module paths
- [x] Update `api.yaml` - update includes for new file names
- [x] Transpile and verify (25 contracts, 62 tests pass)

### 2. Files Changed
- `browser.yaml` → `endpoint.yaml` (renamed, unified for browser/host)
- `instance.yaml` → `context.yaml` (renamed, unified for profile/port)
- `target.yaml` - path params updated
- `node.yaml` - path params updated
- `root.yaml` - module paths prefixed with `src/`
- `api.yaml` - updated includes and documentation

---

## Architecture Decisions

### Unified Routes (Implemented)

| Path | Mode | Interpretation |
|------|------|----------------|
| `/chrome` | browser | Browser info for Chrome |
| `/chrome/default` | browser | Chrome instance with default profile |
| `/localhost` | host | Scan localhost for CDP ports |
| `/localhost/9222` | connection | Direct CDP connection |
| `/192.168.1.50/9222` | connection | Remote CDP connection |

Handler determines mode at runtime:
```typescript
const KNOWN_BROWSERS = new Set(["chrome", "edge", "firefox", "brave", "chromium", "opera", "vivaldi"]);
const mode = KNOWN_BROWSERS.has(endpoint) ? "browser" : "host";
```

### MCP Integration (Future)

**Multiprocess approach**: MCP server as REST client (mirrors CLI pattern).

```
[Claude] <--stdio/SSE--> [MCP Server] <--HTTP--> [REST Server]
```

---

## Future Tasks

- [ ] Add `mcp` field to `EndpointContract` type
- [ ] Update transpiler to emit MCP tool schemas
- [ ] Create `src/mcp/` - MCP server using orchestrator/client
- [ ] Re-implement CLI using orchestrator/client
- [ ] Implement contract module handlers in `src/routes/`
