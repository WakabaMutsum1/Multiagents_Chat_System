let embedder = null;

async function getEmbedder() {
  if (!embedder) {
    const { pipeline } = await import("@huggingface/transformers");
    embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return embedder;
}

async function createEmbedding(text) {
  if(typeof text !== "string" || text.trim() === "") {
      text = "没有回复";
  } else{
      text = text.trim();
  }
  const model = await getEmbedder();
  const output = await model(text, { pooling: "mean", normalize: true });
  
  if (Array.isArray(output)) return output.flat().map(Number);
  if (output && output.data) return Array.from(output.data).map(Number);
  try {
    return Array.from(output).map(Number);
  } catch (e) {
    throw new Error('Unable to parse embedding output');
  }
}

module.exports = { createEmbedding };
