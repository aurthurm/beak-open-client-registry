# UI Rewrite: TanStack Start + shadcn/ui

**Date:** 2026-05-02  
**Branch:** rerwite  
**Author:** Aurthur Musendame

---

## Overview

Complete rewrite of the Open Client Registry frontend from Vue 2 + Vuetify + Vuex to React + TanStack Start + shadcn/ui + Zustand. All existing Express backend APIs (`/ocrux/*`) are preserved without modification. The new app lives in `ui-react/` alongside the untouched `ui/` (kept as reference during the rewrite).

---

## 1. Architecture & Directory Structure

```
client-registry/
├── ui/                                  ← existing Vue 2 app (untouched)
├── ui-react/                            ← new TanStack Start app
│   ├── app/
│   │   ├── routes/
│   │   │   ├── __root.tsx              ← root layout: Navbar, AlertBanner, ProgressOverlay
│   │   │   ├── _auth.tsx               ← protected layout route: server-side auth gate
│   │   │   ├── index.tsx               ← / (patient list)
│   │   │   ├── login.tsx               ← /login (public)
│   │   │   ├── client.$clientId.tsx    ← /client/:clientId
│   │   │   ├── review.tsx              ← /review
│   │   │   ├── automatch.tsx           ← /automatch
│   │   │   ├── resolve.$clientId.tsx   ← /resolve/:clientId
│   │   │   ├── csvreport.tsx           ← /csvreport
│   │   │   ├── addUser.tsx             ← /addUser (admin only)
│   │   │   ├── usersList.tsx           ← /usersList (admin only)
│   │   │   └── changePassword.tsx      ← /changePassword
│   │   ├── store/
│   │   │   └── index.ts               ← Zustand slices (auth, ui, app)
│   │   ├── lib/
│   │   │   ├── api.ts                 ← fetch wrappers for all /ocrux/* endpoints
│   │   │   ├── fetch.ts               ← base fetcher with auth header + 401 handler
│   │   │   └── i18n.ts               ← English dictionary, t() function
│   │   └── components/
│   │       ├── Navbar.tsx
│   │       ├── AlertBanner.tsx
│   │       ├── ProgressOverlay.tsx
│   │       ├── SearchTerm.tsx
│   │       └── PatientCard.tsx
│   ├── public/
│   └── package.json
└── server/                              ← unchanged Express backend
```

**Build output:** `pnpm build` in `ui-react/` writes static assets to `server/gui/`, where Express already serves them at `/crux`.

**Dev proxy:** `vite.config.ts` proxies `/ocrux/*` → `http://localhost:8001` (backend dev server).

---

## 2. Routing & Auth

### Route Protection

All routes except `/login` are children of `_auth.tsx`, a TanStack Start layout route with a `beforeLoad` server function:

```
Request → _auth.tsx beforeLoad (server)
  → reads token cookie via TanStack Start getHeader()
  → validates against GET /ocrux/isTokenActive/
  → invalid: server-side redirect to /login (302, no flash)
  → valid: continue, pass auth context to child route
```

The accounts menu (and routes `/addUser`, `/usersList`) are hidden and redirected for users with `role === 'deduplication'`. The `beforeLoad` on those routes redirects to `/` for deduplication-role users. This matches the current behaviour: `role !== 'deduplication'` is the guard, not a strict admin check, to allow for future roles.

### Session Flow

1. User POSTs credentials to `/ocrux/user/authenticate`
2. Server function sets `token` as an `httpOnly` cookie
3. Response body `{ userID, username, role }` populates Zustand auth slice
4. Subsequent navigations: `_auth.tsx` reads the cookie server-side
5. On 401 from any API call: base fetcher clears Zustand auth slice, redirects to `/login`
6. Logout: clears cookie via server function, clears Zustand, redirects to `/login`

---

## 3. State Management (Zustand)

Three slices — no server data in Zustand (that lives in TanStack Query cache).

### Auth Slice
```ts
{ username: string; userID: string; role: 'admin' | 'deduplication' | '' }
```
Populated after login. Used for: hiding admin nav items, passing `username` to break/unbreak match mutations.

### UI Slice
```ts
{
  alert: { show: boolean; message: string; type: 'success' | 'error' };
  progress: { show: boolean; title: string };
}
```
Replaces Vuex `alert` and `progress` state. AlertBanner and ProgressOverlay read from this slice.

### App Slice
```ts
{
  clients: Array<{ id: string; displayName: string }>;
  systemURI: Record<string, { displayName: string; uri: string | string[] }>;
}
```
Loaded once after login via TanStack Query, written into Zustand for cross-component access (client display names, identifier system lookups used in patient detail views).

---

## 4. Data Fetching (TanStack Query)

### Base Fetcher (`lib/fetch.ts`)
- Reads `Authorization: Bearer <token>` from Zustand auth slice
- On 401: clears auth slice, redirects to `/login`
- Shared by all query and mutation hooks

### API Surface (`lib/api.ts`)

