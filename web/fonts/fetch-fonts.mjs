// Display face: Chiron GoRound TC (SIL OFL 1.1, see OFL.txt), the Hong Kong rounded gothic koelony.com
// sets its headings in. The full family is tens of MB, so this fetches it from Google Fonts cut down
// to the characters this page sets in it, and the result is committed next to this file. Fonts must
// be same-origin here: the page is cross-origin isolated (COEP require-corp, see ../_headers).
//
//   node fonts/fetch-fonts.mjs          (from web/) refetch after headings or buttons change
//
// Characters that are not in the files still render, in the system font.
import { readFile, writeFile } from "node:fs/promises";

const dir = new URL("./", import.meta.url);
const FAMILY = "Chiron GoRound TC";
const LATIN =
  " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~" +
  " ©·×–—‘’“”…−";
const UA_WOFF2 =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

// What style.css sets in the display face: headings, buttons, steps, and these classes.
const DISPLAY_CLASSES = ["btn", "step", "board-text", "board-label", "compare-said", "cmp-text", "path-t", "mname", "pillar", "lg"];
// Text app.js writes into display-face elements (button labels, the hero sample lines, #outTitle).
const FROM_APP_JS = [
  "模型已載入", "已複製", "複製唔到", "已複製網址", "錄音",
  "我哋喺銅鑼灣等緊你，你到咗未呀？", "呢個 bug 好奇怪，deploy 完之後先出現㗎。",
  "閂冷氣，順便開埋客廳盞燈。", "佢話個 meeting 改咗去禮拜五下晝三點。",
];

const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const picked = [];
const open = /<(h1|h2|h3|button|summary|a|span|p|li|div|dt)\b([^>]*)>/g;
for (let m; (m = open.exec(html)); ) {
  const [, tag, attrs] = m;
  const cls = (attrs.match(/class="([^"]*)"/)?.[1] ?? "").split(/\s+/);
  if (!/^(h[123]|button|dt)$/.test(tag) && !cls.some((c) => DISPLAY_CLASSES.includes(c))) continue;
  const end = html.indexOf(`</${tag}>`, m.index);
  picked.push(html.slice(m.index, end).replace(/<[^>]*>/g, ""));
}
const cjk = [...new Set([...picked, ...FROM_APP_JS].join(""))]
  .filter((c) => c.codePointAt(0) > 0x2e7f && !/\s/.test(c))
  .sort()
  .join("");

async function fetchFont(weight, text) {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(FAMILY)}:wght@${weight}&text=${encodeURIComponent(text)}`;
  const css = await (await fetch(url, { headers: { "User-Agent": UA_WOFF2 } })).text();
  const src = css.match(/url\((https:[^)]+)\)\s*format\('woff2'\)/);
  if (!src) throw new Error(`no woff2 for weight ${weight}: ${css.slice(0, 200)}`);
  const res = await fetch(src[1]);
  if (!res.ok) throw new Error(`font file ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

for (const weight of [700, 900]) {
  for (const [name, text] of [["latin", LATIN], ["cjk", cjk]]) {
    const bytes = await fetchFont(weight, text);
    const file = `goround-${name}-${weight}.woff2`;
    await writeFile(new URL(file, dir), bytes);
    console.log(`${file}  ${(bytes.length / 1024).toFixed(1)} kB`);
  }
}
await writeFile(new URL("display-chars.txt", dir), `${cjk}\n`);
console.log(`${[...cjk].length} CJK characters`);
