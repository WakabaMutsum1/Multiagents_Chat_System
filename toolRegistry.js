const { getHistory } = require("./tools/searchHistory");
const { deleteHistory } = require("./tools/deleteHistory");
const { clearHistory } = require("./tools/clearHistory");
const { generatePDF } = require("./tools/generatePDF");
const { stopOperate } = require("./tools/stopOperate");
const { searchTavily } = require("./tools/searchTavily");

const tool_registry = {
    searchHistory: getHistory,
    deleteHistory,
    clearHistory,
    generatePDF,
    stopOperate,
    searchTavily
};

module.exports = { tool_registry };
