const { tool_registry } = require("./toolRegistry");

const skill_registry = {
    "history-manager": {
        file: "historyManager.md",
        tools: {
            searchHistory: tool_registry.searchHistory,
            deleteHistory: tool_registry.deleteHistory,
            clearHistory: tool_registry.clearHistory
        },
        toolPermissions: {
            searchHistory: ["data-provider"],
            deleteHistory: [],
            clearHistory: []
        },
        argsSchema: {
            searchHistory: {
                args: {
                    keyword: "string，必填。要搜索的历史记录关键词。toolFunction 接收整个 args 对象，并读取 args.keyword。"
                }
            },
            deleteHistory: {
                args: {
                    id: "number，必填。要删除的历史记录 id。toolFunction 接收整个 args 对象，并读取 args.id。"
                }
            },
            clearHistory: {
                args: {}
            }
        },
        readOnly: true
    },
    "pdf-generator": {
        file: "PDFManager.md",
        tools: {
            generatePDF: tool_registry.generatePDF
        },
        toolPermissions: {
            generatePDF: ["data-provider"]
        },
        argsSchema: {
            generatePDF: {
                args: {
                    html: "string，必填。HTML 内容，用来生成 PDF，不能为空。toolFunction 接收整个 args 对象，并读取 args.html。",
                    filename: "string，可选。输出 PDF 文件名，建议以 .pdf 结尾。toolFunction 接收整个 args 对象，并读取 args.filename。"
                }
            }
        },
        readOnly: false
    },
    "stop-operate": {
        file: "stopOperate.md",
        tools: {
            stopOperate: tool_registry.stopOperate
        },
        toolPermissions: {
            stopOperate: ["answer-reviewer"]
        },
        argsSchema: {
            stopOperate: {
                args: {}
            }
        },
        readOnly: true
    },
    "search-tavily": {
        file: "searchTavily.md",
        tools: {
            searchTavily: tool_registry.searchTavily
        },
        toolPermissions: {
            searchTavily: ["data-provider"]
        },
        argsSchema: {
            searchTavily: {
                args: {
                    keyword: "string，必填。简洁、具体且非空的 Tavily 搜索关键词。"
                }
            }
        },
        readOnly: true
    }
};

module.exports = { skill_registry };
