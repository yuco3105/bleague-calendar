// ============================================================
// Bカレ ウィジェット（読み込み用・iPhone / Scriptable）
// これをScriptableに1回貼っておけば、以後ウィジェットの中身を直しても
// 貼り直し不要（毎回GitHub Pagesから最新版を読み込んで実行します）
// ============================================================
globalThis.BCAL_FAVS = []; // 推しクラブ（例: ["琉球", "川崎"]）
// ============================================================

const url = "https://yuco3105.github.io/bleague-calendar/widget-scriptable.js?t=" + Date.now();
const src = await new Request(url).loadString();
await eval(`(async () => { ${src} })()`);
