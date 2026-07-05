// ============================================================
// Bカレ ウィジェット（iPhone / Scriptableアプリ用）
// ホーム画面に「今日のBリーグ全試合」を表示します
//
// 【設定】下の2行だけ自分用に書き換えてください
// ============================================================
const DATA_URL = "https://あなたのユーザー名.github.io/bleague-calendar/games.json"; // ←公開後のURLに変更
const FAVS = []; // 推しクラブ（例: ["琉球", "川崎"]）金色で上に表示されます
// ============================================================

const GOLD = new Color("#ffb61e");
const WHITE = new Color("#eef1f8");
const GRAY = new Color("#9aa2b8");
const BG = new Color("#0d1220");
const WEEK = ["日", "月", "火", "水", "木", "金", "土"];

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// データ取得
const req = new Request(DATA_URL);
const data = await req.loadJSON();
const games = data.games ?? data;

// 今日の試合（なければ次の試合日）
const today = ymd(new Date());
let dayGames = games.filter((g) => g.date === today);
let title = "今日の試合";
if (dayGames.length === 0) {
  const dates = [...new Set(games.map((g) => g.date))].sort();
  const next = dates.find((d) => d > today);
  if (next) {
    dayGames = games.filter((g) => g.date === next);
    const nd = new Date(next + "T00:00:00");
    title = `次は ${nd.getMonth() + 1}/${nd.getDate()}(${WEEK[nd.getDay()]})`;
  } else {
    title = "今シーズンの予定は終了";
  }
}
// 推しクラブ優先 → 時刻順
dayGames.sort((a, b) => {
  const af = FAVS.includes(a.home) || FAVS.includes(a.away);
  const bf = FAVS.includes(b.home) || FAVS.includes(b.away);
  if (af !== bf) return af ? -1 : 1;
  return a.time.localeCompare(b.time);
});

// ウィジェット組み立て
const w = new ListWidget();
w.backgroundColor = BG;
w.setPadding(14, 16, 12, 16);
w.url = DATA_URL.replace("games.json", ""); // タップでアプリを開く

const head = w.addText(`🏀 ${title}  ${dayGames.length}試合`);
head.font = Font.heavySystemFont(13);
head.textColor = GOLD;
w.addSpacer(7);

const family = config.widgetFamily || "medium";
const maxRows = family === "large" ? 10 : family === "medium" ? 4 : 2;

for (const g of dayGames.slice(0, maxRows)) {
  const isFav = FAVS.includes(g.home) || FAVS.includes(g.away);
  const row = w.addStack();
  row.centerAlignContent();
  const time = row.addText(g.time);
  time.font = Font.mediumSystemFont(11);
  time.textColor = GRAY;
  row.addSpacer(8);
  const txt = row.addText(`${isFav ? "⭐" : ""}${g.home} - ${g.away}`);
  txt.font = isFav ? Font.boldSystemFont(13) : Font.mediumSystemFont(13);
  txt.textColor = isFav ? GOLD : WHITE;
  txt.lineLimit = 1;
  w.addSpacer(4);
}
if (dayGames.length > maxRows) {
  const more = w.addText(`ほか ${dayGames.length - maxRows} 試合`);
  more.font = Font.mediumSystemFont(10);
  more.textColor = GRAY;
}

// 3時間ごとに自動更新
w.refreshAfterDate = new Date(Date.now() + 3 * 60 * 60 * 1000);

if (config.runsInWidget) {
  Script.setWidget(w);
} else {
  await w.presentMedium(); // Scriptableアプリ内で実行したときのプレビュー
}
Script.complete();
