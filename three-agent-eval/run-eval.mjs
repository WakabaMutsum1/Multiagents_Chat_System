import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';

const ownDir = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
function arg(name, fallback) {
  const index = args.indexOf(name);
  return index < 0 ? fallback : args[index + 1];
}
const project = path.resolve(arg('--project', path.join(ownDir, '..')));
const output = path.resolve(arg('--out', path.join(ownDir, 'raw-results.json')));
const collectorOverride = arg('--collector-model', '');
const mode = arg('--mode', 'original');
const fixedEvidence = mode === 'fixed-evidence';
const jsonContract = args.includes('--json-contract');
const dryRun = args.includes('--dry-run');
const repeats = Number(arg('--repeats', '1'));
const limit = Number(arg('--limit', '3'));
if (!Number.isInteger(repeats) || repeats < 1 || !Number.isInteger(limit) || limit < 1) throw new Error('Invalid repeats/limit');
const offset = Number(arg('--offset', '0'));
const intervalMs = Number(arg('--interval-ms', '18000'));
const onlyId = arg('--case', '');
const cases = JSON.parse(fs.readFileSync(path.join(ownDir, 'cases.json'), 'utf8'))
  .filter(item => !onlyId || item.id === onlyId).slice(offset, offset + limit);
const apiKey = dryRun ? 'offline-placeholder' : process.env.GROQ_API_KEY;
const baseURL = 'https://api.groq.com/openai/v1';
const silent = { log() {}, warn() {}, error() {} };
let totalCalls = 0;
const callLimit = cases.length * repeats * 14 + 2;

if (!apiKey) {
  console.error('Missing GROQ_API_KEY. Load your local .env when starting Node; do not upload the key.');
  process.exit(2);
}
if (!fs.existsSync(path.join(project, 'chat.js'))) {
  console.error('Cannot find chat.js. Pass --project with your backend directory.');
  process.exit(2);
}

const source = fs.readFileSync(path.join(project, 'chat.js'), 'utf8');
const collectorModelFromSource = source.match(/["'](qwen\/[^"']+)["']/)?.[1];
if (!collectorModelFromSource) throw new Error('Cannot detect collector model from chat.js');

function safeError(error) {
  return String(error.message || error).replaceAll(apiKey, '[REDACTED]').slice(0, 300);
}
async function requestJSON(endpoint, payload) {
  if (dryRun) {
    if (endpoint === '/models') return { data: [collectorModelFromSource, 'openai/gpt-oss-20b', 'openai/gpt-oss-120b'].map(id => ({id})) };
    const prompt = payload.messages.map(m => m.content).join('\n');
    const collector = payload.model.startsWith('qwen/');
    const review = prompt.includes('你是最终证据审核者');
    const history = prompt.includes('当时助手说负责人是谁');
    const obj = collector
      ? {skill: history ? 'history-manager' : 'search-tavily', tool: history ? 'searchHistory' : 'searchTavily', args: {keyword:'offline test'}, reply:'OFFLINE_PLACEHOLDER'}
      : review
        ? {decision:'final', reasonCode:'insufficient_evidence', reason:'OFFLINE_PLACEHOLDER', retryHint:'', reply:'OFFLINE_PLACEHOLDER_NOT_A_MODEL_ANSWER'}
        : {skill:'none', tool:'none', args:{}, reply:'OFFLINE_PLACEHOLDER_NOT_A_MODEL_ANSWER'};
    return { choices: [{ message: { content: JSON.stringify(obj) }, finish_reason:'stop' }], usage:{prompt_tokens:0,completion_tokens:0,total_tokens:0} };
  }
  const response = await fetch(`${baseURL}${endpoint}`, {
    method: payload ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    ...(payload ? { body: JSON.stringify(payload) } : {}),
    signal: AbortSignal.timeout(90000)
  });
  let data;
  try { data = await response.json(); } catch { data = {}; }
  if (!response.ok) {
    const message = String(data.error?.message || '').replaceAll(apiKey, '[REDACTED]').replace(/org_[A-Za-z0-9_-]+/g, '[ORG]').slice(0, 350);
    const error = new Error(`Groq HTTP ${response.status}; code=${data.error?.code || 'unknown'}; ${message}`);
    error.status = response.status;
    error.retryAfter = response.headers.get('retry-after');
    throw error;
  }
  return data;
}

function loadModule(relative, mocks = {}, extra = '') {
  const filename = path.join(project, relative);
  const localRequire = createRequire(filename);
  const module = { exports: {} };
  const sandbox = {
    setTimeout, clearTimeout,
    module, exports: module.exports, __dirname: path.dirname(filename), __filename: filename,
    console: silent, process: { env: { GROQ_API_KEY: 'evaluation-client-keeps-key-private' } },
    require(name) { return Object.hasOwn(mocks, name) ? mocks[name] : localRequire(name); }
  };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8') + extra, sandbox, { filename });
  return module.exports;
}

