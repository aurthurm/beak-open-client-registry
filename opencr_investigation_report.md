# OpenCR Investigation Report

Evidence basis: source code first, docs second, and only where needed to fill gaps. Where I could not verify a point in code, I have written `Not found` and named the files searched.

## Section 1 — Codebase inventory

### 1.1 Repository layout

| Path | What it is |
|---|---|
| `.github/workflows` | CI pipeline definitions for build, test, docs, e2e, and Docker publishing. |
| `DemoData` | Sample FHIR/data fixtures for demos and local experimentation. |
| `docker/{elasticsearch,opencr,opensearch}` | Container build contexts for search and OpenCR images. `docker/elasticsearch/Dockerfile` shows ES 7.9.1 plus phonetic and similarity plugins. |
| `docs/{admin,dev,impl,user}` | Operational and product documentation. Useful, but several pages are clearly advisory rather than authoritative. |
| `features` | Cucumber-style acceptance features used by test automation. |
| `old-ui` | Legacy frontend snapshot; contains `node_modules`, suggesting an abandoned or frozen UI branch. |
| `packaging/{ansible,vagrant}` | Deployment packaging artifacts. |
| `resources/{Relationships,ResourcesData,SearchParameter,StructureDefinition}` | FHIR profiles, search parameters, relationship metadata, and seed resources loaded into HAPI. |
| `server/{config,lib,resources,__tests__,gui}` | Main Node.js backend, config, matching logic, route handlers, server-side tests, and generated/static UI assets. |
| `site/{assets,css,dev,images,search,user}` | Public site/docs assets. |
| `tests` | Integration scripts, CSV fixtures, and helper package. |
| `tools` | Small helper package for scripts/utilities. |
| `ui/{src,public,tests}` | Vue 2 frontend source, static assets, and a thin unit test suite. |
| `webapp/{dist,.tanstack,.vscode}` | Another frontend artifact area, including built output and modern tooling traces. |

### 1.2 Languages and frameworks

| Area | Findings |
|---|---|
| Backend language | JavaScript on Node.js. `server/package.json` starts the app with `node lib/app.js` and reserves 8 GB heap for production (`server/package.json:6-10`). |
| Backend framework | Express (`server/package.json:26`), with body parsing, JWT auth, OpenHIM mediator utilities, and custom FHIR routing in `server/lib/app.js:3-20`. |
| Frontend language | JavaScript + Vue SFCs. `ui/src/main.js` bootstraps Vue 2, VueRouter, Vuex, Vuetify, VueI18n, Vuelidate, and vue-cookies (`ui/package.json:11-45`, `ui/src/main.js:1-44`). |
| FHIR artifacts | XML and JSON FHIR R4 profiles, search parameters, relationships, and seed resources under `resources/`. The base Patient profile is R4 (`resources/StructureDefinition/Patient.StructureDefinition.xml:26-46`). |
| Containerization | Docker Compose plus individual Dockerfiles under `docker/`. `docker-compose.yml` only wires HAPI FHIR and Elasticsearch (`docker-compose.yml:5-30`). |
| CI tooling | GitHub Actions. Node matrix is still 10.x/12.x/14.x in both build and test workflows (`.github/workflows/node.js.yml:22-34`, `.github/workflows/test.yml:22-34`). |
| Package tooling | npm in `server`, `ui`, `tools`, and `tests`. No `yarn` scripts are defined. |
| Java build tools | Not found — searched for `pom.xml`, `build.gradle`, and `build.gradle.kts`; none are present. HAPI FHIR is consumed as a Docker image, not as Java source. |
| Mixed stack note | The repo is a Node/Vue application fronting an external Java HAPI FHIR server (`README.md:11-27`, `docker-compose.yml:5-30`). |

### 1.3 External dependencies that matter

| Dependency | What it does | Status / risk |
|---|---|---|
| `express` | HTTP routing and server (`server/package.json:26`). | Core runtime dependency. |
| `openhim-mediator-utils` | Registers and heartbeats the app as an OpenHIM mediator (`server/package.json:43`, `server/lib/app.js:194-249`). | Very old major line; tightly coupled to mediator mode. |
| `fhir` / `fhirpath` | FHIR object manipulation and FHIRPath evaluation (`server/package.json:28-29`, `ui/package.json:13`). | Old majors in both server and UI. |
| `axios` | HTTP client for FHIR/ES calls and UI requests (`server/package.json:21`, `ui/package.json:34`). | Old major in server and even older in UI. |
| `request` | Legacy HTTP client used across routes and matchers (`server/package.json:46`, `server/lib/routes/user.js:3`, `server/lib/esMatchingDeprecated.js:2`). | Deprecated upstream. |
| `jsonwebtoken` | JWT issuance and verification (`server/package.json:34`, `server/lib/app.js:7`, `server/lib/routes/user.js:5`). | Old major. |
| `nconf` | Layered config loading from file + env vars (`server/package.json:40`, `server/lib/config.js:1-13`). | Old major. |
| `redis` | Present in deps (`server/package.json:45`) but no runtime wiring in source. | Appears unused; no `createClient` found in source. |
| `node-cron` | Scheduled patient reprocessing (`server/package.json:42`, `server/lib/modules/cronjobs`). | Core operational dependency. |
| `winston` | Logging (`server/package.json:55`, `server/lib/app.js:13`). | Core logging stack. |
| `exceljs` | CSV/report export to xlsx (`server/package.json:25`, `server/lib/routes/csv.js:31-220`). | Needed for stewardship/reporting. |
| `node-cache` | In-memory cache for CSV/audit coordination (`server/package.json:41`, `server/lib/mixins/matchMixin.js:9-10`). | In-process only; not shared across nodes. |
| `jaro-winkler`, `fast-levenshtein`, `damerau-levenshtein`, `soundex-code`, `metaphone`, `double-metaphone` | String matching comparators (`server/package.json:23-24,27,32,36,49`, `server/lib/medMatching.js:2-7,172-488`). | Matching-critical. |
| `vue` / `vue-router` / `vuex` / `vuetify` / `vue-i18n` | Frontend framework stack (`ui/package.json:15,21-24,19`). | Vue 2 era stack; major-version legacy. |
| `@vue/cli-*` | Build/test tooling for the UI (`ui/package.json:27-31`). | Old CLI generation; paired with OpenSSL legacy workaround. |
| `request-promise-native` | Legacy promise wrapper around `request` (`server/package.json:47`). | Same deprecation risk as `request`. |

Notable flags:

| Flag | Evidence |
|---|---|
| Deprecated dependency | `request` is in both server and UI dependency sets (`server/package.json:46`, `ui/package.json:14`). |
| Old major versions | `uuid@3`, `axios@0.x`, `nconf@0.10`, `redis@3`, `jsonwebtoken@8`, Vue 2 / Vuetify 2 / Vue CLI 4 (`server/package.json:21-56`, `ui/package.json:11-45`). |
| Legacy build workaround | UI scripts set `NODE_OPTIONS=--openssl-legacy-provider` (`ui/package.json:6-9`). |

### 1.4 Datastores

| Store | What it holds | Wiring / use |
|---|---|---|
| HAPI FHIR server | Primary FHIR persistence for Patients, Persons, AuditEvents, DocumentReferences, Basic relationship records, and other proxied FHIR resources. | External service in compose (`docker-compose.yml:5-11`), accessed via `fhirServer.baseURL` (`server/config/config_development.json:24-28`) and `fhirWrapper`/`fhirAxios` (`server/lib/routes/fhir.js:55-77`, `server/lib/modules/fhirAxios.js:34-79`). |
| Elasticsearch / OpenSearch | Matching index and report/search projection. `cacheFHIR.fhir2ES` builds analyzers and mappings, then writes flattened records (`server/lib/tools/cacheFHIR.js:257-380`, `:455-714`). | Configured with `elastic.server`, `elastic.index`, and `elastic.max_compilations_rate` (`server/config/config_development.json:29-35`). |
| In-memory cache | CSV audit/report coordination and short-lived flags. | `NodeCache` in `server/lib/mixins/matchMixin.js:9-10, 67-219`. Not cluster-safe. |
| No Redis runtime | Redis is declared in `package.json` but not instantiated in source. | `rg` found no `createClient` or `require('redis')` in runtime code. |

### 1.5 Last meaningful commit / activity signal

