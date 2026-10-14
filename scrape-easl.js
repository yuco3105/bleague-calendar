// EASL公式のUTC日時を日本時間へ変換。日本の出場クラブの試合を取得する。
const fs = require('node:fs');
const path = require('node:path');
const SOURCE = 'https://www.easl.basketball/ja';
const JAPAN = new Set(['A東京', '長崎', '琉球']);
const NAMES = { 'アルバルク東京': 'A東京', '長崎ヴェルカ': '長崎', '琉球ゴールデンキングス': '琉球' };
function text(html) {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
}
function parseGames(html) {
  const byId = new Map();
  for (const m of html.matchAll(/<a\b([^>]*\bdata-date="[^"]+"[^>]*)>([\s\S]*?)<\/a>/g)) {
    const attrs = m[1], body = m[2];
    const id = attrs.match(/data-id="([^"]+)"/)?.[1];
    const raw = attrs.match(/data-date="([^"]+)"/)?.[1];
    const href = attrs.match(/href="([^"]+)"/)?.[1];
    const teams = [...body.matchAll(/<div class="text-1-line">([\s\S]*?)<\/div>/g)].map(x => text(x[1])).map(x => NAMES[x] || x);
    if (teams.length !== 2 || !teams.some(x => JAPAN.has(x))) continue;
    if (!id || !href || !raw) throw new Error('EASLの試合属性が不完全');
    const utc = new Date(raw + (/Z$|[+-]\d{2}:\d{2}$/.test(raw) ? '' : 'Z'));
    if (!Number.isFinite(utc.getTime())) throw new Error('EASLの日時が不正');
    const jst = new Date(utc.getTime() + 9 * 3600 * 1000).toISOString();
    if (jst.slice(0,10) < '2026-10-01' || jst.slice(0,10) > '2027-06-30') continue;
    const link = new URL(href, SOURCE);
    if (link.origin !== 'https://www.easl.basketball') throw new Error('EASLのリンクが不正');
    const arena = text(body.match(/<div class="sched-card-venue">([\s\S]*?)<\/div>/)?.[1] || '会場未定');
    byId.set(id, { id: 'easl-' + id, date: jst.slice(0,10), time: jst.slice(11,16), home: teams[0], away: teams[1], arena, score: null, easl: true, event: 'EASL 2026-27', link: link.href });
  }
  return [...byId.values()].sort((a,b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}
async function main() {
  const res = await fetch(SOURCE, { signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error('EASL HTTP ' + res.status);
  const games = parseGames(await res.text());
  // HTML構造変更などで既存日程を空・部分取得データで壊さない。
  const file = path.join(__dirname, 'easl.json');
  const previous = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).games.length : 0;
  if (games.length < Math.max(18, previous)) throw new Error('EASL日程の取得件数が不足: ' + games.length);
  fs.writeFileSync(file, JSON.stringify({ updated: new Date().toISOString(), source: SOURCE, timezone: 'Asia/Tokyo', count: games.length, games }, null, 1) + '\n');
  console.log('EASL: ' + games.length + '試合（日本時間）');
}
if (require.main === module) main().catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { parseGames };
