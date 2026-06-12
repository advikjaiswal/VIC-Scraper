const assert = require('node:assert/strict');
const test = require('node:test');
const {
  parseDevNetJobsIndia,
  parseNgoBox,
  parseGizIndia,
  parseGenericLinks
} = require('../src/parsers');

test('parses DevNetJobsIndia-style RFP rows into tenders', () => {
  const html = `
    <table>
      <tr>
        <td><a href="rfp_details.aspx?job_id=123">Impact Evaluation of Health Program</a></td>
        <td>Example NGO</td>
        <td>India</td>
        <td>Last Date: 5th June 2026</td>
      </tr>
    </table>`;
  const tenders = parseDevNetJobsIndia(html, {
    id: 'devnetjobsindia',
    name: 'DevNetJobsIndia',
    base_url: 'https://www.devnetjobsindia.org/rfp_assignments.aspx'
  });

  assert.equal(tenders.length, 1);
  assert.equal(tenders[0].title, 'Impact Evaluation of Health Program');
  assert.equal(tenders[0].organization, 'Example NGO');
  assert.equal(tenders[0].deadline, '2026-06-05');
  assert.equal(tenders[0].detail_url, 'https://www.devnetjobsindia.org/rfp_details.aspx?job_id=123');
});

test('DevNetJobsIndia parser does not persist javascript postback links as source URLs', () => {
  const html = `
    <table>
      <tr>
        <td><a href="javascript:__doPostBack('ctl00$ContentPlaceHolder1$grdJobs$ctl29$lnkJobTitle','')">Baseline Assessment RFP</a></td>
        <td>Khushi Baby Association</td>
        <td>India</td>
        <td>Last Date: 30 May 2026</td>
      </tr>
    </table>`;
  const tenders = parseDevNetJobsIndia(html, {
    id: 'devnetjobsindia',
    name: 'DevNetJobsIndia',
    base_url: 'https://www.devnetjobsindia.org/rfp_assignments.aspx'
  });

  assert.equal(tenders[0].detail_url, 'https://www.devnetjobsindia.org/rfp_assignments.aspx');
  assert.equal(tenders[0].source_url, 'https://www.devnetjobsindia.org/rfp_assignments.aspx');
});

test('parses NGO Box-style cards and keeps document links', () => {
  const html = `
    <div class="rfp">
      <a href="/rfp-detail/impact-evaluation">RFP - Endline Evaluation Study</a>
      <p>Organization: CSR Foundation</p>
      <p>Published: 10 June 2026</p>
      <p>Deadline: 18/06/2026</p>
      <a href="/docs/tor.pdf">Download TOR</a>
    </div>`;
  const tenders = parseNgoBox(html, {
    id: 'ngobox',
    name: 'NGO Box',
    base_url: 'https://ngobox.org/rfp_eoi_listing.php'
  });

  assert.equal(tenders.length, 1);
  assert.equal(tenders[0].organization, 'CSR Foundation');
  assert.equal(tenders[0].posted_date, '2026-06-10');
  assert.equal(tenders[0].documents[0].url, 'https://ngobox.org/docs/tor.pdf');
});

test('generic parser only returns evaluation-like links', () => {
  const html = `
    <a href="/procurement/impact-evaluation">Impact Evaluation Consultancy</a>
    <a href="/procurement/vehicle-supply">Vehicle Supply Tender</a>
    <a href="/procurement/baseline-study">Baseline Study RFP deadline 5 June 2026</a>`;
  const tenders = parseGenericLinks(html, {
    id: 'giz-india',
    name: 'GIZ India',
    base_url: 'https://www.giz.de/en/worldwide/122734.html'
  });

  assert.equal(tenders.length, 2);
  assert.ok(tenders.every(t => /Evaluation|Baseline/i.test(t.title)));
});

test('GIZ parser delegates to generic evaluation link extraction', () => {
  const tenders = parseGizIndia('<a href="/en/downloads/evaluation.pdf">Evaluation RFP</a>', {
    id: 'giz-india',
    name: 'GIZ India',
    base_url: 'https://www.giz.de/en/worldwide/122734.html'
  });
  assert.equal(tenders[0].source_id, 'giz-india');
});
