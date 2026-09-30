const input = document.querySelector("#messageInput");
const button = document.querySelector("#sendButton");
const box = document.querySelector("#box");

let messageHistory = [];
let isSending = false;

let isLoadingHistory = false;
let historyLoadVersion = 0;

function appendMessage(content, className) {
    const element = document.createElement("div");
    element.textContent = content;
    element.className = `message ${className}`;
    box.append(element);
}

async function loadHistory() {
    const version = ++historyLoadVersion;
    isLoadingHistory = true;
    messageHistory = [];
    box.replaceChildren();

    try {
        const clerk = await window.clerkReady;
        if (version !== historyLoadVersion) return;
        if (!clerk.user || !clerk.session) return;

        const userId = clerk.user.id;
        const token = await clerk.session.getToken();
        if (!token) throw new Error("登录已失效，请重新登录");

        const response = await fetch("/chat/history", {
            headers: {
                Authorization: `Bearer ${token}`
            },
            cache: "no-store"
        });

        const rows = await response.json();
        if (!response.ok) {
            throw new Error(rows.error || "历史记录加载失败");
        }
        if (!Array.isArray(rows)) {
            throw new Error("历史记录返回格式错误");
        }

        
        if (
            version !== historyLoadVersion ||
            clerk.user?.id !== userId
        ) return;

        
        for (const row of [...rows].reverse()) {
            appendMessage(row.user_message, "user-message");
            messageHistory.push({
                role: "user",
                content: row.user_message
            });

            
            const answer = row.agent_c || row.agent_b;
            if (answer) {
                appendMessage(answer, "agent-c-message");
                messageHistory.push({
                    role: "assistant",
                    content: answer
                });
            }
        }

        box.scrollTop = box.scrollHeight;
    } catch (error) {
        if (version !== historyLoadVersion) return;
        console.error("历史加载失败:", error);
        appendMessage(
            error.message || "历史记录加载失败，请刷新重试",
            "error-message"
        );
    } finally {
        if (version === historyLoadVersion) {
            isLoadingHistory = false;
        }
    }
}

window.addEventListener("auth-user-changed", () => {
    input.value = "";
    loadHistory();
});

window.clerkReady.then(() => loadHistory()).catch(() => {});

async function sendMessage() {
    let clerk;
    try {
        clerk = await window.clerkReady;
    } catch {
        return;
    }
    if (!clerk.session) {
        return;
    }
    const userIdAtStart = clerk.user.id;

    const originalMessage = input.value.trim();
    const historyCheckpoint = messageHistory.length;

    if (isSending || isLoadingHistory) {
        const busyMessage = document.createElement("div");
        busyMessage.textContent = "前面正在运行，请稍后再试";
        busyMessage.className = "message info-message";
        box.append(busyMessage);
        box.scrollTop = box.scrollHeight;
        return;
    }

    if (!originalMessage) {
        return;
    }

    isSending = true;
    button.disabled = true;
    button.classList.add("is-sending");
    button.setAttribute("aria-busy", "true");
    button.textContent = "";

    const userMessage = document.createElement("div");
    userMessage.textContent = originalMessage;
    userMessage.className = "message user-message";

    box.append(userMessage);
    box.scrollTop = box.scrollHeight;
    input.value = "";

    try {
        messageHistory.push({
            role: "user",
            content: originalMessage
        });

        const formattedMessageHistory = messageHistory
            .map((message) => {
                if (message.role !== "user" && message.role !== "assistant") {
                    throw new Error(`未知的消息角色：${message.role}`);
                }
                const responder = message.role === "user" ? "用户" : "助手";
                return `${responder}：${message.content}`;
            })
            .join("\n\n");

        const token = await clerk.session.getToken();
        if (!token) throw new Error("登录已失效，请重新登录");

        const response = await fetch("/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
                originalMessage,
                messageHistory: formattedMessageHistory
            })
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(
                data.error || `Server error: ${response.status} ${response.statusText}`
            );
        }
        if (clerk.user?.id !== userIdAtStart) return;

        const agentReplies = [{ content: data.finalAnswer, className: "agent-c-message" }].filter(reply => reply.content);

        if (data.finalAnswer) {
            messageHistory.push({
                role: "assistant",
                content: data.finalAnswer
            });
        }

        for (const reply of agentReplies) {
            const agentMessage = document.createElement("div");
            agentMessage.textContent = reply.content;
            agentMessage.className = `message ${reply.className}`;
            box.append(agentMessage);
        }

        if (data.saved === false) {
            const saveWarning = document.createElement("div");
            saveWarning.textContent = data.saveWarning || "回答已生成，但历史记录保存失败。";
            saveWarning.className = "message info-message";
            box.append(saveWarning);
        }

        box.scrollTop = box.scrollHeight;
    } catch (error) {
        messageHistory.length = historyCheckpoint;
        console.error(error);
        const errorMessage = document.createElement("div");
        errorMessage.textContent = error.message || "请求失败，请稍后重试。";
        errorMessage.className = "message error-message";
        box.append(errorMessage);
        box.scrollTop = box.scrollHeight;
    } finally {
        isSending = false;
        button.disabled = false;
        button.classList.remove("is-sending");
        button.setAttribute("aria-busy", "false");
        button.textContent = "";
        input.focus();
    }
}

button.addEventListener("click", sendMessage);
input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.isComposing) {
        event.preventDefault();
        sendMessage();
    }
});
