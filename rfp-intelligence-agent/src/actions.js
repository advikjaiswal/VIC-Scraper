const crypto = require('node:crypto');
const { daysUntil } = require('./scoring');

function actionId(tender, type) {
  return crypto.createHash('sha1').update(`${tender.id}:${type}:${tender.deadline || ''}`).digest('hex').slice(0, 16);
}

function add(actions, tender, type, label, priority = 50) {
  actions.push({
    id: actionId(tender, type),
    tender_id: tender.id,
    type,
    label,
    status: 'open',
    priority,
    due_at: tender.deadline || null,
    created_at: new Date().toISOString()
  });
}

function buildActions(tenders, options = {}) {
  const now = options.now || new Date();
  const actions = [];
  for (const tender of tenders) {
    if (['rejected', 'submitted', 'won', 'lost', 'archived'].includes(tender.status)) continue;
    const score = Number(tender.overall_score || 0);
    const days = daysUntil(tender.deadline, now);
    const docScore = Number(tender.document_availability_score ?? (Array.isArray(tender.documents) && tender.documents.length ? 88 : 35));

    if (score >= 70) {
      add(actions, tender, 'review_rfp', `Review high-fit RFP: ${tender.title}`, days !== null && days <= 14 ? 95 : 82);
      if (!['draft_generated', 'under_review', 'ready_to_submit'].includes(tender.status)) {
        add(actions, tender, 'generate_draft', `Generate proposal pack: ${tender.title}`, 78);
      }
    } else if (score >= 45) {
      add(actions, tender, 'manual_fit_review', `Manual fit review: ${tender.title}`, 58);
    }

    if (score >= 45 && (docScore < 50 || (Array.isArray(tender.documents) && tender.documents.length === 0))) {
      add(actions, tender, 'missing_document', `Find or upload RFP documents: ${tender.title}`, 74);
    }

    if (days !== null && days >= 0 && days <= 7 && score >= 45) {
      add(actions, tender, 'deadline_risk', `Deadline risk: submit before ${tender.deadline}`, 100);
    }
  }
  return actions.sort((a, b) => b.priority - a.priority || String(a.due_at || '').localeCompare(String(b.due_at || '')));
}

module.exports = { buildActions };
