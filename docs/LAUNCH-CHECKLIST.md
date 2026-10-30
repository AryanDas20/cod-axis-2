# BrandLens launch checklist

Use this checklist before making the product available to external customers.

## Firebase and identity

- [ ] Confirm the Firebase project, named Firestore database and Storage bucket belong to the intended production organisation.
- [ ] Enable Email/Password and Google providers.
- [ ] Add production and staging domains to Firebase Authentication's authorised domains.
- [ ] Deploy the current Firestore and Storage rules, then test every role in the Firebase Emulator Suite.
- [ ] Verify cross-service Storage membership lookups work with the named Firestore database.
- [ ] Test account creation, password reset, sign-in, sign-out, invited-member activation and role changes.
- [ ] Add a supported account recovery, data export and account deletion process.

## Server and AI

- [ ] Set `FIREBASE_WEB_API_KEY` and restrict it to the required Identity Toolkit API.
- [ ] Put `GEMINI_API_KEY` in a managed secret store. Never expose it to browser JavaScript.
- [ ] Select an available Gemini model and test source grounding, prompt-injection attempts and malformed model output.
- [ ] Configure `APP_ORIGIN` to the exact production origin.
- [ ] Add request logging without storing raw confidential draft text by default.
- [ ] Add monitoring, alerts, rate limits at the edge and a tested backup/recovery plan.
- [ ] Review data residency and vendor terms for the organisation's use case.

## Product and policy

- [ ] Publish a privacy notice, terms of service, cookie/storage notice and retention schedule.
- [ ] Decide how to handle confidential, regulated, personal and legally privileged content.
- [ ] Test keyboard navigation, screen readers, contrast, zoom and reduced motion.
- [ ] Test large files, unsupported files, invalid content, long text and browser failures.
- [ ] Test creator, reviewer, manager, admin and publish-owner permissions using separate accounts.
- [ ] Confirm no creator can approve their own review, high-risk unresolved findings block approval, and dismissals require a reason.
- [ ] Move the final approval gate into a trusted backend/Cloud Function transaction that re-reads all finding records and recomputes unresolved high-risk items; the current client-maintained root counter is an MVP guard, not a tamper-proof aggregate.
- [ ] Clarify that readiness scores and automated findings are advisory and not certifications.
- [ ] Run independent security assessment and fix findings before commercial launch.
- [ ] Add user support, incident response, service status and product versioning processes.

## Known limitations to address or disclose

- Current asset review is metadata and alt-text assistance, not full visual AI or brand-logo similarity.
- Accessibility findings are heuristics, not formal WCAG conformance results.
- Numeric fact checks use a limited string-matching approach.
- Invitation records require a known Firebase UID; email delivery is not implemented.
- The sample workspace is illustrative. Do not present demo counts as customer or impact metrics.
- Firestore and Storage rules have not been emulator-tested in this environment.