const audit = {
  startedAt: new Date().toISOString(),
  dryRun, repeats,
  sourceSHA256: crypto.createHash('sha256').update(fs.readFileSync(path.join(project, 'chat.js'))).digest('hex'),
  fixtureSHA256: crypto.createHash('sha256').update(fs.readFileSync(path.join(ownDir, 'cases.json'))).digest('hex'),
  runnerSHA256: crypto.createHash('sha256').update(fs.readFileSync(fileURLToPath(import.meta.url))).digest('hex'),
  design: {
    purpose: 'Small controlled evidence-grounding stress test; not a population hallucination rate.',
    fixtureDisclosure: 'All project names, source pages, and source texts are synthetic. .example URLs are fixtures, not live web pages.',
    currentPipeline: 'Current chat.js with preflight routing validation and one shared feedback retry; tools return fixed fixtures; database writes disabled.',
    comparisons: ['B draft (20B, no reviewer)', 'C final (120B reviewer)', '120B alone using the exact B input and system prompt'],
    collectorOverride: collectorOverride || null,
    mode,
    scoring: 'Blind manual scoring required. Label each reply correct / hallucination / incomplete / abstain / protocol_error, with a reason. No model self-grading.',
    fixedEvidence: fixedEvidence ? 'Collector completion is a deterministic stub selecting the fixture tool. Only B, C, and standalone120B call real models. This does NOT evaluate the collector.' : false,
    jsonContract: jsonContract ? 'Append the four-field JSON contract to A/B/standalone prompts only; C retains its decision contract.' : false,
    intervalMs,
    generationChange: 'Preserve existing token caps (A=1000 in v4); set a 4096 cap only where absent. Original temperatures preserved; standalone 120B uses temperature 0 to match C.',
    limitations: 'Repeat count is recorded in repeats; repeated questions are not independent new questions. Synthetic tools do not test live search quality. Latency excludes real search, embedding and database latency. Draft20B vs final120B confounds review with model size; standalone120B is the stronger control.'
  },
  availableModels: [], results: []
};
function checkpoint() {
  fs.writeFileSync(output, JSON.stringify(audit, null, 2));
}
async function completion(request, calls, stage) {
  if (++totalCalls > callLimit) throw new Error('Evaluation request budget reached');
  const requestedModel = request.model;
  const model = collectorOverride && requestedModel.startsWith('qwen/') ? collectorOverride : requestedModel;
  const actual = { ...request, model, max_completion_tokens: request.max_completion_tokens ?? 4096 };
  if (jsonContract && stage !== 'review') {
    actual.messages = request.messages.map(message => message.role === 'system' ? {
      ...message,
      content: `${message.content}\n\n输出协议：你必须只输出一个 JSON 对象，字段必须为 skill、tool、args、reply。skill 和 tool 是字符串，args 是对象，reply 是包含完整回答的非空字符串。不要把 reply 改名为 answer、content 或其他字段。示例结构：{"skill":"none","tool":"none","args":{},"reply":"完整回答"}。遵守前文关于各角色 skill/tool 取值的要求。`
    } : message);
  }
  const record = { stage, requestedModel, model, startedAt: new Date().toISOString() };
  const start = performance.now();
  try {
    const data = await requestJSON('/chat/completions', actual);
    record.ms = Math.round(performance.now() - start);
    record.usage = data.usage;
    record.finishReason = data.choices?.[0]?.finish_reason;
    record.content = data.choices?.[0]?.message?.content;
    return data;
  } catch (error) {
    record.ms = Math.round(performance.now() - start);
    record.error = safeError(error);
    record.retryAfter = error.retryAfter;
    throw error;
  } finally { calls.push(record); }
}

