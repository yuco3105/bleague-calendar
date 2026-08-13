/**
 * プレシーズンゲーム（開幕前の練習試合）の日程を自動更新する。
 *
 * 出どころ: ballbeats.jp が各クラブの公式発表をまとめている note 記事
 *   https://note.com/ballbeats_jp/n/n1646da7ae95e
 * 本文（大会名・所属リーグ・クラブ公式の告知リンクまで入っている）を主に使い、
 * 同じ記事が公開している Google カレンダー(iCal)で取りこぼしを補う。
 * 両方とも同じ人が更新しており、たまに片方だけ新しいことがあるため2本立てにしている。
 *
 * プレシーズンはリーグ公式サイトに日程ページが無く、各クラブが個別に発表するため
 * games.json のスクレイパー(scrape-season.js)では取れない。
 */
const fs = require('fs');

const NOTE_API = 'https://note.com/api/v3/notes/n1646da7ae95e';
const ICS_URL = 'https://calendar.google.com/calendar/ical/f32d559a4c8dcce419a2289887f581cc8886792d4dd48a1ca03e40f56292ac82%40group.calendar.google.com/public/basic.ics';
const SOURCE = 'https://note.com/ballbeats_jp/n/n1646da7ae95e';
const SEASON_START = '2026-09-22'; // リーグ戦の開幕日。これ以降はgames.jsonの担当
const RANGE_START = '2026-08-01';

// 所属リーグ（カレンダー側には入っていないので手元で持つ。未知のクラブは空欄）
const LEAGUE = {
  'A千葉': 'B.PREMIER-東', 'A東京': 'B.PREMIER-東', 'FE名古屋': 'B.ONE-西', 'さいたま': 'B.ONE-東',
  'ソウル三星🇰🇷': 'KBL', 'パース🇦🇺': 'オーストラリア', 'ボン🇩🇪': 'ドイツ', '三河': 'B.PREMIER-西',
  '三遠': 'B.PREMIER-西', '京都': 'B.PREMIER-西', '仙台': 'B.PREMIER-東', '佐賀': 'B.PREMIER-西',
  '信州': 'B.PREMIER-西', '八王子': 'B.ONE-東', '北海道': 'B.PREMIER-東', '千葉J': 'B.PREMIER-東',
  '原州DB🇰🇷': '韓国・KBL', '台湾ビール🇹🇼': 'TPBLリーグ', '名古屋D': 'B.PREMIER-西', '大阪': 'B.PREMIER-西',
  '奈良': 'B.ONE-西', '宇都宮': 'B.PREMIER-東', '富山': 'B.PREMIER-東', '山形': 'B.ONE-北', '岐阜': 'B.ONE-中',
  '岡山': 'B.ONE-西', '岩手': 'B.ONE-北', '島根': 'B.PREMIER-西', '川崎': 'B.PREMIER-東',
  '広島': 'B.PREMIER-西', '愛媛': 'B.ONE-南', '東京SR': 'B.PREMIER-東', '東京UBC': 'B.ONE-東',
  '横浜BC': 'B.PREMIER-東', '横浜EX': 'B.ONE-中', '湘南': 'B.NEXT', '滋賀': 'B.PREMIER-西', '熊本': 'B.ONE-南',
  '琉球': 'B.PREMIER-西', '神戸': 'B.PREMIER-西', '福井': 'B.ONE-中', '福岡': 'B.ONE-南', '福島': 'B.ONE-北',
  '秋田': 'B.PREMIER-東', '立川': 'B.ONE-東', '群馬': 'B.PREMIER-東', '茨城': 'B.PREMIER-東',
  '越谷': 'B.ONE-北', '金沢': 'B.ONE-中', '長崎': 'B.PREMIER-西', '青森': 'B.ONE-北', '静岡': 'B.ONE-西',
  '香川': 'B.ONE-南', '高陽ソノ🇰🇷': '韓国', '鹿児島': 'B.ONE-南', '釜山KCC🇰🇷': '韓国・KBL',
};
// クラブ名をBカレの表記（games.jsonの略称）に寄せる。記事は正式名称、カレンダーは略称で書かれている
const RENAME = {
  // B.PREMIER（games.jsonと同じ略称にしないと「推しクラブ」の金色ハイライトが効かない）
  'レバンガ北海道': '北海道', '仙台89ERS': '仙台', '秋田ノーザンハピネッツ': '秋田',
  '茨城ロボッツ': '茨城', '宇都宮ブレックス': '宇都宮', '群馬クレインサンダーズ': '群馬',
  'アルティーリ千葉': 'A千葉', '千葉ジェッツ': '千葉J', 'アルバルク東京': 'A東京',
  '東京サンロッカーズ': '東京SR', '川崎ブレイブサンダース': '川崎', '横浜ビー・コルセアーズ': '横浜BC',
  '富山グラウジーズ': '富山', '信州ブレイブウォリアーズ': '信州', '三遠ネオフェニックス': '三遠',
  'シーホース三河': '三河', '名古屋ダイヤモンドドルフィンズ': '名古屋D', '滋賀レイクス': '滋賀',
  '京都ハンナリーズ': '京都', '大阪エヴェッサ': '大阪', '神戸ストークス': '神戸',
  '島根スサノオマジック': '島根', '広島ドラゴンフライズ': '広島', '佐賀バルーナーズ': '佐賀',
  '長崎ヴェルカ': '長崎', '琉球ゴールデンキングス': '琉球',
  // B.ONE / B.NEXT
  '青森ワッツ': '青森', '岩手ビッグブルズ': '岩手', '山形ワイヴァンズ': '山形',
  '福島ファイヤーボンズ': '福島', '越谷アルファーズ': '越谷', 'さいたまブロンコス': 'さいたま',
  '埼玉': 'さいたま', '東京八王子ビートレインズ': '八王子', '東京八王子': '八王子',
  '東京ユナイテッドバスケットボールクラブ': '東京UBC', '東京U': '東京UBC',
  '立川ダイス': '立川', '横浜エクセレンス': '横浜EX', 'ベルテックス静岡': '静岡',
  '金沢サムライズ': '金沢', '福井ブローウィンズ': '福井', '岐阜スゥープス': '岐阜',
  'ファイティングイーグルス名古屋': 'FE名古屋', 'バンビシャス奈良': '奈良',
  'トライフープ岡山': '岡山', '香川ファイブアローズ': '香川', '愛媛オレンジバイキングス': '愛媛',
  'ライジングゼファー福岡': '福岡', '熊本ヴォルターズ': '熊本', '鹿児島レブナイズ': '鹿児島',
  'ウォルガ湘南': '湘南',
  // 海外
  'テレコム・バスケッツ・ボン': 'ボン🇩🇪', 'コヤンソノ スカイガナーズ': '高陽ソノ🇰🇷',
  '高陽ソノスカイガナーズ': '高陽ソノ🇰🇷', 'パース・ワイルドキャッツ': 'パース🇦🇺',
  '台湾ビールレオパーズ': '台湾ビール🇹🇼', '釜山KCCイージス': '釜山KCC🇰🇷',
  'ソウルサムスンサンダース': 'ソウル三星🇰🇷', '原州DBプロミ': '原州DB🇰🇷',
};

