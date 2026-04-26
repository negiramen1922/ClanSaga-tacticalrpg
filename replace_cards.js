// カードブロック差し替えスクリプト
// 使い方: node replace_cards.js
const fs = require('fs');
const path = require('path');

const htmlPath = path.join(__dirname, 'index.html');
const fragPath = path.join(__dirname, 'new_cards_fragment.txt');

const html = fs.readFileSync(htmlPath, 'utf8');
const newCards = fs.readFileSync(fragPath, 'utf8');

const startMarker = '\nconst CARDS = {';
const endMarker   = '\n};\n\n// カードLv計算';

const si = html.indexOf(startMarker);
const ei = html.indexOf(endMarker, si);

if (si === -1 || ei === -1) {
  console.error('CARDSブロックが見つかりません。');
  process.exit(1);
}

const result = html.slice(0, si + 1) + newCards.trim() + '\n' + html.slice(ei);
fs.writeFileSync(htmlPath, result, 'utf8');
console.log('完了: CARDSブロックを差し替えました。');

// 簡易構文チェック
try {
  const scripts = result.match(/<script>([\s\S]*?)<\/script>/g) || [];
  let combined = '';
  scripts.forEach(s => { combined += s.replace(/<\/?script>/g, '') + '\n'; });
  new Function(combined);
  console.log('構文チェック: OK');
} catch(e) {
  console.error('構文エラー:', e.message);
}
