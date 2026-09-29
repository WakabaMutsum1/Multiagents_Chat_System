class AgentOutputValidationError extends Error {
    constructor(message) {
        super(`模型输出无效：${message}`);
        this.name = "AgentOutputValidationError";
        this.statusCode = 502;
        this.code = "INVALID_MODEL_OUTPUT";
    }
}

function parseAgentJson(content) {
    if (typeof content !== "string" || content.trim() === "") {
        throw new AgentOutputValidationError("返回内容为空");
    }

    const text = content.trim();
    let parsed;

    try {
        parsed = JSON.parse(text);
    } catch {
        const start = text.indexOf("{");
        const end = text.lastIndexOf("}");

        if (start === -1 || end <= start) {
            throw new AgentOutputValidationError("返回内容不是合法 JSON 对象");
        }

        try {
            parsed = JSON.parse(text.slice(start, end + 1));
        } catch {
            throw new AgentOutputValidationError("返回内容不是合法 JSON 对象");
        }
    }

    return validateAgentOutput(parsed);
}

function validateAgentOutput(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new AgentOutputValidationError("顶层必须是 JSON 对象");
    }

    const requiredFields = ["skill", "tool", "args", "reply"];
    const unknownFields = Object.keys(value).filter(
        (field) => !requiredFields.includes(field)
    );
    if (unknownFields.length > 0) {
        throw new AgentOutputValidationError(
            `包含不允许的字段：${unknownFields.join(", ")}`
        );
    }

    for (const field of requiredFields) {
        if (!Object.prototype.hasOwnProperty.call(value, field)) {
            throw new AgentOutputValidationError(`缺少必填字段 ${field}`);
        }
    }

    for (const field of ["skill", "tool", "reply"]) {
        if (typeof value[field] !== "string") {
            throw new AgentOutputValidationError(`字段 ${field} 必须是字符串`);
        }
        if (value[field].trim() === "") {
            throw new AgentOutputValidationError(`字段 ${field} 不能为空`);
        }
    }

    if (
        value.args === null ||
        typeof value.args !== "object" ||
        Array.isArray(value.args)
    ) {
        throw new AgentOutputValidationError("字段 args 必须是 JSON 对象");
    }

    if (value.skill === "none") {
        if (value.tool !== "none") {
            throw new AgentOutputValidationError(
                "skill 为 none 时 tool 必须为 none"
            );
        }
        if (Object.keys(value.args).length !== 0) {
            throw new AgentOutputValidationError(
                "skill 为 none 时 args 必须是空对象"
            );
        }
    } else if (value.tool === "none") {
        throw new AgentOutputValidationError(
            "skill 非 none 时 tool 不能为 none"
        );
    }

    return {
        skill: value.skill,
        tool: value.tool,
        args: value.args,
        reply: value.reply
    };
}

module.exports = {
    AgentOutputValidationError,
    parseAgentJson,
    validateAgentOutput
};
