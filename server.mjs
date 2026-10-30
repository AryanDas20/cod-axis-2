import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import { runDeterministicPreflight, validateAiFindings } from './src/services/engine.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

// Load a simple .env file without an extra runtime dependency. Existing process
// environment values always take precedence (as they do on managed hosts).
function loadEnvFile() {
  try {
    const source=fs.readFileSync(path.join(ROOT,'.env'),'utf8').replace(/^\uFEFF/,'');
    for (const rawLine of source.split(/\r?\n/)) {
      const line=rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const match=line.replace(/^export\s+/,'').match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match || process.env[match[1]] !== undefined) continue;
      let value=match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        const quote=value[0]; value=value.slice(1,-1);
        if (quote==='"') value=value.replace(/\\n/g,'\n').replace(/\\r/g,'\r').replace(/\\\\/g,'\\').replace(/\\"/g,'"');
      } else {
        value=value.replace(/\s+#.*$/,'').trim();
      }
      process.env[match[1]]=value;
    }
  } catch (error) { if (error.code !== 'ENOENT') console.warn('Could not read .env file:',error.message); }
}
loadEnvFile();

const PORT = Number(process.env.PORT || 3000);
const PRODUCTION = process.env.NODE_ENV === 'production';
const STATIC_ROOT = PRODUCTION ? path.join(ROOT, 'dist') : ROOT;
const MAX_BODY = 15 * 1024 * 1024; // room for base64-encoded 10 MB document imports
const MAX_TEXT = 50000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || '';
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'tribal-antler-3mn89';
const FIRESTORE_DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || 'ai-studio-01751af4-8ee9-4b9b-8158-67aebfccb9a0';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const APP_ORIGIN = process.env.APP_ORIGIN || '';
const CHANNELS = new Set(['website','social','email','paid_campaign','product_page','other']);
const MIME = {
  '.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp',
  '.pdf':'application/pdf','.txt':'text/plain; charset=utf-8','.md':'text/markdown; charset=utf-8','.ico':'image/x-icon'
};
const requestWindows = new Map();

