const sql = require("../db");

async function deleteHistory(args, userId){
    const id = args.id;
    return await sql`
        DELETE FROM messages
        WHERE id = ${id} AND user_id = ${userId}
        RETURNING *
    `;
}

module.exports = { deleteHistory };
