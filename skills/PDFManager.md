name: pdf-generator

description:
当用户明确要求创建、生成、导出、保存、转换 PDF 文件时，使用这个 skill。
Use this skill only when the user explicitly wants a PDF file output.

when to use:
- 用户明确说“生成 PDF”“导出 PDF”“保存成 PDF”“转换成 PDF”“创建 PDF 文件”时，使用这个 skill。
- 用户提供文本、笔记、总结、报告或 HTML，并明确希望输出 PDF 文件时，使用这个 skill。
- Use this skill when the user explicitly asks to generate, export, save, convert, or create a PDF file.

do not use:
- 用户只是要求普通聊天、总结、解释、润色、翻译时，不要使用这个 skill。
- 用户没有明确要求 PDF 文件输出时，不要使用这个 skill。
- 不要因为用户提到“文档”“报告”“总结”就自动使用 generatePDF。
- Do not use this skill for normal chat, normal summarization, explanation, rewriting, or translation.
- Do not use this skill unless PDF output is explicitly requested.

tools:
  - generatePDF

args schema:

generatePDF:
  args:
    html: string, required. HTML 内容，用来生成 PDF。不能为空。toolFunction 接收整个 args 对象，并读取 args.html。
    filename: string, optional. 输出 PDF 文件名，建议以 .pdf 结尾。toolFunction 接收整个 args 对象，并读取 args.filename。

args examples:

Example 1:
{
  "html": "<h1>总结</h1><p>这是 PDF 的内容。</p>",
  "filename": "summary.pdf"
}

Example 2:
{
  "html": "<h1>报告</h1><ul><li>第一点</li><li>第二点</li></ul>",
  "filename": "report.pdf"
}

rules:
- tool must be "generatePDF".
- args must be an object.
- args must strictly follow args schema.
- html is required and must not be empty.
- filename is optional.
- 如果用户没有提供 filename，使用 "document.pdf"。
- filename should end with .pdf.
- html should be valid HTML or a valid HTML fragment.
- Do not rename html to content, text, body, markdown, or data.
- Do not rename filename to name, file, title, path, or output.
- Return valid JSON only.