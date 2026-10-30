import { firebaseReady, firebaseStatus, getAuthInstance, getDbInstance, getFirebaseSdk } from './firebase-client.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const STORE = 'brandlens.workspace.v2';
const THEME_KEY = 'brandlens.theme';
const MAX_TEXT = 50000;
const ROLES = ['admin', 'brand_manager', 'specialist_reviewer', 'creator', 'publish_owner'];
const ROLE_LABELS = { admin: 'Administrator', brand_manager: 'Brand manager', specialist_reviewer: 'Specialist reviewer', creator: 'Creator', publish_owner: 'Publish owner' };
const CHANNELS = ['website', 'social', 'email', 'paid_campaign', 'product_page', 'other'];
const CHANNEL_LABELS = { website: 'Website', social: 'Social media', email: 'Email', paid_campaign: 'Paid campaign', product_page: 'Product page', other: 'Other' };
const STATUS_LABELS = { draft: 'Draft', in_review: 'In review', changes_requested: 'Changes requested', approved: 'Approved', published: 'Published' };
const CATEGORY_ICONS = { 'Tone & Voice': '◌', 'Terminology': 'Aa', 'Facts & Freshness': '⌁', 'Promotional Claims': '✳', 'Visual Consistency': '▧', 'Accessibility': '◉' };

const nowIso = () => new Date().toISOString();
const newId = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const esc = (value = '') => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shortDate = value => value ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(value)) : '—';
const dateTime = value => value ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value)) : '—';
const relative = value => {
  if (!value) return 'Just now';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};
const humanize = value => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());

function seedData() {
  const createdAt = new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString();
  const knowledge = [
    { id: 'kb_fact_1', type: 'fact', title: 'Company founding year', body: 'Northstar Studio was founded in 2018. Use the founding year only when relevant.', sourceName: 'Corporate fact sheet', sourceText: 'Founded in 2018', status: 'active', version: '1.0', createdAt, updatedAt: createdAt },
    { id: 'kb_fact_2', type: 'fact', title: 'Customer support hours', body: 'Customer support is available Monday to Friday, 9:00 AM to 6:00 PM IST.', sourceName: 'Support policy', sourceText: 'Monday to Friday, 9:00 AM to 6:00 PM IST', status: 'active', version: '1.2', createdAt, updatedAt: createdAt },
    { id: 'kb_glossary_1', type: 'glossary', title: 'Preferred product terminology', body: 'Use “workspace” instead of “portal” when referring to the product environment.', preferredTerm: 'workspace', prohibitedTerms: ['portal'], sourceName: 'Messaging guide', sourceText: 'Preferred term: workspace. Avoid: portal.', status: 'active', version: '2.0', createdAt, updatedAt: createdAt },
    { id: 'kb_tone_1', type: 'tone', title: 'Voice and tone', body: 'Sound clear, helpful, calm and confident. Avoid hype, fear-based language, excessive exclamation marks and absolute promises.', sourceName: 'Brand voice guide', sourceText: 'Clear, helpful, calm and confident. Do not make absolute promises.', status: 'active', version: '1.3', createdAt, updatedAt: createdAt },
    { id: 'kb_guide_1', type: 'guideline', title: 'Evidence before promotion', body: 'Product performance, rankings, customer outcomes and comparative claims must be supported by an active approved source before publication.', sourceName: 'Claims policy', sourceText: 'Claims about performance, rankings or outcomes require an active approved source.', status: 'active', version: '1.0', createdAt, updatedAt: createdAt }
  ];
  const reviews = [
    { id: 'rev_website_launch', title: 'Website launch announcement', channel: 'website', status: 'in_review', createdBy: 'demo_creator', createdByName: 'Alex Morgan', assignedTo: 'demo_manager', originalText: 'Welcome to our portal! Northstar Studio was founded in 2018. We are the #1 platform and guarantee 100% results for every team. Our support team is available Monday to Friday, 9:00 AM to 6:00 PM IST.', currentText: 'Welcome to our portal! Northstar Studio was founded in 2018. We are the #1 platform and guarantee 100% results for every team. Our support team is available Monday to Friday, 9:00 AM to 6:00 PM IST.', contentVersion: 1, riskLevel: 'high', createdAt, updatedAt: nowIso(), findings: [
      { id: 'fnd_seed_1', category: 'Terminology', severity: 'medium', excerpt: 'portal', rationale: 'The approved glossary asks writers to use “workspace” for the product environment. “Portal” is listed as a prohibited alternative.', evidenceStatus: 'supported', evidenceIds: ['kb_glossary_1'], evidenceSourceName: 'Messaging guide', evidenceSourceText: 'Preferred term: workspace. Avoid: portal.', suggestedRevision: 'workspace', confidence: .98, status: 'open', createdAt },
      { id: 'fnd_seed_2', category: 'Promotional Claims', severity: 'high', excerpt: '#1 platform', rationale: 'A market-leading ranking is a comparative claim. The approved knowledge base does not contain a ranking source for this statement.', evidenceStatus: 'unsupported', evidenceIds: [], evidenceSourceName: 'No approved evidence found', evidenceSourceText: 'No approved source in this workspace supports a #1 ranking.', suggestedRevision: 'a platform designed to help teams work with greater consistency', confidence: .96, status: 'open', createdAt },
      { id: 'fnd_seed_3', category: 'Promotional Claims', severity: 'high', excerpt: 'guarantee 100% results', rationale: 'The sentence promises a universal outcome. The approved voice and claims guidance prohibits absolute promises.', evidenceStatus: 'supported', evidenceIds: ['kb_tone_1', 'kb_guide_1'], evidenceSourceName: 'Brand voice guide · Claims policy', evidenceSourceText: 'Do not make absolute promises. Claims about outcomes require an active approved source.', suggestedRevision: 'help teams improve consistency with a repeatable review process', confidence: .97, status: 'open', createdAt }
    ], comments: [], versions: [], fileMetadata: null },
    { id: 'rev_social_spring', title: 'Spring campaign social copy', channel: 'social', status: 'approved', createdBy: 'demo_creator', createdByName: 'Alex Morgan', assignedTo: 'demo_manager', originalText: 'Make your next launch clearer with Northstar Studio. A calmer, more consistent way to work with your team.', currentText: 'Make your next launch clearer with Northstar Studio. A calmer, more consistent way to work with your team.', contentVersion: 2, riskLevel: 'low', createdAt: new Date(Date.now() - 86400000 * 3).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString(), findings: [], comments: [], versions: [], fileMetadata: null },
    { id: 'rev_email_update', title: 'Customer support hours update', channel: 'email', status: 'changes_requested', createdBy: 'demo_creator', createdByName: 'Alex Morgan', assignedTo: 'demo_reviewer', originalText: 'Our support team is available every day, around the clock. Contact us whenever you need us.', currentText: 'Our support team is available every day, around the clock. Contact us whenever you need us.', contentVersion: 1, riskLevel: 'medium', createdAt: new Date(Date.now() - 86400000 * 5).toISOString(), updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(), findings: [{ id: 'fnd_seed_4', category: 'Facts & Freshness', severity: 'high', excerpt: 'every day, around the clock', rationale: 'This statement conflicts with the approved support-hours policy.', evidenceStatus: 'conflict', evidenceIds: ['kb_fact_2'], evidenceSourceName: 'Support policy', evidenceSourceText: 'Monday to Friday, 9:00 AM to 6:00 PM IST', suggestedRevision: 'Monday to Friday, 9:00 AM to 6:00 PM IST', confidence: .99, status: 'open', createdAt }], comments: [], versions: [], fileMetadata: null }
  ];
  return {
    workspace: { id: 'northstar-demo', name: 'Northstar Demo', createdAt },
    knowledge, reviews,
    assets: [{ id: 'asset_logo', name: 'Northstar wordmark', kind: 'logo', description: 'Approved horizontal logo placeholder for the demo workspace.', color: '#5368bf', mimeType: 'image/svg+xml', width: 640, height: 180, createdAt }],
    members: [
      { uid: 'demo_creator', displayName: 'Alex Morgan', email: 'alex@northstar.example', role: 'creator', status: 'active', joinedAt: createdAt },
      { uid: 'demo_manager', displayName: 'Jamie Lee', email: 'jamie@northstar.example', role: 'brand_manager', status: 'active', joinedAt: createdAt },
      { uid: 'demo_reviewer', displayName: 'Taylor Kim', email: 'taylor@northstar.example', role: 'specialist_reviewer', status: 'active', joinedAt: createdAt },
      { uid: 'demo_publisher', displayName: 'Morgan Reed', email: 'morgan@northstar.example', role: 'publish_owner', status: 'active', joinedAt: createdAt }
    ],
    audit: [
      { id: 'audit_1', action: 'Knowledge item added', actorName: 'Jamie Lee', actorRole: 'Brand manager', reason: 'Added approved support policy.', createdAt: new Date(Date.now() - 86400000).toISOString() },
      { id: 'audit_2', action: 'Review submitted', actorName: 'Alex Morgan', actorRole: 'Creator', reason: 'Spring campaign social copy submitted for review.', createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
      { id: 'audit_3', action: 'Review approved', actorName: 'Jamie Lee', actorRole: 'Brand manager', reason: 'All open findings resolved.', createdAt: new Date(Date.now() - 86400000 * 3).toISOString() }
    ],
    notifications: [
      { id: 'not_1', title: 'Review waiting for input', text: 'Website launch announcement has 3 open findings.', createdAt: nowIso(), read: false },
      { id: 'not_2', title: 'Knowledge source expiring soon', text: 'Review source validity dates in Brand knowledge.', createdAt: new Date(Date.now() - 86400000).toISOString(), read: true }
    ]
  };
}

function safeLoad() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (stored && Array.isArray(stored.reviews) && Array.isArray(stored.knowledge)) {
      // Older builds cached cloud workspace records locally. Never reveal those cached records in guest mode.
      if (String(stored.workspace?.id || '').startsWith('ws_')) { localStorage.removeItem(STORE); return seedData(); }
      return stored;
    }
  } catch (error) { console.warn('Stored workspace could not be read; loading sample workspace.', error); }
  const data = seedData();
  localStorage.setItem(STORE, JSON.stringify(data));
  return data;
}

const data = safeLoad();
const storedTheme = localStorage.getItem(THEME_KEY);
const state = {
  ...data,
  currentView: 'overview',
  activeReviewId: null,
  currentUser: { uid: null, name: 'Guest user', email: '', photoURL: '', isGuest: true, role: 'creator' },
  cloud: { active: false, workspaceId: null, loading: false, error: null },
  theme: storedTheme || 'light',
  searchTerm: '',
  searchOpen: false,
  reviewFilter: 'all',
  knowledgeFilter: 'all',
  lastFindings: [],
  lastEngineMode: 'Local rules ready',
  tourIndex: -1,
  tourTarget: null,
  accountMenuOpen: false,
  selectedUpload: null,
  reviewBusy: false
};

function persist() {
  // Cloud workspace records stay in Firestore and in memory; do not mirror confidential
  // drafts, knowledge or team records into browser localStorage.
  if (!state.cloud.active) {
    const copy = { workspace: state.workspace, knowledge: state.knowledge, reviews: state.reviews, assets: state.assets, members: state.members, audit: state.audit.slice(-300), notifications: state.notifications };
    try { localStorage.setItem(STORE, JSON.stringify(copy)); }
    catch (error) { notify('Your browser storage is full. Remove large local image previews or export your workspace.', 'error'); }
  }
  updateNavCounts();
}

function currentRole() { return state.currentUser.isGuest ? 'creator' : (state.currentUser.role || 'creator'); }
function roleName(role = currentRole()) { return ROLE_LABELS[role] || 'Guest'; }
function isPrivileged() { return ['admin', 'brand_manager'].includes(currentRole()); }
function canReview() { return !state.currentUser.isGuest && ['admin', 'brand_manager', 'specialist_reviewer'].includes(currentRole()); }
function canApprove(review) {
  if (state.currentUser.isGuest) return false;
  if (!['admin', 'brand_manager'].includes(currentRole())) return false;
  const openHigh = (review.findings || []).some(f => f.severity === 'high' && f.status === 'open');
  if (openHigh) return false;
  // A creator cannot approve their own review, even when no high-risk finding remains.
  if (review.createdBy === state.currentUser.uid) return false;
  return true;
}
function canPublish() { return !state.currentUser.isGuest && ['admin', 'brand_manager', 'publish_owner'].includes(currentRole()); }
function canEditKnowledge() { return !state.currentUser.isGuest && ['admin', 'brand_manager'].includes(currentRole()); }
function userDisplayName() { return state.currentUser.isGuest ? 'Guest user' : (state.currentUser.name || state.currentUser.email || 'Member'); }

function audit(action, reason = '', reviewId = null, metadata = {}) {
  const event = { id: newId('audit'), action, actorUid: state.currentUser.uid || 'guest', actorName: userDisplayName(), actorRole: state.currentUser.isGuest ? 'Guest' : roleName(), reason, reviewId, metadata, createdAt: nowIso() };
  state.audit.unshift(event);
  persist();
  if (state.cloud.active) cloudAddAudit(event);
}

function notify(message, type = 'success') {
  const region = $('#toast-region');
  if (!region) return;
  const node = document.createElement('div');
  node.className = `toast ${type === 'error' ? 'error' : ''}`;
  node.innerHTML = `<span class="toast-check">${type === 'error' ? '!' : '✓'}</span><span>${esc(message)}</span>`;
  region.append(node);
  setTimeout(() => node.remove(), 3800);
}

function updateNavCounts() {
  const reviewCount = $('#review-nav-count');
  const approvalsCount = $('#approval-nav-count');
  if (reviewCount) reviewCount.textContent = state.reviews.length;
  if (approvalsCount) approvalsCount.textContent = state.reviews.filter(r => ['in_review', 'changes_requested'].includes(r.status)).length;
}

function applyTheme() {
  document.documentElement.dataset.theme = state.theme;
  localStorage.setItem(THEME_KEY, state.theme);
  $('#theme-icon').textContent = state.theme === 'dark' ? '☀' : '☾';
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = state.theme === 'dark' ? '#111720' : '#f5f6f8';
}

function setUserChrome() {
  const name = userDisplayName();
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || 'G';
  $('#sidebar-user-name').textContent = name;
  $('#sidebar-user-role').textContent = state.currentUser.isGuest ? 'Guest · local workspace' : `${roleName()} · ${state.cloud.active ? 'cloud workspace' : 'account'}`;
  $('#user-avatar').textContent = initials;
  $('#top-user-avatar').textContent = initials;
  $('#top-user-name').textContent = name;
  $('#workspace-name').textContent = state.workspace?.name || 'My workspace';
  $('#workspace-subtitle').textContent = state.currentUser.isGuest ? 'Demo workspace' : (state.cloud.active ? 'Cloud workspace' : 'Local workspace');
  $('#workspace-switcher .workspace-avatar').textContent = (state.workspace?.name || 'W').slice(0, 1).toUpperCase();
}

const VIEW_LABELS = { overview: 'Overview', 'new-review': 'New review', reviews: 'Review library', 'review-detail': 'Review details', knowledge: 'Brand knowledge', assets: 'Asset library', approvals: 'Approval queue', insights: 'Insights', audit: 'Audit trail', team: 'Team & roles', settings: 'Settings' };
function setView(view, options = {}) {
  if (!VIEW_LABELS[view]) view = 'overview';
  state.currentView = view;
  state.searchOpen = false;
  $('.search-popover')?.classList.add('hidden');
  $('#global-search').value = '';
  $('#global-search').blur();
  $$('.nav-item[data-view]').forEach(button => button.classList.toggle('active', button.dataset.view === view || (view === 'review-detail' && button.dataset.view === 'reviews')));
  $('#breadcrumb-current').textContent = VIEW_LABELS[view];
  $('#sidebar').classList.remove('mobile-open');
  renderPage();
  if (!options.keepScroll) window.scrollTo({ top: 0, behavior: 'smooth' });
}

function pageHeading(eyebrow, title, description, actions = '') {
  return `<div class="page-heading"><div><div class="eyebrow">${esc(eyebrow)}</div><h1>${title}</h1><p>${description}</p></div><div class="heading-actions">${actions}</div></div>`;
}
function statusPill(status) { return `<span class="status-pill status-${esc(status)}">${esc(STATUS_LABELS[status] || humanize(status))}</span>`; }
function severityPill(severity) { return `<span class="severity-pill severity-${esc(severity)}">${esc(severity)} risk</span>`; }
function evidencePill(status) { return `<span class="evidence-pill evidence-${esc(status)}">${esc(humanize(status))}</span>`; }
function userInitials(name) { return String(name || 'U').split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase(); }
function openReview(id) { state.activeReviewId = id; setView('review-detail'); }
function sortedReviews() { return [...state.reviews].sort((a,b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)); }
function allFindings() { return state.reviews.flatMap(r => (r.findings || []).map(f => ({ ...f, reviewTitle: r.title, reviewId: r.id }))); }
function readiness() {
  const total = allFindings();
  const highOpen = total.filter(f => f.severity === 'high' && f.status === 'open').length;
  const open = total.filter(f => f.status === 'open').length;
  const expired = state.knowledge.filter(k => k.expiresAt && new Date(k.expiresAt) < new Date() && k.status !== 'archived').length;
  return Math.max(0, Math.min(100, 100 - highOpen * 12 - Math.max(0, open - highOpen) * 4 - expired * 6));
}

function renderPage() {
  setUserChrome();
  const page = $('#page-wrap');
  if (!page) return;
  const views = {
    overview: renderOverview,
    'new-review': renderNewReview,
    reviews: renderReviews,
    'review-detail': renderReviewDetail,
    knowledge: renderKnowledge,
    assets: renderAssets,
    approvals: renderApprovals,
    insights: renderInsights,
    audit: renderAudit,
    team: renderTeam,
    settings: renderSettings
  };
  page.innerHTML = (views[state.currentView] || renderOverview)();
  updateNavCounts();
  if (state.tourIndex >= 0) highlightTourTarget();
}