const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const clean = (s) => s.replace(/\\,/g, ',').replace(/\\n/g, ' ').replace(/\\;/g, ';').trim();
// 「アリーナ名, 日本、〒000-0000 ○○県…」の住所部分は表示に不要
const shortVenue = (s) => clean(s).split(/,\s*日本/)[0].trim();
const normTeam = (s) => {
  let t = clean(s).replace(/[＜<]([^＞>]+)[＞>]$/, '').replace(/（[^）]*）$/, '').trim();
  return RENAME[t] ?? t;
};

// UTCの「20260902T100000Z」をJSTの日付・時刻にする
function toJst(dt) {
  const m = dt.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) return null; // 終日予定（日付のみ）は時刻が確定していないので扱わない
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) + 9 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return {
    date: `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`,
    time: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`,
  };
}

const stripTags = (html) => html
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .trim();

// 記事本文（h2=日付 / h3=試合 / p=会場と大会名 / figure=クラブ公式の告知リンク）を読む
async function fromNote() {
  const res = await fetch(NOTE_API, { headers: { 'User-Agent': 'bcal-preseason/1.0' } });
  if (!res.ok) throw new Error(`note取得に失敗: HTTP ${res.status}`);
  const body = (await res.json())?.data?.body ?? '';

  const games = [];
  let date = null, cur = null;
  const blocks = body.matchAll(/<(h2|h3|p|figure)\b([^>]*)>([\s\S]*?)<\/\1>/g);
  for (const [, tag, attrs, inner] of blocks) {
    const text = stripTags(inner);
    if (tag === 'h2') {
      const m = text.match(/^(\d{1,2})月(\d{1,2})日/);
      date = m ? `2026-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}` : null;
      cur = null;
      continue;
    }
    if (tag === 'h3') {
      cur = null;
      const m = text.match(/^(\d{1,2}:\d{2})\s+(.+?)\s+vs\s+(.+)$/s);
      if (!date || !m) continue;
      const team = (s) => {
        // 「クラブ名（B.PREMIER-東地区）」「クラブ名＜KBL＞」
        const t = s.replace(/\s+/g, ' ').trim().match(/^(.*?)[（＜](.+?)[）＞]$/);
        const name = (t ? t[1] : s).trim();
        return { name: RENAME[name] ?? name, league: t ? t[2].replace('地区', '') : '' };
      };
      const h = team(m[2]), a = team(m[3]);
      cur = {
        date, time: m[1], home: h.name, away: a.name,
        homeLeague: h.league || LEAGUE[h.name] || '', awayLeague: a.league || LEAGUE[a.name] || '',
        arena: '', event: '', link: '', pre: true,
      };
      games.push(cur);
      continue;
    }
    if (!cur) continue;
    if (tag === 'p' && !cur.arena && text.startsWith('@')) {
      const [venue, ...rest] = text.replace(/^@\s*/, '').split('\n');
      cur.arena = venue.trim();
      cur.event = rest.join(' ').trim();
      continue;
    }
    if (tag === 'figure' && !cur.link) {
      const m = attrs.match(/data-src="([^"]+)"/);
      if (m && /^https?:/.test(m[1])) cur.link = m[1];
    }
  }
  return games;
}

// カレンダー側にしか載っていない試合を拾うための読み込み
async function fromIcal() {
  const res = await fetch(ICS_URL, { headers: { 'User-Agent': 'bcal-preseason/1.0' } });
  if (!res.ok) throw new Error(`iCal取得に失敗: HTTP ${res.status}`);
  // iCalは75文字で折り返され、続きの行が半角スペース始まりになる
  const text = (await res.text()).replace(/\r?\n[ \t]/g, '');

  const games = [];
  for (const block of text.split('BEGIN:VEVENT').slice(1)) {
    const field = (key) => {
      const m = block.match(new RegExp(`^${key}[^:\\n]*:(.*)$`, 'm'));
      return m ? m[1].trim() : '';
    };
    const when = toJst(field('DTSTART'));
    const summary = field('SUMMARY');
    if (!when || !summary.includes(' vs ')) continue;
    if (when.date < RANGE_START || when.date >= SEASON_START) continue; // 前シーズン分と開幕後は除く

    const [home, away] = summary.split(' vs ').map(normTeam);
    const desc = field('DESCRIPTION');
    const link = (desc.match(/href="([^"]+)"/) ?? [])[1] ?? '';
    const event = clean((desc.match(/<p>(.*?)<\/p>/) ?? [])[1] ?? '').replace(/<[^>]+>/g, '');

    games.push({
      date: when.date, time: when.time, home, away,
      homeLeague: LEAGUE[home] ?? '', awayLeague: LEAGUE[away] ?? '',
      arena: shortVenue(field('LOCATION')), event, link, pre: true,
    });
  }
  return games;
}

(async () => {
  const [noteGames, icalGames] = await Promise.all([fromNote(), fromIcal()]);
  if (!noteGames.length && !icalGames.length) {
    throw new Error('試合が0件。記事かカレンダーの形式が変わった可能性あり');
  }
  // 記事（会場・大会名・告知リンクが揃っている）を土台にし、カレンダー側で補正する。
  // 同じ日・同じホームで開始時刻が1時間以内なら同一試合とみなす（対戦相手だけ後から差し替わることがある）
  const same = (a, b) => a.date === b.date && a.home === b.home
    && Math.abs(toMin(a.time) - toMin(b.time)) <= 60;
  const extra = [];
  for (const ig of icalGames) {
    const hit = noteGames.find((ng) => same(ng, ig));
    if (!hit) { extra.push(ig); continue; }
    if (hit.away !== ig.away) {
      // カレンダーの方が先に直っていることがあるので、対戦相手はそちらを採用する
      console.log(`対戦相手を更新: ${hit.date} ${hit.home} vs ${hit.away} → ${ig.away}`);
      hit.away = ig.away;
      hit.awayLeague = LEAGUE[ig.away] ?? '';
    }
  }
  const games = [...noteGames, ...extra];
  games.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  const before = fs.existsSync('preseason.json')
    ? JSON.parse(fs.readFileSync('preseason.json', 'utf8').replace(/^﻿/, '')).count ?? 0
    : 0;
  const out = {
    updated: new Date().toISOString(),
    note: 'B.LEAGUE PRE-SEASON GAME 2026（開幕前の練習試合）。各クラブの公式発表をまとめた記事から自動取得',
    source: SOURCE,
    count: games.length,
    games,
  };
  fs.writeFileSync('preseason.json', JSON.stringify(out, null, 1) + '\n');
  const unknown = [...new Set(games.flatMap((g) => [g.home, g.away]))].filter((n) => !(n in LEAGUE));
  console.log(`プレシーズン ${games.length}件（前回 ${before}件）`);
  if (unknown.length) console.log('リーグ未登録:', unknown.join(', '));
})().catch((e) => {
  console.error('エラー:', e.message);
  process.exit(1);
});
