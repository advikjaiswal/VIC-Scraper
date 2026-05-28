function csvValue(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function rowsToCsv(rows, columns) {
  const header = columns.join(',');
  const body = rows.map(row => columns.map(column => csvValue(row[column])).join(',')).join('\n');
  return `${header}\n${body}${body ? '\n' : ''}`;
}

function tendersToCsv(tenders) {
  const rows = tenders.map(tender => ({
    ...tender,
    success_fee_inr: tender.status === 'won' ? 2000 : 0
  }));
  return rowsToCsv(rows, [
    'tracking_id',
    'title',
    'organization',
    'source_name',
    'country',
    'deadline',
    'status',
    'success_fee_inr',
    'overall_score',
    'detail_url'
  ]);
}

module.exports = { csvValue, rowsToCsv, tendersToCsv };