function renderOverview() {
  const reviews = sortedReviews();
  const findings = allFindings();
  const open = findings.filter(f => f.status === 'open').length;
  const high = findings.filter(f => f.severity === 'high' && f.status === 'open').length;
  const pending = state.reviews.filter(r => ['in_review','changes_requested'].includes(r.status)).length;
  const score = readiness();
  const latest = reviews.slice(0, 4);
  const actions = `<button class="btn btn-secondary" data-action="start-tour">Take a tour <span>↗</span></button><button class="btn btn-primary" data-view="new-review">＋ New review</button>`;
  return `${pageHeading('YOUR BRAND CONTROL CENTRE',`Good ${greeting()}, ${esc(userDisplayName().split(' ')[0])}.`,'Every piece of content deserves a second look before it goes live.',actions)}
    <div class="grid stats-grid">
      <article class="card stat-card"><div class="stat-top"><span>Total reviews</span><span class="stat-icon purple">▤</span></div><div class="stat-value">${state.reviews.length}</div><div class="stat-foot"><span class="positive">${pending} active</span> across your workspace</div></article>
      <article class="card stat-card"><div class="stat-top"><span>Open findings</span><span class="stat-icon coral">✳</span></div><div class="stat-value">${open}</div><div class="stat-foot">${high} high-risk items need attention</div></article>
      <article class="card stat-card"><div class="stat-top"><span>Knowledge sources</span><span class="stat-icon green">◈</span></div><div class="stat-value">${state.knowledge.filter(k => k.status === 'active').length}</div><div class="stat-foot">Approved facts, rules & terminology</div></article>
      <article class="card stat-card"><div class="stat-top"><span>Brand readiness</span><span class="stat-icon amber">⌁</span></div><div class="stat-value">${score}<small style="font-size:12px;color:var(--muted)">/100</small></div><div class="stat-foot">Calculated from current open findings</div></article>
    </div>
    <div class="grid dashboard-grid">
      <article class="card hero-panel" id="overview-hero"><div class="hero-content"><span class="hero-kicker"><i></i> EVIDENCE-FIRST GOVERNANCE</span><h2>Keep every message true to your brand.</h2><p>Review copy against approved facts, terminology and tone rules. Understand why something was flagged, make the call, and keep a clear approval trail.</p><div class="hero-actions"><button class="btn btn-primary" data-view="new-review">Start a content review <span>→</span></button><button class="btn btn-quiet" data-view="knowledge">Manage brand knowledge</button></div></div><div class="hero-graphic"><span></span><b></b></div></article>
      <article class="card panel" id="overview-quick-actions"><div class="panel-head"><div><h2>Quick actions</h2><p>Jump straight into your workflow</p></div></div><div class="quick-actions"><button class="quick-action" data-view="new-review"><span class="qa-icon">＋</span><strong>Review content</strong><small>Check a new draft</small></button><button class="quick-action" data-view="knowledge"><span class="qa-icon">◈</span><strong>Add a brand rule</strong><small>Keep guidance current</small></button><button class="quick-action" data-view="approvals"><span class="qa-icon">✓</span><strong>Review approvals</strong><small>Move work forward</small></button><button class="quick-action" data-view="insights"><span class="qa-icon">⌁</span><strong>Explore insights</strong><small>Spot repeated issues</small></button></div></article>
    </div>
    <div class="grid dashboard-lower">
      <article class="card table-card" id="overview-recent-reviews"><div class="panel" style="padding-bottom:4px"><div class="panel-head"><div><h2>Recent reviews</h2><p>Latest content moving through governance</p></div><button class="link-button" data-view="reviews">View all reviews →</button></div></div>${latest.length ? `<div class="table-wrap"><table><thead><tr><th>Content</th><th>Channel</th><th>Status</th><th>Updated</th></tr></thead><tbody>${latest.map(r => `<tr class="clickable-row" data-open-review="${esc(r.id)}"><td><div class="table-title">${esc(r.title)}</div><div class="table-sub">by ${esc(r.createdByName || 'Workspace member')}</div></td><td>${esc(CHANNEL_LABELS[r.channel] || 'Other')}</td><td>${statusPill(r.status)}</td><td>${relative(r.updatedAt || r.createdAt)}</td></tr>`).join('')}</tbody></table></div>` : emptyState('No reviews yet','Your next review will appear here.','new-review','Create your first review')}</article>
      <div class="grid" style="gap:16px">
        <article class="card readiness-card" id="overview-readiness"><div class="panel-head"><div><h2>Brand readiness</h2><p>Live workspace health snapshot</p></div><button class="link-button" data-view="insights">Details</button></div><div class="readiness-wrap"><div class="readiness-ring" style="--score:${score * 3.6}deg"><strong>${score}</strong><small>out of 100</small></div><div class="readiness-copy"><strong>${score >= 85 ? 'Looking consistent' : score >= 65 ? 'A few things to improve' : 'Needs attention'}</strong><p>This score responds to open findings and expired knowledge sources. It is a working indicator, not a compliance certification.</p></div></div><div class="mini-list"><div class="mini-list-row"><i class="dot" style="background:var(--coral)"></i><span>High-risk open findings</span><b>${high}</b></div><div class="mini-list-row"><i class="dot" style="background:var(--amber)"></i><span>Other open findings</span><b>${Math.max(0, open - high)}</b></div><div class="mini-list-row"><i class="dot" style="background:var(--teal)"></i><span>Active knowledge sources</span><b>${state.knowledge.filter(k => k.status === 'active').length}</b></div></div></article>
        <article class="card panel" id="overview-activity"><div class="panel-head"><div><h2>Recent activity</h2><p>Latest governance events</p></div><button class="link-button" data-view="audit">Audit trail</button></div><div class="activity-list">${state.audit.slice(0,3).map(a => `<div class="activity-row"><div class="activity-icon">${a.action.toLowerCase().includes('approve') ? '✓' : '↗'}</div><div><strong>${esc(a.action)}</strong><p>${esc(a.actorName || 'Member')} · ${esc(a.reason || 'Workspace update')}</p></div><time>${relative(a.createdAt)}</time></div>`).join('') || '<div class="subtle" style="font-size:10px">No activity yet.</div>'}</div></article>
      </div>
    </div>
    ${state.currentUser.isGuest ? `<div class="inline-note" style="margin-top:16px"><strong>Guest workspace:</strong> You are exploring BrandLens with sample content. Changes are saved in this browser only. Sign in with Firebase to create a private cloud workspace and collaborate with your team.</div>` : ''}`;
}

