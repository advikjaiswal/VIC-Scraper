# Architecture

## Purpose

RFP Intelligence & Proposal Automation is a private internal system for opportunity discovery, qualification, proposal drafting, and submission tracking. It is built for impact evaluation, MEL, CSR research, NGO/development-sector research, social impact assessment, and consulting tenders.

The product is designed as an execution workflow, not a generic scraper. Every opportunity is normalized, deduplicated, scored, assigned a next action, and kept behind a human-reviewed submission process.

## Runtime

- Node.js 20+
- Built-in HTTP server
- SQLite storage
- Plain HTML/CSS/JS dashboard
- Public-source scan adapters using built-in `fetch`
- Local document extraction through `pdftotext`, `textutil`, or `pandoc`
- Proposal export through `pandoc`

## Main Modules

- `src/server.js`: private API and dashboard server
- `src/storage.js`: SQLite schema and persistence adapter
- `src/sources.js`: source registry and source limitations
- `src/scanner.js`: source scan runner with failure isolation
- `src/scrapers.js`: source adapter routing
- `src/parsers.js`: conservative HTML extraction helpers
- `src/scoring.js`: fit, urgency, document, eligibility, and reliability scoring
- `src/actions.js`: priority queue generation
- `src/documents.js`: document text extraction and RFP requirement analysis
- `src/proposals.js`: template proposal pack generation with placeholders
- `src/proposalExport.js`: Markdown and DOCX exports
- `public/index.html`: private command-center dashboard

## Data Model

SQLite tables:

- `sources`
- `scan_runs`
- `tenders`
- `tender_documents`
- `proposal_drafts`
- `actions`
- `settings`
- `client_profile`
- `audit_events`

## Workflow

1. Source registry defines approved sources and limitations.
2. Autopilot scans enabled sources.
3. Parsers extract public tender/RFP records.
4. Normalizer maps records to a common tender model.
5. Deduper uses source, title, organization, and deadline.
6. Scoring ranks opportunities by fit and actionability.
7. Action builder creates review, draft, document, and deadline tasks.
8. Users shortlist/reject opportunities and generate proposal packs.
9. Users review placeholders and export draft materials.
10. Final submission remains manual and human-approved.

## Source Policy

Public HTML sources are scanned respectfully with a clear user agent and bounded timeouts. Subscription or login-gated sources require legitimate credentials and source-specific handling. LinkedIn is assisted/manual unless approved official access is available.

## Security Model

Local development can run without a token. Any shared or hosted environment must set `RFP_ADMIN_TOKEN`. Generated drafts, tender documents, and client data should remain private. API keys must not be logged.

## Deployment

The included Dockerfile installs the command-line tools needed for SQLite, PDF extraction, and DOCX export. For local macOS use, `pdftotext`, `textutil`, and `pandoc` are detected automatically where available.
