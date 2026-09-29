const { createEmbedding }= require("../createEmbedding");  
const sql = require("../db");


async function getHistory(args, userId){
    const keyword = await createEmbedding(args.keyword);
    const vectorLiteral = `[${keyword.map(n => Number(n)).join(",")}]`;
    const query = `
        SELECT
        m.id,
        m.user_message,
        m.agent_a,
        m.agent_b,
        m.agent_c,
        k.user_embedding <-> $1::vector AS distance
        FROM knowledge_chunks AS k
        JOIN messages AS m ON m.id = k.message_id
        WHERE m.user_id = $2
        ORDER BY distance ASC
        LIMIT 5
    `;
    const result = await sql.query(query, [vectorLiteral, userId]);
    return result;
}

module.exports = { getHistory };
