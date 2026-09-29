const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { parseReviewJson, preflightReason } = require('./reviewProtocol');

const action = (tool = 'searchTavily') => ({ skill: tool === 'searchHistory' ? 'history-manager' : 'search-tavily', tool, args: { keyword: '报告' }, reply: '正在检索' });
const draft = { skill: 'none', tool: 'none', args: {}, reply: '候选答案' };
const retry = { decision: 'retry', reasonCode: 'wrong_scope', reason: '检索范围错误', retryHint: '查询试验报告', reply: '' };
const final = { decision: 'final', reasonCode: 'insufficient_evidence', reason: '只有目标', retryHint: '', reply: '22%仅为目标，尚无实测结果。' };

async function run(outputs, question = '请查阅星苇试验报告，给出节能比例') {
    let handler;
    const executed = [], requests = [];
    const mocks = {
        './db': () => { throw Error('must not write'); },
        './createEmbedding': {},
        './skillCatalog': { skillCatalog: async () => [] },
        './prompts/catalogPrompt': { createCatalogPrompt: () => '' },
        './toolUser': { toolUser: async (role, skill, tool) => {
            executed.push(tool);
            return tool === 'stopOperate' ? { stopOperate: true } : { success: true, results: [] };
        } },
        express: { Router: () => ({ post: (_, fn) => { handler = fn; }, get() {} }) },
        'groq-sdk': class { constructor() { this.chat = { completions: { create: async request => {
            requests.push(request);
            assert.ok(outputs.length, 'unexpected model call');
            return { choices: [{ message: { content: JSON.stringify(outputs.shift()) } }] };
        } } }; } }
    };
    vm.runInNewContext(fs.readFileSync(require.resolve('./chat'), 'utf8'), {
        require: name => mocks[name] || require(name), module: { exports: {} },
        process: { env: {} }, console: { log() {}, warn() {}, error() {} }
    });
    let body, status = 200;
    await handler({ body: { originalMessage: question, messageHistory: question } }, {
        status(code) { status = code; return this; }, json(value) { body = value; }
    });
    assert.equal(status, 200, JSON.stringify(body));
    assert.equal(outputs.length, 0);
    return { body, executed, requests };
}

test('preflight preserves explicit history requests', () => {
    assert.ok(preflightReason('请查阅项目试验报告', action('searchHistory')));
    assert.ok(preflightReason('请检索苔桥项目的团队名单，谁负责软件组？硬件组是谁负责？', action('searchHistory')));
    assert.equal(preflightReason('查找此前聊天中的项目报告', action('searchHistory')), null);
});
test('review contract rejects malformed and inconsistent decisions', () => {
    assert.deepEqual(parseReviewJson(JSON.stringify(retry)), retry);
    assert.throws(() => parseReviewJson(JSON.stringify({ ...retry, retryHint: '' })));
    assert.throws(() => parseReviewJson(JSON.stringify({ ...final, extra: true })));
    assert.throws(() => parseReviewJson(JSON.stringify({ ...retry, reasonCode: 'insufficient_evidence' })));
});
test('wrong history tool is blocked before execution and consumes shared retry', async () => {
    const { body, executed } = await run([action('searchHistory'), action(), draft, final]);
    assert.deepEqual(executed, ['searchTavily', 'stopOperate']);
    assert.equal(body.retriesUsed, 1);
    assert.equal(body.attempts[0].stage, 'preflight');
});
test('C feedback reruns A, B and C once and is visible to A', async () => {
    const { body, requests, executed } = await run([action(), draft, retry, action(), draft, final]);
    assert.equal(body.attempts.length, 2);
    assert.equal(body.finalAnswer, final.reply);
    assert.match(requests[3].messages[1].content, /wrong_scope|检索范围错误/);
    assert.deepEqual(executed, ['searchTavily', 'searchTavily', 'stopOperate']);
});
test('repeated retry from C is bounded and becomes an explicit final limitation', async () => {
    const { body } = await run([action(), draft, retry, action(), draft, retry]);
    assert.equal(body.review.reasonCode, 'retry_exhausted');
    assert.equal(body.stopOperate, true);
});
test('preflight and C cannot each obtain a retry', async () => {
    const { body, executed } = await run([action('searchHistory'), action('searchHistory'), draft, retry]);
    assert.deepEqual(executed, ['stopOperate']);
    assert.equal(body.retriesUsed, 1);
    assert.equal(body.review.reasonCode, 'retry_exhausted');
});
test('correct search with insufficient evidence ends without retry', async () => {
    const { body } = await run([action(), draft, final]);
    assert.equal(body.retriesUsed, 0);
    assert.equal(body.review.reasonCode, 'insufficient_evidence');
});
test('invalid C JSON is retried with the C contract', async () => {
    const { requests } = await run([action(), draft, {}, final]);
    assert.match(requests[3].messages[0].content, /decision、reasonCode、reason、retryHint、reply/);
    assert.doesNotMatch(requests[3].messages[0].content, /必须且只能包含 skill/);
});