| Signal | Evidence |
|---|---|
| Current branch activity | `master` points at commit `6320bd9` dated `2026-05-02T20:07:05+02:00` with message `Build OpenCR locally from this repo`. |
| In-progress / abandoned branch | Branch `rerwite` points at `396a823` dated `2026-05-03T12:54:03+02:00` with message `a complete rewrite to typescript and react js tanstack start shadcn ui`. That looks like a side rewrite, not the mainline. |
| Release tag / changelog | Not found — investigated `git log`, repo root, and docs; no newer release tag or changelog entry surfaced as a stronger activity signal than HEAD commit. |

## Section 2 — Architecture map

### 2.1 Component diagram in words

Runtime topology, as implemented:

1. The Node/Express app starts in either standalone HTTPS mode or OpenHIM mediator mode (`server/lib/app.js:193-270`).
2. Standalone mode creates an HTTPS server with client certificate requirements and local server certs (`server/lib/app.js:24-30, 253-270`).
3. Mediator mode registers with OpenHIM using `openhim-mediator-utils`, fetches config, and activates heartbeats (`server/lib/app.js:194-249`; `server/config/mediator.json:23-168`).
4. The app mounts route groups for user admin, FHIR proxying, matching, CSV export, and config reads (`server/lib/app.js:121-130`).
5. Requests under `/ocrux/*` are JWT-gated except `OPTIONS` and `/ocrux/user/authenticate` (`server/lib/app.js:51-92`).
6. In standalone mode, non-`/ocrux` requests also pass through client-certificate validation (`server/lib/app.js:94-115, 121-124`).
7. FHIR requests proxy to the HAPI FHIR base URL through `fhirWrapper`/`fhirAxios` (`server/lib/routes/fhir.js:55-77`, `server/lib/modules/fhirAxios.js:34-79`).
8. Patient writes trigger matching and, if Elasticsearch is enabled, ES cache sync (`server/lib/routes/fhir.js:191-304`, `server/lib/mixins/matchMixin.js:1111-1316`, `server/lib/tools/cacheFHIR.js:455-714`).
9. OpenHIM channel config maps `/fhir` to the local app on port 3000 and allows GET/POST/PUT/DELETE (`server/config/mediator.json:97-154`).

OpenHIE/OpenHIM note:

| Item | Evidence |
|---|---|
| Mediator support is real, not just documentation | `server/lib/app.js:194-249` and `server/config/mediator.json:1-168`. |
| OpenHIM channel is preconfigured | `/fhir` route to `localhost:3000` with allow-list and methods in `server/config/mediator.json:97-154`. |

### 2.2 FHIR conformance

| Item | Evidence / assessment |
|---|---|
| FHIR version | R4. The base Patient profile declares `fhirVersion value="4.0.0"` and `url http://hl7.org/fhir/StructureDefinition/Patient` (`resources/StructureDefinition/Patient.StructureDefinition.xml:26-46`). |
| Patient profile | `Patient.StructureDefinition.xml` is the HL7 base profile; `CRPatient.StructureDefinition.xml` constrains `Patient` and slices `meta.extension` to add `CRBrokenMatch` (`resources/StructureDefinition/CRPatient.StructureDefinition.xml:3-57`). |
| Explicitly handled resources | Patient, Person, Basic, AuditEvent, DocumentReference, ValueSet, CodeSystem, Parameters, Bundle, Provenance, and generic proxied resources (`server/lib/routes/fhir.js:11-25, 27-304`; `server/lib/routes/csv.js:13-220`; `server/lib/mixins/matchMixin.js:373-470, 1246-1301`). |
| FHIR proxy behavior | `GET /:resource?/:id?` proxies to the HAPI FHIR base URL; `id === '$ihe-pix'` triggers a PIXM-like lookup (`server/lib/routes/fhir.js:27-77, 80-170`). |
| Custom patient extension | `CRBrokenMatch` extension on `Patient.meta.extension` (`resources/StructureDefinition/CRBrokenMatch.StructureDefinition.xml:23-33`; `resources/StructureDefinition/CRPatient.StructureDefinition.xml:49-56`). |
| User extension/profile | `OCRUserDetails` extension on `Person`; `OCRUser` profile constrains `Person.extension:userDetails` (`resources/StructureDefinition/OCRUserDetails.StructureDefinition.xml:3-127`; `resources/StructureDefinition/OCRUser.StructureDefinition.xml:3-48`). |
| Report metadata | `PatientRelationship.json` defines iHRIS report fields used to build the search/index projection (`resources/Relationships/PatientRelationship.json:11-127`; `server/lib/tools/cacheFHIR.js:464-518`). |

Custom extensions and tags:

| URL / tag | Where defined | Purpose |
|---|---|---|
| `http://openclientregistry.org/fhir/StructureDefinition/OCRUserDetails` | `resources/StructureDefinition/OCRUserDetails.StructureDefinition.xml:3-127` and `server/lib/routes/user.js:63-81` | Stores username, role, password hash, salt, and created date on `Person`. |
| `http://openclientregistry.org/fhir/StructureDefinition/OCRUser` | `resources/StructureDefinition/OCRUser.StructureDefinition.xml:3-48` | `Person` profile wrapper for user details. |
| `http://ihris.org/CR/fhir/StructureDefinition/CRBrokenMatch` | `resources/StructureDefinition/CRBrokenMatch.StructureDefinition.xml:3-33` | Marks broken link relationships on patient meta. |
| `http://openclientregistry.org/fhir/clientid` | `server/lib/mixins/matchMixin.js:1032-1049`, `server/lib/routes/match.js:1151-1159` | Tags the submitting client system. |
| `http://openclientregistry.org/fhir/extension/csvauditreport` | `server/lib/mixins/matchMixin.js:33-45` | Links a CSV audit event to its child audit events. |
| `http://ihris.org/fhir/StructureDefinition/iHRISReportDetails` / `iHRISReportElement` | `resources/Relationships/PatientRelationship.json:11-127` and `server/lib/tools/cacheFHIR.js:481-516` | Defines ES/report fields. |
| `http://ihris.org/fhir/StructureDefinition/opencrDisplay` / `opencrReportDisplay` | `resources/Relationships/PatientDisplay.json:11-88` | Controls UI display/search fields for the patient search screen. |

### 2.3 API surface

The deployed app is typically exposed under `/ocrux/*` after `cleanReqPath` strips the prefix (`server/lib/app.js:117-130`). The OpenHIM mediator channel also exposes `/fhir` to the backend (`server/config/mediator.json:97-154`).

| Method + path | Purpose | Auth |
|---|---|---|
| `POST /ocrux/user/authenticate` | Login, verify username/password, return JWT and role (`server/lib/routes/user.js:352-448`). | Public login endpoint. |
| `POST /ocrux/user/addUser` | Create a new `Person` user with OCRUserDetails extension (`server/lib/routes/user.js:15-105`). | JWT required. |
| `POST /ocrux/user/editUser` | Update name/role/status on a user `Person` (`server/lib/routes/user.js:107-186`). | JWT required. |
| `GET /ocrux/user/getUsers` | List users from HAPI `Person` resources (`server/lib/routes/user.js:188-243`). | JWT required. |
| `POST /ocrux/user/changepassword` | Validate old password and write a new hash/salt (`server/lib/routes/user.js:245-348`). | JWT required. |
| `GET /ocrux/config/getURI` | Return configured identifier namespaces (`server/lib/routes/config.js:5-7`). | JWT required. |
| `GET /ocrux/config/getClients` | Return configured client list (`server/lib/routes/config.js:9-11`). | JWT required. |
| `GET /ocrux/fhir/ValueSet/:id/$expand` | FHIR ValueSet expansion proxy (`server/lib/routes/fhir.js:11-17`). | JWT required. |
| `GET /ocrux/fhir/CodeSystem/$lookup` | FHIR CodeSystem lookup proxy (`server/lib/routes/fhir.js:19-25`). | JWT required. |
| `GET /ocrux/fhir/:resource?/:id?` | Generic FHIR read/proxy; `id=$ihe-pix` triggers PIXM-style response (`server/lib/routes/fhir.js:27-170`). | JWT required. |
| `POST /ocrux/fhir` | Submit a FHIR Bundle; Patients are routed through matching, non-Patient resources are forwarded directly (`server/lib/routes/fhir.js:173-304`). | JWT required. |
| `POST /ocrux/fhir/:resourceType` | Save a single resource, with Patient special-cased (`server/lib/routes/fhir.js:306-340`). | JWT required. |
| `PUT /ocrux/fhir/:resourceType/:id` | Update a resource, with Patient special-cased (`server/lib/routes/fhir.js:306-340`). | JWT required. |
| `POST /ocrux/match/resolve-match-issue` | Stewardship action to resolve duplicate/match issues (`server/lib/routes/match.js:18-576`). | JWT required. |
| `POST /ocrux/match/break-match` | Break a golden record relationship (`server/lib/routes/match.js:578-1060`). | JWT required. |
| `GET /ocrux/match/count-match-issues` | Count match issues tagged on Patients (`server/lib/routes/match.js:1060-1070`). | JWT required. |
| `GET /ocrux/match/count-new-auto-matches` | Count newly auto-matched Patients (`server/lib/routes/match.js:1072-1082`). | JWT required. |
| `POST /ocrux/match/matches` | Return a match matrix for a submitted Patient (`server/lib/routes/match.js:1084-1294`). | JWT required. |
| `GET /ocrux/match/potential-matches/:id` | Return potential/auto/conflict matches for one Patient (`server/lib/routes/match.js:1296-1487`). | JWT required. |
| `GET /ocrux/match/get-match-issues` | Return match review backlog from tags (`server/lib/routes/match.js:1489-1537`). | JWT required. |
| `GET /ocrux/match/get-new-auto-matches` | Return auto-match backlog from tags (`server/lib/routes/match.js:1539-1588`). | JWT required. |
| `POST /ocrux/match/unbreak-match` | Reverse a broken match relationship (`server/lib/routes/match.js:1590-1680`). | JWT required. |
| `GET /ocrux/csv/getCSVUpload` | List CSV audit uploads (`server/lib/routes/csv.js:13-29`). | JWT required. |
| `GET /ocrux/csv/getCSVReport/:id` | Generate xlsx stewardship report (`server/lib/routes/csv.js:31-220`). | JWT required. |
| `POST /updateConfig` | Persist config changes back to `config_${env}.json` (`server/lib/app.js:132-172`). | Not covered by the `/ocrux/*` JWT branch; in standalone mode it is client-cert gated, and in mediator mode it relies on surrounding deployment controls. |