async function evaluate(item) {
  const calls = [], requests = [], toolCalls = [];
  let standalonePhase = false;
  let writes = 0;
  const rejectDatabase = async () => { writes++; throw new Error('Database disabled for isolated evaluation'); };
  rejectDatabase.query = rejectDatabase;
  const tool_registry = {
    searchTavily: async (toolArgs) => {
      toolCalls.push({ tool: 'searchTavily', args: toolArgs });
      return { success: true, keyword: toolArgs.keyword, results: item.sources.map(x => ({ ...x, score: 0.9 })) };
    },
    searchHistory: async (toolArgs) => {
      toolCalls.push({ tool: 'searchHistory', args: toolArgs });
      return item.historyRows || [];
    },
    stopOperate: async () => ({ stopOperate: true }),
    generatePDF: async () => { throw new Error('PDF output disabled during evaluation'); },
    deleteHistory: async () => { throw new Error('Deletion disabled during evaluation'); },
    clearHistory: async () => { throw new Error('Deletion disabled during evaluation'); }
  };
  const registry = loadModule('skillRegistry.js', { './toolRegistry': { tool_registry } });
  const originalToolUser = loadModule('toolUser.js', { './skillRegistry': registry });
  const toolUser = { toolUser: (role, skill, tool, args, context) => originalToolUser.toolUser(role, skill, tool, args, {...context, userId:'offline_eval_user'}) };
  const skillCatalog = loadModule('skillCatalog.js', { './skillRegistry': registry });
  const handlers = {};
  const router = { post(route, handler) { handlers[`POST ${route}`] = handler; }, get() {} };
  class Groq {
    constructor() {
      this.chat = { completions: { create: async request => {
        requests.push(request);
        if (fixedEvidence && request.model.startsWith('qwen/')) {
          const history = Boolean(item.historyRows);
          const selected = { skill: history ? 'history-manager' : 'search-tavily', tool: history ? 'searchHistory' : 'searchTavily', args: { keyword: item.question }, reply: history ? '正在检索此前的聊天记录。' : '正在检索项目资料。' };
          return { choices: [{ message: { content: JSON.stringify(selected) } }] };
        }
        const stage = standalonePhase ? 'standalone120b' : request.model.startsWith('qwen/') ? 'collector' : request.model === 'openai/gpt-oss-20b' ? 'draft' : 'review';
        return completion(request, calls, stage);
      } } };
    }
  }
  const exported = loadModule('chat.js', {
    './db': rejectDatabase, './toolUser': toolUser, 'groq-sdk': Groq,
    express: { Router: () => router }, './skillCatalog': skillCatalog,
    './createEmbedding': { createEmbedding: async () => { throw new Error('Storage disabled for isolated evaluation'); } }
  }, '\nmodule.exports.__evalParse = parseAgentJson; module.exports.__evalStart = startAgent;');
  const response = { status: 200 };
  const res = { status(code) { response.status = code; return this; }, json(data) { response.body = data; return this; } };
  const started = performance.now();
  await handlers['POST /']({ body: { originalMessage: item.question, messageHistory: `用户：${item.question}` } }, res);
  const pipelineMs = Math.round(performance.now() - started);
  const draftRequest = requests.filter(request => request.model === 'openai/gpt-oss-20b').at(-1);
  let standalone = null;
  if (draftRequest) {
    standalonePhase = true;
    try {
      const parsed = await exported.__evalStart('openai/gpt-oss-120b', draftRequest.messages[0].content, draftRequest.messages[1].content, 0);
      standalone = { reply: parsed.reply };
    } catch (error) { standalone = { error: safeError(error) }; }
  }
  let draftReply = response.body?.draftAnswer;
  if (!draftReply) {
    for (const call of calls.filter(c => c.stage === 'draft').reverse()) {
      try { draftReply = exported.__evalParse(call.content).reply; break; } catch {}
    }
  }
  return {
    id: item.id, category: item.category, question: item.question, gold: item.gold, rubric: item.rubric,
    status: response.status, error: response.body?.error,
    collector: response.body?.dataProvider, draft: draftReply, final: response.body?.finalAnswer,
    standalone, stopOperate: response.body?.stopOperate,
    review: response.body?.review, retriesUsed: response.body?.retriesUsed, attempts: response.body?.attempts,
    actualEvidenceInput: draftRequest?.messages?.[1]?.content,
    pipelineMs, calls, toolCalls, databaseCalls: writes,
    scores: { draft: null, final: null, standalone120b: null }
  };
}

try {
  const listed = await requestJSON('/models');
  audit.availableModels = listed.data.filter(item => /qwen|gpt-oss/.test(item.id)).map(item => item.id);
  checkpoint();
  const collectorModel = collectorOverride || collectorModelFromSource;
  if (!fixedEvidence && !audit.availableModels.includes(collectorModel)) {
    throw new Error(`Collector model ${collectorModel} is not in this account's active model list. Set --collector-model explicitly.`);
  }
  const runs = Array.from({length:repeats}, (_, repeat) => cases.map(item => ({...item, repeat:repeat+1}))).flat();
  for (const [index, item] of runs.entries()) {
    if (!dryRun && index > 0 && intervalMs > 0) await delay(intervalMs);
    console.log(`START ${item.id}`);
    const result = await evaluate(item);
    result.repeat = item.repeat;
    audit.results.push(result);
    checkpoint();
    console.log(`DONE ${item.id} http=${result.status} calls=${result.calls.length} pipeline_ms=${result.pipelineMs}`);
    if (result.calls.some(call => call.error?.includes('401') || call.error?.includes('429'))) {
      audit.stoppedReason = 'Authentication or rate limit error; no automatic repeated billing attempts.';
      break;
    }
  }
  audit.finishedAt = new Date().toISOString();
  audit.totalCalls = totalCalls;
  checkpoint();
} catch (error) {
  audit.stoppedReason = safeError(error);
  audit.finishedAt = new Date().toISOString();
  checkpoint();
  console.error(audit.stoppedReason);
  process.exitCode = 1;
}
