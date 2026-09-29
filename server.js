require("dotenv").config();

const sql = require("./db");
sql`SELECT NOW()`

    .then((result) => {

        console.log("数据库连接成功:", result[0]);

    })

    .catch((error) => {

        console.error("数据库连接失败:", error);

    });

const Groq = require("groq-sdk");
const express = require("express");
const path = require("path");
const { clerkMiddleware, getAuth } = require("@clerk/express");
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});
const app = express();
const chatRouter = require("./chat")
const rateBuckets = new Map();
const chatRateLimit = Number.parseInt(process.env.CHAT_RATE_LIMIT || "10", 10);
const chatRateWindowMs = Number.parseInt(process.env.CHAT_RATE_WINDOW_MS || "60000", 10);

function chatLimiter(req, res, next) {
    const now = Date.now();
    const clientKey = req.socket.remoteAddress || "unknown";
    const bucket = rateBuckets.get(clientKey);

    if (!bucket || now >= bucket.resetAt) {
        rateBuckets.set(clientKey, { count: 1, resetAt: now + chatRateWindowMs });
        return next();
    }

    if (bucket.count >= chatRateLimit) {
        const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
        res.set("Retry-After", String(retryAfterSeconds));
        return res.status(429).json({ error: "请求过于频繁，请稍后再试。" });
    }

    bucket.count += 1;
    next();
}
function identifyUser(req, res, next) {
    const { isAuthenticated, userId } = getAuth(req);
    if (!isAuthenticated || !userId) {
        return res.status(401).json({ error: "请先登录" });
    }
    req.user = { id: userId };
    next();
}

app.use(clerkMiddleware());
app.use(express.json());
app.get("/auth/config", (req, res) => {
    if (!process.env.CLERK_PUBLISHABLE_KEY) {
        return res.status(503).json({ error: "尚未配置 Clerk Publishable Key" });
    }
    res.json({ publishableKey: process.env.CLERK_PUBLISHABLE_KEY });
});
app.use("/chat", (req, res, next) => {
    if (req.method === "POST" && req.path === "/") {
        return chatLimiter(req, res, next);
    }
    next();
}, identifyUser, chatRouter);

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "chatdemo.html"));
});
app.get("/chatdemo.html", (req, res) => {
    res.sendFile(path.join(__dirname, "chatdemo.html"));
});
for (const file of ["style.css", "index.js", "auth.js"]) {
    app.get(`/${file}`, (req, res) => {
        res.sendFile(path.join(__dirname, file));
    });
}

const port = Number.parseInt(process.env.PORT || "3000", 10);

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