FHIR-spec vs custom:

| Category | Endpoints |
|---|---|
| FHIR-spec / FHIR-adjacent | `GET /ocrux/fhir/...`, `POST /ocrux/fhir`, `POST /ocrux/fhir/:resourceType`, `PUT /ocrux/fhir/:resourceType/:id`, `GET /ocrux/fhir/ValueSet/:id/$expand`, `GET /ocrux/fhir/CodeSystem/$lookup`. |
| Custom OpenCR endpoints | `user/*`, `match/*`, `csv/*`, `config/*`, `POST /updateConfig`. |

### 2.4 Configuration surface

Config loading:

| Mechanism | Evidence |
|---|---|
| File-based config per environment | `server/lib/config.js:1-13` loads `config_${env}.json` plus a decision-rule file. |
| Env var override syntax | `nconf.env({separator:'__'})` maps `APP__PORT` style variables to nested keys (`server/lib/config.js:9-12`; `docs/admin/configuration.md:158-175`). |
| Decision rules | `server/lib/config.js:4-8` picks `decisionRules.json` for non-test and `decisionRulesTest.json` for test. |

Major knobs and defaults:

| Key | Default / example | Notes |
|---|---|---|
| `auth.secret` | `3084e343-71bc-4247-86e4-ea210af89c28` (`server/config/config_development.json:2-5`) | Hard-coded secret should not ship as a repo default. |
| `auth.tokenDuration` | `5400` seconds (`server/config/config_development.json:2-5`) | Token lifetime. |
| `app.port` | `3000` (`server/config/config_development.json:6-10`) | Backend listener. |
| `app.host` | `127.0.0.1` in development (`server/config/config_development.json:6-10`) | Standalone bind address. |
| `app.installed` | `false` (`server/config/config_development.json:6-10`) | Controls initial resource loading (`server/lib/prerequisites.js:107-113`). |
| `mediator.register` | `false` (`server/config/config_development.json:11-20`) | Switches between standalone and OpenHIM mediator modes. |
| `mediator.api.*` | `root@openhim.org` / `openhim-password` / `https://localhost:8080` / `trustSelfSigned=true` (`server/config/config_development.json:11-20`) | Hard-coded defaults; should be treated as demo-only. |
| `fhirServer.baseURL` | `http://localhost:8080/hapi/fhir` (`server/config/config_development.json:24-28`) | HAPI FHIR endpoint. |
| `fhirServer.username/password` | `hapi` / `hapi` (`server/config/config_development.json:24-28`) | Demo credentials; should not survive production. |
| `elastic.server` | `http://localhost:9200` (`server/config/config_development.json:29-35`) | ES/OpenSearch endpoint. |
| `elastic.index` | `patients` (`server/config/config_development.json:29-35`) | Main match index. |
| `elastic.max_compilations_rate` | `10000/1m` (`server/config/config_development.json:29-35`) | ES script compilation cap. |
| `matching.tool` | `elasticsearch` (`server/config/config_development.json:36-40`) | Switches between ES and legacy mediator matcher. |
| `matching.autoMatchPatientWithHumanAdjudTag` | `false` (`server/config/config_development.json:36-40`) | Special-case merge behavior. |
| `matching.resolvePotentialOfPotentials` | `false` (`server/config/config_development.json:36-40`) | Controls recursive review. |
| `codes.goldenRecord` | `5c827da5-4858-4f3d-a50c-62ece001efea` (`server/config/config_development.json:41-43`) | Tag code used to identify golden records. |
| `structureDefinition.uri` | `http://openclientregistry.org/fhir` (`server/config/config_development.json:44-48`) | Base URI for custom profiles and tags. |
| `structureDefinition.reportRelationship` | `patientreport` (`server/config/config_development.json:44-48`) | Drives ES/report projection. |
| `structureDefinition.autoModifyRelationshipBasedOnDecisionRules` | `true` (`server/config/config_development.json:44-48`) | Allows startup mutation of relationship metadata. |
| `clients` | `openmrs`, `dhis2`, `lims`, `cr` (`server/config/config_development.json:49-66`) | Display names for submitting systems. |
| `systems.internalid.uri[]` | OpenMRS/OpenCR identifiers (`server/config/config_development.json:67-90`) | Used to locate the internal registry ID. |
| `systems.nationalid.uri` | `http://clientregistry.org/cr/natioanlid` (`server/config/config_development.json:79-82`) | Note the typo in the URI string. |
| `systems.artnumber.uri` | `http://clientregistry.org/cr/artnumber` (`server/config/config_development.json:83-86`) | ART identifier namespace. |
| `systems.brokenMatch.uri` | `http://clientregistry.org/brokenMatch` (`server/config/config_development.json:87-89`) | Broken-link marker namespace. |
| `cronJobs.patientReprocessing` | `0 21 * * *` (`server/config/config_development.json:21-23`) | Daily reprocessing schedule. |

Hard-coded values that should not be left as-is:

| Value | Why it is a problem |
|---|---|
| `auth.secret` in repo config | JWT signing secret is visible in source (`server/config/config_development.json:2-5`). |
| Default OpenHIM credentials | `root@openhim.org` / `openhim-password` are embedded (`server/config/config_development.json:11-20`). |
| Demo FHIR credentials | `hapi` / `hapi` are embedded (`server/config/config_development.json:24-28`). |
| `rejectUnauthorized: false` | TLS server will accept unauthorized client certs (`server/lib/app.js:24-30`). |
| `trustSelfSigned: true` | Mediator mode trusts self-signed OpenHIM certs by default (`server/config/config_development.json:11-20`). |

## Section 3 — Patient matching deep-dive (the core feature)

### 3.1 Matching algorithm(s) implemented

There are two match engines:

| Engine | Where | What it does |
|---|---|---|
| Elasticsearch-backed | `server/lib/esMatching.js:13-497` | Builds ES `function_score` queries, uses similarity scripts/plugins, and classifies hits into auto/potential/conflict buckets. |
| Legacy mediator-backed | `server/lib/medMatching.js:17-493` | Pulls batches of Patients from HAPI and compares them in-process using string comparators. |

End-to-end request path:

