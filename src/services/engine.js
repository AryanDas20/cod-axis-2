const allowedCategories = ['Tone & Voice', 'Terminology', 'Facts & Freshness', 'Promotional Claims', 'Visual Consistency', 'Accessibility'];
const allowedSeverity = ['high', 'medium', 'low'];
const allowedEvidence = ['supported', 'unsupported', 'expired_source', 'conflict'];
const allowedStatus = ['open', 'accepted', 'edited', 'dismissed', 'resolved'];

const escapeRegExp = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const now = () => new Date().toISOString();
const id = () => `fnd_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;

export function runDeterministicPreflight(text, channel = 'website', knowledgeItems = [], reviewId = 'review-temp', workspaceId = 'local-workspace') {
  const started = performance.now();
  const source = typeof text === 'string' ? text.slice(0, 50000) : '';
  const items = Array.isArray(knowledgeItems) ? knowledgeItems.filter(k => k && k.status === 'active') : [];
  const activeItems = items.filter(k => !k.expiresAt || new Date(k.expiresAt).getTime() >= Date.now());
  const findings = [];
  const seen = new Set();

  function add(category, severity, excerpt, rationale, evidenceStatus, evidenceIds, sourceName, sourceText, suggestedRevision, ruleId) {
    const exact = String(excerpt || '').trim().slice(0, 500);
    if (!exact) return;
    const key = `${category}:${exact.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    const validIds = [...new Set((evidenceIds || []).filter(itemId => activeItems.some(item => item.id === itemId)))];
    const supported = validIds.length > 0 && evidenceStatus === 'supported';
    findings.push({
      id: id(), reviewId, workspaceId, category, severity, excerpt: exact,
      ruleId, rationale: String(rationale || 'This content needs a human review.'),
      evidenceStatus: supported ? 'supported' : evidenceStatus === 'expired_source' ? 'expired_source' : evidenceStatus === 'conflict' ? 'conflict' : 'unsupported',
      evidenceIds: validIds,
      evidenceSourceName: supported ? (sourceName || 'Approved knowledge base') : 'No approved evidence found',
      evidenceSourceText: supported ? (sourceText || '') : 'No active approved knowledge item supports this statement.',
      suggestedRevision: String(suggestedRevision || ''), confidence: 0.86, status: 'open', createdAt: now()
    });
  }

  const termItems = activeItems.filter(k => k.type === 'glossary');
  for (const item of termItems) {
    const prohibited = Array.isArray(item.prohibitedTerms) ? item.prohibitedTerms : [];
    for (const term of prohibited) {
      if (!term || !new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i').test(source)) continue;
      const preferred = item.preferredTerm || 'the approved preferred term';
      add('Terminology', 'medium', term,
        `The approved glossary marks “${term}” as a term to avoid. Use “${preferred}” to keep product language consistent.`,
        'supported', [item.id], item.sourceName || item.title, item.sourceText || item.body,
        preferred, 'glossary-prohibited-term');
    }
  }

  const absoluteRules = [
    { regex: /\b(?:100\s*%|one hundred percent)\s*(?:guaranteed|results?|safe|secure|effective)?\b/ig, revision: 'a measurable result supported by an approved source' },
    { regex: /\bguarantee(?:d|s)?\b/ig, revision: 'is designed to help' },
    { regex: /\b(?:#1|number one|world'?s best|best[- ]in[- ]class|industry[- ]leading|market[- ]leading)\b/ig, revision: 'a specific, verifiable product benefit' },
    { regex: /\b(?:always|never|everyone|no one|zero risk|completely secure|scam[- ]free)\b/ig, revision: 'a qualified statement supported by current approved evidence' }
  ];
  for (const rule of absoluteRules) {
    const matches = [...source.matchAll(rule.regex)];
    if (!matches.length) continue;
    const match = matches[0];
    const activeTone = activeItems.filter(k => ['tone', 'guideline'].includes(k.type));
    const supporting = activeTone.filter(k => /absolute|guarantee|claim|promise|universal/i.test(`${k.title} ${k.body} ${k.sourceText || ''}`));
    add('Promotional Claims', 'high', match[0],
      'This wording may imply a universal promise, guaranteed result or market-leading position. Such claims need specific, current evidence before publication.',
      supporting.length ? 'supported' : 'unsupported', supporting.map(k => k.id), supporting.map(k => k.sourceName || k.title).join(' · '), supporting.map(k => k.sourceText || k.body).join(' | '), rule.revision, 'absolute-promotional-claim');
  }

  const numbers = [...source.matchAll(/\b\d+(?:\.\d+)?\s*(?:%|percent|customers|users|hours|days|weeks|months|years)\b/gi)];
  for (const match of numbers.slice(0, 3)) {
    const found = activeItems.filter(k => `${k.title} ${k.body} ${k.sourceText || ''}`.toLowerCase().includes(match[0].toLowerCase()));
    if (found.length) continue;
    add('Facts & Freshness', 'medium', match[0],
      'A numeric fact or performance statement appears in the draft, but no matching active approved source was found. Confirm the value and record its source.',
      'unsupported', [], 'No approved evidence found', 'No active approved knowledge item supports this number.',
      'Remove the number or replace it with a verified value from the brand knowledge library.', 'numeric-claim-no-source');
  }

  const expiredItems = (Array.isArray(knowledgeItems) ? knowledgeItems : []).filter(k => k?.expiresAt && new Date(k.expiresAt).getTime() < Date.now() && k.status !== 'archived');
  for (const item of expiredItems) {
    const tokens = String(item.title || '').toLowerCase().split(/\s+/).filter(w => w.length > 4);
    if (tokens.some(token => source.toLowerCase().includes(token))) {
      add('Facts & Freshness', 'medium', item.title,
        `The knowledge item “${item.title}” has passed its validity date. Verify it with its source owner before publication.`,
        'expired_source', [], item.sourceName || item.title, item.sourceText || item.body,
        'Confirm the current information and update the source validity date.', 'expired-knowledge-source');
    }
  }

  const tone = activeItems.find(k => k.type === 'tone');
  const exclamations = (source.match(/!/g) || []).length;
  if (exclamations >= 3) {
    const excerpt = source.split(/(?<=[.!?])\s+/).find(sentence => (sentence.match(/!/g) || []).length >= 2) || source.slice(0, 120);
    add('Tone & Voice', 'low', excerpt,
      'The draft uses several exclamation marks. Check whether this matches the approved voice, which should remain clear and confident.',
      tone ? 'supported' : 'unsupported', tone ? [tone.id] : [], tone?.sourceName || '', tone?.sourceText || tone?.body || '',
      'Reduce emphasis and let the benefit carry the message.', 'tone-exclamation-overuse');
  }
  const caps = source.match(/\b[A-Z]{4,}\b/g) || [];
  if (caps.length >= 2) {
    add('Tone & Voice', 'low', caps.slice(0, 3).join(', '),
      'Several words are written in all capitals. Check whether this is intentional and consistent with the approved voice.',
      tone ? 'supported' : 'unsupported', tone ? [tone.id] : [], tone?.sourceName || '', tone?.sourceText || tone?.body || '',
      'Use normal sentence case except for approved acronyms.', 'tone-all-caps');
  }

  const longSentence = source.split(/(?<=[.!?])\s+/).find(sentence => sentence.trim().split(/\s+/).length > 36);
  if (longSentence) {
    add('Accessibility', 'low', longSentence.slice(0, 180),
      'This sentence is longer than 36 words. Shorter sentences are often easier to scan and understand. This is a readability heuristic, not a formal accessibility test.',
      'unsupported', [], '', '', 'Split the sentence into two or more shorter statements.', 'accessibility-long-sentence');
  }
  const vagueLink = source.match(/\b(?:click here|read more here|learn more here)\b/i);
  if (vagueLink) {
    add('Accessibility', 'low', vagueLink[0],
      'Generic link wording does not explain the destination to people using screen readers or scanning links out of context.',
      'unsupported', [], '', '', 'Use a descriptive link label that explains the destination.', 'accessibility-vague-link');
  }

  const elapsed = Math.max(0, Math.round(performance.now() - started));
  return { findings, executionTimeMs: elapsed, channel };
}

export function validateAiFindings(parsed, text, knowledgeItems, reviewId, workspaceId) {
  if (!Array.isArray(parsed)) return [];
  const approved = new Map((Array.isArray(knowledgeItems) ? knowledgeItems : []).filter(k => k?.status === 'active' && (!k.expiresAt || new Date(k.expiresAt).getTime() >= Date.now())).map(k => [k.id,k]));
  const out = [];
  for (const [index, item] of parsed.entries()) {
    if (!item || typeof item !== 'object') continue;
    const excerpt = typeof item.excerpt === 'string' ? item.excerpt.trim() : '';
    if (!excerpt || !text.includes(excerpt)) continue;
    const category = allowedCategories.includes(item.category) ? item.category : 'Promotional Claims';
    const severity = allowedSeverity.includes(item.severity) ? item.severity : 'medium';
    const ids = Array.isArray(item.evidenceIds) ? [...new Set(item.evidenceIds.filter(id => approved.has(id)))] : [];
    const evidenceStatus = ids.length && item.evidenceStatus === 'supported' ? 'supported' : (item.evidenceStatus === 'conflict' && ids.length ? 'conflict' : 'unsupported');
    const sources = ids.map(id => approved.get(id));
    out.push({
      id: `fnd-ai-${Date.now().toString(36)}-${index}`, reviewId, workspaceId, category, severity,
      excerpt, ruleId: 'ai-source-grounded',
      rationale: String(item.rationale || 'Flagged during source-grounded review.').slice(0,1000),
      evidenceStatus, evidenceIds: evidenceStatus === 'supported' || evidenceStatus === 'conflict' ? ids : [],
      evidenceSourceName: sources.length ? sources.map(k => k.sourceName || k.title).join(' · ') : 'No approved evidence found',
      evidenceSourceText: sources.length ? String(item.evidenceSourceText || sources.map(k => k.sourceText || k.body || '').join(' | ')).slice(0,2000) : 'No active approved knowledge item supports this statement.',
      suggestedRevision: String(item.suggestedRevision || '').slice(0,2000),
      confidence: typeof item.confidence === 'number' ? Math.max(0,Math.min(1,item.confidence)) : 0.8,
      status: 'open', createdAt: now()
    });
  }
  return out;
}
