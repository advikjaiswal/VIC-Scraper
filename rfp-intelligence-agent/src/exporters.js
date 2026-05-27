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
  return rowsToCsv(tenders, [
    'id',
    'title',
    'organization',
    'source_name',
    'country',
    'deadline',
    'status',
    'overall_score',
    'detail_url'
  ]);
}

module.exports = { csvValue, rowsToCsv, tendersToCsv };