| Function | Method | Endpoint |
|---|---|---|
| `fetchPatients(params)` | GET | `/ocrux/fhir/Patient` |
| `fetchPatient(id)` | GET | `/ocrux/fhir/Patient?_include=Patient:link&_id=...` |
| `fetchDisplayConfig()` | GET | `/ocrux/fhir/Basic/patientdisplaypage` |
| `fetchMatchIssues()` | GET | `/ocrux/match/get-match-issues` |
| `fetchMatchIssueCount()` | GET | `/ocrux/match/count-match-issues` |
| `fetchAutoMatches()` | GET | `/ocrux/match/get-new-auto-matches` |
| `fetchAutoMatchCount()` | GET | `/ocrux/match/count-new-auto-matches` |
| `fetchPotentialMatches(id)` | GET | `/ocrux/match/potential-matches/:id` |
| `fetchAuditEvents(id)` | GET | `/ocrux/fhir/AuditEvent?entity=...` |
| `fetchClients()` | GET | `/ocrux/config/getClients` |
| `fetchSystemURI()` | GET | `/ocrux/config/getURI` |
| `fetchUsers()` | GET | `/ocrux/user/getUsers/` |
| `fetchCSVUploads()` | GET | `/ocrux/csv/getCSVUpload` |
| `fetchCSVReport(id)` | GET | `/ocrux/csv/getCSVReport/:id` |
| `authenticate(creds)` | POST | `/ocrux/user/authenticate` |
| `breakMatch(ids)` | POST | `/ocrux/match/break-match` |
| `unbreakMatch(pairs)` | POST | `/ocrux/match/unbreak-match` |
| `resolveMatchIssue(body)` | POST | `/ocrux/match/resolve-match-issue` |
| `addUser(formData)` | POST | `/ocrux/user/addUser/` |
| `editUser(formData)` | POST | `/ocrux/user/editUser/` |
| `changePassword(formData)` | POST | `/ocrux/user/changepassword/` |

### Polling
`fetchMatchIssueCount` and `fetchAutoMatchCount` use `refetchInterval: 60_000` — navbar badges stay fresh without manual calls.

### Pagination
Patient list uses TanStack Query with `placeholderData: keepPreviousData` to avoid flicker on page change. Server-side cursor pagination is preserved (next/previous FHIR bundle links).

---

## 5. Components & Pages

### Shared Components

| Component | Purpose |
|---|---|
| `Navbar.tsx` | Top bar: nav links with badge counts, accounts dropdown (admin only), language toggle scaffold, logout |
| `AlertBanner.tsx` | Global success/error alert strip (reads Zustand ui.alert) |
| `ProgressOverlay.tsx` | Full-screen loading dialog (reads Zustand ui.progress) |
| `SearchTerm.tsx` | Reusable filter input; emits value changes upward |
| `PatientCard.tsx` | Patient detail card: name, identifiers, telecom, extensions |

### Page Mapping

| Route | Key shadcn/ui components | Notable behaviour |
|---|---|---|
| `/` | DataTable, Select, Input | Server-side pagination; FHIR path evaluation via `fhirpath` lib; source filter dropdown |
| `/login` | Card, Input, Button, Alert | react-hook-form + zod validation; sets httpOnly cookie via server function |
| `/client/:clientId` | Tabs, Card stack, DataTable, Checkbox | Record tab: stacked PatientCards (carousel replaced with prev/next buttons); History tab: Accordion of audit events; break/revert match actions |
| `/review` | DataTable, Input, Badge | Searchable table; date formatted with date-fns; links to `/resolve/:id?flagType=...` |
| `/automatch` | DataTable, Input, Badge | Same structure as Review |
| `/resolve/:clientId` | DataTable, Combobox, Dialog, Switch | Bucket assignment via searchable Combobox (shadcn Command component); scores matrix; review-before-save dialog; nickname toggle |
| `/csvreport` | DataTable, Button | Download triggers window redirect |
| `/addUser` | Card, Input, Select, Button | react-hook-form + zod; multipart FormData POST |
| `/usersList` | DataTable, Input, Dialog | Inline edit dialog; same form as AddUser minus password fields |
| `/changePassword` | Card, Input, Button | Password match validation client-side before POST |

### Resolve Page — Bucket Assignment UX
The CR ID assignment uses shadcn's **Command** component (combobox with search). When the list exceeds ~10 entries or the user starts typing, the list filters. "Assign to new CR ID" is always the last option, separated by a divider — matching current behaviour. Nickname display (element names) and "include real CRUID" toggle are preserved as switches in a side panel.

---

## 6. i18n Scaffold

`lib/i18n.ts` exports a `t(key: string): string` function backed by a static English dictionary. Dictionary keys match the existing `en.json` exactly. Components call `t('menu_home')`, `t('surname')`, etc.

To add full i18n later: replace `lib/i18n.ts` with an `i18next` wrapper — no component changes required.

The language switcher in the Navbar is rendered but toggles only between `en` (active) and `fr` (shows "coming soon" toast) until translations are wired up.

---

## 7. Build & Integration

### Dev
```bash
# Terminal 1
cd server && bun run dev       # Express on :3000

# Terminal 2  
cd ui-react && pnpm dev        # TanStack Start on :3001
                               # /ocrux/* proxied to :3000
```

### Production
```bash
cd ui-react && pnpm build      # outputs to server/gui/
cd server && bun run start     # serves /crux from server/gui/
```

### shadcn Init Command
```bash
pnpm dlx shadcn@latest init --base base --template start --rtl --pointer --preset b6WLEHCvvd
```

### Dependencies
```
@tanstack/react-start
@tanstack/react-router
@tanstack/react-query
zustand
react-hook-form
zod
js-cookie
fhirpath
date-fns
```

### Root package.json scripts added
```json
"ui:dev":   "cd ui-react && pnpm dev",
"ui:build": "cd ui-react && pnpm build"
```

### Unchanged
- `server/` — all Express routes, JWT middleware, FHIR proxy
- `docker-compose.yml` — build step updated to call `ui:build`
- `ui/` — left in place as reference

---

## 8. What Is Not In Scope

- Modifying any server-side route or middleware
- Adding new pages beyond what the Vue app currently has
- Implementing French translations (scaffold only)
- Drag-and-drop in Resolve (using Combobox instead)
- Any changes to the Docker or deployment configuration beyond the build script swap
