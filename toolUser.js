const { skill_registry } = require("./skillRegistry");

async function toolUser(agentRole, skill, tool, args = {}, context = {}){
    try{
        if (skill === "none" && tool === "none") {
            return undefined;
        }

        const trySkill = skill_registry[skill];
        if (!trySkill) {
            throw new Error(`Skill 不存在：${skill}`);
        }

        const toolFunction = trySkill.tools[tool];
        if (!toolFunction) {
            throw new Error(`Tool 不属于 Skill ${skill}：${tool}`);
        }

        const allowedAgents = trySkill.toolPermissions?.[tool] || [];
        if (!allowedAgents.includes(agentRole)) {
            throw new Error(`${agentRole} 不允许调用工具：${tool}`);
        }

        if (skill === "history-manager") {
            if (!context.userId) {
                throw new Error("请先登录后使用历史记录工具");
            }
            return await toolFunction(args, context.userId);
        }

        return await toolFunction(args);
    }catch(error){
        console.error(error.message);
        throw error;
    }
}

module.exports = { toolUser };
