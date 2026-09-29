const test = require("node:test");
const assert = require("node:assert/strict");
const {
    AgentOutputValidationError,
    parseAgentJson,
    validateAgentOutput
} = require("./agentResponse");

test("accepts a complete valid agent response", () => {
    assert.deepEqual(
        parseAgentJson('{"skill":"none","tool":"none","args":{},"reply":"完成"}'),
        { skill: "none", tool: "none", args: {}, reply: "完成" }
    );
});

test("rejects a missing reply instead of supplying a default", () => {
    assert.throws(
        () => validateAgentOutput({ skill: "none", tool: "none", args: {} }),
        (error) => {
            assert.equal(error instanceof AgentOutputValidationError, true);
            assert.equal(error.statusCode, 502);
            assert.match(error.message, /缺少必填字段 reply/);
            return true;
        }
    );
});

test("rejects an empty reply", () => {
    assert.throws(
        () => validateAgentOutput({
            skill: "none",
            tool: "none",
            args: {},
            reply: "   "
        }),
        /字段 reply 不能为空/
    );
});

test("rejects invalid field types and unknown fields", () => {
    assert.throws(
        () => validateAgentOutput({
            skill: "none",
            tool: "none",
            args: [],
            reply: "完成"
        }),
        /字段 args 必须是 JSON 对象/
    );
    assert.throws(
        () => validateAgentOutput({
            skill: "none",
            tool: "none",
            args: {},
            reply: "完成",
            extra: true
        }),
        /包含不允许的字段：extra/
    );
});

test("rejects inconsistent none fields", () => {
    assert.throws(
        () => validateAgentOutput({
            skill: "none",
            tool: "searchTavily",
            args: {},
            reply: "正在查询"
        }),
        /skill 为 none 时 tool 必须为 none/
    );
});