1. A FHIR Bundle or single Patient enters through `/ocrux/fhir` or `/ocrux/fhir/:resourceType` (`server/lib/routes/fhir.js:173-340`).
2. Patient resources are routed to `matchMixin.addPatient` (`server/lib/routes/fhir.js:191-236, 326-373`).
3. `addPatient` finds/creates the internal registry ID, calls `findMatches`, and persists the patient plus links (`server/lib/mixins/matchMixin.js:482-1325`).
4. `findMatches` selects either `medMatching` or `esMatching` based on `matching.tool` and calls `performMatch` (`server/lib/mixins/matchMixin.js:543-576`).
5. `performMatch` returns auto, potential, and conflict sets, plus ES scores and matched golden records (`server/lib/esMatching.js:250-490`; `server/lib/medMatching.js:17-166`).
6. Review endpoints and CSV export read the tags/links/audit objects that `addPatient` and the match routes write (`server/lib/routes/match.js:1060-1680`, `server/lib/mixins/matchMixin.js:373-470`).

Decision-rule source:

| Source | Evidence |
|---|---|
| Deterministic default rules | `server/config/decisionRules.json:13-69` |
| Probabilistic template | `server/config/decisionRulesProbabilisticTemplate.json:27-69` |
| Test-specific rules | `server/config/decisionRulesTest.json:21-50` |

### 3.2 Blocking strategy

| Observation | Evidence |
|---|---|
| There is no separate blocking-key stage in code. | The ES engine builds one query per decision rule using filters and similarity scripts, not a dedicated block-key reducer (`server/lib/esMatching.js:37-186`). |
| Practical reduction comes from filters and index design. | `decisionRule.filters` become ES `term` filters (`server/lib/esMatching.js:151-185`), and `cacheFHIR.createESIndex` builds analyzer-aware mappings on a per-report index (`server/lib/tools/cacheFHIR.js:257-380`). |
| Mediator path is brute-force within batches. | It fetches Patients in pages of 3000 and compares each target patient against the source patient (`server/lib/medMatching.js:17-166`). |

Inference: scaling is currently based more on search-engine tuning and rule filtering than on explicit probabilistic blocking partitions.

### 3.3 Comparator functions

| Comparator | Where implemented | Notes |
|---|---|---|
| `exact` | `server/lib/medMatching.js:172-215` | Lowercases and trims before equality comparison. |
| `levenshtein` | `server/lib/medMatching.js:217-257` | Uses `fast-levenshtein`. |
| `damerau-levenshtein` | `server/lib/medMatching.js:259-299` | Uses Damerau distance; supports transpositions. |
| `jaro-winkler` | `server/lib/medMatching.js:301-340` | Uses `jaro-winkler`. |
| `soundex` | `server/lib/medMatching.js:343-388` | English-centric phonetic comparison. |
| `metaphone` | `server/lib/medMatching.js:390-435` | English-centric phonetic comparison. |
| `double-metaphone` | `server/lib/medMatching.js:437-488` | English-centric phonetic comparison. |
| `normalized-levenshtein-similarity` | `server/lib/esMatching.js:126-133` | Used for `exact` in ES path. |
| `jaro-winkler-similarity` / similarity scripts | `server/lib/esMatching.js:37-186` and `docker/elasticsearch/Dockerfile:1-7` | Requires ES similarity plugin support. |
| `phonetic` / `.phonetic` field | `server/lib/esMatching.js:99-115`, `server/lib/tools/cacheFHIR.js:266-281, 329-340` | Uses the phonetic analyzer and matches on the `.phonetic` subfield. |

Comparator configuration lives in decision rules:

| Evidence | Meaning |
|---|---|
| `server/config/decisionRules.json:16-58` | Deterministic given/family/birthdate/phone/nationalid/art fields. |
| `server/config/decisionRulesProbabilisticTemplate.json:30-59` | Probabilistic example with `mValue`/`uValue`. |

### 3.4 Decision model

| Item | Evidence |
|---|---|
| Deterministic thresholds | `potentialMatchThreshold = 4`, `autoMatchThreshold = 6` (`server/config/decisionRules.json:61-68`). |
| Probabilistic thresholds | `potentialMatchThreshold = 100`, `autoMatchThreshold = 102` in the template (`server/config/decisionRulesProbabilisticTemplate.json:61-69`). |
| ES score mode | `buildQuery` uses `score_mode = sum` for deterministic and `fellegi-sunter` for probabilistic (`server/lib/esMatching.js:57-62`). |
| Tunable weights | Deterministic fields can carry `weight`; probabilistic fields can carry `mValue` and `uValue` (`server/lib/esMatching.js:135-141`). |
| Field-level filters | `filters` are part of the decision rule object (`server/config/decisionRules.json:63-68`, `server/lib/esMatching.js:151-185`). |
| Mediator mode scoring | Boolean field-level matching only; no aggregate Fellegi-Sunter logic (`server/lib/medMatching.js:54-166`). |

### 3.5 Match review UI

| Finding | Evidence |
|---|---|
| There is a stewardship UI. | The shell exposes `review`, `automatch`, `csv`, `accounts`, and logout actions (`ui/src/App.vue:11-91`). |
| Review backlog counts are live. | App shell fetches `count-match-issues` and `count-new-auto-matches` on load (`ui/src/App.vue:151-170`; `server/lib/routes/match.js:1060-1082`). |
| Review/automatch screens are functional, but the UI stack is old. | Vue 2 / Vuetify 2 / Vue CLI 4 with an OpenSSL legacy workaround (`ui/package.json:6-45`). |
| Production readiness | Functional, but not modern. I did not find evidence of a newer stewardship UX, component tests beyond a thin sample, or performance instrumentation around review throughput. |

### 3.6 Audit trail

| Audit artifact | Evidence |
|---|---|
| Patient add/update audit | `createAddPatientAudEvent` writes `AuditEvent` resources with action, source IP, outcome, CRUIDs, matches, and submitted resource (`server/lib/mixins/matchMixin.js:373-470`). |
| CSV upload audit | `createCSVUploadAudEvent` writes `AuditEvent` with submitted resource, match JSON, and optional CRUID (`server/lib/mixins/matchMixin.js:67-219`). |
| Match issue tags | Patients are tagged with `potentialMatches`, `conflictMatches`, `autoMatches`, and `humanAdjudication` markers (`server/lib/mixins/matchMixin.js:543-741`, `server/lib/routes/match.js:1489-1588`). |
| Merge/break history | `resolve-match-issue`, `break-match`, and `unbreak-match` mutate Patient links and can create Provenance for CSV-driven updates (`server/lib/routes/match.js:18-1680`, `server/lib/mixins/matchMixin.js:1246-1301`). |

Format:

| Format | Notes |
|---|---|
| FHIR `AuditEvent` | Primary logging shape for add/update and CSV uploads. |
| FHIR tags / links | Used as operational state for match review. |
| Not found | I did not find a dedicated append-only forensic event stream beyond HAPI `AuditEvent` and resource meta tags. |

### 3.7 Performance characteristics

| Signal | Evidence |
|---|---|
| ES scroll size | `getESDocument` pulls 1000 hits at a time and scrolls until exhausted (`server/lib/esMatching.js:189-247`). |
| Mediator page size | `medMatching.performMatch` loads Patients in pages of 3000 (`server/lib/medMatching.js:17-53`). |
| Indexing strategy | `cacheFHIR.createESIndex` creates analyzers and field mappings, then `fhir2ES` performs incremental sync from `sync:lastFHIR2ESSync` (`server/lib/tools/cacheFHIR.js:257-380`, `:455-714`; `server/config/config_development.json:91-93`). |
| Plugin dependency | ES/OpenSearch must have phonetic and string-similarity plugins installed (`server/lib/prerequisites.js:200-220`, `docs/admin/installation.md:43-89`). |
| Benchmarks | Not found — investigated repo docs, workflows, and logs; no formal throughput benchmark or patient-count capacity report was present. |

Inference:

| Registry size | Likely behavior |
|---|---|
| 5M patients | ES-backed matching can probably remain viable with tuned shards, filters, and plugin support. |
| 10M patients | Candidate reduction and index tuning become mandatory; mediator mode is likely too slow. |
| 20M patients | The current codebase would likely need architecture work around blocking, sharding, and async batch processing. |

### 3.8 Gaps / known weaknesses

| Weakness | Evidence |
|---|---|
| Empty identifier matcher | `server/lib/medMatching.js:490-492` is a stub. |
| Deprecated matcher file still exists | `server/lib/esMatchingDeprecated.js:1-178` is present alongside the newer ES matcher. |
| Hard-coded decision-rule model | `server/config/decisionRules.json:13-69` and `server/config/decisionRulesProbabilisticTemplate.json:27-69` are file-based, not admin-tunable at runtime. |
| No dedicated blocking stage | `server/lib/esMatching.js:37-186`. |
| English-centric phonetics | `soundex`, `metaphone`, and `double-metaphone` are the available phonetic comparators in mediator mode (`server/lib/medMatching.js:343-488`). |
| `identifiersMatcher` absent | No support for identifier-wise comparator logic in mediator path. |
| Review state is tag-driven | Functional, but operationally fragile at scale (`server/lib/routes/match.js:1489-1588`). |
| No inbound HL7 v2 parser | Not found — investigated `server/lib/routes`, `server/lib/modules`, and `server/config`. |

