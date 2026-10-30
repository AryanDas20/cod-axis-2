# BrandLens 2.1 - rebuild notes

## Workspace and navigation

- Replaced the single long dashboard flow with separate Overview, New review, Review library, Review detail, Brand knowledge, Asset library, Approval queue, Insights, Audit trail, Team & roles and Settings views.
- Added responsive navigation, global search, keyboard shortcut, light/dark themes and a seven-step guided tour.
- Added a guest/sample workspace that is clearly labelled and persists only in the current browser.

## Governance workflows

- Added Firebase email/password and Google sign-in, password reset, private workspace creation/joining and role-aware screens.
- Added source records for facts, glossary terms, voice rules, guidelines and assets.
- Added preflight checks, evidence status, reasons, suggested revisions, human findings actions, comments, version snapshots, review states, approval and publish records.
- Added workspace insights, CSV/JSON exports and an append-only audit event model.

## Technical work

- Rebuilt the client in vanilla JavaScript and CSS because the supplied export contained no original `src/` implementation.
- Added a Node HTTP server with request-size limits, rate limits, security headers, document extraction and an authenticated cloud preflight endpoint.
- Server-side reviews verify Firebase ID tokens and active membership, then load approved knowledge from Firestore instead of trusting client-provided evidence.
- Added strict Firestore/Storage rule starting points, source ID validation and an illustrated simple-English PDF user guide.

## Important release boundary

This is an expanded MVP foundation, not a certified production service. The Firebase rules have not been run in the Firebase Emulator Suite here; end-to-end browser testing and live Firebase account validation were not available in this environment. The high-risk summary counter is client-maintained in this MVP. Move final approval into a trusted backend/Cloud Function transaction that reloads finding records and recomputes unresolved high-risk findings before a public commercial launch. The current asset checks are metadata/accessibility assistance, not full computer-vision brand matching.
