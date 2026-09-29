const { AgentOutputValidationError } = require('./agentResponse');

const reviewContract = '只输出 JSON，必须且只能包含 decision、reasonCode、reason、retryHint、reply。decision 为 retry 或 final；reasonCode 为 wrong_tool、wrong_scope、tool_error、sufficient_evidence、insufficient_evidence 或 retry_exhausted；reason 必须非空。retry 时 retryHint 必须非空，reply 为空；final 时 retryHint 为空，reply 为完整非空最终答案。';

function parseReviewJson(content) {
    let value;
    try { value = JSON.parse(content); } catch { throw new AgentOutputValidationError('审核结果不是 JSON'); }
    const fields = ['decision', 'reasonCode', 'reason', 'retryHint', 'reply'];
    if (!value || Array.isArray(value) || Object.keys(value).length !== fields.length ||
        fields.some(key => typeof value[key] !== 'string') ||
        !['retry', 'final'].includes(value.decision) || !value.reason.trim()) {
        throw new AgentOutputValidationError('审核字段无效');
    }
    const retryReasons = ['wrong_tool', 'wrong_scope', 'tool_error'];
    if (![...retryReasons, 'sufficient_evidence', 'insufficient_evidence', 'retry_exhausted'].includes(value.reasonCode) ||
        (value.decision === 'retry' && (!retryReasons.includes(value.reasonCode) || !value.retryHint.trim() || value.reply !== '')) ||
        (value.decision === 'final' && (!value.reply.trim() || value.retryHint !== ''))) {
        throw new AgentOutputValidationError('审核决策与内容不一致');
    }
    return value;
}

function preflightReason(question, action) {
    const historyRequest = /此前|之前|上次|聊天|对话|我说过|你说过|我们聊/.test(question);
    const externalRequest = /查阅|核实|查证|搜索|检索|查询|查找/.test(question) && /报告|项目|公告|官网|发布|试验/.test(question);
    if (action.tool === 'searchHistory' && externalRequest && !historyRequest) {
        return '用户要求核实外部资料，searchHistory 只能检索聊天记录；请重新选择 searchTavily 检索相关来源。';
    }
    return null;
}

module.exports = { reviewContract, parseReviewJson, preflightReason };