function greeting() { const hour = new Date().getHours(); return hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'; }
function emptyState(title, text, view, actionLabel) { return `<div class="empty-state"><div class="empty-icon">◌</div><strong>${esc(title)}</strong><p>${esc(text)}</p>${view ? `<button class="btn btn-secondary btn-sm" data-view="${view}">${esc(actionLabel || 'Explore')} →</button>` : ''}</div>`; }

function renderNewReview() {
  const selected = state.selectedUpload;
  return `${pageHeading('PRE-PUBLICATION CHECK','Create a content review','Paste a draft or upload a document. BrandLens checks it against the active knowledge in this workspace.',`<button class="btn btn-secondary" data-action="load-template">Use sample copy</button>`)}
    <div class="content-grid">
      <section class="card composer-card" id="new-review-composer">
        <form id="review-form">
          <div class="composer-grid">
            <div class="field"><label for="review-title">Review title</label><input id="review-title" name="title" maxlength="200" placeholder="e.g. Product launch announcement" required /></div>
            <div class="field"><label for="review-channel">Publishing channel</label><select id="review-channel" name="channel">${CHANNELS.map(c => `<option value="${c}">${CHANNEL_LABELS[c]}</option>`).join('')}</select></div>
          </div>
          <div class="field"><label for="review-copy">Content to review</label><div class="editor-toolbar"><span>Draft editor · Plain text</span><span class="char-count" id="char-count">0 / ${MAX_TEXT.toLocaleString()}</span></div><textarea id="review-copy" name="text" maxlength="${MAX_TEXT}" rows="12" placeholder="Paste your content here. Include the claims, headline, body copy and calls to action you plan to publish..." required></textarea><span class="field-hint">Up to ${MAX_TEXT.toLocaleString()} characters. Your original wording is kept until you choose to apply a suggestion.</span></div>
          <label class="upload-drop" for="review-file"><span class="upload-icon">⇧</span><span><strong>${selected ? esc(selected.name) : 'Upload a document instead'}</strong><small>${selected ? 'File ready to import' : 'Supported: .txt, .md, .html, .csv and .docx · Max 10 MB'}</small></span><span class="link-button" style="margin-left:auto">Browse files</span><input id="review-file" type="file" accept=".txt,.md,.html,.htm,.csv,.docx,text/plain,text/markdown,text/html,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document" /></label>
          <div class="review-action-row"><button class="btn btn-primary" type="submit" id="run-review-button">Run brand preflight <span>→</span></button><button class="btn btn-quiet" type="button" data-action="save-draft">Save as draft</button><button class="btn btn-quiet" type="button" data-action="clear-composer">Clear</button></div>
        </form>
        <div id="preflight-results"></div>
      </section>
      <aside class="grid" style="gap:13px;align-content:start">
        <article class="card sidebar-card" id="new-review-checks"><h3>What gets checked?</h3>
          ${[['Aa','Tone & Voice','Clarity, confidence and consistency'],['T','Terminology','Preferred words and prohibited terms'],['⌁','Facts & Freshness','Approved facts, dates and source validity'],['✳','Promotional Claims','Unsupported rankings and absolute promises'],['▧','Visual Consistency','Assets, colour and basic image metadata'],['◉','Accessibility','Alt text, readability and inclusive language']].map(row => `<div class="check-category"><div class="category-check">${row[0]}</div><div><strong>${row[1]}</strong><small>${row[2]}</small></div></div>`).join('')}
        </article>
        <article class="card sidebar-card"><h3>Evidence, not guesses</h3><p class="subtle" style="font-size:10px;line-height:1.6;margin-bottom:12px">Every finding links to an active approved knowledge item or clearly says that no approved evidence was found. A suggestion never publishes content for you.</p><div class="inline-note success-note"><strong>Human stays in control</strong><br>Creators edit. Reviewers evaluate. Authorised owners approve and publish.</div></article>
        <article class="card sidebar-card"><h3>Useful starting point</h3><p class="subtle" style="font-size:10px;line-height:1.6">Try the sample announcement to see a glossary issue and two promotional claims flagged with explanations.</p><button class="btn btn-secondary btn-sm" data-action="load-template">Load example draft</button></article>
      </aside>
    </div>`;
}

function renderReviews() {
  const filtered = sortedReviews().filter(r => state.reviewFilter === 'all' || r.status === state.reviewFilter);
  const actions = `<button class="btn btn-primary" data-view="new-review">＋ New review</button>`;
  return `${pageHeading('CONTENT OPERATIONS','Review library','All submitted drafts, findings and publication states in this workspace.',actions)}
    <div class="filter-row"><input class="input-control" id="review-search" placeholder="Search reviews..." style="max-width:260px" /><select class="input-control" id="review-status-filter" style="max-width:190px"><option value="all">All statuses</option>${Object.entries(STATUS_LABELS).map(([k,v]) => `<option value="${k}" ${state.reviewFilter===k?'selected':''}>${v}</option>`).join('')}</select><span class="subtle" style="font-size:10px;margin-left:auto">${state.reviews.length} total reviews</span></div>
    <section class="card table-card" id="review-library-table"><div class="table-wrap"><table><thead><tr><th>Content</th><th>Channel</th><th>Findings</th><th>Risk</th><th>Status</th><th>Last updated</th><th></th></tr></thead><tbody id="review-table-body">${filtered.map(reviewTableRow).join('') || `<tr><td colspan="7">${emptyState('No reviews match this filter','Try another status or create a new review.','new-review','Create a review')}</td></tr>`}</tbody></table></div></section>
    <div class="inline-note" style="margin-top:13px">Content and review history are saved ${state.cloud.active ? 'to your Firebase workspace' : 'in this browser in guest/local mode'}. Guest changes do not sync to other devices.</div>`;
}
function reviewTableRow(r) {
  const findings = r.findings || [];
  const open = findings.filter(f => f.status === 'open').length;
  const risk = findings.some(f => f.severity === 'high' && f.status === 'open') ? 'high' : findings.some(f => f.severity === 'medium' && f.status === 'open') ? 'medium' : 'low';
  return `<tr class="clickable-row" data-open-review="${esc(r.id)}"><td><div class="table-title">${esc(r.title)}</div><div class="table-sub">${esc(r.createdByName || 'Workspace member')}</div></td><td>${esc(CHANNEL_LABELS[r.channel] || 'Other')}</td><td><b>${open}</b><span class="subtle"> open</span></td><td>${severityPill(risk)}</td><td>${statusPill(r.status)}</td><td>${dateTime(r.updatedAt || r.createdAt)}</td><td><button class="icon-button" data-open-review="${esc(r.id)}" aria-label="Open review">→</button></td></tr>`;
}

function renderReviewDetail() {
  const review = state.reviews.find(r => r.id === state.activeReviewId);
  if (!review) { state.currentView = 'reviews'; return renderReviews(); }
  const findings = review.findings || [];
  const openCount = findings.filter(f => f.status === 'open').length;
  const openHigh = findings.filter(f => f.severity === 'high' && f.status === 'open').length;
  const approvedCan = canApprove(review);
  const publishCan = canPublish() && review.status === 'approved';
  return `${pageHeading('REVIEW WORKSPACE',esc(review.title),`${CHANNEL_LABELS[review.channel] || 'Other'} · created ${dateTime(review.createdAt)} · version ${review.contentVersion || 1}`,`<button class="btn btn-quiet" data-view="reviews">← Back to library</button><button class="btn btn-secondary" data-action="export-review" data-id="${esc(review.id)}">Export report</button>`)}
    <div class="review-detail-grid">
      <div class="grid" style="gap:14px">
        <section class="card section-card"><div class="section-title-row"><div><h2>Draft content</h2><p>Version ${review.contentVersion || 1} · Updated ${relative(review.updatedAt)}</p></div><span class="type-pill">${esc(CHANNEL_LABELS[review.channel] || 'Other')}</span></div><div class="review-text-block">${esc(review.currentText || '')}</div><div class="review-action-row"><button class="btn btn-secondary btn-sm" data-action="edit-review-text" data-id="${esc(review.id)}">Edit draft</button><button class="btn btn-quiet btn-sm" data-action="save-version" data-id="${esc(review.id)}">Save snapshot</button><button class="btn btn-quiet btn-sm" data-action="rerun-review" data-id="${esc(review.id)}">Re-run checks</button></div></section>
        <section class="card section-card"><div class="section-title-row"><div><h2>Governance findings <span class="subtle">(${findings.length})</span></h2><p>${openCount} open · ${openHigh} high-risk</p></div><span class="type-pill">${review.riskLevel || (openHigh ? 'high' : 'low')} risk</span></div>${findings.length ? findings.map(f => findingCard(f, review.id, true)).join('') : emptyState('No findings','No issues have been recorded for this review yet. Run the checks to evaluate the draft.','new-review','Run a review')}</section>
        <section class="card section-card"><div class="section-title-row"><div><h2>Discussion</h2><p>Leave context for creators and reviewers</p></div></div><div class="grid" style="gap:10px">${(review.comments || []).map(c => `<div class="activity-row"><div class="user-avatar small">${esc(userInitials(c.authorName))}</div><div><strong>${esc(c.authorName || 'Member')} <span class="subtle" style="font-weight:400">· ${relative(c.createdAt)}</span></strong><p>${esc(c.body)}</p></div></div>`).join('') || '<p class="subtle" style="font-size:10px;margin:0">No comments yet. Add a note to keep decisions together.</p>'}</div><div class="field" style="margin-top:13px"><textarea id="review-comment" rows="2" placeholder="Add a comment or reviewer note..."></textarea></div><div class="review-action-row"><button class="btn btn-secondary btn-sm" data-action="add-comment" data-id="${esc(review.id)}">Post comment</button></div></section>
      </div>
      <aside class="grid" style="gap:13px;align-content:start">
        <section class="card sidebar-card"><h3>Review status</h3><div style="margin:7px 0 12px">${statusPill(review.status)}</div><div class="mini-list"><div class="mini-list-row"><span>Open findings</span><b>${openCount}</b></div><div class="mini-list-row"><span>High risk</span><b>${openHigh}</b></div><div class="mini-list-row"><span>Created by</span><b>${esc(review.createdByName || 'Member')}</b></div><div class="mini-list-row"><span>Assigned to</span><b>${esc(review.assignedToName || 'Unassigned')}</b></div></div><div class="hr"></div>
          ${review.status !== 'approved' && review.status !== 'published' ? `<button class="btn btn-secondary" style="width:100%;margin-bottom:7px" data-action="request-changes" data-id="${esc(review.id)}" ${!canReview()?'disabled':''}>Request changes</button><button class="btn btn-primary" style="width:100%" data-action="approve-review" data-id="${esc(review.id)}" ${!approvedCan?'disabled':''}>Approve review</button>${!state.currentUser.isGuest && !approvedCan ? `<p class="field-hint" style="margin:9px 0 0">Approval is disabled until open high-risk findings are resolved and a Brand Manager or Administrator reviews it.</p>` : ''}` : ''}
          ${publishCan ? `<button class="btn btn-primary" style="width:100%;margin-top:8px" data-action="publish-review" data-id="${esc(review.id)}">Publish / export record</button>` : ''}
          ${review.status === 'published' ? `<div class="inline-note success-note">This review has been marked published by an authorised workspace role.</div>` : ''}
          ${state.currentUser.isGuest ? `<div class="inline-note warning-note" style="margin-top:10px">Guest mode is for trying the workflow. Sign in with Firebase to exercise real role-based approvals.</div>` : ''}
        </section>
        <section class="card sidebar-card"><h3>Version history</h3>${(review.versions || []).length ? (review.versions || []).slice().reverse().map(v => `<div class="setting-line"><div><strong>Version ${v.versionNumber}</strong><small>${esc(v.changeSummary || 'Saved snapshot')} · ${relative(v.createdAt)}</small></div><button class="link-button" data-action="restore-version" data-id="${esc(review.id)}" data-version="${v.id}">Restore</button></div>`).join('') : '<p class="subtle" style="font-size:10px">No snapshots yet. Save a version before making a major change.</p>'}</section>
        <section class="card sidebar-card"><h3>Governance guardrails</h3><div class="policy-list"><div class="policy-row"><span>✓</span><span>Publishing is a human decision; checks never publish automatically.</span></div><div class="policy-row"><span>✓</span><span>Dismissals require a written reason.</span></div><div class="policy-row"><span>✓</span><span>Evidence links can only refer to approved workspace items.</span></div></div></section>
      </aside>
    </div>`;
}

function findingCard(f, reviewId, detailed = false) {
  const review = state.reviews.find(r => r.id === reviewId);
  const canEditThisDraft = state.currentUser.isGuest || isPrivileged() || (currentRole() === 'creator' && review?.createdBy === state.currentUser.uid);
  const canModerateFinding = state.currentUser.isGuest || canReview();
  const actions = [
    canModerateFinding ? `<button class="btn btn-quiet btn-sm" data-action="dismiss-finding" data-id="${esc(reviewId)}" data-finding="${esc(f.id)}">Dismiss with reason</button>` : '',
    canEditThisDraft ? `<button class="btn btn-secondary btn-sm" data-action="apply-suggestion" data-id="${esc(reviewId)}" data-finding="${esc(f.id)}">Apply suggestion</button>` : '',
    canModerateFinding ? `<button class="btn btn-quiet btn-sm" data-action="accept-finding" data-id="${esc(reviewId)}" data-finding="${esc(f.id)}">Mark accepted</button>` : ''
  ].filter(Boolean).join('');
  return `<article class="finding-card" data-finding-id="${esc(f.id)}"><div class="finding-top"><span class="finding-category">${CATEGORY_ICONS[f.category] || '◌'} ${esc(f.category)}</span>${severityPill(f.severity)}${evidencePill(f.evidenceStatus)}<span class="subtle" style="margin-left:auto;font-size:9px">${esc(humanize(f.status))}</span></div><blockquote>“${esc(f.excerpt)}”</blockquote><p>${esc(f.rationale)}</p><div class="finding-meta">Evidence: <b>${esc(f.evidenceSourceName || 'No approved evidence found')}</b> · Confidence ${Math.round((f.confidence || .8) * 100)}%</div>${f.evidenceSourceText ? `<div class="finding-meta">Source detail: ${esc(f.evidenceSourceText)}</div>` : ''}${f.suggestedRevision ? `<div class="suggestion-box"><strong>Suggested correction</strong><p>${esc(f.suggestedRevision)}</p></div>` : ''}${detailed && f.status === 'open' && actions ? `<div class="finding-actions">${actions}</div>` : ''}</article>`;
}

function renderKnowledge() {
  const items = state.knowledge.filter(k => state.knowledgeFilter === 'all' || k.type === state.knowledgeFilter);
  const actions = `${canEditKnowledge() ? '<button class="btn btn-primary" data-action="add-knowledge">＋ Add knowledge</button>' : '<span class="type-pill">Read only</span>'}`;
  return `${pageHeading('THE SOURCE OF TRUTH','Brand knowledge','The approved facts, voice rules and terminology your content is reviewed against.',actions)}
    <div class="filter-row"><select id="knowledge-filter" class="input-control" style="max-width:190px"><option value="all">All knowledge types</option>${['fact','glossary','tone','guideline','asset'].map(t => `<option value="${t}" ${state.knowledgeFilter === t ? 'selected' : ''}>${humanize(t)}</option>`).join('')}</select><input class="input-control" id="knowledge-search" placeholder="Search approved sources..." style="max-width:270px" /><span class="subtle" style="font-size:10px;margin-left:auto">${state.knowledge.length} items in this library</span></div>
    <section class="card section-card"><div class="section-title-row"><div><h2>Approved knowledge library</h2><p>Only items marked Active can support a finding.</p></div><button class="btn btn-quiet btn-sm" data-action="knowledge-help">How this works</button></div><div class="knowledge-grid" id="knowledge-grid">${items.map(k => knowledgeCard(k)).join('') || emptyState('No knowledge items found','Add an approved source or change the selected filter.','knowledge',canEditKnowledge()?'Add an item':'View all items')}</div></section>
    <div class="inline-note"><strong>Evidence rule:</strong> BrandLens never invents an approved source. When a claim cannot be grounded in an active item, the result says “No approved evidence found”. Add an owner, source and validity date to improve traceability.</div>`;
}
function knowledgeCard(k) {
  const stale = k.expiresAt && new Date(k.expiresAt) < new Date();
  return `<article class="knowledge-item" data-knowledge-id="${esc(k.id)}"><div class="knowledge-item-top"><span class="type-pill">${esc(humanize(k.type))}</span><span class="status-pill ${stale || k.status === 'expired' ? 'status-changes_requested' : k.status === 'active' ? 'status-approved' : 'status-draft'}">${stale ? 'Expired' : esc(humanize(k.status || 'active'))}</span></div><h3>${esc(k.title)}</h3><p>${esc(k.body)}</p>${k.preferredTerm ? `<small>Preferred: <b>${esc(k.preferredTerm)}</b></small><br>` : ''}<small>Source: ${esc(k.sourceName || 'Not supplied')} ${k.version ? `· v${esc(k.version)}` : ''} ${k.expiresAt ? `· Expires ${shortDate(k.expiresAt)}` : ''}</small>${canEditKnowledge() ? `<div class="finding-actions"><button class="btn btn-quiet btn-sm" data-action="edit-knowledge" data-id="${esc(k.id)}">Edit</button><button class="btn btn-quiet btn-sm" data-action="delete-knowledge" data-id="${esc(k.id)}">Archive</button></div>` : ''}</article>`;
}

function renderAssets() {
  return `${pageHeading('BRAND ASSETS','Asset library','Keep approved logos, imagery, colour references and accessibility notes in one place.',`${(canEditKnowledge() || state.currentUser.isGuest) ? '<button class="btn btn-primary" data-action="upload-asset">⇧ Add an asset</button>' : '<span class="type-pill">Manager access required</span>'}`)}
    <div class="inline-note warning-note" style="margin-bottom:14px"><strong>Visual review scope:</strong> BrandLens currently checks file metadata, dimensions, alt text and sampled colour values. It does not claim to perform a full visual-design or trademark review. A human reviewer should verify logo placement, rights and final appearance.</div>
    <section class="card section-card"><div class="section-title-row"><div><h2>Approved brand assets</h2><p>Assets stored here can be referenced during content review.</p></div><span class="type-pill">${state.assets.length} assets</span></div><div class="asset-grid">${state.assets.map(a => `<article class="asset-card"><div class="asset-preview">${a.dataUrl ? `<img src="${a.dataUrl}" alt="${esc(a.alt || a.name)}" />` : a.color ? `<div style="width:85%;height:56px;border-radius:10px;background:${esc(a.color)};box-shadow:0 7px 20px #0002;display:grid;place-items:center;color:white;font-weight:800;font-size:12px">${esc(a.name)}</div>` : `<span class="asset-placeholder">▧</span>`}</div><div class="asset-info"><strong>${esc(a.name)}</strong><small>${esc(a.kind || 'Brand asset')} · ${a.width && a.height ? `${a.width} × ${a.height}` : (a.mimeType || 'Metadata only')}</small><small>${esc(a.description || a.alt || 'No usage guidance supplied')}</small><div class="asset-actions"><button class="btn btn-secondary btn-sm" data-action="check-asset" data-id="${esc(a.id)}">Check asset</button><button class="btn btn-quiet btn-sm" data-action="edit-asset" data-id="${esc(a.id)}">Details</button></div></div></article>`).join('') || emptyState('No approved assets yet','Upload an approved logo or image to start building the asset library.','assets','Add an asset')}</div></section>
    <section class="card section-card"><div class="section-title-row"><div><h2>Visual governance checklist</h2><p>Use these checks before an asset is approved for reuse.</p></div></div><div class="grid" style="grid-template-columns:repeat(3,1fr);gap:10px">${[['File and dimensions','Confirm file type, size and resolution match the intended channel.'],['Alt text and access','Write a useful text alternative that conveys the image purpose.'],['Rights and source','Record who owns the asset and whether usage rights are current.']].map(([h,p])=>`<div class="settings-option"><h3>${h}</h3><p style="margin:0">${p}</p></div>`).join('')}</div></section>`;
}

function renderApprovals() {
  const queue = sortedReviews().filter(r => ['in_review','changes_requested'].includes(r.status));
  return `${pageHeading('HUMAN REVIEW GATE','Approval queue','Reviewers assess the findings and move approved content to the publish owner.',`<span class="type-pill">${queue.length} waiting</span>`)}
    <section class="card section-card"><div class="section-title-row"><div><h2>Needs attention</h2><p>Approvals are never automatic. Every decision is recorded in the audit trail.</p></div></div>${queue.length ? queue.map(r => { const open = (r.findings||[]).filter(f=>f.status==='open'); const high = open.filter(f=>f.severity==='high').length; const owner = state.members.find(m=>m.uid===r.assignedTo); return `<div class="approval-item"><div><h3>${esc(r.title)}</h3><p>${esc(CHANNEL_LABELS[r.channel]||'Other')} · ${open.length} open findings · assigned to ${esc(owner?.displayName || r.assignedToName || 'Unassigned')}</p><div style="display:flex;gap:7px;margin-top:8px;align-items:center">${statusPill(r.status)}${high ? severityPill('high') : severityPill(open.length?'medium':'low')}</div></div><div class="approval-side"><button class="btn btn-secondary btn-sm" data-open-review="${esc(r.id)}">Open review</button>${canApprove(r) ? `<button class="btn btn-primary btn-sm" data-action="approve-review" data-id="${esc(r.id)}">Approve</button>` : '<span class="subtle" style="font-size:9px">Reviewer action required</span>'}</div></div>`; }).join('') : emptyState('Queue is clear','There are no drafts waiting for a governance decision.','reviews','Browse all reviews')}</section>
    <section class="card section-card"><div class="section-title-row"><div><h2>Decision boundaries</h2><p>Role-based checks protect high-risk claims and final publication.</p></div></div><div class="grid" style="grid-template-columns:repeat(3,1fr);gap:10px"><div class="settings-option"><h3>Reviewers</h3><p>Specialist reviewers can inspect evidence and request changes. They cannot approve their own work.</p></div><div class="settings-option"><h3>Brand managers</h3><p>Managers can approve regular reviews after open high-risk findings are resolved.</p></div><div class="settings-option"><h3>Publish owners</h3><p>Publish owners perform the final release/export step after approval.</p></div></div></section>`;
}

function renderInsights() {
  const findings = allFindings();
  const categories = ['Tone & Voice','Terminology','Facts & Freshness','Promotional Claims','Visual Consistency','Accessibility'];
  const counts = categories.map(c => ({ name:c, value:findings.filter(f => f.category===c).length }));
  const max = Math.max(1, ...counts.map(c=>c.value));
  const repeatTerms = {};
  findings.forEach(f => { const key = `${f.category}: ${f.excerpt}`; repeatTerms[key] = (repeatTerms[key] || 0) + 1; });
  const repeated = Object.entries(repeatTerms).filter(([,n])=>n>1).sort((a,b)=>b[1]-a[1]).slice(0,4);
  const supportPct = findings.length ? Math.round(findings.filter(f=>f.evidenceStatus==='supported').length/findings.length*100) : 0;
  return `${pageHeading('GOVERNANCE INTELLIGENCE','Insights & patterns','Find recurring mistakes and improve the guidance your team relies on.',`<button class="btn btn-secondary" data-action="export-insights">Export insights</button>`)}
    <div class="grid stats-grid"><article class="card stat-card"><div class="stat-top"><span>Findings reviewed</span><span class="stat-icon purple">◌</span></div><div class="stat-value">${findings.length}</div><div class="stat-foot">Across ${state.reviews.length} reviews</div></article><article class="card stat-card"><div class="stat-top"><span>Evidence-backed</span><span class="stat-icon green">✓</span></div><div class="stat-value">${supportPct}%</div><div class="stat-foot">Findings linked to an approved source</div></article><article class="card stat-card"><div class="stat-top"><span>High-risk open</span><span class="stat-icon coral">!</span></div><div class="stat-value">${findings.filter(f=>f.severity==='high'&&f.status==='open').length}</div><div class="stat-foot">Should be reviewed before approval</div></article><article class="card stat-card"><div class="stat-top"><span>Active knowledge</span><span class="stat-icon amber">◈</span></div><div class="stat-value">${state.knowledge.filter(k=>k.status==='active').length}</div><div class="stat-foot">Approved sources in this workspace</div></article></div>
    <div class="insights-grid"><section class="card section-card"><div class="section-title-row"><div><h2>Issue distribution</h2><p>All recorded findings by governance category</p></div></div><div class="bar-chart">${counts.map(c=>`<div class="bar-row"><label>${esc(c.name)}</label><div class="bar-track"><div class="bar-fill" style="width:${(c.value/max)*100}%"></div></div><b>${c.value}</b></div>`).join('')}</div><div class="inline-note">These counts describe only the reviews currently stored in this workspace. They are not industry benchmarks or a measured reduction in risk.</div></section>
      <section class="card section-card"><div class="section-title-row"><div><h2>Repeated issues</h2><p>Patterns that could signal a training or policy gap</p></div></div>${repeated.length ? repeated.map(([term,n])=>`<div class="setting-line"><div><strong>${esc(term)}</strong><small>Appears in multiple findings</small></div><span class="type-pill">${n}×</span></div>`).join('') : '<p class="subtle" style="font-size:10px">Repeated patterns will appear as more reviews are completed.</p>'}<div class="insight-callout"><strong>Governance recommendation</strong><p>${repeated.length ? `Review the source guidance for “${esc(repeated[0][0])}”. A repeated issue may mean the rule is not clear enough or has not reached content creators.` : 'Keep approved facts, prohibited terms and claim guidance specific. Clear source material makes reviews more consistent.'}</p></div></section></div>
    <section class="card section-card"><div class="section-title-row"><div><h2>Knowledge freshness</h2><p>Review items that may need an owner or validity date.</p></div><button class="link-button" data-view="knowledge">Open knowledge library →</button></div>${state.knowledge.map(k=>{const exp=k.expiresAt && new Date(k.expiresAt)<new Date();return `<div class="setting-line"><div><strong>${esc(k.title)}</strong><small>${esc(k.sourceName||'No source name')}</small></div><span class="status-pill ${exp?'status-changes_requested':k.status==='active'?'status-approved':'status-draft'}">${exp?'Expired':esc(humanize(k.status||'active'))}</span></div>`}).join('')}</section>`;
}

function renderAudit() {
  return `${pageHeading('ACCOUNTABILITY','Audit trail','A chronological record of decisions, edits and governance events.',`<button class="btn btn-secondary" data-action="export-audit">Export log</button>`)}
    <section class="card table-card"><div class="table-wrap"><table><thead><tr><th>Event</th><th>Actor</th><th>Role</th><th>Reason / context</th><th>Time</th></tr></thead><tbody>${state.audit.map(a=>`<tr><td><div class="table-title">${esc(a.action)}</div></td><td>${esc(a.actorName||'Member')}</td><td>${esc(a.actorRole||'Member')}</td><td>${esc(a.reason||'—')}</td><td>${dateTime(a.createdAt)}</td></tr>`).join('') || '<tr><td colspan="5">No audit events recorded.</td></tr>'}</tbody></table></div></section>
    <div class="inline-note warning-note" style="margin-top:13px"><strong>Audit integrity note:</strong> Cloud audit entries are designed to be append-only under the supplied Firestore rules. Entries stored in guest/local mode are editable by the person using this browser and must not be treated as a tamper-proof compliance record.</div>`;
}

function renderTeam() {
  return `${pageHeading('PEOPLE & PERMISSIONS','Team and roles','Make responsibilities clear from the first draft to the final publish decision.',`<button class="btn btn-primary" data-action="invite-member" ${!isPrivileged()?'disabled':''}>＋ Invite member</button>`)}
    <section class="card section-card"><div class="section-title-row"><div><h2>Workspace members</h2><p>${state.members.filter(m=>m.status==='active').length} active · ${state.members.filter(m=>m.status==='invited').length} invited</p></div><span class="type-pill">Role-based access</span></div>${state.members.map(m=>`<div class="team-row"><div class="user-avatar">${esc(userInitials(m.displayName))}</div><div class="team-copy"><strong>${esc(m.displayName)} ${m.uid===state.currentUser.uid?'<span class="type-pill">You</span>':''}</strong><small>${esc(m.email||'No email supplied')} · ${esc(humanize(m.status||'active'))}</small></div><span class="type-pill">${esc(roleName(m.role))}</span>${isPrivileged()&&m.uid!==state.currentUser.uid&&!state.currentUser.isGuest?`<button class="btn btn-quiet btn-sm" data-action="change-member-role" data-id="${esc(m.uid)}">Change role</button>`:''}</div>`).join('') || '<p class="subtle" style="font-size:10px">No members found.</p>'}</section>
    <section class="card section-card"><div class="section-title-row"><div><h2>Role permissions</h2><p>Actions are restricted by the member role and the state of the review.</p></div></div><div class="table-wrap"><table><thead><tr><th>Role</th><th>Submit drafts</th><th>Manage knowledge</th><th>Review findings</th><th>Approve</th><th>Publish</th></tr></thead><tbody>${ROLES.map(r=>`<tr><td><b>${ROLE_LABELS[r]}</b></td><td>${['admin','brand_manager','specialist_reviewer','creator','publish_owner'].includes(r)?'✓':'—'}</td><td>${['admin','brand_manager'].includes(r)?'✓':'—'}</td><td>${['admin','brand_manager','specialist_reviewer'].includes(r)?'✓':'—'}</td><td>${['admin','brand_manager'].includes(r)?'✓':'—'}</td><td>${['admin','brand_manager','publish_owner'].includes(r)?'✓':'—'}</td></tr>`).join('')}</tbody></table></div><div class="inline-note" style="margin-top:13px">Administrators assign roles. A user cannot promote their own account. Creators cannot approve their own reviews; high-risk findings must be resolved before approval.</div></section>
    ${state.currentUser.isGuest ? `<div class="inline-note warning-note">You are in guest mode. Sign in to create a workspace and manage actual team membership.</div>` : ''}`;
}

function renderSettings() {
  return `${pageHeading('WORKSPACE CONTROL','Settings','Manage how your workspace behaves, stores information and supports your team.',`<button class="btn btn-secondary" data-action="download-guide">Download product guide ↓</button>`)}
    <div class="settings-grid">
      <section class="card section-card"><div class="section-title-row"><div><h2>Personal preferences</h2><p>Your individual workspace experience</p></div></div><div class="setting-line"><div><strong>Appearance</strong><small>Switch between light and dark theme</small></div><button class="btn btn-secondary btn-sm" data-action="toggle-theme">${state.theme==='dark'?'Switch to light':'Switch to dark'}</button></div><div class="setting-line"><div><strong>Guided product tour</strong><small>Replay the walkthrough and feature explanations</small></div><button class="btn btn-secondary btn-sm" data-action="start-tour">Start tour</button></div><div class="setting-line"><div><strong>Product guide</strong><small>Detailed, illustrated instructions in simple English</small></div><button class="btn btn-secondary btn-sm" data-action="download-guide">Download PDF</button></div></section>
      <section class="card section-card"><div class="section-title-row"><div><h2>Workspace details</h2><p>Basic information for this BrandLens workspace</p></div></div><form id="workspace-form" class="modal-form"><div class="field"><label for="workspace-name-edit">Workspace name</label><input id="workspace-name-edit" name="name" maxlength="100" value="${esc(state.workspace?.name||'My workspace')}" ${!isPrivileged()?'disabled':''}/></div><button class="btn btn-primary" type="submit" ${!isPrivileged()?'disabled':''}>Save workspace name</button></form><div class="hr"></div><div class="setting-line"><div><strong>Storage mode</strong><small>${state.cloud.active?'Firebase cloud sync is active':'Local browser storage'} </small></div><span class="status-pill ${state.cloud.active?'status-approved':'status-changes_requested'}">${state.cloud.active?'Cloud':'Local'}</span></div><div class="setting-line"><div><strong>Current account</strong><small>${esc(state.currentUser.email||'No signed-in account')}</small></div>${state.currentUser.isGuest?'<button class="btn btn-secondary btn-sm" data-action="open-auth">Sign in</button>':'<button class="btn btn-quiet btn-sm" data-action="sign-out">Sign out</button>'}</div></section>
      <section class="card section-card"><div class="section-title-row"><div><h2>Data and exports</h2><p>Make a portable copy of the information in this workspace.</p></div></div><div class="setting-line"><div><strong>Export workspace data</strong><small>Download reviews, knowledge, assets and audit entries as JSON.</small></div><button class="btn btn-secondary btn-sm" data-action="export-workspace">Export JSON</button></div><div class="setting-line"><div><strong>Export review list</strong><small>Save review titles, channels and statuses as CSV.</small></div><button class="btn btn-secondary btn-sm" data-action="export-reviews-csv">Export CSV</button></div><div class="setting-line"><div><strong>Clear local demo data</strong><small>Removes BrandLens cache in this browser only.</small></div><button class="btn btn-danger btn-sm" data-action="reset-local">Reset local data</button></div></section>
      <section class="card section-card"><div class="section-title-row"><div><h2>Privacy and responsible AI</h2><p>Understand where data goes before you review confidential material.</p></div></div><div class="policy-list"><div class="policy-row"><span>✓</span><span>Firebase Authentication manages sign-in. Passwords are not stored in BrandLens local storage.</span></div><div class="policy-row"><span>✓</span><span>Gemini API keys stay on the server. When AI review is enabled, draft text and the selected approved knowledge summaries are sent to Google for analysis.</span></div><div class="policy-row"><span>✓</span><span>When the AI key is unavailable, deterministic checks run locally on the server. Findings may be less nuanced.</span></div><div class="policy-row"><span>✓</span><span>Review suggestions are proposals. A human remains responsible for approving and publishing content.</span></div><div class="policy-row"><span>✓</span><span>Guest data is stored in this browser. Do not use guest mode for confidential company drafts on shared devices.</span></div></div><div class="inline-note warning-note" style="margin-top:13px"><strong>Before commercial launch:</strong> deploy and test the updated Firestore and Storage rules, configure Firebase authorized domains, add a privacy notice and retention policy, enable service monitoring and backups, and conduct an independent security review.</div></section>
    </div>`;
}

function openModal(title, subtitle, body, footer = '', wide = false) {
  const modal = $('#modal');
  modal.classList.toggle('modal-wide', wide);
  modal.innerHTML = `<div class="modal-head"><div><h2 id="modal-title">${title}</h2><p>${subtitle || ''}</p></div><button class="icon-button" data-action="close-modal" aria-label="Close dialog">×</button></div>${body}${footer ? `<div class="modal-footer">${footer}</div>` : ''}`;
  $('#modal-backdrop').classList.remove('hidden');
}
function closeModal() { $('#modal-backdrop').classList.add('hidden'); $('#modal').innerHTML = ''; }

async function runReview() {
  const title = $('#review-title')?.value.trim() || 'Untitled content review';
  const channel = $('#review-channel')?.value || 'website';
  const text = $('#review-copy')?.value.trim() || '';
  if (!text) { notify('Add some content before running a review.', 'error'); return; }
  if (text.length > MAX_TEXT) { notify(`Content must be ${MAX_TEXT.toLocaleString()} characters or fewer.`, 'error'); return; }
  if (state.reviewBusy) return;
  state.reviewBusy = true;
  const button = $('#run-review-button');
  if (button) { button.disabled = true; button.textContent = 'Checking your draft…'; }
  $('#preflight-results').innerHTML = `<div class="card section-card review-results"><div class="empty-state"><div class="empty-icon">⌁</div><strong>Review in progress</strong><p>Checking terminology, approved facts, promotional claims, tone and accessibility cues.</p></div></div>`;
  let review = {
    id: newId('review'), title, channel, status: 'in_review', createdBy: state.currentUser.uid || 'guest', createdByName: userDisplayName(), assignedTo: null,
    originalText: text, currentText: text, contentVersion: 1, riskLevel: 'low', openHighCount: 0, createdAt: nowIso(), updatedAt: nowIso(), findings: [], comments: [], versions: [], fileMetadata: state.selectedUpload ? { name: state.selectedUpload.name, type: state.selectedUpload.type, size: state.selectedUpload.size } : null
  };
  state.reviews.unshift(review);
  persist();
  try {
    if (state.currentUser.isGuest || !state.cloud.active) {
      // Guest drafts stay in the browser. They are not sent to an external AI provider.
      review.findings = runLocalPreflight(text, channel, state.knowledge.filter(k => k.status === 'active'), review.id);
      state.lastEngineMode = 'Guest mode · browser rules only';
    } else {
      const auth=getAuthInstance(), sdk=getFirebaseSdk();
      const token = await sdk.getIdToken(auth.currentUser);
      const response = await fetch('/api/check-content', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ text, channel, reviewId: review.id, workspaceId: state.cloud.workspaceId })
      });
      if (!response.ok) throw new Error((await response.json()).error || `Review service returned ${response.status}`);
      const payload = await response.json();
      review.findings = Array.isArray(payload.findings) ? payload.findings.map(f => ({ ...f, id: f.id || newId('finding'), status: f.status || 'open', createdAt: f.createdAt || nowIso() })) : [];
      state.lastEngineMode = payload.engineMode || 'Rules-only mode';
      if(payload.aiWarning) notify('AI review was unavailable; deterministic rules were used.', 'error');
    }
    $('#engine-status-label').textContent = state.lastEngineMode;
  } catch (error) {
    console.warn('Server preflight is not reachable; using a local rules-only fallback for this review.', error);
    review.findings = runLocalPreflight(text, channel, state.knowledge.filter(k => k.status === 'active'), review.id);
    state.lastEngineMode = 'Browser fallback · rules only';
    $('#engine-status-label').textContent = 'Browser fallback · rules only';
    notify('Secure server review unavailable. Browser-only checks were used instead.', 'error');
  }
  review.riskLevel = review.findings.some(f => f.severity === 'high') ? 'high' : review.findings.some(f => f.severity === 'medium') ? 'medium' : 'low';
  review.openHighCount = unresolvedHighCount(review.findings);
  review.updatedAt = nowIso();
  state.lastFindings = review.findings;
  state.activeReviewId = review.id;
  persist();
  if (state.cloud.active) await cloudSaveReview(review);
  audit('Preflight review completed', `${review.findings.length} findings · ${state.lastEngineMode}`, review.id, { channel, findings: review.findings.length });
  state.reviewBusy = false;
  if (button) { button.disabled = false; button.innerHTML = 'Run brand preflight <span>→</span>'; }
  const target = $('#preflight-results');
  if (target) target.innerHTML = renderPreflightResults(review);
  notify(`Review complete. ${review.findings.length} finding${review.findings.length === 1 ? '' : 's'} recorded.`);
  if (!review.findings.length) {
    const noIssues = $('#preflight-results');
    if (noIssues) noIssues.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function runLocalPreflight(text, channel, knowledgeItems, reviewId) {
  const findings = [];
  const push = (category, severity, excerpt, rationale, evidenceStatus, evidenceIds, evidenceSourceName, evidenceSourceText, suggestedRevision, ruleId) => {
    if (!excerpt) return;
    const normalized = excerpt.toLowerCase();
    if (findings.some(f => f.excerpt.toLowerCase() === normalized && f.category === category)) return;
    findings.push({ id: newId('finding'), reviewId, category, severity, excerpt: excerpt.slice(0, 500), rationale, evidenceStatus, evidenceIds, evidenceSourceName, evidenceSourceText, suggestedRevision, confidence: .84, status: 'open', ruleId, createdAt: nowIso() });
  };
  const active = knowledgeItems.filter(k => k.status === 'active' && !(k.expiresAt && new Date(k.expiresAt) < new Date()));
  const findSupport = term => active.filter(k => `${k.title} ${k.body} ${k.sourceText || ''}`.toLowerCase().includes(term.toLowerCase()));
  for (const item of active.filter(k => k.type === 'glossary')) {
    const bad = (item.prohibitedTerms || []).find(term => term && new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i').test(text));
    if (bad) push('Terminology', 'medium', bad, `The approved glossary lists “${bad}” as a term to avoid. Use the preferred term to keep product language consistent.`, 'supported', [item.id], item.sourceName || item.title, item.sourceText || item.body, item.preferredTerm || 'Use the approved preferred term.', 'glossary-prohibited-term');
    if (item.preferredTerm) {
      const alternatives = (item.prohibitedTerms || []).filter(term => new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i').test(text));
      if (alternatives.length && !new RegExp(`\\b${escapeRegExp(item.preferredTerm)}\\b`, 'i').test(text)) push('Terminology', 'low', alternatives[0], `This draft does not use the preferred term “${item.preferredTerm}”.`, 'supported', [item.id], item.sourceName || item.title, item.sourceText || item.body, item.preferredTerm, 'glossary-preferred-term');
    }
  }
  const riskyClaims = [
    { re: /\b(100\s*%|one hundred percent)\s*(?:guaranteed|results?|safe|secure|effective)?\b/ig, label: '100% claim', suggestion: 'a measurable result supported by an approved source' },
    { re: /\bguarantee(?:d|s)?\b/ig, label: 'guarantee', suggestion: 'is designed to help' },
    { re: /\b(?:#1|number one|world'?s best|best[- ]in[- ]class|industry[- ]leading|market[- ]leading)\b/ig, label: 'ranking or superiority claim', suggestion: 'a specific, verifiable product benefit' },
    { re: /\b(?:always|never|everyone|no one|zero risk|completely secure|scam[- ]free)\b/ig, label: 'absolute or universal claim', suggestion: 'a qualified statement that can be supported by approved evidence' }
  ];
  for (const claim of riskyClaims) {
    const match = claim.re.exec(text);
    if (match) {
      const excerpt = match[0];
      const support = findSupport(excerpt);
      push('Promotional Claims', 'high', excerpt, `This wording may imply an absolute promise, universal result or market-leading position. Such claims need specific, current evidence before publication.`, support.length ? 'supported' : 'unsupported', support.map(k=>k.id), support.map(k=>k.sourceName||k.title).join(' · ') || 'No approved evidence found', support.map(k=>k.sourceText||k.body).join(' | ') || 'No approved knowledge item supports this promotional claim.', claim.suggestion, 'promotional-absolute-claim');
    }
  }
  const numericMatches = [...text.matchAll(/\b\d+(?:\.\d+)?\s*(?:%|percent|customers|users|hours|days|weeks|months|years)\b/gi)];
  for (const match of numericMatches.slice(0, 2)) {
    const snippet = match[0];
    const support = findSupport(snippet) || [];
    if (!support.length) push('Facts & Freshness', 'medium', snippet, 'A numeric fact or performance statement appears in the draft, but no matching active approved source was found. Confirm the number and add its source.', 'unsupported', [], 'No approved evidence found', 'No active approved knowledge item supports this number.', 'Remove the number or replace it with a verified value from the brand knowledge library.', 'numeric-claim-no-source');
  }
  for (const item of knowledgeItems.filter(k => k.expiresAt && new Date(k.expiresAt) < new Date() && k.status !== 'archived')) {
    if (text.toLowerCase().includes(item.title.toLowerCase().split(' ')[0])) push('Facts & Freshness', 'medium', item.title, `The relevant knowledge item “${item.title}” has passed its expiry date. Verify the source before relying on it.`, 'expired_source', [item.id], item.sourceName || item.title, item.sourceText || item.body, 'Ask the source owner to confirm the current information and update the validity date.', 'expired-knowledge');
  }
  const tone = active.find(k => k.type === 'tone');
  const exclamations = (text.match(/!/g) || []).length;
  if (exclamations >= 3) push('Tone & Voice', 'low', text.split(/(?<=[.!?])\s/).find(s => (s.match(/!/g)||[]).length >= 2) || text.slice(0, 150), 'The draft uses several exclamation marks. The tone guidance asks for calm, confident language rather than hype.', tone ? 'supported' : 'unsupported', tone ? [tone.id] : [], tone?.sourceName || 'No approved evidence found', tone?.sourceText || tone?.body || 'No approved tone guidance is present.', 'Reduce emphasis and let the benefit carry the message.', 'tone-exclamation-overuse');
  const allCaps = text.match(/\b[A-Z]{4,}\b/g) || [];
  if (allCaps.length >= 2) push('Tone & Voice', 'low', allCaps.slice(0, 3).join(', '), 'Several words are written in all capitals. Check whether this is intentional and consistent with the voice rules.', tone ? 'supported' : 'unsupported', tone ? [tone.id] : [], tone?.sourceName || 'No approved evidence found', tone?.sourceText || tone?.body || '', 'Use normal sentence case except for approved acronyms.', 'tone-all-caps');
  const longSentence = text.split(/(?<=[.!?])\s+/).find(s => s.trim().split(/\s+/).length > 36);
  if (longSentence) push('Accessibility', 'low', longSentence.slice(0, 180), 'This sentence is longer than 36 words. Shorter sentences are generally easier to scan and understand.', 'unsupported', [], 'No approved evidence found', 'This is a readability heuristic, not a formal accessibility certification.', 'Split the sentence into two or more shorter statements.', 'accessibility-long-sentence');
  if (/\b(click here|read more here|learn more here)\b/i.test(text)) push('Accessibility', 'low', (text.match(/\b(click here|read more here|learn more here)\b/i)||[])[0], 'Generic link wording does not explain the destination to people using screen readers or scanning links out of context.', 'unsupported', [], 'No approved evidence found', 'Accessibility suggestion based on link wording.', 'Use a descriptive link label that explains the destination.', 'accessibility-vague-link');
  return findings;
}
function escapeRegExp(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function renderPreflightResults(review) {
  const findings = review.findings || [];
  if (!findings.length) return `<section class="card section-card review-results"><div class="inline-note success-note"><strong>Nothing was flagged by the active checks.</strong><br>This is not a guarantee that the content is correct or compliant. A human should still verify context, rights and final presentation.</div><div class="review-action-row"><button class="btn btn-primary" data-open-review="${esc(review.id)}">Open review details</button></div></section>`;
  const high = findings.filter(f=>f.severity==='high').length;
  const medium = findings.filter(f=>f.severity==='medium').length;
  const low = findings.filter(f=>f.severity==='low').length;
  return `<section class="card section-card review-results"><div class="section-title-row"><div><h2>Review results</h2><p>${esc(state.lastEngineMode)} · ${findings.length} findings recorded</p></div><button class="btn btn-secondary btn-sm" data-open-review="${esc(review.id)}">Open full review →</button></div><div class="results-summary"><div class="result-metric"><span>Total findings</span><strong>${findings.length}</strong></div><div class="result-metric"><span>High risk</span><strong style="color:var(--coral)">${high}</strong></div><div class="result-metric"><span>Medium</span><strong style="color:var(--amber)">${medium}</strong></div><div class="result-metric"><span>Low</span><strong style="color:var(--teal)">${low}</strong></div></div>${findings.slice(0, 3).map(f=>findingCard(f,review.id,false)).join('')}${findings.length>3?`<p class="subtle" style="font-size:10px">Plus ${findings.length-3} more. Open the full review to manage each finding.</p>`:''}<div class="inline-note warning-note">Review output is advisory. Suggested changes are not automatically applied and content is never published by the checker.</div></section>`;
}

function saveVersion(review, changeSummary) {
  const version = { id: newId('version'), reviewId: review.id, versionNumber: (review.contentVersion || 1), text: review.currentText, changeSummary, createdBy: state.currentUser.uid || 'guest', createdAt: nowIso() };
  review.versions ||= []; review.versions.push(version);
  if (state.cloud.active) cloudSaveVersion(review.id, version);
  return version;
}
function unresolvedHighCount(findings) {
  // A creator-applied edit is not a final decision. High-risk findings stay unresolved
  // until an authorised reviewer accepts, dismisses with a reason, or resolves them.
  return (findings || []).filter(f => f.severity === 'high' && ['open','edited'].includes(f.status)).length;
}
function updateReview(review) {
  review.openHighCount = unresolvedHighCount(review.findings);
  review.updatedAt = nowIso(); persist(); if (state.cloud.active) cloudSaveReview(review);
}

function acceptFinding(reviewId, findingId) {
  const review = state.reviews.find(r=>r.id===reviewId); const finding = review?.findings?.find(f=>f.id===findingId);
  if (!review || !finding) return;
  finding.status = 'accepted'; finding.updatedAt = nowIso(); finding.updatedBy = state.currentUser.uid || 'guest';
  updateReview(review); audit('Finding accepted', `${finding.category}: ${finding.excerpt}`, review.id);
  setView('review-detail'); notify('Finding marked as accepted.');
}
function applySuggestion(reviewId, findingId) {
  const review = state.reviews.find(r=>r.id===reviewId); const finding = review?.findings?.find(f=>f.id===findingId);
  if (!review || !finding || !finding.suggestedRevision) return;
  saveVersion(review, 'Snapshot before applying a suggested correction');
  const excerpt = finding.excerpt;
  if (excerpt && review.currentText.toLowerCase().includes(excerpt.toLowerCase())) {
    const index = review.currentText.toLowerCase().indexOf(excerpt.toLowerCase());
    review.currentText = review.currentText.slice(0,index) + finding.suggestedRevision + review.currentText.slice(index + excerpt.length);
  } else {
    review.currentText += `\n\n[Suggested update] ${finding.suggestedRevision}`;
  }
  finding.status = 'edited'; finding.updatedAt = nowIso(); finding.updatedBy = state.currentUser.uid || 'guest';
  review.contentVersion = (review.contentVersion || 1) + 1;
  updateReview(review); audit('Suggested correction applied', `${finding.category}: ${finding.excerpt}`, review.id);
  setView('review-detail'); notify('Suggestion applied. Review the revised draft before approval.');
}
function dismissFinding(reviewId, findingId, reason) {
  if (!reason.trim()) { notify('A reason is required before dismissing a finding.', 'error'); return; }
  const review = state.reviews.find(r=>r.id===reviewId); const finding = review?.findings?.find(f=>f.id===findingId);
  if (!review || !finding) return;
  finding.status = 'dismissed'; finding.dismissReason = reason.trim(); finding.updatedAt = nowIso(); finding.updatedBy = state.currentUser.uid || 'guest';
  updateReview(review); audit('Finding dismissed', reason.trim(), review.id, { findingId });
  closeModal(); setView('review-detail'); notify('Finding dismissed with an audit reason.');
}

function requestChanges(reviewId) {
  const review = state.reviews.find(r=>r.id===reviewId); if (!review) return;
  if (!canReview()) { notify('Only an authorised reviewer can request changes in a signed-in workspace.', 'error'); return; }
  openModal('Request changes', 'Explain what the creator should address before the next review.', `<form id="request-changes-form" class="modal-form"><div class="field"><label for="request-reason">Reviewer note</label><textarea id="request-reason" required rows="4" placeholder="Explain the changes needed and point to the relevant guideline..."></textarea></div></form>`, `<button class="btn btn-quiet" data-action="close-modal">Cancel</button><button class="btn btn-primary" data-action="confirm-request-changes" data-id="${esc(reviewId)}">Send request</button>`);
}
function approveReview(reviewId) {
  const review = state.reviews.find(r=>r.id===reviewId); if (!review) return;
  if (!canApprove(review)) { notify('Approval is restricted by the workspace role and unresolved high-risk findings.', 'error'); return; }
  openModal('Approve this review?', 'This records a human approval decision. It does not publish the content.', `<div class="inline-note warning-note"><strong>Before approving:</strong> confirm the draft is current, source evidence is accurate and no high-risk findings remain open. Approval will be recorded in the audit trail.</div><form id="approve-form" class="modal-form" style="margin-top:12px"><div class="field"><label for="approve-reason">Approval note (optional)</label><textarea id="approve-reason" rows="3" placeholder="Add a short reason for the decision..."></textarea></div></form>`, `<button class="btn btn-quiet" data-action="close-modal">Cancel</button><button class="btn btn-primary" data-action="confirm-approve" data-id="${esc(reviewId)}">Confirm approval</button>`);
}
function publishReview(reviewId) {
  const review = state.reviews.find(r=>r.id===reviewId); if (!review) return;
  if (!canPublish() || review.status !== 'approved') { notify('Only an authorised publish owner can publish an approved review.', 'error'); return; }
  openModal('Publish / export approved content', 'This marks the review as published in this workspace and creates a downloadable record.', `<div class="inline-note success-note"><strong>Human approval recorded.</strong><br>Confirm that the final approved text and all channels are correct before completing this step.</div><form id="publish-form" class="modal-form" style="margin-top:12px"><div class="field"><label for="publish-note">Publication note</label><textarea id="publish-note" rows="3" placeholder="Add destination, date or release context..."></textarea></div></form>`, `<button class="btn btn-quiet" data-action="close-modal">Cancel</button><button class="btn btn-primary" data-action="confirm-publish" data-id="${esc(reviewId)}">Confirm publish</button>`);
}

function saveNewDraft() {
  const title = $('#review-title')?.value.trim() || 'Untitled draft';
  const text = $('#review-copy')?.value || '';
  if (!text.trim()) { notify('Add content before saving a draft.', 'error'); return; }
  const review = { id:newId('review'), title, channel:$('#review-channel')?.value||'website', status:'draft', createdBy:state.currentUser.uid||'guest', createdByName:userDisplayName(), originalText:text, currentText:text, contentVersion:1, riskLevel:'low', openHighCount:0, createdAt:nowIso(), updatedAt:nowIso(), findings:[], comments:[], versions:[], fileMetadata:state.selectedUpload?{name:state.selectedUpload.name,size:state.selectedUpload.size}:null };
  state.reviews.unshift(review); persist(); if (state.cloud.active) cloudSaveReview(review); audit('Draft saved', title, review.id); notify('Draft saved to your workspace.'); setView('review-detail'); state.activeReviewId=review.id; renderPage();
}

function editReviewText(reviewId) {
  const review = state.reviews.find(r=>r.id===reviewId); if (!review) return;
  openModal('Edit draft content', 'A snapshot will be saved before you update the current version.', `<form id="edit-review-form" class="modal-form"><div class="field"><label for="edited-content">Draft text</label><textarea id="edited-content" rows="12" maxlength="${MAX_TEXT}" required>${esc(review.currentText)}</textarea></div></form>`, `<button class="btn btn-quiet" data-action="close-modal">Cancel</button><button class="btn btn-primary" data-action="save-review-edit" data-id="${esc(reviewId)}">Save changes</button>`, true);
}

function addComment(reviewId) {
  const review = state.reviews.find(r=>r.id===reviewId); const body = $('#review-comment')?.value.trim();
  if (!review || !body) { notify('Write a comment first.', 'error'); return; }
  if (body.length > 2000) { notify('Comments must be 2,000 characters or fewer.', 'error'); return; }
  const comment = { id:newId('comment'), reviewId, authorUid:state.currentUser.uid||'guest', authorName:userDisplayName(), body, createdAt:nowIso() };
  review.comments ||= []; review.comments.push(comment); review.updatedAt=nowIso(); persist(); if (state.cloud.active) cloudSaveComment(reviewId, comment); audit('Review comment added', body.slice(0,120), review.id); setView('review-detail'); notify('Comment posted.');
}

function downloadBlob(filename, content, type = 'application/json;charset=utf-8') {
  const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}
function exportReview(review) {
  const payload = { product:'BrandLens', exportedAt:nowIso(), workspace:state.workspace?.name, review: { ...review, findings:review.findings||[], comments:review.comments||[], versions:review.versions||[] }, note:'This export is a workspace record. It is not a legal certification or an independent compliance attestation.' };
  downloadBlob(`${safeFilename(review.title)}-brandlens-review.json`, JSON.stringify(payload,null,2));
  notify('Review report downloaded.');
}
function safeFilename(name) { return String(name||'brandlens').normalize('NFKD').replace(/[^a-zA-Z0-9-_]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,70).toLowerCase() || 'brandlens'; }
function exportRowsCsv(rows, filename) {
  const keys = Object.keys(rows[0] || { 'No records':'' });
  const csv = [keys.join(','), ...rows.map(row => keys.map(key => `"${String(row[key] ?? '').replaceAll('"','""')}"`).join(','))].join('\n');
  downloadBlob(filename, csv, 'text/csv;charset=utf-8');
}

function openAuth(mode = 'signin') {
  const isSignup = mode === 'signup';
  openModal(isSignup ? 'Create your BrandLens account' : 'Sign in to BrandLens', isSignup ? 'Set up your account and create a private workspace.' : 'Sign in to continue to your team workspace.', `<div class="inline-note" style="margin-bottom:13px">Firebase Authentication is used for account access. BrandLens never stores your password in browser storage.</div><form id="auth-form" class="modal-form"><input type="hidden" name="mode" value="${isSignup?'signup':'signin'}" />${isSignup?'<div class="field"><label for="auth-name">Your name</label><input id="auth-name" name="name" maxlength="120" placeholder="Full name" required /></div>':''}<div class="field"><label for="auth-email">Work email</label><input id="auth-email" name="email" type="email" autocomplete="email" placeholder="you@company.com" required /></div><div class="field"><label for="auth-password">Password</label><input id="auth-password" name="password" type="password" minlength="8" autocomplete="${isSignup?'new-password':'current-password'}" placeholder="At least 8 characters" required /></div><div id="auth-error" class="inline-note danger-note hidden"></div><button class="btn btn-primary" style="width:100%" type="submit">${isSignup?'Create account':'Sign in'}</button>${!isSignup?'<button class="link-button" type="button" data-action="password-reset" style="margin-top:8px">Forgot password?</button>':''}</form><div class="hr"></div><button class="btn" style="width:100%" data-action="google-signin">Continue with Google</button><p class="subtle" style="font-size:9px;text-align:center;margin:12px 0 0">${isSignup?'Already have an account?':'New to BrandLens?'} <button class="link-button" data-action="auth-switch" data-mode="${isSignup?'signin':'signup'}">${isSignup?'Sign in':'Create an account'}</button></p>`, '', false);
}

async function handleAuthSubmit(form) {
  const auth = getAuthInstance(); const sdk = getFirebaseSdk();
  const errorBox = $('#auth-error');
  if (!auth || !sdk) { if (errorBox) { errorBox.textContent='Firebase is not available. Check your network connection and Firebase configuration, then reload the page.'; errorBox.classList.remove('hidden'); } return; }
  const mode = form.elements.mode.value;
  const email = form.elements.email.value.trim(); const password = form.elements.password.value;
  try {
    if (mode === 'signup') {
      const name = form.elements.name.value.trim();
      const result = await sdk.createUserWithEmailAndPassword(auth,email,password);
      await sdk.updateProfile(result.user,{displayName:name});
      state.currentUser = { uid:result.user.uid, name, email, photoURL:result.user.photoURL||'', isGuest:false, role:'admin' };
      closeModal();
      await createCloudWorkspace(`${name.split(' ')[0]}'s workspace`);
      notify('Account created and workspace set up.');
    } else {
      await sdk.signInWithEmailAndPassword(auth,email,password);
      closeModal();
      notify('Signed in. Loading your workspace…');
    }
  } catch (error) {
    console.error('Firebase sign-in error:',error);
    if (errorBox) { errorBox.textContent = authErrorMessage(error); errorBox.classList.remove('hidden'); }
  }
}
function authErrorMessage(error) {
  const code = error?.code || '';
  const messages = {
    'auth/invalid-credential':'The email or password is not correct.',
    'auth/email-already-in-use':'An account already exists for this email address.',
    'auth/weak-password':'Choose a stronger password with at least 8 characters.',
    'auth/invalid-email':'Enter a valid email address.',
    'auth/popup-closed-by-user':'The Google sign-in window was closed before completion.',
    'auth/unauthorized-domain':'This website domain has not been added to Firebase authorised domains.'
  };
  return messages[code] || (error?.message || 'Sign-in failed. Check your Firebase Auth settings and try again.');
}

async function sendPasswordReset() {
  const email = $('#auth-form')?.elements.email?.value.trim();
  if (!email) { notify('Enter your account email first, then choose Forgot password.', 'error'); return; }
  const auth=getAuthInstance(), sdk=getFirebaseSdk();
  if(!auth||!sdk){notify('Firebase is not available. Check the Firebase configuration and try again.','error');return;}
  try { await sdk.sendPasswordResetEmail(auth,email); notify('Password reset email sent. Check your inbox.'); }
  catch(error) { notify(authErrorMessage(error),'error'); }
}

async function handleGoogleSignIn() {
  const ready = await firebaseReady; const auth = getAuthInstance(); const sdk = getFirebaseSdk();
  if (!ready.enabled || !auth || !sdk) { notify('Firebase could not be reached. Try email sign-in later or continue as a guest.', 'error'); return; }
  try {
    const provider = new sdk.GoogleAuthProvider();
    await sdk.signInWithPopup(auth, provider);
    closeModal(); notify('Signed in with Google.');
  } catch (error) { notify(authErrorMessage(error), 'error'); }
}

async function handleAuthState(user) {
  if (!user) {
    // Firebase sign-out must not leave another account's private workspace on screen.
    const guest = safeLoad();
    Object.assign(state, guest, { currentUser:{ uid:null, name:'Guest user', email:'', photoURL:'', isGuest:true, role:'creator' }, cloud:{ active:false, workspaceId:null, loading:false, error:null }, currentView:'overview', activeReviewId:null });
    renderPage(); return;
  }
  state.currentUser = { uid:user.uid, name:user.displayName || user.email?.split('@')[0] || 'Member', email:user.email || '', photoURL:user.photoURL || '', isGuest:false, role:'creator' };
  const wsId = localStorage.getItem(`brandlens.workspace.${user.uid}`);
  if (wsId) {
    await loadCloudWorkspace(wsId);
  } else {
    state.cloud.active = false;
    renderPage();
    showWorkspaceSetup();
  }
}

function showWorkspaceSetup() {
  openModal('Set up your workspace', 'Choose a new workspace or join one where you already have an invitation.', `<div class="inline-note success-note" style="margin-bottom:12px">Signed in as <strong>${esc(state.currentUser.email)}</strong>.</div><div class="grid" style="gap:14px"><form id="create-workspace-form" class="modal-form"><div class="field"><label for="new-workspace-name">Create a new workspace</label><input id="new-workspace-name" name="name" maxlength="100" placeholder="Company or team name" required /></div><button class="btn btn-primary" type="submit">Create workspace</button></form><div class="hr" style="margin:0"></div><form id="join-workspace-form" class="modal-form"><div class="field"><label for="join-workspace-id">Join an invited workspace</label><input id="join-workspace-id" name="workspaceId" maxlength="128" placeholder="Workspace ID from your administrator" required /></div><button class="btn btn-secondary" type="submit">Join workspace</button></form></div>`, '', false);
}

async function createCloudWorkspace(name) {
  await firebaseReady;
  const db = getDbInstance(), sdk = getFirebaseSdk(), user = state.currentUser;
  if (!db || !sdk || !user?.uid) { notify('Firebase is not ready. The account is signed in but workspace creation could not finish.', 'error'); return; }
  const workspaceId = `ws_${user.uid.slice(0,12)}_${Math.random().toString(36).slice(2,7)}`.replace(/[^a-zA-Z0-9_-]/g,'');
  try {
    const root = sdk.doc(db,'workspaces',workspaceId);
    await sdk.setDoc(root,{ name:name.slice(0,100), createdBy:user.uid, createdAt:sdk.serverTimestamp(), settings:{ version:'2.1.0' } });
    await sdk.setDoc(sdk.doc(db,'workspaces',workspaceId,'members',user.uid),{ uid:user.uid, role:'admin', displayName:user.name || user.email, email:user.email, status:'active', joinedAt:sdk.serverTimestamp() });
    localStorage.setItem(`brandlens.workspace.${user.uid}`,workspaceId);
    state.workspace = { id:workspaceId, name, createdBy:user.uid, createdAt:nowIso() };
    state.members = [{ uid:user.uid, role:'admin', displayName:user.name, email:user.email, status:'active', joinedAt:nowIso() }];
    state.knowledge = []; state.reviews = []; state.assets = []; state.audit = [];
    state.cloud.active = true; state.cloud.workspaceId = workspaceId; state.currentUser.role='admin';
    persist(); closeModal(); setView('overview'); audit('Workspace created', name); notify('Your private workspace is ready.');
  } catch (error) { console.error(error); notify(`Workspace setup failed: ${error.message}`, 'error'); }
}

async function joinCloudWorkspace(workspaceId) {
  await firebaseReady;
  const db = getDbInstance(), sdk = getFirebaseSdk(), user = state.currentUser;
  if (!db || !sdk || !user?.uid) { notify('Firebase is not ready.', 'error'); return; }
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(workspaceId)) { notify('Workspace ID contains unsupported characters.', 'error'); return; }
  try {
    const memberRef = sdk.doc(db,'workspaces',workspaceId,'members',user.uid);
    const memberSnap = await sdk.getDoc(memberRef);
    if (!memberSnap.exists() || !['invited','active'].includes(memberSnap.data().status)) throw new Error('No active invitation for this account was found. Ask the workspace administrator to invite your Firebase UID.');
    const member = memberSnap.data();
    if (member.status === 'invited') await sdk.updateDoc(memberRef,{ status:'active', joinedAt:sdk.serverTimestamp() });
    localStorage.setItem(`brandlens.workspace.${user.uid}`,workspaceId);
    closeModal(); await loadCloudWorkspace(workspaceId); notify('You joined the workspace.');
  } catch (error) { notify(error.message || 'Could not join this workspace.', 'error'); }
}

async function loadCloudWorkspace(workspaceId) {
  const db = getDbInstance(), sdk = getFirebaseSdk();
  if (!db || !sdk) return;
  state.cloud.loading = true;
  try {
    const root = await sdk.getDoc(sdk.doc(db,'workspaces',workspaceId));
    const memberSnap = await sdk.getDoc(sdk.doc(db,'workspaces',workspaceId,'members',state.currentUser.uid));
    if (!root.exists() || !memberSnap.exists() || memberSnap.data().status !== 'active') throw new Error('Your account is not an active member of this workspace.');
    const workspace = { id:workspaceId, ...root.data() };
    const member = memberSnap.data();
    state.workspace = workspace;
    state.currentUser.role = ROLES.includes(member.role) ? member.role : 'creator';
    state.currentUser.name = member.displayName || state.currentUser.name;
    const [membersSnap, knowledgeSnap, reviewsSnap, assetsSnap, auditSnap] = await Promise.all([
      sdk.getDocs(sdk.collection(db,'workspaces',workspaceId,'members')),
      sdk.getDocs(sdk.collection(db,'workspaces',workspaceId,'knowledgeItems')),
      sdk.getDocs(sdk.collection(db,'workspaces',workspaceId,'reviews')),
      sdk.getDocs(sdk.collection(db,'workspaces',workspaceId,'assets')),
      sdk.getDocs(sdk.collection(db,'workspaces',workspaceId,'auditEvents'))
    ]);
    const normaliseFirestoreTimes = record => Object.fromEntries(Object.entries(record || {}).map(([key,value]) => [key, value && typeof value.toDate === 'function' ? value.toDate().toISOString() : value]));
    state.members = membersSnap.docs.map(d=>({uid:d.id,...normaliseFirestoreTimes(d.data())}));
    state.knowledge = knowledgeSnap.docs.map(d=>({id:d.id,...normaliseFirestoreTimes(d.data())}));
    state.assets = assetsSnap.docs.map(d=>({id:d.id,...normaliseFirestoreTimes(d.data()),dataUrl:null}));
    const storage=getStorageInstance();
    if(storage){ await Promise.all(state.assets.map(async asset=>{ if(!asset.mimeType || !asset.mimeType.startsWith('image/')) return; try { const blob=await sdk.getBlob(sdk.ref(storage,`workspaces/${workspaceId}/assets/${asset.id}`),5*1024*1024); asset.dataUrl=await readBlobAsDataUrl(blob); } catch(err) { console.warn('Could not load private asset preview',asset.id,err?.message); } })); }
    state.reviews = [];
    for (const snap of reviewsSnap.docs) {
      const review = { id:snap.id, ...normaliseFirestoreTimes(snap.data()) };
      const [findings, versions, comments] = await Promise.all([
        sdk.getDocs(sdk.collection(db,'workspaces',workspaceId,'reviews',snap.id,'findings')),
        sdk.getDocs(sdk.collection(db,'workspaces',workspaceId,'reviews',snap.id,'versions')),
        sdk.getDocs(sdk.collection(db,'workspaces',workspaceId,'reviews',snap.id,'comments'))
      ]);
      review.findings = findings.docs.map(d=>({id:d.id,...normaliseFirestoreTimes(d.data())}));
      review.versions = versions.docs.map(d=>({id:d.id,...normaliseFirestoreTimes(d.data())})).sort((a,b)=>(a.versionNumber||0)-(b.versionNumber||0));
      review.comments = comments.docs.map(d=>({id:d.id,...normaliseFirestoreTimes(d.data())})).sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
      // Firestore Timestamp values are normalised for the UI.
      for (const field of ['createdAt','updatedAt']) if (review[field]?.toDate) review[field] = review[field].toDate().toISOString();
      state.reviews.push(review);
    }
    state.audit = auditSnap.docs.map(d=>({id:d.id,...d.data()})).map(a=>({ ...a, createdAt:a.createdAt?.toDate ? a.createdAt.toDate().toISOString() : a.createdAt })).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    state.cloud.active = true; state.cloud.workspaceId = workspaceId; state.cloud.loading = false; state.cloud.error = null;
    for (const review of state.reviews) {
      const expectedHighCount=unresolvedHighCount(review.findings);
      const counterNeedsSync=typeof review.openHighCount !== 'number' || review.openHighCount !== expectedHighCount;
      review.openHighCount=expectedHighCount;
      // Only reviewer roles may maintain the authoritative aggregate on an existing cloud review.
      if (counterNeedsSync && isReviewer()) await cloudSaveReview(review);
    }
    persist(); renderPage(); $('#engine-status-label').textContent = 'Firebase workspace connected';
  } catch (error) {
    state.cloud.loading = false; state.cloud.error = error.message; state.cloud.active = false;
    console.warn('Workspace sync error', error);
    notify(`Cloud workspace could not be loaded: ${error.message}`, 'error');
    showWorkspaceSetup();
  }
}

async function cloudSet(path, id, payload, options = {}) {
  const db=getDbInstance(), sdk=getFirebaseSdk(); if (!db||!sdk||!state.cloud.active) return;
  try {
    const ref=sdk.doc(db,'workspaces',state.cloud.workspaceId,...path,id);
    const { id:ignoredId, dataUrl:ignoredDataUrl, ...clean } = payload || {};
    const snapshot=await sdk.getDoc(ref);
    // Server-owned timestamps are immutable and must not be overwritten by UI ISO strings.
    if (snapshot.exists() && options.serverCreatedAt) delete clean.createdAt;
    const cloudPayload={ ...clean, updatedAt:sdk.serverTimestamp() };
    if (!snapshot.exists() && options.serverCreatedAt) cloudPayload.createdAt=sdk.serverTimestamp();
    await sdk.setDoc(ref,cloudPayload,{merge:true});
  } catch(error) { console.warn('Cloud sync failed',error); notify(`Cloud sync failed: ${error.message}`, 'error'); }
}
async function cloudSaveReview(review) {
  const { id, findings=[], comments=[], versions=[], ...record } = review;
  record.openHighCount = unresolvedHighCount(findings);
  const db=getDbInstance(), sdk=getFirebaseSdk();
  if (!db || !sdk || !state.cloud.active) return;
  const rootRef=sdk.doc(db,'workspaces',state.cloud.workspaceId,'reviews',id);
  const rootSnapshot=await sdk.getDoc(rootRef);
  // A first-time review must exist before its nested findings can be created.
  // On edits, sync findings first and then update the root approval counter.
  if (!rootSnapshot.exists()) {
    await cloudSet(['reviews'],id,{...record,workspaceId:state.cloud.workspaceId},{serverCreatedAt:true});
  }
  for (const finding of findings) await cloudSet(['reviews',id,'findings'],finding.id,finding,{serverCreatedAt:true});
  if (rootSnapshot.exists()) {
    const rootUpdate={...record,workspaceId:state.cloud.workspaceId};
    if (!isReviewer()) delete rootUpdate.openHighCount;
    await cloudSet(['reviews'],id,rootUpdate,{serverCreatedAt:true});
  }
  for (const version of versions) await cloudCreateImmutable(['reviews',id,'versions'],version.id,version);
  for (const comment of comments) await cloudCreateImmutable(['reviews',id,'comments'],comment.id,comment);
}
async function cloudSaveKnowledge(item) { const {id,...record}=item; await cloudSet(['knowledgeItems'],id,{...record,workspaceId:state.cloud.workspaceId},{serverCreatedAt:true}); }
async function cloudSaveAsset(item) { const {id,...meta} = item; await cloudSet(['assets'],id,meta,{serverCreatedAt:true}); }
async function cloudCreateImmutable(path,id,payload) {
  const db=getDbInstance(), sdk=getFirebaseSdk(); if(!db||!sdk||!state.cloud.active)return;
  try { const ref=sdk.doc(db,'workspaces',state.cloud.workspaceId,...path,id); const snap=await sdk.getDoc(ref); if(snap.exists())return; const {id:ignored,...record}=payload||{}; await sdk.setDoc(ref,{...record,createdAt:sdk.serverTimestamp()}); } catch(error){console.warn('Immutable record sync failed',error);notify(`Cloud sync failed: ${error.message}`,'error');}
}
async function cloudSaveVersion(reviewId, version) { await cloudCreateImmutable(['reviews',reviewId,'versions'],version.id,version); }
async function cloudSaveComment(reviewId, comment) { await cloudCreateImmutable(['reviews',reviewId,'comments'],comment.id,comment); }
async function cloudAddAudit(event) {
  const db=getDbInstance(), sdk=getFirebaseSdk(); if (!db||!sdk||!state.cloud.active) return;
  try { const {id,...record}=event; await sdk.setDoc(sdk.doc(db,'workspaces',state.cloud.workspaceId,'auditEvents',id),{...record,createdAt:sdk.serverTimestamp()}); }
  catch(error) { console.warn('Audit event could not sync',error); }
}

async function signOut() {
  const auth=getAuthInstance(), sdk=getFirebaseSdk();
  if (auth && sdk) { try { await sdk.signOut(auth); } catch(error) { notify(error.message,'error'); return; } }
  // Keep the user's separate guest workspace intact instead of replacing it with fresh samples.
  const guestData=safeLoad();
  Object.assign(state,guestData,{
    currentUser:{uid:null,name:'Guest user',email:'',photoURL:'',isGuest:true,role:'creator'},
    cloud:{active:false,workspaceId:null,loading:false,error:null},
    activeReviewId:null,lastFindings:[],selectedUpload:null,reviewBusy:false
  });
  persist(); setView('overview'); notify('Signed out. You are now in guest mode.');
}

function addKnowledge(item) {
  const entry={ id:newId('kb'), status:'active', version:'1.0', createdAt:nowIso(), updatedAt:nowIso(), ...item };
  state.knowledge.unshift(entry); persist(); if(state.cloud.active) cloudSaveKnowledge(entry); audit('Knowledge item added',entry.title); setView('knowledge'); notify('Knowledge item added.');
}
function editKnowledge(id) {
  const item=state.knowledge.find(k=>k.id===id); if(!item)return;
  openModal('Edit knowledge item','Update the approved source. Changes affect future reviews.', `<form id="knowledge-form" class="modal-form"><input type="hidden" name="id" value="${esc(item.id)}"/><div class="field"><label>Knowledge type</label><select name="type">${['fact','glossary','tone','guideline','asset'].map(t=>`<option value="${t}" ${item.type===t?'selected':''}>${humanize(t)}</option>`).join('')}</select></div><div class="field"><label>Title</label><input name="title" maxlength="200" required value="${esc(item.title)}"/></div><div class="field"><label>Approved guidance / fact</label><textarea name="body" maxlength="4000" rows="4" required>${esc(item.body)}</textarea></div><div class="field"><label>Source name</label><input name="sourceName" maxlength="160" value="${esc(item.sourceName||'')}" placeholder="e.g. Product fact sheet"/></div><div class="field"><label>Exact source text or citation detail</label><textarea name="sourceText" maxlength="4000" rows="2">${esc(item.sourceText||'')}</textarea></div><div class="field"><label>Preferred term (glossary)</label><input name="preferredTerm" maxlength="100" value="${esc(item.preferredTerm||'')}"/></div><div class="field"><label>Terms to avoid (comma separated)</label><input name="prohibitedTerms" value="${esc((item.prohibitedTerms||[]).join(', '))}"/></div><div class="field"><label>Valid until (optional)</label><input name="expiresAt" type="date" value="${item.expiresAt?String(item.expiresAt).slice(0,10):''}"/></div></form>`, `<button class="btn btn-quiet" data-action="close-modal">Cancel</button><button class="btn btn-primary" data-action="save-knowledge">Save item</button>`, true);
}
function openAddKnowledge() {
  openModal('Add approved knowledge','Create a source that BrandLens can use when reviewing content.', `<form id="knowledge-form" class="modal-form"><div class="field"><label>Knowledge type</label><select name="type">${['fact','glossary','tone','guideline','asset'].map(t=>`<option value="${t}">${humanize(t)}</option>`).join('')}</select></div><div class="field"><label>Title</label><input name="title" maxlength="200" placeholder="e.g. Product launch date" required/></div><div class="field"><label>Approved guidance / fact</label><textarea name="body" maxlength="4000" rows="4" placeholder="Write the exact approved information or rule..." required></textarea></div><div class="field"><label>Source name</label><input name="sourceName" maxlength="160" placeholder="e.g. Official fact sheet"/></div><div class="field"><label>Exact source text or citation detail</label><textarea name="sourceText" maxlength="4000" rows="2" placeholder="Paste the source excerpt that supports this item..."></textarea></div><div class="field"><label>Preferred term (glossary)</label><input name="preferredTerm" maxlength="100" placeholder="Preferred word or phrase"/></div><div class="field"><label>Terms to avoid (comma separated)</label><input name="prohibitedTerms" placeholder="e.g. portal, dashboard"/></div><div class="field"><label>Valid until (optional)</label><input name="expiresAt" type="date"/></div></form>`, `<button class="btn btn-quiet" data-action="close-modal">Cancel</button><button class="btn btn-primary" data-action="save-knowledge">Add to knowledge</button>`, true);
}

function uploadAssetModal() {
  openModal('Add a brand asset','Add an image reference and record how it may be used.', `<form id="asset-form" class="modal-form"><div class="field"><label>Asset file</label><input name="file" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" required/><span class="field-hint">PNG, JPG, WebP or SVG · Max 5 MB per file</span></div><div class="field"><label>Asset name</label><input name="name" maxlength="120" placeholder="e.g. Primary logo — light background" required/></div><div class="field"><label>Asset type</label><select name="kind"><option value="logo">Logo</option><option value="photography">Photography</option><option value="illustration">Illustration</option><option value="icon">Icon</option><option value="template">Template</option><option value="other">Other</option></select></div><div class="field"><label>Alternative text</label><input name="alt" maxlength="250" placeholder="Describe the image's purpose"/></div><div class="field"><label>Usage and rights note</label><textarea name="description" rows="2" maxlength="800" placeholder="Where may this asset be used? Who owns it?"></textarea></div></form>`, `<button class="btn btn-quiet" data-action="close-modal">Cancel</button><button class="btn btn-primary" data-action="save-asset">Add asset</button>`);
}

async function checkAsset(id) {
  const asset=state.assets.find(a=>a.id===id); if(!asset)return;
  const issues=[];
  if(!asset.alt?.trim()) issues.push('Add useful alternative text so people using assistive technology understand the image.');
  if((asset.width||0)<600) issues.push('The image is narrower than 600px. Confirm it has enough resolution for its intended channel.');
  if(asset.kind==='logo' && !asset.description?.trim()) issues.push('Add rules for clear space, minimum size and approved background use.');
  if(!asset.description?.trim()) issues.push('Record ownership, usage rights and any restrictions.');
  const result=issues.length ? `<div class="inline-note warning-note"><strong>${issues.length} review note${issues.length===1?'':'s'}</strong><br>${issues.map(esc).join('<br>')}</div>` : '<div class="inline-note success-note"><strong>Basic metadata checks passed.</strong><br>A human reviewer must still verify design accuracy, logo placement, rights and visual context.</div>';
  openModal(`Asset check: ${esc(asset.name)}`,'Automated checks cover metadata and basic accessibility cues only.', `${result}<div class="hr"></div><div class="mini-list"><div class="mini-list-row"><span>File type</span><b>${esc(asset.mimeType||'Unknown')}</b></div><div class="mini-list-row"><span>Dimensions</span><b>${asset.width&&asset.height?`${asset.width} × ${asset.height}`:'Not detected'}</b></div><div class="mini-list-row"><span>Alternative text</span><b>${asset.alt?'Provided':'Missing'}</b></div><div class="mini-list-row"><span>Asset usage note</span><b>${asset.description?'Provided':'Missing'}</b></div></div>`, `<button class="btn btn-primary" data-action="close-modal">Done</button>`);
}

async function importDocument(file) {
  if (!file) return;
  if (file.size > 10 * 1024 * 1024) { notify('The file is larger than 10 MB.', 'error'); return; }
  const allowed = ['.txt','.md','.html','.htm','.csv','.docx'];
  const ext = `.${file.name.split('.').pop().toLowerCase()}`;
  if (!allowed.includes(ext)) { notify('Supported files are TXT, MD, HTML, CSV and DOCX.', 'error'); return; }
  state.selectedUpload = { name:file.name, size:file.size, type:file.type };
  const drop = $('.upload-drop');
  if (drop) drop.querySelector('strong').textContent = file.name;
  const buffer = await file.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);
  try {
    const response = await fetch('/api/parse-doc', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ fileName:file.name, base64Content:base64, mimeType:file.type }) });
    if (!response.ok) throw new Error((await response.json()).error || 'Document could not be parsed.');
    const result = await response.json();
    $('#review-copy').value = result.text || '';
    $('#char-count').textContent = `${(result.text||'').length.toLocaleString()} / ${MAX_TEXT.toLocaleString()}`;
    if (!$('#review-title').value.trim()) $('#review-title').value = file.name.replace(/\.[^.]+$/,'');
    notify(`${file.name} imported. Check the extracted text before reviewing.`);
  } catch (error) {
    if (['.txt','.md','.html','.htm','.csv'].includes(ext)) {
      try {
        const text = await file.text();
        $('#review-copy').value = ext === '.html' || ext === '.htm' ? htmlToText(text) : text;
        $('#char-count').textContent = `${$('#review-copy').value.length.toLocaleString()} / ${MAX_TEXT.toLocaleString()}`;
        if (!$('#review-title').value.trim()) $('#review-title').value = file.name.replace(/\.[^.]+$/,'');
        notify('Document imported in browser fallback mode.');
      } catch (_) { notify(error.message, 'error'); }
    } else notify(error.message || 'Document parser is unavailable. Start the BrandLens server and try again.', 'error');
  }
}
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer); let binary = '';
  for (let i=0; i<bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, Math.min(i+0x8000,bytes.length)));
  return btoa(binary);
}
function htmlToText(html) { const doc = new DOMParser().parseFromString(html,'text/html'); doc.querySelectorAll('script,style,noscript').forEach(e=>e.remove()); return doc.body.textContent.replace(/\n{3,}/g,'\n\n').trim(); }

