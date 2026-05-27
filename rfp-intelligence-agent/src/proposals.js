const { cleanText } = require('./domain');

function generateTemplateProposal({ tender, clientProfile = {} }) {
  const clientName = cleanText(clientProfile.organization_name || 'Client Team');
  const sectors = Array.isArray(clientProfile.sectors) && clientProfile.sectors.length
    ? clientProfile.sectors.join(', ')
    : '[INSERT PRIORITY SECTORS]';
  const needs = [
    'Confirm legal entity name, registration details, and authorized signatory.',
    'Insert relevant project experience and client references.',
    'Add named team members, CV summaries, and availability.',
    'Prepare budget/financial proposal in the required format.'
  ];
  const title = cleanText(tender.title || 'RFP opportunity');
  const organization = cleanText(tender.organization || 'Issuing organization');
  const deadline = cleanText(tender.deadline || 'Deadline not detected');
  const description = cleanText(tender.description_clean || tender.description_raw || 'No detailed RFP text has been extracted yet.');
  const keywords = Array.isArray(tender.keywords_matched) && tender.keywords_matched.length
    ? tender.keywords_matched.join(', ')
    : 'evaluation, research, fieldwork, analysis';
  const deadlineRisk = tender.deadline ? `Submission deadline is ${tender.deadline}.` : 'Submission deadline must be confirmed from the source document.';
  const confidence = description.length > 120 ? 68 : 52;

  const markdown = `# Technical Proposal Draft: ${title}

## Human Review Required

This proposal pack is prepared for ${clientName}. It is a structured first draft and must be reviewed before submission. Do not submit until all placeholders, credentials, team details, financials, and compliance requirements are resolved.

## RFP Summary

- Issuer: ${organization}
- Deadline: ${deadline}
- Detected focus: ${keywords}
- Source scope signal: ${description}

## Go / No-Go Recommendation

Recommendation: **Proceed to human review before bid decision.**

Rationale:

- The opportunity appears aligned with ${sectors}.
- ${deadlineRisk}
- Confirm eligibility, required documents, financial format, and submission channel before final approval.
- If the source document cannot be opened, retrieve it from the source listing and attach it to the opportunity before finalizing.

## Compliance Matrix

| Requirement | Current Status | Owner |
| --- | --- | --- |
| Eligibility criteria | [VERIFY AGAINST RFP] | Proposal Lead |
| Technical proposal format | [VERIFY REQUIRED FORMAT] | Proposal Lead |
| Financial proposal format | [INSERT BUDGET TEMPLATE] | Finance |
| Organization registration documents | [ATTACH VERIFIED DOCUMENTS] | Admin |
| Relevant experience evidence | [INSERT RELEVANT PROJECT EXPERIENCE] | Proposal Lead |
| Team CVs and availability | [INSERT NAMED TEAM] | HR / Project Lead |
| Submission method | [VERIFY EMAIL / PORTAL / HARD COPY] | Bid Manager |

## Executive Summary

${clientName} is pleased to submit this technical proposal to support ${organization} for ${title}. Our proposed approach is utilization-focused: the assignment will not only produce a report, but also generate clear evidence, practical recommendations, and decision-ready insights for program teams and stakeholders.

The assignment will be delivered through a structured evaluation process covering inception, evaluation design, tool development, field planning, data collection, analysis, validation, and reporting. The final methodology and work plan should be aligned with the full Terms of Reference after document review.

## Understanding of the Assignment

Based on the available RFP text, the assignment appears to require evaluation or research support connected to ${sectors}. The likely expectation is to assess program effectiveness, implementation quality, beneficiary outcomes, and actionable learning for future program decisions.

Key interpretation:

- The client requires a credible and independent evidence-generation process.
- The assignment may require mixed-methods research with quantitative and qualitative components.
- The proposal should demonstrate sector understanding, field execution capability, analytical rigor, and concise reporting.
- The final submission must respond exactly to the RFP's requested structure and annexures.

## Technical Methodology

### 1. Inception And Evaluation Framing

- Conduct kickoff with the client team.
- Review program documents, prior reports, logical framework, monitoring data, and implementation plans.
- Prepare an evaluation matrix covering key questions, indicators, data sources, methods, and analysis approach.
- Confirm geography, sample frame, stakeholder categories, and fieldwork constraints.

### 2. Research Design And Tools

- Develop quantitative survey tools where required.
- Develop qualitative guides for interviews, focus groups, case studies, and stakeholder consultations.
- Build sampling strategy and field protocols.
- Pilot tools before full deployment and refine based on learning.

### 3. Data Collection

- Train field investigators and supervisors.
- Implement quality-controlled data collection.
- Maintain daily field monitoring, back-checks, and issue logs.
- Ensure informed consent, respondent privacy, and ethical handling of data.

### 4. Analysis And Synthesis

- Clean and validate datasets.
- Analyze quantitative indicators and qualitative themes.
- Triangulate findings across stakeholder groups and evidence sources.
- Develop practical recommendations linked to evidence.

### 5. Reporting And Validation

- Prepare a findings deck for validation.
- Facilitate feedback with the client team.
- Submit draft report, incorporate comments, and prepare final report.
- Provide annexures, tools, datasets, and documentation as required.

## Work Plan

| Stage | Activities | Output | Timing |
| --- | --- | --- | --- |
| Mobilization | Kickoff, document review, data request | Mobilization note | Week 1 |
| Inception | Evaluation matrix, methodology, sampling plan | Inception report | Week 1-2 |
| Tool Design | Survey tools, interview guides, consent scripts | Final tools | Week 2 |
| Fieldwork | Training, data collection, quality checks | Fieldwork completion note | Week 3-5 |
| Analysis | Data cleaning, coding, triangulation | Findings deck | Week 5-6 |
| Reporting | Draft report, validation, final report | Final report and annexures | Week 6-8 |

## Team Structure

- Project Director: [INSERT NAME, ROLE, AND RELEVANT EXPERIENCE]
- Evaluation Lead: [INSERT NAME, ROLE, AND RELEVANT EXPERIENCE]
- Quantitative Research Lead: [INSERT NAME, ROLE, AND RELEVANT EXPERIENCE]
- Qualitative Research Lead: [INSERT NAME, ROLE, AND RELEVANT EXPERIENCE]
- Field Manager: [INSERT NAME, GEOGRAPHY, AND LANGUAGE CAPACITY]
- Data Analyst: [INSERT NAME AND TOOLS]
- Quality Assurance Reviewer: [INSERT NAME]

## Relevant Experience Mapping

| RFP Requirement | Relevant Experience To Insert | Evidence |
| --- | --- | --- |
| Evaluation / research design | [INSERT RELEVANT PROJECT EXPERIENCE] | Completion certificate / report link |
| Field data collection | [INSERT SIMILAR FIELD ASSIGNMENT] | Client reference |
| Sector familiarity | [INSERT EDUCATION / HEALTH / CSR / LIVELIHOODS EXPERIENCE] | Case summary |
| Reporting and recommendations | [INSERT REPORTING SAMPLE] | Redacted sample |

## Quality Assurance

- Senior review of methodology, tools, and report.
- Enumerator training and field protocols.
- Daily data-quality dashboards during fieldwork.
- Back-checks and spot-checks for sampled interviews.
- Secure data handling and version-controlled analysis files.
- Validation of findings before final submission.

## Ethics And Data Protection

- Obtain informed consent from all respondents.
- Avoid collecting unnecessary personally identifiable information.
- Store data securely and restrict access to the project team.
- Report findings in aggregate unless explicit consent permits attribution.
- Follow child protection, safeguarding, and respondent safety protocols where relevant.

## Assumptions

- The issuer will provide program documents, beneficiary access, and relevant administrative data.
- Fieldwork timelines depend on stakeholder availability and permissions.
- Budget and team composition will be finalized after document review.
- The final methodology may change after reviewing the complete Terms of Reference.

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| Short proposal deadline | Complete eligibility check and proposal skeleton immediately. |
| Missing source document | Retrieve document from the source listing or request it from the issuer before finalizing. |
| Field access constraints | Build contingency days and remote interview options. |
| Low response rates | Use replacement sampling and stakeholder follow-ups. |
| Data quality issues | Use validation checks, supervisor review, and back-checks. |

## Clarification Questions

- What is the expected sample size and geography?
- Are tools or indicators already defined?
- Is there a preferred methodology or evaluation framework?
- What format is required for the financial proposal?
- Are there mandatory forms, declarations, or registration documents?
- Should the final report include datasets, transcripts, dashboards, or presentation decks?

## Cover Email

Subject: Proposal submission for ${title}

Dear Procurement / Evaluation Committee,

Please find attached the technical and financial proposal from ${clientName} for ${title}. We appreciate the opportunity to submit our response and remain available for any clarification required.

Regards,  
[INSERT SENDER NAME]  
${clientName}

## Submission Checklist

- [ ] Technical proposal finalized
- [ ] Financial proposal finalized
- [ ] Organization profile attached
- [ ] Relevant experience attached
- [ ] Team CVs attached
- [ ] Registration/tax documents attached
- [ ] Required forms signed
- [ ] Submission email/portal checked
- [ ] Source document and addenda reviewed
- [ ] Eligibility confirmed
- [ ] Final human approval received
`;

  return {
    tender_id: tender.id,
    title: `Proposal Draft - ${title}`,
    markdown,
    cover_email: markdown.split('## Cover Email')[1].split('## Submission Checklist')[0].trim(),
    checklist_markdown: markdown.split('## Submission Checklist')[1].trim(),
    needs_human_input: needs,
    confidence_score: confidence
  };
}

module.exports = { generateTemplateProposal };
