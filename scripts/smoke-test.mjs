import assert from 'node:assert/strict';
import fs from 'node:fs';
import { runDeterministicPreflight, validateAiFindings } from '../src/services/engine.js';

const knowledge = [
  { id:'g1', type:'glossary', title:'Product language', body:'Use workspace, not portal.', preferredTerm:'workspace', prohibitedTerms:['portal'], sourceName:'Messaging guide', sourceText:'Preferred: workspace. Avoid: portal.', status:'active' },
  { id:'t1', type:'tone', title:'Voice rules', body:'Avoid universal promises and guarantees.', sourceName:'Voice guide', sourceText:'Do not make guarantees.', status:'active' },
  { id:'f1', type:'fact', title:'Founding year', body:'Founded in 2018.', sourceName:'Fact sheet', sourceText:'Founded in 2018.', status:'active' }
];
const draft = 'Welcome to our portal. We are the #1 platform and guarantee 100% results for every customer. Founded in 2018. Click here!';
const result = runDeterministicPreflight(draft, 'website', knowledge, 'review-test', 'workspace-test');
assert.ok(result.findings.some(f => f.category === 'Terminology' && f.evidenceIds.includes('g1')),'prohibited glossary term should cite the approved glossary');
assert.ok(result.findings.some(f => f.category === 'Promotional Claims' && f.severity === 'high'),'unsupported universal claim should be high risk');
assert.ok(result.findings.some(f => f.category === 'Accessibility'),'generic link wording should be flagged');
assert.ok(result.findings.every(f => f.status === 'open'),'new findings should be open');

const forged = validateAiFindings([{ category:'Promotional Claims', severity:'high', excerpt:'Founded in 2018', evidenceStatus:'supported', evidenceIds:['made-up-id'], rationale:'Test', suggestedRevision:'Updated' }], draft, knowledge, 'review-test', 'workspace-test');
assert.equal(forged.length,1,'an exact excerpt should be retained');
assert.equal(forged[0].evidenceStatus,'unsupported','unapproved evidence IDs must not be accepted');
assert.deepEqual(forged[0].evidenceIds,[],'unapproved evidence IDs must be stripped');
assert.equal(forged[0].evidenceSourceName,'No approved evidence found');

for (const path of ['index.html','styles.css','app.js','firebase-client.js','server.mjs','firestore.rules','storage.rules','public/BrandLens-Product-Guide.pdf']) {
  assert.ok(fs.existsSync(new URL(`../${path}`, import.meta.url)),`missing project file: ${path}`);
}
console.log(`Smoke test passed: ${result.findings.length} deterministic findings; AI evidence validation and build file checks passed.`);