function openWorkspaceMenu() {
  const cloudLabel = state.cloud.active ? 'Private Firebase workspace' : 'Guest sample workspace';
  const body = `<div class="policy-list"><div class="policy-row"><span>◈</span><span><b>${esc(state.workspace?.name || 'My workspace')}</b><br>${esc(cloudLabel)}</span></div><div class="policy-row"><span>▤</span><span>${state.reviews.length} reviews · ${state.knowledge.length} knowledge items · ${state.members.filter(m=>m.status==='active').length} active members</span></div>${state.cloud.active?`<div class="policy-row"><span>⌁</span><span>Workspace ID: <code>${esc(state.cloud.workspaceId)}</code></span></div>`:'<div class="policy-row"><span>!</span><span>Guest data is saved only in this browser. Sign in to create or join a shared workspace.</span></div>'}</div>`;
  const footer = state.currentUser.isGuest
    ? `<button class="btn btn-primary" data-action="open-auth">Sign in / create account</button>`
    : `<button class="btn btn-secondary" data-action="switch-workspace">Switch / create workspace</button><button class="btn btn-quiet" data-action="close-modal">Close</button>`;
  openModal('Workspace options','See which workspace is currently open.',body,footer);
}
function showAccountDetails() {
  openModal('Account details','Your Firebase identity and active workspace role.', `<div class="policy-list"><div class="policy-row"><span>◉</span><span><b>${esc(userDisplayName())}</b><br>${esc(state.currentUser.email || 'No email')}</span></div><div class="policy-row"><span>♧</span><span>Role: <b>${esc(roleName())}</b></span></div><div class="policy-row"><span>◈</span><span>Workspace: <b>${esc(state.workspace?.name || 'My workspace')}</b></span></div><div class="policy-row"><span>✓</span><span>Authentication: Firebase</span></div></div>`, `<button class="btn btn-quiet" data-action="close-modal">Close</button><button class="btn btn-danger" data-action="sign-out">Sign out</button>`);
}

