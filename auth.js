const authPanel = document.querySelector("#authPanel");
const authStatus = document.querySelector("#authStatus");
const signIn = document.querySelector("#signIn");
const userButton = document.querySelector("#userButton");

let clerk;
let signInMounted = false;
let userButtonMounted = false;
let currentUserId;

function loadScript(src, publishableKey) {
    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = src;
        script.crossOrigin = "anonymous";
        if (publishableKey) {
            script.dataset.clerkPublishableKey = publishableKey;
        }
        script.onload = resolve;
        script.onerror = () => reject(new Error("无法加载 Clerk 登录组件"));
        document.head.append(script);
    });
}

function updateAuthUI() {
    const signedIn = Boolean(clerk?.user && clerk?.session);
    const nextUserId = signedIn ? clerk.user.id : null;
    if (currentUserId !== nextUserId) {
        currentUserId = nextUserId;
        window.dispatchEvent(new CustomEvent("auth-user-changed"));
    }
    document.body.classList.toggle("is-signed-in", signedIn);
    authPanel.hidden = signedIn;

    if (signedIn) {
        if (signInMounted) {
            clerk.unmountSignIn(signIn);
            signInMounted = false;
        }
        if (!userButtonMounted) {
            clerk.mountUserButton(userButton);
            userButtonMounted = true;
        }
    } else {
        if (userButtonMounted) {
            clerk.unmountUserButton(userButton);
            userButtonMounted = false;
        }
        authStatus.textContent = "登录或注册后即可开始聊天。";
        if (!signInMounted) {
            clerk.mountSignIn(signIn);
            signInMounted = true;
        }
    }
}

window.clerkReady = (async () => {
    try {
        const response = await fetch("/auth/config");
        if (!response.ok) throw new Error("Clerk 配置未就绪");
        const { publishableKey } = await response.json();
        const domain = atob(publishableKey.split("_")[2]).slice(0, -1);
        const origin = `https://${domain}`;

        await loadScript(`${origin}/npm/@clerk/ui@1/dist/ui.browser.js`);
        await loadScript(`${origin}/npm/@clerk/clerk-js@6/dist/clerk.browser.js`, publishableKey);
        clerk = window.Clerk;
        await clerk.load({ ui: { ClerkUI: window.__internal_ClerkUICtor } });
        clerk.addListener(updateAuthUI);
        updateAuthUI();
        return clerk;
    } catch (error) {
        console.error("Clerk 登录初始化失败:", error);
        authStatus.textContent = "登录功能暂时不可用，请检查后端配置后刷新页面。";
        throw error;
    }
})();
