const sql = require("../db");

async function clearHistory(args, userId) {
    return await sql`
        DELETE FROM messages
        WHERE user_id = ${userId}
        RETURNING *
    `;
}

module.exports = { clearHistory };
