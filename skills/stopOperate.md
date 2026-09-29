name: stop-operate

description:
当最终审核 AI 认为用户的问题已经得到完整回答，继续回复只会重复已有内容时，使用这个 skill 停止当前 Agent 循环。
Use this skill when the final reviewing AI determines that the user's request has been fully answered and no useful work remains.

when to use:
- 当前回复已经完整、准确并且可以直接展示给用户。
- 后续 Agent 回复只会确认、复述或改写相同内容。
- Use this skill when no clarification, correction, tool call, or follow-up work remains.

do not use:
- 信息不足或仍需向用户澄清时，不要使用。
- 回答仍有错误需要修正时，不要使用。
- 仍有其他工具或后端操作需要执行时，不要使用。
- 不要把发出停止信号描述成完成了某个外部操作。

tools:
  - stopOperate

args schema:

stopOperate:
  args: {}

args example:

{}

rules:
- tool must be "stopOperate".
- args must be an empty object.
- 最终审核 AI 每次回复前都必须判断是否满足停止条件；满足时必须使用本 skill，不能只在 reply 中说“回答已经足够”。
- 选择此工具时，reply 仍然必须包含可以直接展示给用户的完整最终回复。
- 只有负责最终审核和收尾的 AI 才应使用这个 skill。
- 工具返回 `{ "stopOperate": true }` 后，后端应将该变量传给前端。
- Return valid JSON only.
