const fs = require("fs/promises");
const path = require("path");
const { skill_registry } = require("./skillRegistry");

async function skillCatalog(agentRole) {
    const skillDirectory = path.join(__dirname, "skills");
    const entries = await fs.readdir(skillDirectory, { withFileTypes: true });
    const catalog = [];

    for (const entry of entries) {
        const file = entry.isDirectory()
            ? path.join(entry.name, "SKILL.md")
            : entry.name;

        if (!file.endsWith(".md")) {
            continue;
        }

        const filePath = path.join(skillDirectory, file);
        let skillInfo;
        try {
            skillInfo = await fs.readFile(filePath, "utf8");
        } catch (error) {
            if (error.code === "ENOENT") {
                continue;
            }
            throw error;
        }

        const nameMatch = skillInfo.match(/^name:\s*(.+)$/m);
        const descriptionMatch = skillInfo.match(/^description:\s*([\s\S]*?)(?:\n\n|\ntools:|\n##|$)/m);
        const toolsMatch = skillInfo.match(/^tools:\s*\n((?:\s*-\s*.+\n?)+)/m);
        const declaredTools = toolsMatch
            ? toolsMatch[1].split("\n")
                .map((line) => line.replace(/^\s*-\s*/, "").replaceAll("`", "").trim())
                .filter(Boolean)
            : [];
        const skillName = nameMatch
            ? nameMatch[1].trim()
            : path.basename(file, ".md");
        const registrySkill = skill_registry[skillName];
        const tools = registrySkill
            ? Object.keys(registrySkill.tools).filter((toolName) => {
                const allowedAgents = registrySkill.toolPermissions?.[toolName] || [];
                return !agentRole || allowedAgents.includes(agentRole);
            })
            : declaredTools;

        if (tools.length === 0) {
            continue;
        }

        const argsSchema = registrySkill
            ? Object.fromEntries(
                tools.map((toolName) => [
                    toolName,
                    registrySkill.argsSchema?.[toolName] || { args: {} }
                ])
            )
            : {};
        const toolPermissions = registrySkill
            ? Object.fromEntries(
                tools.map((toolName) => [
                    toolName,
                    registrySkill.toolPermissions?.[toolName] || []
                ])
            )
            : {};

        catalog.push({
            name: skillName,
            description: descriptionMatch
                ? descriptionMatch[1].trim()
                : "没有描述",
            tools,
            toolPermissions,
            argsSchema,
            guide: skillInfo
        });
    }

    return catalog;
}

module.exports = { skillCatalog };
