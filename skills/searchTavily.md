name: search-tavily

description:
当用户要求联网搜索、查询最新公开信息或回答需要可核验的网页证据时，使用 Tavily 搜索并返回标题、URL 和相关内容片段。不要用于查询聊天历史、私人数据或无需联网的普通任务。

tools:
  - searchTavily

# Search Tavily

## Purpose

使用 Tavily 搜索公开网页，为回答者提供可核验的资料片段。

## Tool

### searchTavily

args schema:

```yaml
args:
  keyword: string, required. 简洁、具体且非空的搜索关键词。
```

args example:

```json
{
  "keyword": "原神 官方 世界观 游戏设定"
}
```

## Rules

- 只有 `data-provider` 可以调用此 Tool。
- 用户明确要求联网、查询最新信息或需要公开网页证据时使用。
- 搜索聊天历史时使用 `searchHistory`，不要使用本 Tool。
- 不要搜索用户私人数据、凭证或内部数据库信息。
- 调用前不得声称已经获得搜索结果。
- 只把 Tool 实际返回的 `title`、`url`、`content` 和 `score` 当作搜索资料。
- `content` 是相关内容片段，不等于整篇网页，也不保证事实正确。
- 不要仅凭标题推导详细事实。
- 搜索失败或结果为空时，明确说明没有取得可靠资料。
- 不得编造来源、URL、引文或搜索结果。

## Reply rules

- 调用 Tool 时，`reply` 只简短说明正在搜索相关资料。
- 不要在 Tool 返回前提前回答需要核验的事实。

## Agent output example

```json
{
  "skill": "search-tavily",
  "tool": "searchTavily",
  "args": {
    "keyword": "原神 官方 世界观 游戏设定"
  },
  "reply": "正在搜索与原神游戏设定相关的公开资料。"
}
```

## Global rules

- tool must be `searchTavily`.
- args must strictly follow the schema.
- Return valid JSON only.
