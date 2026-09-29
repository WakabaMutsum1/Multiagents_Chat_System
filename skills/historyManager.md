---
name: history-manager
description:
当用户需要查询、查看、回顾、总结聊天历史记录时，优先使用 searchHistory。
Use this skill to search, review, or summarize chat history.
Only use deleteHistory or clearHistory when the user explicitly asks to delete records.

tools:
  - searchHistory
  - deleteHistory
  - clearHistory
---

# History Manager

## purpose

这个 skill 用来管理聊天历史记录。
This skill manages chat history records.

它可以：

- 根据关键词搜索历史记录
- 查看过去讨论过的内容
- 根据查询结果总结历史
- 删除指定的历史记录
- 清空全部历史记录

## when to use searchHistory

当用户询问以前聊过什么，或者想查找某个话题时，必须使用 `searchHistory`。

Use `searchHistory` when the user wants to:

- 查询以前聊过什么
- 查看之前有没有聊过某个话题
- 回顾之前的内容
- 总结之前的聊天记录
- 找以前提到过的内容
- search chat history
- review previous conversations
- summarize previous chat history

Important rules:

- 普通查询、回顾、总结历史记录时，只能使用 `searchHistory`。
- Do not use `deleteHistory` or `clearHistory` for search, review, or summary requests.
- 不要把“查询历史”“回顾历史”“总结历史”误判成删除或清空操作。
- If the user asks “我们之前聊过什么”, use `searchHistory`.
- If the user asks “之前有没有聊过某个话题”, use `searchHistory`.

args schema:

searchHistory:
  args:
    keyword: string, required. 要搜索的历史记录关键词。toolFunction 接收整个 args 对象，并读取 args.keyword。

args example:

{
  "keyword": "数据库 索引 性能优化"
}

reply rules:

- 根据工具返回结果回答用户。
- 如果没有找到结果，明确告诉用户没有匹配的历史记录。
- 不要编造数据库中不存在的内容。

## when to use deleteHistory

只有当用户明确要求删除某一条聊天记录，并且提供或确认记录 id 时，才允许使用 `deleteHistory`。

Use `deleteHistory` only when the user explicitly wants to delete one specific record.

Allowed examples:

- “删除 id 为 3 的记录”
- “帮我删除第 5 条历史记录”
- “确认删除这条记录”

Do not use deleteHistory when:

- 用户只是说“查看、查询、回顾、总结、找一下”
- 用户没有提供明确 id
- 用户只是问以前聊过什么

args schema:

deleteHistory:
  args:
    id: number, required. 要删除的历史记录 id。toolFunction 接收整个 args 对象，并读取 args.id。

args example:

{
  "id": 3
}

rules:

- 必须获得明确的记录 id。
- 在执行删除前，必须获得用户确认。
- 不允许自行猜测记录 id。
- 不允许删除多条记录，除非用户明确要求。

## when to use clearHistory

只有当用户明确要求清空、清除、删除全部聊天记录时，才允许使用 `clearHistory`。

Use `clearHistory` only when the user explicitly asks to clear or delete all chat history.

Allowed examples:

- “清空全部历史记录”
- “清除所有聊天记录”
- “删除全部记录”
- “确认清除所有历史记录”

Do not use clearHistory when:

- 用户只是说“我们之前聊过什么”
- 用户只是要求“总结之前内容”
- 用户只是要求“查一下历史记录”
- 用户只是要求搜索某个话题

args schema:

clearHistory:
  args: {}

args example:

{}

rules:

- 明确告知用户这会删除所有历史记录。
- 必须获得用户明确确认。
- 不允许把“删除某一条”误判成“清空全部”。
- 不允许把“查询历史”“总结历史”误判成“清空全部”。

## global rules

- tool must be one of: `searchHistory`, `deleteHistory`, `clearHistory`.
- args must strictly follow args schema.
- Do not rename `keyword` to query, text, content, or search.
- Do not rename `id` to recordId, messageId, number, or index.
- 查询操作可以自动执行。
- 删除单条记录和清空全部记录都必须经过用户确认。
- 不允许修改数据库中与历史记录无关的数据。
- 每次查询只返回最相关的少量结果，避免浪费 token。
- Return valid JSON only.