function openAccountMenu() {
  $('.account-popover')?.remove();
  const node = document.createElement('div'); node.className='account-popover'; node.innerHTML = `<div class="account-summary"><strong>${esc(userDisplayName())}</strong><small>${esc(state.currentUser.email || 'Guest account')} · ${esc(state.currentUser.isGuest?'Local mode':roleName())}</small></div>${state.currentUser.isGuest?'<button data-action="open-auth">Sign in / create account</button>':'<button data-action="account-details">Account details</button><button data-action="sign-out">Sign out</button>'}<button data-view="settings">Workspace settings</button><button data-action="download-guide">Download product guide</button>`;
  document.body.append(node);
  const close = e => { if (!node.contains(e.target) && !e.target.closest('[data-action="account-menu"]')) { node.remove(); document.removeEventListener('click',close); } };
  setTimeout(()=>document.addEventListener('click',close),0);
}
function openNotifications() {
  const list = state.notifications.slice(0,8);
  openModal('Notifications','Updates and reminders from your workspace.', list.length ? `<div class="grid" style="gap:10px">${list.map(n=>`<div class="activity-row"><div class="activity-icon">${n.read?'◷':'●'}</div><div><strong>${esc(n.title)}</strong><p>${esc(n.text)} · ${relative(n.createdAt)}</p></div></div>`).join('')}</div>` : '<div class="empty-state"><strong>You are all caught up</strong><p>There are no new notifications.</p></div>', `<button class="btn btn-primary" data-action="mark-notifications-read">Mark all as read</button>`);
}