## Section 4 — Security and identity

### 4.1 AuthN / AuthZ model

| Item | Evidence |
|---|---|
| JWT authentication | `/ocrux/*` requests are validated by `jwt.verify(token, config.get('auth:secret'))` (`server/lib/app.js:51-92`). |
| Login endpoint | `POST /ocrux/user/authenticate` signs a JWT with `auth.secret` and `auth.tokenDuration` (`server/lib/routes/user.js:352-448`). |
| Client certificates | Standalone mode requires client certs for non-`/ocrux` traffic (`server/lib/app.js:94-115, 121-124`). |
| OpenHIM mediated path | The app can register as an OpenHIM mediator and rely on that deployment pattern (`server/lib/app.js:194-249`; `server/config/mediator.json:97-154`). |
| Auth code location | `server/lib/app.js` and `server/lib/routes/user.js`. |

Security concern:

| Concern | Evidence |
|---|---|
| Global auth state | `authorized` is a process-wide variable in `server/lib/app.js:38, 58, 82, 98`, not per-request state. |

### 4.2 User and role management

| Item | Evidence |
|---|---|
| Admin UI exists | `ui/src/App.vue:52-79` shows account management. |
| Backend user CRUD | `server/lib/routes/user.js:15-243` handles add/edit/list. |
| Default role fallback | If missing, UI/API defaults role to `admin` (`server/lib/routes/user.js:228-237`). |
| Role vocabulary | `OCRUserDetails` profile enumerates `View`, `Edit`, and `Admin` (`resources/StructureDefinition/OCRUserDetails.StructureDefinition.xml:101-117`). |
| RBAC granularity | Coarse. I found no resource-level or field-level authorization checks in code; authorization appears to be route/UI-level and role-string based. |

### 4.3 PII handling

| Item | Evidence |
|---|---|
| Encryption in transit | Standalone HTTPS server uses TLS certs (`server/lib/app.js:24-30, 253-270`). |
| Cert validation | `requestCert: true` but `rejectUnauthorized: false` means unauthorized certs are not rejected at the TLS layer (`server/lib/app.js:24-30`). |
| Password handling | User passwords are PBKDF2-hashed with random salts before storage (`server/lib/routes/user.js:43-80`, `:295-319`, `:415-430`). |
| At-rest encryption | Not found — investigated source, Docker files, and docs; no field-level encryption or at-rest encryption implementation surfaced in code. |
| Sensitive identifiers | Stored in HAPI and optionally projected into ES indexes; no per-field encryption found (`server/lib/tools/cacheFHIR.js:257-380, 455-714`). |

### 4.4 Audit logging

| Item | Evidence |
|---|---|
| FHIR AuditEvent usage | Add/update and CSV-upload operations create `AuditEvent` resources (`server/lib/mixins/matchMixin.js:67-219, 373-470`). |
| Query logging | Docs claim query audit events are stored in HAPI and viewable in UI (`docs/admin/security.md:54-64`). |
| Match decision detail | Stored as resource tags and event details, not as a dedicated external audit system (`server/lib/routes/match.js:1489-1588`, `server/lib/mixins/matchMixin.js:373-470`). |

### 4.5 Consent model

| Finding | Evidence |
|---|---|
| FHIR Consent support | Not found — investigated `server/lib/routes`, `server/lib/mixins`, `resources`, and `ui/src`; no Consent route, UI, or consent workflow surfaced. |
| Consent enforcement | Not found. |

## Section 5 — Operational maturity

### 5.1 Deployment

| Item | Evidence |
|---|---|
| Docker | Yes, but partial. Compose wires HAPI FHIR and Elasticsearch only (`docker-compose.yml:5-30`). |
| Kubernetes / Helm | Not found — investigated repo root, `packaging`, and `docker`; no K8s or Helm manifests were present. |
| OpenCR service packaging | Docker build contexts exist under `docker/opencr`, `docker/elasticsearch`, and `docker/opensearch`. |
| Realistic production deploy | Moderate at best from repo-as-is. The app depends on external HAPI, ES/OpenSearch plugins, certs, and OpenHIM configuration (`server/lib/app.js:194-270`, `server/lib/prerequisites.js:200-220`, `docs/admin/installation.md:43-89`). |

Deployment rating: `3/5` for a competent integrator, `2/5` if judged as a turnkey product.

### 5.2 Observability

| Item | Evidence |
|---|---|
| Logging framework | Winston (`server/package.json:55`, `server/lib/app.js:13`). |
| Log level use | `info`, `warn`, and `error` are used throughout the backend. |
| Structured logging | Not found — logs are mostly plain text. |
| Metrics endpoint | Not found. No Prometheus or equivalent endpoint surfaced in `server/lib`, `docs`, or `server/package.json`. |
| Tracing | Not found. |

### 5.3 Test coverage

| Item | Evidence |
|---|---|
| Backend test framework | Jest (`server/package.json:9-10, 33`). |
| UI test framework | Vue CLI unit-jest scaffolding (`ui/package.json:8-9, 27-31, 83-85`). |
| E2E tests | GitHub Actions runs `npm test e2e` and waits for a compose stack (`.github/workflows/e2e.yml:11-30`). |
| Rough file-count signal | About 65 files under test directories versus about 104 code-ish files in the main source trees, based on a quick repo file count. |
| Test depth | Backend appears materially tested; UI has only a thin sample unit test surface. |

### 5.4 Documentation quality

| Artifact | Rating | Evidence / notes |
|---|---|---|
| `README.md` | `4/5` | Clear scope statement, stack overview, and docs links (`README.md:1-48`). |
| Admin architecture docs | `4/5` | Good operational guidance and hardening notes (`docs/admin/security.md:1-74`; `docs/admin/installation.md:43-89`). |
| API docs | `3/5` | OpenAPI exists, but it is incomplete relative to the full custom route surface (`server/openapi.json:1-240`). |
| Developer setup | `3/5` | Documentation is decent, but the build/runtime split is old and partially implied by config files rather than spelled out in one place. |

### 5.5 Backup / DR posture

| Finding | Evidence |
|---|---|
| Built-in backup tooling | Not found. |
| DR automation | Not found. |
| Guidance | General hardening docs mention backup and recovery, but not a repo-native backup workflow (`docs/admin/security.md:18-28`). |

### 5.6 Multi-tenancy

| Finding | Evidence |
|---|---|
| Multi-tenant model | Not found. There are no tenant, partition, or programme-isolation constructs in the backend or config. |
| Practical design | Single-tenant by design, with one set of clients and one identifier namespace map (`server/config/config_development.json:49-90`). |

## Section 6 — Integration points

### 6.1 OpenHIE alignment

| Workflow / pattern | Evidence | Assessment |
|---|---|---|
| OpenHIM mediator | `server/lib/app.js:194-249`, `server/config/mediator.json:1-168` | Implemented. |
| PIXM-like patient lookup | `server/lib/routes/fhir.js:27-170`, especially `id === '$ihe-pix'` | Implemented in a narrow form. |
| PIX / PDQ | Not found — investigated source and docs; no explicit PDQ server or broad PIX workflow implementation beyond the `$ihe-pix` route. | Missing / partial. |
| MDM / MPI mediator | The app behaves like an MPI/client registry, but there is no separate external mediator service for matching beyond the OpenHIM registration pattern. | Partial. |
| HCS connection patterns | Not found — investigated `server/lib`, `server/config`, `docs/admin`, and `docs/dev`; no HCS-specific connection pattern surfaced. | Missing. |

### 6.2 Inbound integration patterns

