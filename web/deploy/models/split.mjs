#!/usr/bin/env node
// Re-split a web model package into parts under the Workers static-asset limit (25 MiB a file).
//
//   node split.mjs <src> <model-id> [model-name]
//
// <src> is a directory, or a URL such as https://demo.koelony.com/models/yue-0.6b-int8/, holding
// manifest.json and the parts it lists. A URL is streamed, so only the output is written to disk. Writes ./dist/models/<model-id>/: the files cut into 24 MiB parts and a new
// manifest.json in the same format, which asr-worker.js already joins back together.
import { createReadStream, mkdirSync, openSync, readFileSync, rmSync, writeSync, closeSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PART = 24 * 1024 * 1024;
const [src, id, name] = process.argv.slice(2);
if (!src || !id) {
  console.error("usage: node split.mjs <src-dir> <model-id> [model-name]");
  process.exit(2);
}
const remote = /^https?:\/\//.test(src);
const base = remote && !src.endsWith("/") ? `${src}/` : src;
const open = async (name) => {
  if (!remote) return createReadStream(join(src, name), { highWaterMark: 1 << 20 });
  const res = await fetch(new URL(name, base), { headers: { "User-Agent": "koelony-split" } });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return res.body;
};
const man = remote
  ? await (await fetch(new URL("manifest.json", base))).json()
  : JSON.parse(readFileSync(join(src, "manifest.json"), "utf8"));
const out = join(import.meta.dirname, "dist", "models", id);
rmSync(join(import.meta.dirname, "dist"), { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const files = [];
for (const f of man.files) {
  const parts = [];
  let fd = -1;
  let inPart = PART;
  let total = 0;
  const next = () => {
    if (fd >= 0) closeSync(fd);
    const partName = f.size <= PART ? f.name : `${f.name}.part${parts.length}`;
    parts.push({ name: partName, size: 0 });
    fd = openSync(join(out, partName), "w");
    inPart = 0;
  };
  for (const p of f.parts) {
    for await (const chunk of await open(p.name)) {
      let off = 0;
      while (off < chunk.length) {
        if (inPart === PART) next();
        const n = Math.min(chunk.length - off, PART - inPart);
        writeSync(fd, chunk, off, n);
        parts[parts.length - 1].size += n;
        inPart += n;
        off += n;
        total += n;
      }
    }
  }
  if (fd >= 0) closeSync(fd);
  if (total !== f.size) throw new Error(`${f.name}: read ${total}, manifest says ${f.size}`);
  files.push({ name: f.name, size: f.size, parts });
  console.log(`${f.name}: ${parts.length} part(s)`);
}
writeFileSync(
  join(out, "manifest.json"),
  `${JSON.stringify({ ...man, model: name ?? man.model, files }, null, 1)}\n`,
);
writeFileSync(
  join(import.meta.dirname, "dist", "_headers"),
  `/models/*\n  Cache-Control: public, max-age=86400\n/models/*/manifest.json\n  Cache-Control: no-cache\n`,
);
console.log(`wrote ${out}`);
