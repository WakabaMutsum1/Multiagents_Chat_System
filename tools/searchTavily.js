async function searchTavily(args = {}) {
    const keyword = args.keyword;

    if (typeof keyword !== "string" || keyword.trim() === "") {
        throw new Error("searchTavily requires a non-empty args.keyword");
    }

    if (!process.env.TAVILY_API_KEY) {
        throw new Error("TAVILY_API_KEY is not configured");
    }

    const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            query: keyword.trim(),
            search_depth: "basic",
            max_results: 5,
            include_answer: false,
            include_raw_content: false
        }),
        signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
        throw new Error(`Tavily request failed with status ${response.status}`);
    }

    const data = await response.json();

    return {
        success: true,
        keyword: keyword.trim(),
        results: Array.isArray(data.results)
            ? data.results.map((item) => ({
                title: item.title || "无标题",
                url: item.url || "",
                content: item.content || "",
                score: typeof item.score === "number" ? item.score : null
            }))
            : []
    };
}

module.exports = { searchTavily };