const tourSteps = [
  { view:'overview', selector:'#overview-hero', title:'Your governance workspace', description:'This is your overview. It shows the work moving through review, open findings, approved knowledge and a calculated readiness indicator. The score is a helpful signal, not a certification.' },
  { view:'new-review', selector:'#new-review-composer', title:'Start a content review', description:'Create a review by entering a title, choosing a channel and pasting copy. You can also import TXT, Markdown, HTML, CSV or DOCX files. BrandLens keeps the original draft until you decide to edit it.' },
  { view:'knowledge', selector:'.knowledge-grid', title:'Give the checker approved sources', description:'Add official facts, preferred terms, tone rules and guidelines. Include a source name, exact source text, an owner and an expiry date. Only active knowledge can support a finding.' },
  { view:'assets', selector:'.asset-grid', title:'Keep brand assets organised', description:'Store approved logos, images and usage notes. The current automated asset checks inspect basic file metadata, dimensions and alt text. A person still verifies the actual visual design and rights.' },
  { view:'approvals', selector:'.approval-item, .empty-state', title:'Keep a person in the decision loop', description:'Creators submit; specialist reviewers request changes; brand managers or administrators approve; publish owners handle the final release. High-risk findings should be resolved before approval.' },
  { view:'insights', selector:'.insights-grid', title:'Learn from repeated mistakes', description:'Insights group recorded findings by category and show recurring patterns. If the same issue appears repeatedly, clarify the guideline or train the team.' },
  { view:'settings', selector:'.settings-grid', title:'Protect and export your work', description:'Change the theme, manage your workspace, export data and download the detailed product guide. Before a public launch, deploy and test the Firebase security rules and configure privacy, retention and backups.' }
];
function startTour() { state.tourIndex=0; showTourStep(); }
function showTourStep() {
  const step=tourSteps[state.tourIndex]; if(!step) return endTour();
  state.tourTarget=step.selector;
  setView(step.view,{keepScroll:true});
  $('#tour-backdrop').classList.remove('hidden'); $('#tour-card').classList.remove('hidden');
  $('#tour-step-count').textContent=`STEP ${state.tourIndex+1} OF ${tourSteps.length}`;
  $('#tour-title').textContent=step.title; $('#tour-description').textContent=step.description;
  $('#tour-progress-fill').style.width=`${((state.tourIndex+1)/tourSteps.length)*100}%`;
  $('#tour-next').innerHTML=state.tourIndex===tourSteps.length-1?'Finish tour <span>✓</span>':'Next step <span>→</span>';
  setTimeout(highlightTourTarget,80);
}
function highlightTourTarget() {
  $$('.tour-focus').forEach(el=>el.classList.remove('tour-focus'));
  if (state.tourIndex<0) return;
  const selector=state.tourTarget; const target=selector?$(selector):null;
  if(target) { target.classList.add('tour-focus'); target.scrollIntoView({behavior:'smooth',block:'center'}); }
}
function nextTour() { if (state.tourIndex < tourSteps.length-1) { state.tourIndex++; showTourStep(); } else endTour(); }
function endTour() { state.tourIndex=-1; state.tourTarget=null; $$('.tour-focus').forEach(el=>el.classList.remove('tour-focus')); $('#tour-backdrop').classList.add('hidden'); $('#tour-card').classList.add('hidden'); }

