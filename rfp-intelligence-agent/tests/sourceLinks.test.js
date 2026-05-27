const assert = require('node:assert/strict');
const test = require('node:test');
const { openableSourceUrl, sourceLinkType } = require('../src/sourceLinks');

test('uses detail URL when it is a normal http URL', () => {
  assert.equal(
    openableSourceUrl({ detail_url: 'https://ngobox.org/full_rfp_eoi_123', source_url: 'https://ngobox.org/rfp_eoi_listing.php' }),
    'https://ngobox.org/full_rfp_eoi_123'
  );
});

test('falls back to source listing for javascript postback links', () => {
  assert.equal(
    openableSourceUrl({
      detail_url: "javascript:__doPostBack('x','')",
      source_url: 'https://www.devnetjobsindia.org/rfp_assignments.aspx'
    }),
    'https://www.devnetjobsindia.org/rfp_assignments.aspx'
  );
});

test('labels source URL fallback as listing when detail and source URL are the same', () => {
  assert.equal(
    sourceLinkType({
      detail_url: 'https://www.devnetjobsindia.org/rfp_assignments.aspx',
      source_url: 'https://www.devnetjobsindia.org/rfp_assignments.aspx'
    }),
    'listing'
  );
});
