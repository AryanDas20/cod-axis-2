# BrandLens — Brand Governance Workspace

BrandLens is an evidence-first review workspace for checking content before it is published. It helps creators and reviewers compare draft text with approved facts, terminology, tone guidance and brand assets. It explains findings, offers possible corrections and records human review decisions.

> **Release status:** This is a deployable MVP foundation, not a fully audited enterprise product. Before public commercial use, deploy and test the Firebase rules, configure the server environment, complete a security review, publish privacy/retention terms and test real user workflows.

## What is included

- A multi-section workspace: Overview, New review, Review library, Review details, Brand knowledge, Asset library, Approval queue, Insights, Audit trail, Team & roles and Settings.
- Light and dark themes, responsive navigation, workspace and account menus, global search (`Ctrl/Cmd + K`) and a seven-step guided tour.
- Guest/sample mode. Guest work is saved in this browser only. Signed-in cloud workspaces use Firebase Authentication, Cloud Firestore and Firebase Storage.
- Email/password registration and sign-in, Google sign-in and password reset. The first new account creates a workspace administrator.
- Brand knowledge for facts, glossary terms, tone rules, guidelines and asset records. Active approved knowledge is the source set used by the server-side review endpoint.
- Deterministic checks for prohibited terminology, universal promises, unsupported numeric statements, expired source references, tone signals and basic readability/accessibility cues.
- Optional source-grounded Gemini augmentation. AI findings are accepted only when the excerpt is found in the draft and evidence IDs match an active approved source.
- Human finding actions, required dismissal reasons, comments, version snapshots, review status changes, role-aware approval and a separate publish/export action.
- Workspace JSON and review CSV exports, review JSON records and an illustrated PDF product guide.
- TXT, MD, HTML, CSV and DOCX document extraction. Image assets accept PNG, JPEG, WebP and SVG up to 5 MB.

## Run locally

**Requirements:** Node.js 20 or newer.

```bash
cp .env.example .env
# Edit .env as described below
npm run check
npm run build
npm run dev
```

Open `http://localhost:3000`.

No npm package installation is required for the current static client and Node HTTP server. The server reads a simple project-root `.env` file at startup (existing platform environment variables take precedence). Firebase browser SDK modules are loaded from Google's Firebase CDN, so browser access to `www.gstatic.com` is required for sign-in and cloud data. The guest/sample workspace remains usable without Firebase.

## Environment variables

| Variable | Required | Purpose |
|---|---:|---|
| `PORT` | No | HTTP port. Defaults to `3000`. |
| `FIREBASE_WEB_API_KEY` | Yes for server preflight | Firebase web API key used by the server to verify Firebase ID tokens through Identity Toolkit. Use the key from Firebase project settings and restrict it to the required Identity Toolkit API. |
| `FIREBASE_PROJECT_ID` | No | Defaults to the supplied project `tribal-antler-3mn89`. |
| `FIRESTORE_DATABASE_ID` | No | Defaults to the supplied named database `ai-studio-01751af4-8ee9-4b9b-8158-67aebfccb9a0`. |
| `GEMINI_API_KEY` | No | Optional server-only Gemini API key. Without it, deterministic rules still run. Never put this key in browser code. |
| `GEMINI_MODEL` | No | Gemini model name. Defaults to `gemini-2.5-flash`; change it to a model available to your Google project. |
| `APP_ORIGIN` | Recommended in production | Exact allowed browser origin, for example `https://brand.example.com`. When blank, origin checking is not restricted by this setting. |

The Firebase browser configuration in `firebase-client.js` comes from the supplied project file. The Firebase web API key is not a server secret, but it should still be restricted in Google Cloud Console. The Gemini key is a secret and must exist only in the server environment or secret manager.

## Firebase setup

1. In Firebase Authentication, enable **Email/Password** and **Google** sign-in.
2. Add your production domain and local development domain to Authentication's authorised domains.
3. Confirm that the named Firestore database ID matches `FIRESTORE_DATABASE_ID`.
4. Deploy `firestore.rules` to that named database and `storage.rules` to the project's Storage bucket.
5. Confirm the bucket matches the `storageBucket` value in `firebase-client.js`.
6. Set `FIREBASE_WEB_API_KEY` in the server environment. Without it, Firebase login may still work in the browser, but the authenticated server preflight endpoint returns a configuration error and the client falls back to local rules.
7. Add `GEMINI_API_KEY` only when you want server-side AI analysis. Test the data-sharing notice and your Google API data-processing obligations before sending confidential drafts to an external model.

Firebase CLI configuration is included in `firebase.json` and `.firebaserc`. Review the database and bucket identifiers before running:

```bash
firebase deploy --only firestore:rules,storage --project tribal-antler-3mn89
```

The Storage rules use Firestore membership lookups for the supplied named database. Validate that cross-service lookup in your Firebase project and Storage emulator before public release.

## Architecture

```text
Browser
  ├── Vanilla JavaScript UI (app.js) + CSS (styles.css)
  ├── Firebase Auth SDK → sign-in, Google provider, password reset
  ├── Firestore → workspace, members, knowledge, reviews, findings,
  │               versions, comments and append-only audit events
  └── Firebase Storage → private image assets

Node HTTP server (server.mjs)
  ├── /api/health
  ├── /api/parse-doc
  └── /api/check-content
        ├── verifies Firebase ID token
        ├── verifies active workspace membership
        ├── loads active knowledge from Firestore (does not trust client-sent sources)
        ├── deterministic preflight checks
        └── optional Gemini augmentation, validated against exact excerpts and source IDs
```

The data collections follow the supplied project blueprint: `Workspace`, `Member`, `KnowledgeItem`, `Review`, `Finding`, `ReviewVersion`, `Comment` and `AuditEvent`.

## Role model

- **Administrator:** workspace settings, member roles, knowledge management, reviews, approvals and publication.
- **Brand manager:** manages knowledge and triage, can approve reviews and publish approved material.
- **Specialist reviewer:** checks higher-risk claims and can request changes or dismiss findings with a reason.
- **Creator:** submits drafts, reviews findings and edits their own content.
- **Publish owner:** completes the final publish/export step for approved reviews.

Creators cannot approve their own reviews. The app maintains an unresolved high-risk counter, and the Firestore approval rule requires that counter to be zero. Important security boundary: in this MVP the counter is a cached aggregate written by the client, not a tamper-proof server-side count of every nested finding. Before commercial use, move the final approval decision into a trusted Cloud Function or backend transaction that re-reads all finding records and recomputes unresolved high-risk items immediately before approving. The checker never publishes content on its own.

## Supported review scope and limits

- Deterministic text checks are heuristic. A finding is a prompt for human review, not a legal or compliance decision.
- A source can support a claim only when it exists in the active workspace knowledge library. Otherwise BrandLens reports that approved evidence was not found.
- Numeric claim matching is based on simple text matching; it is not a full fact-checking database.
- Asset checks inspect file type, size, dimensions, sampled colour, alternative text and usage metadata. They do **not** perform full visual similarity, logo detection, layout recognition, image rights verification or trademark review.
- Accessibility checks are limited text/readability cues. They are not a WCAG audit or a substitute for assistive-technology testing.
- The invitation flow creates a pending record for a known Firebase UID. It does not send email invitations. Email delivery and managed invitations need a trusted server or Cloud Function.
- The audit trail is append-only in Firestore under the supplied rules. Guest/local audit data can be changed by the browser user and is not a tamper-proof record.
- The browser Firebase SDK is loaded from a CDN. The app needs an internet connection for Firebase sign-in and cloud sync.

## Security and privacy notes

- Cloud documents are not copied into the browser's localStorage by this build. Guest/sample data is stored locally; authenticated workspace data remains in memory and Firestore/Storage.
- The server verifies the Firebase token and membership before a cloud preflight. It reads approved knowledge from Firestore rather than trusting knowledge passed in a browser request.
- Draft content and a summary of active approved knowledge are sent to Google Gemini only when `GEMINI_API_KEY` is configured and the user is running a signed-in cloud review. Guest reviews run locally.
- Configure HTTPS, restrictive `APP_ORIGIN`, API-key restrictions, secret management, backups, retention/deletion processes and monitoring in production.
- Have a qualified reviewer test Firestore and Storage rules against the actual Firebase project. Security rules in this repository are a starting policy and have not been validated by the Firebase emulator in this build environment. The high-risk counter is not tamper-proof against a workspace member who manually writes Firestore documents; use a trusted approval service before production sign-off.

## Tests

```bash
npm run check
npm run build
npm run smoke
```

The smoke test checks key content-analysis behaviours and validates that the static build contains the client assets. It does not replace browser end-to-end tests, Firebase emulator tests, penetration tests or load tests.

## Main project files

- `index.html` — application shell.
- `styles.css` — responsive light/dark interface styling.
- `app.js` — navigation, user experience, guest persistence and workspace workflows.
- `firebase-client.js` — Firebase browser SDK bootstrap and project configuration.
- `server.mjs` — secure preflight and document parsing server.
- `src/services/engine.js` — deterministic checks and AI finding validation.
- `firestore.rules` and `storage.rules` — workspace and asset access rules.
- `public/BrandLens-Product-Guide.pdf` — illustrated user guide.