function searchItems(term) {
  const q=term.trim().toLowerCase(); if(!q) return [];
  const results=[];
  Object.entries(VIEW_LABELS).filter(([id,label])=>id!=='review-detail'&&label.toLowerCase().includes(q)).forEach(([id,label])=>results.push({label,sub:'Workspace section',view:id,icon:'↗'}));
  state.reviews.forEach(r=>{if(`${r.title} ${CHANNEL_LABELS[r.channel]||''} ${r.status}`.toLowerCase().includes(q)) results.push({label:r.title,sub:`Review · ${STATUS_LABELS[r.status]||r.status}`,reviewId:r.id,icon:'▤'});});
  state.knowledge.forEach(k=>{if(`${k.title} ${k.body} ${k.type}`.toLowerCase().includes(q)) results.push({label:k.title,sub:`Brand knowledge · ${humanize(k.type)}`,view:'knowledge',icon:'◈'});});
  allFindings().forEach(f=>{if(`${f.excerpt} ${f.category} ${f.rationale}`.toLowerCase().includes(q)) results.push({label:f.excerpt,sub:`Finding · ${f.category}`,reviewId:f.reviewId,icon:'✳'});});
  state.assets.forEach(a=>{if(`${a.name} ${a.kind} ${a.description||''} ${a.alt||''}`.toLowerCase().includes(q)) results.push({label:a.name,sub:`Brand asset · ${humanize(a.kind||'asset')}`,view:'assets',icon:'▧'});});
  state.members.forEach(m=>{if(`${m.displayName} ${m.email||''} ${m.role}`.toLowerCase().includes(q)) results.push({label:m.displayName,sub:`Team member · ${roleName(m.role)}`,view:'team',icon:'♧'});});
  state.audit.forEach(a=>{if(`${a.action} ${a.actorName||''} ${a.reason||''}`.toLowerCase().includes(q)) results.push({label:a.action,sub:`Audit event · ${a.actorName||'Member'}`,view:'audit',icon:'◷'});});
  return results.slice(0,12);
}
function showSearchResults(term) {
  const pop=$('#search-popover'); const results=searchItems(term);
  if(!term.trim()) { pop.classList.add('hidden'); return; }
  pop.innerHTML=results.length?`<div class="search-section-label">Search results</div>${results.map((r,i)=>`<div class="search-result" data-search-index="${i}"><b>${r.icon}</b><span>${esc(r.label)}</span><small>${esc(r.sub)}</small></div>`).join('')}`:`<div class="empty-state" style="padding:18px"><strong>No matches found</strong><p>Try a review title, guideline, term or workspace section.</p></div>`;
  pop.classList.remove('hidden');
}
function applySearchResult(index, term) {
  const result=searchItems(term)[index]; if(!result) return;
  if(result.reviewId) openReview(result.reviewId); else setView(result.view||'overview');
  $('#search-popover').classList.add('hidden'); $('#global-search').value='';
}

function handleAction(action, button) {
  const id=button.dataset.id, findingId=button.dataset.finding;
  switch(action) {
    case 'toggle-theme': state.theme=state.theme==='dark'?'light':'dark'; applyTheme(); renderPage(); break;
    case 'start-tour': startTour(); break;
    case 'end-tour': endTour(); break;
    case 'tour-next': nextTour(); break;
    case 'account-menu': openAccountMenu(); break;
    case 'account-details': showAccountDetails(); break;
    case 'workspace-menu': openWorkspaceMenu(); break;
    case 'switch-workspace': closeModal(); showWorkspaceSetup(); break;
    case 'notifications': openNotifications(); break;
    case 'open-auth': openAuth('signin'); break;
    case 'auth-switch': openAuth(button.dataset.mode||'signup'); break;
    case 'google-signin': handleGoogleSignIn(); break;
    case 'password-reset': sendPasswordReset(); break;
    case 'sign-out': signOut(); $('.account-popover')?.remove(); break;
    case 'close-modal': closeModal(); break;
    case 'load-template': {
      const sample='Welcome to our portal! Northstar Studio was founded in 2018. We are the #1 platform and guarantee 100% results for every team. Our support team is available Monday to Friday, 9:00 AM to 6:00 PM IST.';
      if($('#review-title')) $('#review-title').value='Website launch announcement';
      if($('#review-copy')) { $('#review-copy').value=sample; $('#char-count').textContent=`${sample.length} / ${MAX_TEXT.toLocaleString()}`; }
      if($('#review-channel')) $('#review-channel').value='website';
      notify('Example draft loaded. Run the checks to see the findings.'); break;
    }
    case 'save-draft': saveNewDraft(); break;
    case 'clear-composer': if($('#review-title')) $('#review-title').value=''; if($('#review-copy')) $('#review-copy').value=''; state.selectedUpload=null; if($('#char-count')) $('#char-count').textContent=`0 / ${MAX_TEXT.toLocaleString()}`; if($('#preflight-results')) $('#preflight-results').innerHTML=''; break;
    case 'accept-finding': acceptFinding(id,findingId); break;
    case 'apply-suggestion': applySuggestion(id,findingId); break;
    case 'dismiss-finding': openModal('Dismiss finding','A short explanation is required and will be written to the audit trail.', `<form id="dismiss-form" class="modal-form"><div class="field"><label for="dismiss-reason">Reason for dismissal</label><textarea id="dismiss-reason" required rows="4" maxlength="500" placeholder="Explain why this finding does not apply..."></textarea></div></form>`, `<button class="btn btn-quiet" data-action="close-modal">Cancel</button><button class="btn btn-danger" data-action="confirm-dismiss" data-id="${esc(id)}" data-finding="${esc(findingId)}">Dismiss finding</button>`); break;
    case 'edit-review-text': editReviewText(id); break;
    case 'save-version': { const r=state.reviews.find(x=>x.id===id); if(r){saveVersion(r,'Manual snapshot'); updateReview(r); audit('Version snapshot saved',`Version ${r.contentVersion||1}`,r.id); renderPage();notify('Version snapshot saved.');} break; }
    case 'rerun-review': { const r=state.reviews.find(x=>x.id===id); if(r){setView('new-review'); $('#review-title').value=r.title; $('#review-channel').value=r.channel; $('#review-copy').value=r.currentText; $('#char-count').textContent=`${r.currentText.length} / ${MAX_TEXT.toLocaleString()}`; notify('Draft copied into the preflight editor.');} break; }
    case 'add-comment': addComment(id); break;
    case 'request-changes': requestChanges(id); break;
    case 'confirm-request-changes': {
      const r=state.reviews.find(x=>x.id===id), reason=$('#request-reason')?.value.trim(); if(!reason){notify('Add a reviewer note before requesting changes.','error');break;}
      if(r){r.status='changes_requested';r.updatedAt=nowIso();r.reviewerNote=reason;updateReview(r);audit('Changes requested',reason,r.id);closeModal();setView('review-detail');notify('Changes requested from the creator.');} break;
    }
    case 'approve-review': approveReview(id); break;
    case 'confirm-approve': {
      const r=state.reviews.find(x=>x.id===id), note=$('#approve-reason')?.value.trim()||'Review approved after human assessment.';
      if(r&&canApprove(r)){r.status='approved';r.approvedBy=state.currentUser.uid;r.approvedByName=userDisplayName();r.approvedAt=nowIso();r.updatedAt=nowIso();updateReview(r);audit('Review approved',note,r.id);closeModal();setView('review-detail');notify('Review approved. Publication remains a separate step.');}else notify('This role cannot approve the review.','error'); break;
    }
    case 'publish-review': publishReview(id); break;
    case 'confirm-publish': {
      const r=state.reviews.find(x=>x.id===id), note=$('#publish-note')?.value.trim()||'Published by authorised workspace member.';
      if(r&&canPublish()&&r.status==='approved'){r.status='published';r.publishedAt=nowIso();r.publishedBy=state.currentUser.uid;r.updatedAt=nowIso();updateReview(r);audit('Review published',note,r.id);closeModal();downloadBlob(`${safeFilename(r.title)}-publication-record.json`,JSON.stringify({workspace:state.workspace,review:r,publishedAt:r.publishedAt,publishedBy:userDisplayName(),note,disclaimer:'Workspace publication record, not a legal certificate.'},null,2));setView('review-detail');notify('Publication record downloaded.');} else notify('Publishing is restricted to authorised roles on an approved review.','error'); break;
    }
    case 'restore-version': {
      const r=state.reviews.find(x=>x.id===id), v=r?.versions?.find(x=>x.id===button.dataset.version); if(r&&v){saveVersion(r,'Snapshot before restoring an earlier version');r.currentText=v.text;r.contentVersion=(r.contentVersion||1)+1;r.updatedAt=nowIso();updateReview(r);audit('Earlier version restored',`Restored version ${v.versionNumber}`,r.id);setView('review-detail');notify('Earlier draft version restored.');} break;
    }
    case 'export-review': { const r=state.reviews.find(x=>x.id===id); if(r) exportReview(r); break; }
    case 'add-knowledge': if(canEditKnowledge()) openAddKnowledge(); else notify('Only brand managers and administrators can edit approved knowledge.','error'); break;
    case 'edit-knowledge': if(canEditKnowledge()) editKnowledge(id); break;
    case 'delete-knowledge': {
      const k=state.knowledge.find(x=>x.id===id); if(k&&canEditKnowledge()){k.status='archived';k.updatedAt=nowIso();persist();if(state.cloud.active)cloudSaveKnowledge(k);audit('Knowledge item archived',k.title);renderPage();notify('Knowledge item archived. It remains in the library history.');} break;
    }
    case 'knowledge-help': openModal('How brand knowledge works','Use your organisation’s approved information as the basis for review.', `<div class="policy-list"><div class="policy-row"><span>1</span><span><b>Facts</b> are exact information such as dates, prices, locations or service hours.</span></div><div class="policy-row"><span>2</span><span><b>Glossary</b> items define preferred product terms and words to avoid.</span></div><div class="policy-row"><span>3</span><span><b>Tone</b> and <b>guideline</b> items explain how the brand should sound and which claims are allowed.</span></div><div class="policy-row"><span>4</span><span>Include a source, source excerpt, owner and expiry date. Expired sources should be checked before reuse.</span></div></div>`, `<button class="btn btn-primary" data-action="close-modal">Understood</button>`); break;
    case 'upload-asset': uploadAssetModal(); break;
    case 'check-asset': checkAsset(id); break;
    case 'edit-asset': {
      const a=state.assets.find(x=>x.id===id);if(!a)break;
      openModal('Asset details','Update its description and accessibility information.', `<form id="edit-asset-form" class="modal-form"><input type="hidden" name="id" value="${esc(id)}"/><div class="field"><label>Asset name</label><input name="name" required maxlength="120" value="${esc(a.name)}"/></div><div class="field"><label>Alternative text</label><input name="alt" maxlength="250" value="${esc(a.alt||'')}"/></div><div class="field"><label>Usage and rights note</label><textarea name="description" rows="3" maxlength="800">${esc(a.description||'')}</textarea></div></form>`, `<button class="btn btn-quiet" data-action="close-modal">Cancel</button><button class="btn btn-primary" data-action="save-asset-details">Save details</button>`);break;
    }
    case 'invite-member': if(isPrivileged()) openInviteModal(); else notify('Only administrators and brand managers can invite members.','error'); break;
    case 'change-member-role': changeMemberRole(id); break;
    case 'export-workspace': downloadBlob('brandlens-workspace-export.json',JSON.stringify({exportedAt:nowIso(),workspace:state.workspace,knowledge:state.knowledge,reviews:state.reviews,assets:state.assets.map(({dataUrl,...a})=>a),members:state.members,audit:state.audit},null,2));notify('Workspace export downloaded.');break;
    case 'export-reviews-csv': exportRowsCsv(state.reviews.map(r=>({title:r.title,channel:CHANNEL_LABELS[r.channel]||r.channel,status:STATUS_LABELS[r.status]||r.status,createdBy:r.createdByName,createdAt:r.createdAt,updatedAt:r.updatedAt,openFindings:(r.findings||[]).filter(f=>f.status==='open').length})), 'brandlens-reviews.csv'); notify('Reviews CSV downloaded.');break;
    case 'export-audit': exportRowsCsv(state.audit.map(a=>({action:a.action,actor:a.actorName,role:a.actorRole,reason:a.reason,createdAt:a.createdAt,reviewId:a.reviewId||''})), 'brandlens-audit-log.csv');notify('Audit log exported.');break;
    case 'export-insights': downloadBlob('brandlens-insights.json',JSON.stringify({exportedAt:nowIso(),workspace:state.workspace,categoryCounts:Object.fromEntries(['Tone & Voice','Terminology','Facts & Freshness','Promotional Claims','Visual Consistency','Accessibility'].map(c=>[c,allFindings().filter(f=>f.category===c).length])),repeatedFindings:allFindings().map(f=>({category:f.category,excerpt:f.excerpt})),readiness:readiness()},null,2));notify('Insights exported.');break;
    case 'download-guide': window.open('/BrandLens-Product-Guide.pdf','_blank','noopener');break;
    case 'reset-local': openModal('Reset local BrandLens data?','This clears the BrandLens data cache in this browser and restores sample workspace content. It does not delete Firebase cloud records.', `<div class="inline-note danger-note"><strong>This action cannot be undone in this browser.</strong><br>Only keys beginning with “brandlens.” will be removed. Other websites’ storage is not affected.</div>`, `<button class="btn btn-quiet" data-action="close-modal">Cancel</button><button class="btn btn-danger" data-action="confirm-reset-local">Reset local data</button>`); break;
    case 'confirm-reset-local': {
      Object.keys(localStorage).filter(k=>k.startsWith('brandlens.')).forEach(k=>localStorage.removeItem(k));
      const fresh=seedData(); Object.assign(state,fresh); state.currentUser={uid:null,name:'Guest user',email:'',photoURL:'',isGuest:true,role:'creator'};state.cloud={active:false,workspaceId:null,loading:false,error:null};state.theme='light';applyTheme();persist();closeModal();setView('overview');notify('Local demo data restored.');break;
    }
    case 'mark-notifications-read': state.notifications.forEach(n=>n.read=true); persist(); closeModal(); notify('Notifications marked as read.'); break;
    default: break;
  }
}