| Pattern | Evidence | Assessment |
|---|---|---|
| FHIR Bundle ingestion | `POST /ocrux/fhir` accepts a Bundle and routes Patients through matching (`server/lib/routes/fhir.js:173-304`). | Implemented. |
| Single resource FHIR ingest | `POST /ocrux/fhir/:resourceType`, `PUT /ocrux/fhir/:resourceType/:id` (`server/lib/routes/fhir.js:306-340`). | Implemented. |
| FHIR `$match`-style behavior | The app exposes custom match endpoints rather than a canonical FHIR `$match` operation (`server/lib/routes/match.js:1084-1487`). | Partial and custom. |
| HL7v2 ingestion | Not found. | Missing. |
| Non-FHIR custom ingest | Not found. | Missing / code changes required. |
| Batch enrolment via CSV | CSV upload/reporting is present (`server/lib/routes/csv.js:13-220`; `server/lib/mixins/matchMixin.js:67-219`). | Implemented, but stewardship-oriented rather than a full enrolment API. |
| OpenHIM-mediated flow | Configured through mediator channel rules (`server/config/mediator.json:97-154`). | Implemented. |

For BeakInsights: the current codebase does not natively consume HL7 v2 ADT, ORU, or sample/result feeds; if MoHCC wants a practical national rollout, a mediator translation layer is still required (`server/lib/routes/fhir.js:173-340`, `server/lib/routes/match.js:1084-1680`, `server/lib/modules/fhirAxios.js:34-295`).

### 6.3 Outbound notifications

| Item | Evidence |
|---|---|
| Subscriptions | Not found — no FHIR Subscription route or handler in `server/lib`, `server/openapi.json`, or `docs`. |
| Webhooks | Not found. |
| Event bus | Not found. |
| Downstream EMR notification on merge | Not found. The system relies on polling, tags, and stored resources rather than push notifications. |
| Message queue | Not found. |

### 6.4 Identifier types

| Identifier namespace | Evidence | Ease of adding new one |
|---|---|---|
| Internal IDs | `systems.internalid.uri[]` in config (`server/config/config_development.json:67-78`). | Config-only, but still needs matching-rule awareness. |
| National ID | `systems.nationalid.uri` and `decisionRules.json:46-52`. | Minor config for the namespace; code changes needed for validation and normalization. |
| ART number | `systems.artnumber.uri` and `decisionRules.json:53-58`. | Minor config. |
| Broken match marker | `systems.brokenMatch.uri` (`server/config/config_development.json:87-89`). | Config-only. |
| Adding a Zimbabwe National ID or e-passport | Not a first-class feature. The namespace can be configured, but validation and any special matching logic would be new code. |
| EC number / passport / refugee ID / temporary ID | Not found as predefined namespaces. | Needs config plus rule and validation work. |

### 6.5 HL7 v2 to FHIR translation

| Finding | Evidence |
|---|---|
| Native HL7 v2 support | Not found — there are no HL7 v2 listeners, parsers, or ADT/ORU handlers in the runtime code. |
| Translation layer location | The likely place is an OpenHIM mediator or adjacent integration service, because OpenCR already understands OpenHIM registration and FHIR ingress (`server/lib/app.js:194-249`, `server/config/mediator.json:97-154`). |
| FHIR-only bias | The inbound API is FHIR Bundle / resource oriented (`server/lib/routes/fhir.js:173-340`). |

For BeakInsights, this is an important differentiation point: most Zimbabwean LIMS and analyser estates are still HL7 v2-native, so a production bid should explicitly include a mediator translation pattern instead of pretending the registry will speak FHIR everywhere on day one.

### 6.6 Query patterns

| Query mode | Evidence | Notes |
|---|---|---|
| Read by identifier | `GET /ocrux/fhir/:resource?/:id?` and `fhirAxios.read/search` (`server/lib/routes/fhir.js:27-77`, `server/lib/modules/fhirAxios.js:48-135`) | The code proxies to HAPI and can search by query params. |
| Demographic search | `fhirAxios.search` and `searchAll` forward query params to HAPI with pagination (`server/lib/modules/fhirAxios.js:67-136`). | Latency depends on HAPI and the query shape; the code does not add a search cache. |
| PIXM-style lookup | `id === '$ihe-pix'` in `server/lib/routes/fhir.js:27-170`. | Narrow, identifier-centric lookup only. |
| UI query patterns | The UI search/display config uses `given:contains`, `family:contains`, `gender`, and `link` search parameters (`resources/Relationships/PatientDisplay.json:11-88`). | Good for review screens, but not a full external query API. |
| Pagination | `fhirAxios.searchAll` follows `link.relation === 'next'` (`server/lib/modules/fhirAxios.js:89-136`). | Reasonable, but no explicit caching or async search job model. |

Not found — investigated `server/lib/modules/fhirAxios.js`, `server/lib/routes/fhir.js`, `resources/Relationships/PatientDisplay.json`, and `ui/src`; there is no dedicated latency benchmark or search cache layer in the repo.

## Section 7 — Zimbabwe / sub-Saharan Africa context fit

Legend: `a` works as-is, `b` needs minor config, `c` needs code changes, `d` missing entirely.

| Item | Verdict | Evidence / assessment |
|---|---|---|
| 7.1 National ID format `NN-NNNNNNNN-X-NN` | `c` | The code knows about a `nationalid` namespace and exact-match field (`server/config/decisionRules.json:46-52`), but there is no format validator or parser for Zimbabwe’s canonical format. The namespace URI itself is configurable, so the validation gap is code, not pure config. |
| 7.2 Names with non-ASCII characters, hyphens, multi-word surnames | `c` | Matchers mostly lowercase + trim or English-centric phonetics (`server/lib/medMatching.js:172-488`). No accent folding or locale-aware name normalization surfaced. |
| 7.3 Partial DOB | `d` | `birthDate` is treated as exact in the default deterministic rules (`server/config/decisionRules.json:32-38`). I found no partial-date handling. |
| 7.4 Address hierarchy Province → District → Ward → Village | `c` | The report projection includes `address` as a display field (`server/lib/routes/csv.js:39-63, 68-92`), but there is no hierarchy-aware address comparator or structured address model in matching code. |
| 7.5 Mobile-first / low-bandwidth | `c` | The UI is a Vue 2 + Vuetify SPA with legacy build tooling (`ui/package.json:6-45`) and not a lightweight clerk client. I did not find hard evidence of aggressive code-splitting or mobile optimization. |
| 7.6 Offline / intermittent connectivity | `d` | Not found — no PWA, service worker, or offline sync layer in `ui/src` or `ui/public`. |
| 7.7 Languages (Shona / Ndebele) | `c` | VueI18n is present, but only English and French are wired in (`ui/src/main.js:33-35`; `ui/src/App.vue:145-148`). Adding Shona/Ndebele is feasible but not already done. |
| 7.8 Phone numbers and shared household numbers | `c` | Phone is a default matching field (`server/config/decisionRules.json:39-45`), but I found no Zimbabwe-specific normalization for `+263` formats or household sharing. |
| 7.9 Twins / mother-infant near-matches | `c` | No special treatment surfaced for same-DOB, same-address, or mother/infant temporary identity patterns. |
| 7.10 Sex / gender coding | `a` | The default rules use FHIR `gender` as a filter (`server/config/decisionRules.json:63-68`) and the UI/search/reporting assumes that same field (`resources/Relationships/PatientDisplay.json:47-63`, `server/lib/routes/csv.js:39-63`). That works as-is if Zimbabwe HMIS aligns to FHIR administrative gender. |

## Section 8 — Known issues, dead code, and technical debt

### 8.1 TODO, FIXME, XXX, HACK comments

| Finding | Evidence |
|---|---|
| TODO/FIXME/HACK trail | Not found — searched `server`, `ui`, `tests`, `resources`, and `docs` for those markers and found no source comments of that form. |

### 8.2 Abandoned modules/files

| File / area | Why it looks abandoned |
|---|---|
| `server/lib/esMatchingDeprecated.js` | Explicitly older ES matcher implementation; still present alongside the newer matcher (`server/lib/esMatchingDeprecated.js:1-178`). |
| `server/lib/medMatching.js:490-492` | `identifiersMatcher` is completely empty. |
| `old-ui` | Legacy UI snapshot with `node_modules`; likely superseded. |
| `webapp/dist`, `server/gui/js`, `server/gui/css` | Built/generated artifacts committed into the repo. |
| Branch `rerwite` | Separate TS/React/TanStack rewrite branch exists (`git for-each-ref` output). |

### 8.3 Dependency upgrades that are overdue

Important note: I did not run `npm audit` or `pip-audit`; this is a version-obsolescence review based on the manifest, not a live CVE scan.

