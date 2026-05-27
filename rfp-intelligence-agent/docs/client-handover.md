# Client Handover

## What The System Does

RFP Intelligence & Proposal Automation continuously checks approved opportunity sources, extracts relevant tenders, scores them, creates next actions, drafts proposal packs, and tracks every opportunity through a human-approved submission workflow.

## Launch Checklist

- Set `RFP_ADMIN_TOKEN` to a long private token.
- Confirm the client profile and proposal placeholders before generating final drafts.
- Run Autopilot and review source health.
- Review the first 20 opportunities for relevance calibration.
- Confirm which subscription portals the client has legitimate access to.
- Keep LinkedIn in assisted/manual mode unless official access is approved.
- Back up `data/rfp-intelligence.sqlite`.

## Daily Workflow

1. Run RFP Autopilot.
2. Review priority queue.
3. Open high-fit opportunities.
4. Shortlist, reject, or request a draft.
5. Generate proposal pack for shortlisted opportunities.
6. Replace placeholders with verified client credentials.
7. Export draft and checklist.
8. Submit manually after final human approval.

## Source Limitations

Public HTML sources can change structure or block requests. The scan runner records failures without stopping the whole system. Subscription sources require legitimate credentials and source-specific handling. LinkedIn should not be automated through login scraping.

## Backup

Back up:

```text
data/rfp-intelligence.sqlite
exports/
```

## Human Approval Rule

The tool prepares and tracks submissions. It does not submit automatically. The team must review all generated material before use.