function openInviteModal() {
  openModal('Invite a workspace member','Add the Firebase user UID supplied by the invited teammate. They can claim the invitation after signing in.', `<form id="invite-form" class="modal-form"><div class="field"><label>Firebase user UID</label><input name="uid" required maxlength="128" placeholder="Target user UID" /></div><div class="field"><label>Display name</label><input name="displayName" required maxlength="120" placeholder="Teammate name" /></div><div class="field"><label>Work email</label><input name="email" type="email" maxlength="160" placeholder="teammate@company.com" /></div><div class="field"><label>Workspace role</label><select name="role">${ROLES.filter(r=>r!=='admin').map(r=>`<option value="${r}">${ROLE_LABELS[r]}</option>`).join('')}</select></div></form><div class="inline-note" style="margin-top:11px">This MVP creates a pending membership record for a known Firebase UID. Email delivery and managed invitation links require a trusted server or Cloud Function.</div>`, `<button class="btn btn-quiet" data-action="close-modal">Cancel</button><button class="btn btn-primary" data-action="save-invite">Create invitation</button>`);
}
async function saveInvite() {
  const form=$('#invite-form'); if(!form.reportValidity())return;
  const values=Object.fromEntries(new FormData(form).entries());
  const uid=values.uid.trim();
  if(!/^[a-zA-Z0-9_-]{1,128}$/.test(uid)){notify('The Firebase UID contains unsupported characters.','error');return;}
  if(state.currentUser.isGuest||!state.cloud.active||!isPrivileged()){notify('Invitations require an authenticated administrator or brand manager in a cloud workspace.','error');return;}
  const member={uid,displayName:values.displayName,email:values.email,role:values.role,status:'invited',joinedAt:null};
  try {
    const db=getDbInstance(),sdk=getFirebaseSdk();
    await sdk.setDoc(sdk.doc(db,'workspaces',state.cloud.workspaceId,'members',uid),member);
    state.members=state.members.filter(m=>m.uid!==uid);state.members.push(member);persist();audit('Workspace invitation created',`${values.email||uid} invited as ${ROLE_LABELS[values.role]}`);closeModal();renderPage();notify('Invitation record created. Share the workspace ID and ask the teammate to join with their Firebase account.');
  } catch(error){notify(error.message||'Could not create the invitation.','error');}
}
async function changeMemberRole(uid) {
  const member=state.members.find(m=>m.uid===uid); if(!member)return;
  if(!isPrivileged()||state.currentUser.isGuest||uid===state.currentUser.uid){notify('You cannot change this member role.','error');return;}
  openModal('Change member role',`Update ${esc(member.displayName)}'s workspace permissions.`, `<form id="role-form" class="modal-form"><input type="hidden" name="uid" value="${esc(uid)}"/><div class="field"><label>New role</label><select name="role">${ROLES.map(r=>`<option value="${r}" ${member.role===r?'selected':''}>${ROLE_LABELS[r]}</option>`).join('')}</select></div></form>`, `<button class="btn btn-quiet" data-action="close-modal">Cancel</button><button class="btn btn-primary" data-action="save-role">Save role</button>`);
}

async function saveAsset() {
  const form=$('#asset-form'); if(!form.reportValidity())return;
  const file=form.elements.file.files?.[0]; if(!file){notify('Choose an image file.','error');return;}
  if(file.size>5*1024*1024){notify('Asset images must be 5 MB or smaller.','error');return;}
  if(!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)){notify('Use PNG, JPEG, WebP or SVG.','error');return;}
  const name=form.elements.name.value.trim();
  const id=newId('asset');
  const meta={id,name,kind:form.elements.kind.value,alt:form.elements.alt.value.trim(),description:form.elements.description.value.trim(),mimeType:file.type,size:file.size,color:null,createdAt:nowIso(),width:0,height:0};
  let dataUrl=null;
  try { dataUrl=await readFileAsDataUrl(file); } catch(_){ }
  if(file.type!=='image/svg+xml'&&dataUrl){
    try { const img=await loadImage(dataUrl); meta.width=img.naturalWidth;meta.height=img.naturalHeight;meta.color=await sampleImageColor(img); } catch(_){ }
  }
  if(state.cloud.active){
    const ready=await firebaseReady; const sdk=getFirebaseSdk();
    try {
      if(ready.enabled&&sdk){
        const storage=getStorageInstance();
        const assetRef=sdk.ref(storage,`workspaces/${state.cloud.workspaceId}/assets/${id}`);
        await sdk.uploadBytes(assetRef,file,{contentType:file.type});
        await cloudSaveAsset(meta);
      }
    } catch(error){notify(`Cloud upload failed: ${error.message}. Asset kept in this browser only.`, 'error');}
  }
  if(dataUrl) meta.dataUrl=dataUrl;
  state.assets.unshift(meta);persist();audit('Brand asset added',name);closeModal();setView('assets');notify('Asset added to the library.');
}
function readFileAsDataUrl(file){return readBlobAsDataUrl(file);}
function readBlobAsDataUrl(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob);});}
function loadImage(src){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});}
async function sampleImageColor(img){try{const canvas=document.createElement('canvas');canvas.width=20;canvas.height=20;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,20,20);const data=ctx.getImageData(0,0,20,20).data;let r=0,g=0,b=0,n=0;for(let i=0;i<data.length;i+=4){if(data[i+3]>180){r+=data[i];g+=data[i+1];b+=data[i+2];n++;}}if(!n)return null;return '#'+[r/n,g/n,b/n].map(x=>Math.round(x).toString(16).padStart(2,'0')).join('');}catch(_){return null;}}

async function handleSubmit(form) {
  if(form.id==='review-form') { await runReview(); return; }
  if(form.id==='auth-form') { await handleAuthSubmit(form); return; }
  if(form.id==='create-workspace-form') { const name=form.elements.name.value.trim(); if(name) await createCloudWorkspace(name); return; }
  if(form.id==='join-workspace-form') { const id=form.elements.workspaceId.value.trim(); if(id) await joinCloudWorkspace(id); return; }
  if(form.id==='knowledge-form') {
    const values=Object.fromEntries(new FormData(form).entries());
    const item={type:values.type,title:values.title.trim(),body:values.body.trim(),sourceName:values.sourceName.trim(),sourceText:values.sourceText.trim(),preferredTerm:values.preferredTerm.trim(),prohibitedTerms:values.prohibitedTerms.split(',').map(s=>s.trim()).filter(Boolean),expiresAt:values.expiresAt||null,status:'active'};
    if(values.id){const old=state.knowledge.find(k=>k.id===values.id);if(old){Object.assign(old,item,{updatedAt:nowIso(),version:old.version||'1.0'});persist();if(state.cloud.active)cloudSaveKnowledge(old);audit('Knowledge item updated',old.title);closeModal();setView('knowledge');notify('Knowledge item updated.');}}else addKnowledge(item);
    return;
  }
  if(form.id==='asset-form') { await saveAsset(); return; }
  if(form.id==='workspace-form') {
    const name=form.elements.name.value.trim();if(!name)return;
    state.workspace.name=name;persist();
    if(state.cloud.active){const db=getDbInstance(),sdk=getFirebaseSdk();try{await sdk.updateDoc(sdk.doc(db,'workspaces',state.cloud.workspaceId),{name});}catch(error){notify(`Workspace update failed: ${error.message}`,'error');}}
    audit('Workspace settings updated',`Workspace renamed to ${name}`);renderPage();notify('Workspace name updated.');return;
  }
  if(form.id==='edit-asset-form') {
    const values=Object.fromEntries(new FormData(form).entries());const a=state.assets.find(x=>x.id===values.id);if(a){a.name=values.name.trim();a.alt=values.alt.trim();a.description=values.description.trim();persist();if(state.cloud.active)cloudSaveAsset(a);audit('Asset metadata updated',a.name);closeModal();renderPage();notify('Asset details saved.');}return;
  }
  if(form.id==='invite-form') { await saveInvite(); return; }
  if(form.id==='role-form') { await saveRole(); return; }
}

async function saveRole(){
  const form=$('#role-form');if(!form.reportValidity())return;
  const uid=form.elements.uid.value,role=form.elements.role.value;const member=state.members.find(m=>m.uid===uid);if(!member||!isPrivileged()||state.currentUser.isGuest)return;
  try{const db=getDbInstance(),sdk=getFirebaseSdk();await sdk.updateDoc(sdk.doc(db,'workspaces',state.cloud.workspaceId,'members',uid),{role});member.role=role;persist();audit('Member role changed',`${member.displayName} set to ${ROLE_LABELS[role]}`);closeModal();renderPage();notify('Member role updated.');}
  catch(error){notify(`Role update failed: ${error.message}`,'error');}
}

// Click routing and small interactive controls.
document.addEventListener('click', async (event) => {
  const searchItem=event.target.closest('[data-search-index]');
  if(searchItem){applySearchResult(Number(searchItem.dataset.searchIndex),$('#global-search').value);return;}
  const openReviewButton=event.target.closest('[data-open-review]');
  if(openReviewButton){event.preventDefault();openReview(openReviewButton.dataset.openReview);return;}
  const viewButton=event.target.closest('[data-view]');
  if(viewButton){event.preventDefault();$('.account-popover')?.remove();setView(viewButton.dataset.view);return;}
  const actionButton=event.target.closest('[data-action]');
  if(actionButton){event.preventDefault();handleAction(actionButton.dataset.action,actionButton);return;}
  if(event.target.id==='modal-backdrop') closeModal();
});

document.addEventListener('submit', async (event) => {
  const form=event.target;
  if(!form.matches('form'))return;
  event.preventDefault();
  await handleSubmit(form);
});

document.addEventListener('change', async (event) => {
  if(event.target.id==='review-file') { await importDocument(event.target.files?.[0]); }
  if(event.target.id==='review-status-filter') { state.reviewFilter=event.target.value; renderPage(); }
  if(event.target.id==='knowledge-filter') { state.knowledgeFilter=event.target.value; renderPage(); }
});

document.addEventListener('input', (event) => {
  if(event.target.id==='review-copy') { const count=$('#char-count'); if(count)count.textContent=`${event.target.value.length.toLocaleString()} / ${MAX_TEXT.toLocaleString()}`; }
  if(event.target.id==='global-search') showSearchResults(event.target.value);
  if(event.target.id==='review-search') {
    const q=event.target.value.toLowerCase();
    const target=$('#review-table-body');
    if(target)target.innerHTML=sortedReviews().filter(r=>(state.reviewFilter==='all'||r.status===state.reviewFilter)&&`${r.title} ${r.createdByName||''} ${r.channel} ${r.status}`.toLowerCase().includes(q)).map(reviewTableRow).join('') || '<tr><td colspan="7" style="padding:25px;text-align:center;color:var(--muted)">No matching reviews.</td></tr>';
  }
  if(event.target.id==='knowledge-search') {
    const q=event.target.value.toLowerCase();const grid=$('#knowledge-grid');
    if(grid)grid.innerHTML=state.knowledge.filter(k=>(state.knowledgeFilter==='all'||k.type===state.knowledgeFilter)&&`${k.title} ${k.body} ${k.type}`.toLowerCase().includes(q)).map(knowledgeCard).join('') || '<div class="empty-state"><strong>No matching knowledge items</strong></div>';
  }
});

$('#mobile-menu').addEventListener('click',()=>$('#sidebar').classList.toggle('mobile-open'));
$('#global-search').addEventListener('focus',()=>{if(window.innerWidth<=700){$('.global-search-wrap').classList.add('search-open');$('#global-search').placeholder='Search...';}});
document.addEventListener('keydown',(event)=>{
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='k'){event.preventDefault();$('#global-search').focus();if(window.innerWidth<=700)$('.global-search-wrap').classList.add('search-open');}
  if(event.key==='Escape'){closeModal();endTour();$('.account-popover')?.remove();$('#search-popover').classList.add('hidden');}
});

// Honour section deep-links. This also makes help links and training screenshots reproducible.
const requestedView = new URLSearchParams(window.location.search).get('view');
if (requestedView && VIEW_LABELS[requestedView]) state.currentView = requestedView;
if (state.currentView === 'review-detail' && !state.activeReviewId) state.activeReviewId = sortedReviews()[0]?.id || null;

// Initialise the client experience first; the guest workspace remains usable if Firebase is unavailable.
applyTheme();
renderPage();
(async()=>{
  const ready=await firebaseReady;
  if(!ready.enabled){$('#engine-status-label').textContent='Local rules ready · Firebase unavailable';return;}
  const auth=getAuthInstance(),sdk=getFirebaseSdk();
  $('#engine-status-label').textContent='Firebase available · Guest mode';
  sdk.onAuthStateChanged(auth,handleAuthState);
})();