| Dependency | Why it is overdue |
|---|---|
| `request` | Deprecated and still used in server and UI (`server/package.json:46`, `ui/package.json:14`). |
| `uuid@3` | Old major (`server/package.json:53`). |
| `axios@0.19` / `0.18` | Very old major lines (`server/package.json:21`, `ui/package.json:34`). |
| `nconf@0.10` | Old major (`server/package.json:40`). |
| `redis@3` | Old major (`server/package.json:45`). |
| `jsonwebtoken@8` | Old major (`server/package.json:34`). |
| `openhim-mediator-utils@0.2.3` | Very old line and mediator-specific. |
| Vue 2 / Vuex 3 / Vue Router 3 / Vuetify 2 / Vue CLI 4 | Legacy frontend generation (`ui/package.json:11-45`). |
| `NODE_OPTIONS=--openssl-legacy-provider` | Indicates the UI build is relying on an old crypto compatibility path (`ui/package.json:6-9`). |

### 8.4 Duplicated logic / refactor opportunities

| Duplicated area | Evidence | Refactor opportunity |
|---|---|---|
| Matching selection and result shaping | `server/lib/match.js:1084-1487`, `server/lib/mixins/matchMixin.js:543-741`, `server/lib/esMatching.js:250-490`, `server/lib/medMatching.js:17-166` | Centralize match-result DTO construction and tag handling. |
| Config mutation | `server/lib/app.js:132-172` and `server/lib/mixins/generalMixin.js:44-58` | Use one config-writer path, not two slightly different implementations. |
| Audit event creation | `server/lib/mixins/matchMixin.js:67-219, 373-470` | Pull common AuditEvent helpers into one module. |
| User password hashing | `server/lib/routes/user.js:43-80, 295-319, 415-430` | Shared password utility would reduce drift and bugs. |
| Report relationship parsing | `server/lib/prerequisites.js:12-100` and `server/lib/tools/cacheFHIR.js:455-714` | Split schema parsing from indexing and sync. |

## Section 9 — The improvement opportunity list (the gold)

| # | Opportunity | Current state (file:line) | Proposed enhancement | Effort | Why it matters for Zimbabwe |
|---|---|---|---|---|---|
| 1 | Make match thresholds and weights admin-tunable | `server/config/decisionRules.json:13-69`, `server/lib/esMatching.js:37-186` | Add an admin UI and API for editing decision rules, thresholds, and field weights without redeploying. | M | MoHCC can recalibrate match sensitivity as data quality changes between provinces/programmes. |
| 2 | Add hierarchy-aware address matching | `resources/Relationships/PatientRelationship.json:11-127`, `server/config/decisionRules.json:13-69` | Model Province/District/Ward/Village as structured comparators and score partial address agreement. | M | Zimbabwe addresses are not postcode-centric; hierarchy-aware matching will outperform flat string matching. |
| 3 | Add Zimbabwe National ID validation and normalization | `server/config/decisionRules.json:46-52`, `server/config/config_development.json:79-82` | Validate the `NN-NNNNNNN-X-NN` pattern, normalize separators, and flag malformed IDs before match. | S | A national registry needs deterministic ID hygiene; it reduces false positives and user frustration. |
| 4 | Support partial DOB matching | `server/config/decisionRules.json:32-38` | Treat year-only and year-plus-month DOBs as first-class match states. | M | Partial birth dates are common in SSA and should not be forced into exact-match logic. |
| 5 | Add locale-aware name normalization | `server/lib/medMatching.js:172-488` | Normalize diacritics, hyphens, apostrophes, and multi-word surnames before comparator scoring. | M | Shona/Ndebele names can be penalized by English-centric phonetic matching. |
| 6 | Normalize Zimbabwe phone numbers | `server/config/decisionRules.json:39-45`, `server/lib/routes/csv.js:39-63` | Canonicalize `+263` / leading-zero local formats and support household-shared numbers in scoring. | S | Phone is already a matching field; making it robust would improve auto-match quality immediately. |
| 7 | Expose identifier namespace registry | `server/config/config_development.json:67-90` | Add a UI for configuring ID systems, display names, and validation patterns for new programmes. | M | Zimbabwe may need NID, passport, facility ID, programme ID, and partner-specific identifiers over time. |
| 8 | Add explicit blocking keys | `server/lib/esMatching.js:37-186`, `server/lib/tools/cacheFHIR.js:257-380` | Introduce blocking partitions such as province, sex, year-of-birth, or hash-prefix buckets before similarity scoring. | L | Without blocking, registry size growth will drive ES cost and latency. |
| 9 | Add FHIR Subscription or webhook notifications | `server/lib/modules/fhirAxios.js:34-220`, `server/lib/routes/match.js:1489-1680` | Emit event notifications when a duplicate is resolved, merged, or broken. | M | Downstream EMRs need to react to identity changes instead of polling. |
| 10 | Build a stewardship dashboard | `ui/src/App.vue:11-91`, `server/lib/routes/match.js:1060-1588` | Add backlog charts, auto-match volumes, review turnaround, and adjudication outcomes. | M | Evaluators will see operational control and governance, not just a raw matcher. |
| 11 | Add a forensic match/audit viewer | `server/lib/mixins/matchMixin.js:373-470`, `server/lib/routes/csv.js:31-220` | Surface match rationale, audit event details, and before/after link changes in a searchable UI. | M | National registries need explainability for merges and reversals. |
| 12 | Replace legacy `request` usage | `server/package.json:46`, `ui/package.json:14`, `server/lib/routes/user.js:3` | Move to a modern HTTP client everywhere and remove the legacy package from the stack. | M | Reduces maintenance risk and simplifies future security patching. |
| 13 | Retire the deprecated matcher path | `server/lib/esMatchingDeprecated.js:1-178`, `server/lib/medMatching.js:490-492` | Remove dead code and either complete or delete the empty `identifiersMatcher`. | S | Shrinks ambiguity for future implementers and lowers bug surface. |
| 14 | Improve authz granularity | `server/lib/routes/user.js:15-448`, `ui/src/App.vue:52-79` | Add resource-level role checks and finer-grained admin permissions. | M | MoHCC deployments often separate steward, registrar, auditor, and super-admin duties. |
| 15 | Remove global auth state | `server/lib/app.js:38, 58, 82, 98` | Replace the process-wide `authorized` flag with per-request authentication state. | S | The current pattern can leak authorization state across requests in a single process. |
| 16 | Add low-bandwidth/mobile optimizations | `ui/package.json:6-45`, `ui/src/App.vue:1-187` | Code-split the SPA, reduce default payloads, and add a leaner clinician/registrar mode. | M | Rural clinic users may be on slow or unstable 3G links. |
| 17 | Add Shona and Ndebele localization | `ui/src/main.js:33-36`, `ui/src/App.vue:145-148` | Add locale files, translation coverage, and language switch persistence. | S | Multi-language UI matters for national adoption and training. |
| 18 | Add metrics and health endpoints | `server/lib/app.js:121-172`, `server/lib/app.js:193-270` | Expose `/health`, `/ready`, and basic Prometheus counters for match volume and backlog. | S | Makes production support and SLA reporting much easier. |
| 19 | Add backup/restore automation | `docs/admin/security.md:18-28`, `docker-compose.yml:5-30` | Script HAPI and ES snapshot/restore and document DR steps in the repo. | M | Client registries are critical infrastructure; disaster recovery must be explicit. |
| 20 | Add deployment manifests | `docker-compose.yml:5-30`, `server/lib/app.js:193-270` | Provide Kubernetes/Helm or at least full-stack compose for OpenCR + HAPI + ES/OpenSearch. | M | Cuts implementation time and makes provincial rollout repeatable. |
| 21 | Add patient identity quality analytics | `server/lib/routes/match.js:1060-1588`, `server/lib/mixins/matchMixin.js:373-470` | Surface duplicate rates, conflict rates, and source-system quality by district/programme. | M | Lets the Ministry see where data quality intervention is needed. |
| 22 | Add Zimbabwe-ready address and ID search forms | `ui/src/App.vue:11-91`, `resources/Relationships/PatientDisplay.json:11-88` | Extend the search UI to support address hierarchy and alternate ID types. | M | Field users need search forms that match how records are actually collected. |
| 23 | Add HL7 v2 ADT mediator | `server/lib/routes/fhir.js:173-340`, `server/lib/routes/match.js:1084-1680`, `server/lib/app.js:194-249` | Build an OpenHIM mediator that translates ADT^A04/A08/A40 into OpenCR patient enrolment, update, and merge operations. | L | Zimbabwe EMRs and LIMS estates are still mostly HL7 v2; this is the fastest path to real adoption. |
| 24 | Add consumer-side merge notifications | `server/lib/routes/match.js:1489-1680` | Publish match/merge events to downstream EMRs, LIMS, and HMIS consumers. | M | BeakInsights has built consumer-side integration patterns before; this closes a common operational gap in registry deployments. |
| 25 | Add a registry query API for external consumers | `server/lib/modules/fhirAxios.js:48-136`, `server/lib/routes/fhir.js:27-77` | Create a documented search facade for EHRs/LIMS to fetch demographics by identifier, name, DOB, and phone with paging and caching. | M | MoHCC will need a predictable query contract, not just a stewardship UI. |
| 26 | Add duplicate-resolution explainability | `server/lib/mixins/matchMixin.js:373-470`, `server/lib/routes/csv.js:31-220` | Show which rules, scores, and conflicting sources caused each decision. | M | Helps stewards trust the system and makes training easier. |
| 27 | Add twin / infant identity safeguards | `server/config/decisionRules.json:13-69`, `server/lib/routes/match.js:1084-1487` | Add special handling for infants, siblings, and same-household near-matches where phone/address is weak evidence. | M | This is common in maternal-child health programs and reduces harmful false merges. |
| 28 | Add sex/gender mapping validation | `server/config/decisionRules.json:63-68`, `resources/Relationships/PatientDisplay.json:47-63` | Validate and map local HMIS sex codes to FHIR administrative-gender values cleanly. | S | Prevents subtle mismatch and reporting errors across programmes. |