function send(res, status, payload, headers = {}) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': typeof payload === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body), ...securityHeaders(), ...headers });
  res.end(body);
}
function securityHeaders() {
  return {
    'X-Content-Type-Options':'nosniff',
    'X-Frame-Options':'DENY',
    'Referrer-Policy':'strict-origin-when-cross-origin',
    'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
    'Cross-Origin-Opener-Policy':'same-origin-allow-popups',
    'Content-Security-Policy':"default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; img-src 'self' data: blob: https:; font-src 'self' https://fonts.gstatic.com data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' https://www.gstatic.com; connect-src 'self' https://www.gstatic.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://firebasestorage.googleapis.com https://generativelanguage.googleapis.com;"
  };
}
function allowedOrigin(req) {
  if (!APP_ORIGIN) return true;
  return req.headers.origin === APP_ORIGIN;
}
function rateLimit(req) {
  const key = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const item = requestWindows.get(key) || { start: now, count: 0 };
  if (now - item.start > 60_000) { item.start = now; item.count = 0; }
  item.count += 1; requestWindows.set(key, item);
  return item.count <= 45;
}
async function readJson(req) {
  let total = 0; const chunks = [];
  for await (const chunk of req) {
    total += chunk.length;
    if (total > MAX_BODY) throw Object.assign(new Error('Request body is too large. Maximum request size is 12 MB.'), { status: 413 });
    chunks.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 }); }
}
function htmlToText(html) {
  return String(html).replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/(?:p|div|li|h[1-6]|tr)>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/[ \t]+/g,' ').replace(/\n{3,}/g,'\n\n').trim();
}
function extractDocxText(buffer) {
  // Locate the ZIP end-of-central-directory record and then word/document.xml.
  const signature = 0x06054b50;
  let eocd = -1;
  for (let i = Math.max(0, buffer.length - 65557); i <= buffer.length - 22; i++) {
    if (buffer.readUInt32LE(i) === signature) eocd = i;
  }
  if (eocd < 0) throw new Error('The DOCX file is not a valid ZIP-based Word document.');
  const entryCount = buffer.readUInt16LE(eocd + 10);
  let cursor = buffer.readUInt32LE(eocd + 16);
  for (let i = 0; i < entryCount; i++) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) break;
    const method = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const fileName = buffer.subarray(cursor + 46, cursor + 46 + fileNameLength).toString('utf8');
    if (fileName === 'word/document.xml') {
      const localNameLength = buffer.readUInt16LE(localOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localOffset + 28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
      const xmlBuffer = method === 8 ? inflateRawSync(compressed, { maxOutputLength: 20 * 1024 * 1024 }) : method === 0 ? compressed : null;
      if (!xmlBuffer) throw new Error(`Unsupported DOCX compression method: ${method}`);
      const xml = xmlBuffer.toString('utf8');
      return xml.replace(/<w:tab\b[^>]*\/>/g,'\t').replace(/<w:br\b[^>]*\/>/g,'\n').replace(/<\/w:p>/g,'\n').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/\n{3,}/g,'\n\n').trim();
    }
    cursor += 46 + fileNameLength + extraLength + commentLength;
  }
  throw new Error('This DOCX document does not contain the expected Word document body.');
}
function validateId(value, fallback) {
  const id = typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value) ? value : fallback;
  return id;
}
function safeKnowledge(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 100).filter(k => k && typeof k === 'object').map(k => ({
    id: validateId(k.id,''), type: ['fact','glossary','tone','guideline','asset'].includes(k.type) ? k.type : 'guideline',
    title: String(k.title || '').slice(0,200), body: String(k.body || '').slice(0,4000),
    preferredTerm: String(k.preferredTerm || '').slice(0,100), prohibitedTerms: Array.isArray(k.prohibitedTerms) ? k.prohibitedTerms.slice(0,30).map(v=>String(v).slice(0,100)) : [],
    sourceName: String(k.sourceName || '').slice(0,160), sourceText: String(k.sourceText || '').slice(0,4000),
    status: ['active','expiring','expired','archived'].includes(k.status) ? k.status : 'archived', expiresAt: k.expiresAt ? String(k.expiresAt).slice(0,40) : null
  })).filter(k => k.id && k.title);
}
async function runGeminiReview(text, channel, knowledgeItems) {
  const summaries = knowledgeItems.filter(k => k.status === 'active').map(k => ({ id:k.id,type:k.type,title:k.title,sourceName:k.sourceName,sourceText:k.sourceText||k.body,status:k.status,expiresAt:k.expiresAt }));
  const prompt = `You are BrandLens, an evidence-first brand governance reviewer. Review the submitted content against the approved knowledge items supplied below.\n\nCONTENT CHANNEL: ${channel}\n\nDRAFT CONTENT:\n"""\n${text}\n"""\n\nAPPROVED KNOWLEDGE ITEMS (the only allowed sources):\n${JSON.stringify(summaries,null,2)}\n\nRULES:\n1. Find issues in tone and voice, terminology, facts and freshness, promotional claims, visual references stated in the copy, and accessibility/readability.\n2. Cite only IDs that appear exactly in the approved knowledge JSON above. Never invent source names, IDs, facts, certifications or quotations.\n3. If no matching approved source exists, set evidenceStatus to "unsupported", evidenceIds to [], evidenceSourceName to "No approved evidence found", and explain that no approved evidence was supplied.\n4. An expired source must not be treated as current support.\n5. Provide clear, plain-English explanations and a practical correction that preserves the writer's intended message.\n6. excerpt must be an exact substring from the submitted draft.\n7. Return only a JSON array using the specified fields. Categories must be one of: ${['Tone & Voice','Terminology','Facts & Freshness','Promotional Claims','Visual Consistency','Accessibility'].join('; ')}. Severity must be high, medium or low.\n\nOUTPUT SCHEMA EXAMPLE:\n[{"category":"Promotional Claims","severity":"high","excerpt":"exact words from draft","rationale":"why this needs review","evidenceStatus":"unsupported","evidenceIds":[],"evidenceSourceName":"No approved evidence found","evidenceSourceText":"No approved source supports the claim.","suggestedRevision":"a realistic alternative","confidence":0.9}]`;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`, {
    method:'POST', headers:{ 'Content-Type':'application/json', 'x-goog-api-key':GEMINI_API_KEY },
    body:JSON.stringify({ contents:[{role:'user',parts:[{text:prompt}]}], generationConfig:{responseMimeType:'application/json',temperature:0.15} }),
    signal:AbortSignal.timeout(25_000)
  });
  if (!response.ok) throw new Error(`Gemini returned HTTP ${response.status}`);
  const json=await response.json();
  const textOut=json?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('') || '';
  if (!textOut) throw new Error('Gemini returned an empty response.');
  const cleaned=textOut.trim().replace(/^```(?:json)?/i,'').replace(/```$/,'').trim();
  return JSON.parse(cleaned);
}


function firestoreValue(value) {
  if (!value || typeof value !== 'object') return value;
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(firestoreValue);
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([k,v])=>[k,firestoreValue(v)]));
  return value;
}
function firestoreDocument(doc) {
  const fields=Object.fromEntries(Object.entries(doc.fields || {}).map(([k,v])=>[k,firestoreValue(v)]));
  const id=String(doc.name || '').split('/').pop();
  return { id, ...fields };
}
async function firebaseRest(pathname, token) {
  const response=await fetch(`https://firestore.googleapis.com/v1/${pathname}`,{
    headers:{'Authorization':`Bearer ${token}`}, signal:AbortSignal.timeout(12000)
  });
  if(!response.ok) throw new Error(`Workspace data request failed (${response.status}).`);
  return response.json();
}
async function verifyWorkspaceAndLoadKnowledge(req, workspaceId) {
  const authHeader=String(req.headers.authorization || '');
  const token=authHeader.startsWith('Bearer ')?authHeader.slice(7).trim():'';
  if(!token) throw Object.assign(new Error('Sign in to run a server-side review. Guest content is checked in your browser only.'),{status:401});
  if(!FIREBASE_WEB_API_KEY) throw Object.assign(new Error('The server Firebase verification key is not configured. Set FIREBASE_WEB_API_KEY before enabling server-side reviews.'),{status:503});
  const lookup=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`,{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:token}),signal:AbortSignal.timeout(10000)
  });
  if(!lookup.ok) throw Object.assign(new Error('Firebase sign-in token is invalid or expired. Sign in again.'),{status:401});
  const account=await lookup.json();
  const user=account.users?.[0];
  const uid=String(user?.localId || '');
  if(!uid) throw Object.assign(new Error('Unable to verify the signed-in Firebase account.'),{status:401});
  const base=`projects/${encodeURIComponent(FIREBASE_PROJECT_ID)}/databases/${encodeURIComponent(FIRESTORE_DATABASE_ID)}/documents`;
  const membership=await firebaseRest(`${base}/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(uid)}`,token);
  const member=firestoreDocument(membership);
  if(member.uid!==uid || member.status!=='active') throw Object.assign(new Error('Your Firebase account is not an active member of this workspace.'),{status:403});
  const collection=await firebaseRest(`${base}/workspaces/${encodeURIComponent(workspaceId)}/knowledgeItems?pageSize=100`,token);
  const items=(collection.documents || []).map(firestoreDocument).filter(item=>item.status==='active');
  return {uid,member,knowledgeItems:safeKnowledge(items)};
}

async function handleCheckContent(req, res) {
  const body = await readJson(req);
  const text = typeof body.text === 'string' ? body.text : '';
  if (!text.trim()) return send(res,400,{error:'Draft text is required.'});
  if (text.length > MAX_TEXT) return send(res,413,{error:`Draft text is limited to ${MAX_TEXT.toLocaleString()} characters.`});
  const channel = CHANNELS.has(body.channel) ? body.channel : 'website';
  const reviewId = validateId(body.reviewId,'review-temp');
  const workspaceId = validateId(body.workspaceId,'local-workspace');
  const authorised = await verifyWorkspaceAndLoadKnowledge(req,workspaceId);
  const knowledgeItems = authorised.knowledgeItems;
  const deterministic = runDeterministicPreflight(text,channel,knowledgeItems,reviewId,workspaceId);
  let findings = [...deterministic.findings];
  let engineMode = 'Rules-only mode';
  let aiError = null;
  if (GEMINI_API_KEY) {
    try {
      const parsed = await runGeminiReview(text,channel,knowledgeItems);
      const aiFindings = validateAiFindings(parsed,text,knowledgeItems,reviewId,workspaceId);
      for (const finding of aiFindings) {
        const duplicate = findings.some(existing => existing.excerpt.toLowerCase() === finding.excerpt.toLowerCase() || existing.excerpt.toLowerCase().includes(finding.excerpt.toLowerCase()) || finding.excerpt.toLowerCase().includes(existing.excerpt.toLowerCase()));
        if (!duplicate) findings.push(finding);
      }
      engineMode = 'Source-grounded AI + Rules enabled';
    } catch (error) {
      aiError = error.message;
      console.warn('Source-grounded AI review failed; deterministic findings retained:', error.message);
    }
  }
  return send(res,200,{
    findings, engineMode, executionTimeMs:deterministic.executionTimeMs,
    aiAvailable:Boolean(GEMINI_API_KEY), aiWarning:aiError, reviewerUid:authorised.uid, workspaceRole:authorised.member.role,
    stats:{ total:findings.length, high:findings.filter(f=>f.severity==='high').length, medium:findings.filter(f=>f.severity==='medium').length, low:findings.filter(f=>f.severity==='low').length, supportedCount:findings.filter(f=>f.evidenceStatus==='supported').length, unsupportedCount:findings.filter(f=>f.evidenceStatus==='unsupported').length }
  });
}

async function handleParseDoc(req,res) {
  const body=await readJson(req);
  const fileName=typeof body.fileName==='string'?path.basename(body.fileName).slice(0,180):'';
  const base64=typeof body.base64Content==='string'?body.base64Content:'';
  if(!fileName||!base64)return send(res,400,{error:'Missing fileName or base64Content.'});
  if(base64.length>Math.ceil(10*1024*1024*4/3)+16)return send(res,413,{error:'Documents must be 10 MB or smaller.'});
  const buffer=Buffer.from(base64,'base64');
  if(buffer.length>10*1024*1024)return send(res,413,{error:'Documents must be 10 MB or smaller.'});
  const extension=path.extname(fileName).toLowerCase();
  let text='';
  try {
    if(['.txt','.md','.csv'].includes(extension)) text=buffer.toString('utf8');
    else if(['.html','.htm'].includes(extension)) text=htmlToText(buffer.toString('utf8'));
    else if(extension==='.docx') text=extractDocxText(buffer);
    else return send(res,400,{error:`Unsupported file type "${extension || 'unknown'}". BrandLens accepts TXT, MD, HTML, CSV and DOCX documents.`});
  } catch(error) { return send(res,422,{error:`Document extraction failed: ${error.message}`}); }
  if(text.length>MAX_TEXT) return send(res,413,{error:`Extracted text exceeds ${MAX_TEXT.toLocaleString()} characters. Please shorten the document before review.`});
  return send(res,200,{text,fileName,charCount:text.length});
}

async function handleApi(req,res,url) {
  if(!allowedOrigin(req)) return send(res,403,{error:'Origin is not allowed.'});
  if(!rateLimit(req)) return send(res,429,{error:'Too many requests. Please try again shortly.'});
  if(url.pathname==='/api/health' && req.method==='GET') return send(res,200,{status:'online',aiEnabled:Boolean(GEMINI_API_KEY),model:GEMINI_API_KEY?GEMINI_MODEL:null,engineMode:GEMINI_API_KEY?'Source-grounded AI + Rules enabled':'Rules-only mode',firebaseAuthConfigured:Boolean(FIREBASE_WEB_API_KEY),workspaceKnowledgeMode:'Firestore-authoritative',supportedFileTypes:['.txt','.md','.html','.csv','.docx'],maxContentCharacters:MAX_TEXT});
  if(url.pathname==='/api/check-content' && req.method==='POST') return handleCheckContent(req,res);
  if(url.pathname==='/api/parse-doc' && req.method==='POST') return handleParseDoc(req,res);
  return send(res,404,{error:'API endpoint not found.'});
}

function serveStatic(url,res) {
  let pathname=decodeURIComponent(url.pathname);
  if(pathname==='/' || pathname==='') pathname='/index.html';
  // In development the guide lives under /public; the build script copies it to dist root.
  if(pathname==='/BrandLens-Product-Guide.pdf' && !PRODUCTION) pathname='/public/BrandLens-Product-Guide.pdf';
  const candidate=path.resolve(STATIC_ROOT,`.${pathname}`);
  if(!candidate.startsWith(path.resolve(STATIC_ROOT)+path.sep) && candidate!==path.resolve(STATIC_ROOT,'index.html')) {
    res.writeHead(400,securityHeaders());res.end('Bad request');return;
  }
  fs.stat(candidate,(err,stat)=>{
    if(err||!stat.isFile()) { res.writeHead(404,securityHeaders());res.end('Not found');return; }
    const ext=path.extname(candidate).toLowerCase();
    res.writeHead(200,{...securityHeaders(),'Content-Type':MIME[ext]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':ext==='.html'?'no-cache':'public, max-age=3600'});
    fs.createReadStream(candidate).pipe(res);
  });
}

const server=http.createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://localhost');
    if(url.pathname.startsWith('/api/')) return await handleApi(req,res,url);
    if(req.method!=='GET'&&req.method!=='HEAD') return send(res,405,{error:'Method not allowed.'});
    if(req.method==='HEAD') { let pathname=url.pathname==='/'?'/index.html':url.pathname;if(pathname==='/BrandLens-Product-Guide.pdf'&&!PRODUCTION)pathname='/public/BrandLens-Product-Guide.pdf';const candidate=path.resolve(STATIC_ROOT,`.${pathname}`);if(!candidate.startsWith(path.resolve(STATIC_ROOT)+path.sep))return send(res,400,'Bad request');return fs.stat(candidate,(err,stat)=>{if(err||!stat.isFile()){res.writeHead(404,securityHeaders());return res.end();}res.writeHead(200,{...securityHeaders(),'Content-Type':MIME[path.extname(candidate).toLowerCase()]||'application/octet-stream','Content-Length':stat.size});res.end();}); }
    return serveStatic(url,res);
  } catch(error) {
    console.error('Request failed:',error);
    if(!res.headersSent) send(res,error.status||500,{error:error.status?error.message:'An unexpected server error occurred.'}); else res.end();
  }
});

server.listen(PORT,'0.0.0.0',()=>{
  console.log(`BrandLens running on http://0.0.0.0:${PORT}`);
  console.log(`Preflight engine: ${GEMINI_API_KEY?'Source-grounded AI + Rules':'Rules-only mode'}`);
});
