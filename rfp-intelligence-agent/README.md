# RFP Intelligence & Proposal Automation

Private internal command center for discovering, scoring, drafting for, and tracking RFPs/tenders related to impact evaluation, MEL, CSR research, NGO research, social impact assessment, and development-sector consulting.

## Production Launch

This application is ready to run as a private internal tool. It includes:

- Approved source registry with safe handling for public, subscription, and assisted sources
- Public-source scan runner with parser isolation and source-failure tolerance
- SQLite-backed tender tracker
- Tender normalization, deduplication, scoring, and action generation
- Human-reviewed opportunity workflow from `new` to `submitted/won/lost`
- Proposal draft generation with missing-information warnings
- Document text extraction for PDF, DOC, DOCX, HTML, Markdown, and text files
- Markdown/DOCX proposal export
- Tender tracker CSV export
- Private token authentication for non-local environments
- Dockerfile and environment template
- Automated test suite

## Quick Start

```bash
cp .env.example .env
npm test
npm run check
npm start
```

Open:

```text
http://127.0.0.1:4177
```

For any shared or hosted environment, set a strong `RFP_ADMIN_TOKEN` before launch.

## Core Workflow

1. Scan approved sources.
2. Review the priority queue and open the original source listing.
3. Shortlist strong-fit opportunities.
4. Create a proposal pack.
5. Fill credentials, team, budget, and required attachments.
6. Mark ready to submit after human review.
7. Submit manually through the approved email or portal.
8. Mark submitted, won, or lost.

The system never auto-submits proposals.

## Supported Sources

Configured source registry:

- DevNetJobsIndia
- NGO Box
- UNGM
- GIZ India
- Indev Jobs
- UNDP India procurement fallback
- LinkedIn assisted import mode

Subscription or login-gated portals such as Devex, DevelopmentAid, TenderTiger, Tendersinfo, TenderDetail, and GeM should be enabled only after legitimate credentials/access and source-specific rules are confirmed. LinkedIn is treated as assisted/manual import unless approved official access is available.

## Scripts

- `npm start` starts the private dashboard/API.
- `npm test` runs the test suite.
- `npm run check` syntax-checks source and scripts.
- `node scripts/export-latest-draft.js` exports the latest proposal draft to Markdown and DOCX.

## Environment

See `.env.example`.

Important values:

- `PORT` and `HOST` control local binding.
- `RFP_ADMIN_TOKEN` protects private access.
- `RFP_DB_PATH` points to the SQLite database.
- `RFP_USER_AGENT` identifies respectful public-source requests.
- `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` are reserved for optional future AI provider integration.

## Security And Privacy

- Keep the app private.
- Do not expose proposal documents publicly.
- Do not log API keys.
- Do not scrape subscription portals without legitimate access.
- Do not perform risky LinkedIn login scraping.
- Keep human approval before final submission.

## Deployment Notes

The app has no required npm runtime dependencies. The host must provide:

- Node.js 20+
- `sqlite3`
- `pdftotext` for PDF extraction
- `textutil` on macOS or an equivalent DOC/DOCX extraction tool
- `pandoc` for DOCX export

The included Dockerfile installs `sqlite3`. For Linux production, add `poppler-utils` and `pandoc` if document extraction/export are required in the container.

The Vercel CLI is not installed on this machine. Installing it with `npm i -g vercel` unlocks useful deployment workflows such as `vercel env pull`, `vercel deploy`, and `vercel logs` if Vercel deployment is chosen.
