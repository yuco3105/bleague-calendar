// FIBA公式の試合ページから男子日本代表の試合結果を取得し japan.json の result を埋める
// 使い方: node scrape-japan-results.js  →  japan.json を書き換え（変化がなければ何もしない）
//
// 対象は fibaId を持つ試合（W杯予選）だけ。強化試合はFIBA管轄外でIDがないため自動取得できず、
// アプリ側の「結果未入力」バッジで気づいて手動更新する運用。
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
const WAIT_MS = 1500; // サーバーに負荷をかけないための間隔
const EVENT = 'fiba-basketball-world-cup-2027-asian-qualifiers';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchHtml(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

// 日本時間の今日（YYYY-MM-DD）。GitHub ActionsはUTCで動くため明示的に+9時間する
function todayJst() {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

// fibaId は "126926-CHN-JPN" 形式（HOME-AWAYの順）
function parseFibaId(fibaId) {
  const m = /^(\d+)-([A-Z]{3})-([A-Z]{3})$/.exec(fibaId);
  if (!m) return null;
  return { num: m[1], home: m[2], away: m[3] };
}

// 試合ページのスコア表示（例: >73<!-- --> - <!-- -->92<）から HOME-AWAY を取り出す。
// 未実施の試合ではスコア要素そのものが出ないため null が返る（誤検出しないことを検証済み）
function parseScore(html) {
  const m = /<\/svg><\/div>(\d{1,3})(?:<!-- -->)?\s*-\s*(?:<!-- -->)?(\d{1,3})</.exec(html)
    ?? /[>](\d{1,3})(?:<!-- -->)?\s+-\s+(?:<!-- -->)?(\d{1,3})</.exec(html);
  if (!m) return null;
  const home = Number(m[1]);
  const away = Number(m[2]);
  // バスケの得点として現実的な範囲か（誤検出よけ）
  if (!(home >= 30 && home <= 200 && away >= 30 && away <= 200)) return null;
  return { home, away };
}

(async () => {
  const file = path.join(__dirname, 'japan.json');
  // エディタがBOMを付けてしまうことがあるので剥がしてから読む
  const data = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^﻿/, ''));
  const today = todayJst();
  let changed = 0;
  const manualPending = [];

  for (const g of data.games) {
    if (g.result) continue;
    if (g.date >= today) continue; // まだ終わっていない試合は触らない

    if (!g.fibaId) {
      manualPending.push(`${g.date} ${g.opponent}（${g.comp}）`);
      continue;
    }
    const info = parseFibaId(g.fibaId);
    if (!info) {
      console.error(`  ${g.date}: fibaId の形式が不正 (${g.fibaId})`);
      continue;
    }

    const url = `https://www.fiba.basketball/en/events/${EVENT}/games/${g.fibaId}`;
    try {
      const html = await fetchHtml(url);
      const score = parseScore(html);
      if (!score) {
        console.log(`  ${g.date} vs ${g.opponent}: スコア未掲載（延期/未反映の可能性）`);
      } else {
        const jpnIsHome = info.home === 'JPN';
        const jpn = jpnIsHome ? score.home : score.away;
        const opp = jpnIsHome ? score.away : score.home;
        g.result = `${jpn > opp ? '○' : '●'} ${jpn}-${opp}`;
        changed++;
        console.log(`  ${g.date} vs ${g.opponent}: ${g.result}`);
      }
    } catch (e) {
      console.error(`  ${g.date} vs ${g.opponent}: ERROR ${e.message}`);
    }
    await sleep(WAIT_MS);
  }

  if (manualPending.length) {
    console.log('手動入力が必要な試合（FIBA管轄外のため自動取得できない）:');
    for (const m of manualPending) console.log(`  - ${m}`);
  }

  if (changed === 0) {
    console.log('新しく確定した結果はなし → japan.json は変更しない');
    return;
  }
  data.updated = new Date(Date.now() + 9 * 60 * 60 * 1000)
    .toISOString()
    .replace(/\.\d{3}Z$/, '+09:00');
  fs.writeFileSync(file, JSON.stringify(data, null, 1) + '\n', 'utf8');
  console.log(`${changed}件の結果を japan.json に反映`);
})();
