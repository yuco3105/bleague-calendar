// Bリーグ公式サイトから2026-27シーズン(B.PREMIER)の全試合データを取得する
// 使い方: node scrape-season.js  →  games.json を生成
const fs = require('fs');
const path = require('path');

// シーズン対象月（試合がない月は自動的にスキップされる）
const SEASON = [
  [2026, 9], [2026, 10], [2026, 11], [2026, 12],
  [2027, 1], [2027, 2], [2027, 3], [2027, 4], [2027, 5], [2027, 6],
];
const WAIT_MS = 1200; // サーバーに負荷をかけないための間隔
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchHtml(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

// 月ページの日付スライダーから試合開催日の一覧を取り出す
function parseGameDays(html) {
  const days = new Set();
  for (const m of html.matchAll(/class="js_click_data" data-day="(\d+)"/g)) {
    days.add(Number(m[1]));
  }
  return [...days].sort((a, b) => a - b);
}

// 日別ページから試合一覧を取り出す
function parseGames(html, dateStr) {
  const games = [];
  const chunks = html.split(/<li class="list-item" id="/).slice(1);
  for (const chunk of chunks) {
    const id = chunk.match(/^(\d+)/)?.[1];
    const home = chunk.match(/<span class="team home">[\s\S]*?<span class="team-name">([^<]*)<\/span>/)?.[1]?.trim();
    const away = chunk.match(/<span class="team away">[\s\S]*?<span class="team-name">([^<]*)<\/span>/)?.[1]?.trim();
    const arenaBlock = chunk.match(/<div class="info-arena">([\s\S]*?)<\/div>/)?.[1] ?? '';
    const spans = [...arenaBlock.matchAll(/<span[^>]*>([^<]*)<\/span>/g)]
      .map((m) => m[1].trim())
      .filter(Boolean);
    const arena = spans.find((s) => s.includes('|')) ?? spans[0] ?? '';
    const time = spans.find((s) => /^\d{1,2}:\d{2}$/.test(s)) ?? '';
    const score = chunk.match(/<span class="point font-blg">\s*([\d\s-]+?)\s*<\/span>/)?.[1]?.trim() || null;
    if (id && home && away) {
      games.push({ date: dateStr, id, home, away, arena, time, score });
    }
  }
  return games;
}

(async () => {
  const byId = new Map();
  for (const [year, mon] of SEASON) {
    const mm = String(mon).padStart(2, '0');
    const monthUrl = `https://www.bleague.jp/schedule/?year=${year}&mon=${mm}&tab=1`;
    let monthHtml;
    try {
      monthHtml = await fetchHtml(monthUrl);
    } catch (e) {
      console.error(`skip ${year}-${mm}: ${e.message}`);
      continue;
    }
    const days = parseGameDays(monthHtml);
    console.log(`${year}-${mm}: game days = [${days.join(', ')}]`);
    await sleep(WAIT_MS);
    for (const day of days) {
      const dateStr = `${year}-${mm}-${String(day).padStart(2, '0')}`;
      const dayUrl = `https://www.bleague.jp/schedule/?year=${year}&mon=${mm}&day=${day}&tab=1`;
      try {
        const html = await fetchHtml(dayUrl);
        const games = parseGames(html, dateStr);
        for (const g of games) byId.set(g.id, g);
        console.log(`  ${dateStr}: ${games.length} games`);
      } catch (e) {
        console.error(`  ${dateStr}: ERROR ${e.message}`);
      }
      await sleep(WAIT_MS);
    }
  }
  const games = [...byId.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)
  );
  const out = { updated: new Date().toISOString(), count: games.length, games };
  fs.writeFileSync(path.join(__dirname, 'games.json'), JSON.stringify(out, null, 1), 'utf8');
  console.log(`TOTAL: ${games.length} games -> games.json`);
})();