## Section 10 — Risks I should know about before bidding

### 10.1 Hard architectural lock-ins

| Risk | Evidence | Impact |
|---|---|---|
| HAPI FHIR is the persistence center | `README.md:11-27`, `server/lib/modules/fhirAxios.js:34-79` | Swapping out the FHIR server is a major migration, not a simple config flip. |
| Elasticsearch/OpenSearch is deeply embedded in matching | `server/lib/esMatching.js:37-490`, `server/lib/tools/cacheFHIR.js:257-714` | Matching quality and performance are tied to ES plugins, mappings, and similarity scripts. |
| OpenHIM mediator is a first-class mode | `server/lib/app.js:194-249`, `server/config/mediator.json:1-168` | Reworking the integration pattern would affect startup, config, and deployment flows. |

### 10.2 Licence concerns

| Risk | Evidence | Impact |
|---|---|---|
| Elasticsearch vs OpenSearch licensing | `docs/admin/installation.md:43-89`, `docs/dev/license.md:11-17` | The repo explicitly warns about Elasticsearch license restrictions and recommends OpenSearch. Procurement should avoid ambiguity here. |
| Dependency licenses | Not fully audited in this pass | Most listed deps are permissive, but this should still be verified during delivery. |

### 10.3 Security weaknesses to disclose

| Risk | Evidence | Impact |
|---|---|---|
| Global `authorized` state | `server/lib/app.js:38, 58, 82, 98` | Potential request-isolation issue in a multi-request Node process. |
| TLS accepts unauthorized client certs | `server/lib/app.js:24-30` | Standalone mode does not hard-fail unauthorized certs at the transport layer. |
| Demo credentials and JWT secret in repo config | `server/config/config_development.json:2-28` | Must be replaced before production use. |
| Passwords passed via query string | `server/lib/routes/user.js:352-448` | Login credentials appear in URL/query handling, which is poor security hygiene. |
| Config write endpoint | `server/lib/app.js:132-172` | If not properly constrained by outer auth, this is a sensitive administrative surface. |

### 10.4 Performance ceilings

| Risk | Evidence | Impact |
|---|---|---|
| Mediator matcher scans in batches of 3000 | `server/lib/medMatching.js:17-53` | Suitable only for small-to-medium registries. |
| ES matcher scrolls 1000 at a time | `server/lib/esMatching.js:189-247` | Scales better than mediator mode, but still requires serious cluster tuning at high volume. |
| Incremental sync has to touch each changed resource | `server/lib/tools/cacheFHIR.js:455-714` | Large backfills or daily surges will create maintenance windows unless optimized. |

### 10.5 Anything else a senior architect would flag

| Risk | Evidence | Impact |
|---|---|---|
| `user.js` logs use an undefined variable | `server/lib/routes/user.js:30-35` | The logging path references `resource`, which is not defined there; this is a bug waiting to happen. |
| HAPI/ES defaults are demo-like | `server/config/config_development.json:11-35` | Production hardening will require a real secrets strategy and infrastructure controls. |
| Legacy frontend build chain | `ui/package.json:6-45` | The UI build relies on old tooling and the OpenSSL legacy provider, which raises maintainability risk. |
| Repo contains built artifacts and `node_modules` trees | `find` output across `server`, `old-ui`, `webapp` | Increases noise and can obscure what is source versus generated. |

## Section 11 — Quick wins (first 90 days)

| # | Quick win | Effort | Why it lands well |
|---|---|---|---|
| 1 | Add an admin page for editing matching thresholds and field weights | M | Shows immediate governance value and de-risks later tuning. |
| 2 | Implement Zimbabwe ID and phone normalization | S | Quick, visible quality improvement on core matching fields. |
| 3 | Add a stewardship dashboard for backlog and auto-match counts | M | Gives the Ministry an operational view from day one. |
| 4 | Add Shona/Ndebele language scaffolding | S | Demonstrates localization readiness without a huge codebase rewrite. |
| 5 | Add a match/audit detail viewer | M | Makes duplicate resolution explainable to evaluators and users. |
| 6 | Replace hard-coded demo secrets in config templates | S | Easy credibility win for security posture. |
| 7 | Add `/health` and `/ready` endpoints plus a couple of counters | S | Improves deployment confidence and supportability immediately. |
| 8 | Produce full-stack deployment manifests for OpenCR + HAPI + ES/OpenSearch | M | Turns the repo into something a delivery team can actually stand up repeatedly. |

## Section 12 — BeakInsights Differentiation Map

This is the section that should feed the proposal narrative. The point is not just "we can integrate OpenCR", but "we know how to make OpenCR useful in Zimbabwe because we have already solved adjacent integration problems from the consumer side."

| BeakInsights capability | OpenCR gap it addresses | Proposal narrative angle |
|---|---|---|
| HL7 v2 integration | OpenCR has no native HL7 v2 listener, parser, or ADT/ORU inbound path (`server/lib/routes/fhir.js:173-340`; `server/lib/routes/match.js:1084-1680`; `server/lib/modules/fhirAxios.js:34-295`). | "We will not ask every facility to become FHIR-native first; we will build the HL7 v2 mediator that turns existing ADT traffic into registry-ready patient events." |
| EHR ↔ LIMS ↔ CR integration experience | OpenCR exposes only a registry core; it does not notify downstream consumers or provide consumer-side integration patterns (`server/lib/routes/match.js:1489-1680`; `server/lib/routes/fhir.js:27-170`). | "BeakInsights understands the downstream consumer workflow, so the registry will be built to serve EHR, LIMS, and HMIS consumers, not just to collect records." |
| FHIR REST integration | OpenCR is FHIR-centric already, but the current surface is narrow and custom (`server/lib/routes/fhir.js:11-340`, `server/openapi.json:19-240`). | "We can standardize the custom OpenCR endpoints into a proper consumption contract for downstream FHIR clients." |
| HL7 v2 analyser/LIMS interfacing | OpenCR currently lacks native HL7 v2 support and outbound notifications (`server/lib/routes/fhir.js:173-340`, `server/lib/routes/match.js:1489-1680`). | "We can bridge the legacy analyser/LIMS world without waiting for system replacement." |
| Batch/file-based enrolment and stewardship | OpenCR has CSV reporting and upload audit infrastructure, but not a complete bulk enrolment UX (`server/lib/routes/csv.js:13-220`, `server/lib/mixins/matchMixin.js:67-219`). | "We can deliver practical bulk onboarding and data stewardship workflows for facilities that still operate on files and spreadsheets." |
| Cross-system SSA data exchange | OpenCR is single-registry/single-tenant by design and lacks programme partitioning (`server/config/config_development.json:49-90`; `docs/admin/security.md:54-64`). | "We can wrap OpenCR with the programme and programme-partitioning discipline required for national scale." |
| Consumer-side de-duplication controls | OpenCR writes tags and AuditEvents, but the stewardship UX is old and the matching model is file-driven (`server/lib/mixins/matchMixin.js:543-741`, `server/config/decisionRules.json:13-69`). | "BeakInsights can turn a working matcher into a governable national deduplication service." |
