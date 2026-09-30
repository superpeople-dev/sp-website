// Makes src/lib/game-files.json, the list the launcher downloads the game from
// (app/api/launcher/game): every file in the Storj folder, with its size and
// SHA-256. The launcher gets each file through a short-lived link from
// app/api/launcher/game/link; the share link below is only for reading the
// bucket here (a read-only share of the game folder, made in the Storj console;
// delete it again afterwards if players must not use it).
//
//   node scripts/game-files.mjs "C:\path\to\the game" https://link.storjshare.io/s/<key>/sp-launcher-files/game/
//
// The files are the ones in the bucket (its public share link lists them); the
// hashes are read from a copy of the same game on this PC, which must have
// every one of them at the same size. A random 64 KiB of each file is then
// fetched from the bucket and compared with the local copy, so the list cannot
// describe files the bucket does not serve. Run it again whenever the files in
// the bucket change, and deploy: launchers read the new list at once.
import { createHash, randomInt } from "node:crypto";
import { closeSync, createReadStream, openSync, readSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [folder, share] = process.argv.slice(2);
const link = share?.match(/^https:\/\/([^/]+)\/(?:s|raw)\/([^/]+)\/(.+?)\/?$/);
if (!folder || !link) {
  console.error('Usage: node scripts/game-files.mjs "<game folder>" https://link.storjshare.io/s/<key>/<bucket>/<folder>/');
  process.exit(1);
}
const [, host, key, prefix] = link;
const page = (path) => `https://${host}/s/${key}/${prefix}/${path}`;
const base = `https://${host}/raw/${key}/${prefix}/`;
const encode = (path) => path.split("/").map(encodeURIComponent).join("/");

// ---- what the bucket has: its listing pages, folder by folder ------------
const paths = [];
const folders = [""];
while (folders.length) {
  const dir = folders.shift();
  let cursor = "";
  do {
    const res = await fetch(page(encode(dir)) + (cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""));
    if (!res.ok) throw new Error(`listing ${dir || "/"}: ${res.status}`);
    const html = await res.text();
    for (const [, href] of html.matchAll(/href="\.\/([^"?]+)\?wrap=1"/g)) {
      const name = decodeURIComponent(href.replaceAll("&amp;", "&"));
      if (name.endsWith("/")) folders.push(dir + name);
      else if (!paths.includes(dir + name)) paths.push(dir + name);
    }
    const next = html.match(/href="\.\/\?cursor=([^"]+)"/);
    cursor = next ? decodeURIComponent(next[1].replaceAll("&amp;", "&")) : "";
  } while (cursor);
}
paths.sort();
console.log(`${paths.length} files in the bucket`);

// ---- sizes, and the local copy hashed ------------------------------------
async function inParallel(items, work, n = 8) {
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) await work(items[next++]);
  }));
}

const files = [];
await inParallel(paths, async (path) => {
  const res = await fetch(base + encode(path), { method: "HEAD" });
  const size = Number(res.headers.get("content-length"));
  if (!res.ok || !Number.isFinite(size)) throw new Error(`${path}: the bucket answered ${res.status}`);
  let local;
  try {
    local = statSync(join(folder, path)).size;
  } catch {
    throw new Error(`${path} is in the bucket but not in ${folder}`);
  }
  if (local !== size) throw new Error(`${path}: ${local} bytes here, ${size} in the bucket`);
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(join(folder, path), { highWaterMark: 4 << 20 })) hash.update(chunk);
  files.push({ path, size, sha256: hash.digest("hex") });
});
files.sort((a, b) => a.path.localeCompare(b.path));
const total = files.reduce((sum, f) => sum + f.size, 0);
console.log(`${files.length} files hashed, ${(total / 1e9).toFixed(2)} GB`);

// ---- the bucket serves the same bytes -------------------------------------
// Small files whole, big ones three random 64 KiB slices each.
const SLICE = 64 * 1024;
const WHOLE = 1024 * 1024;
const differ = [];
await inParallel(files, async (f) => {
  const slices = f.size <= WHOLE ? [[0, f.size]] : Array.from({ length: 3 }, () => [randomInt(0, f.size - SLICE + 1), SLICE]);
  const fd = openSync(join(folder, f.path), "r");
  try {
    for (const [at, length] of slices) {
      if (length === 0) continue;
      const res = await fetch(base + encode(f.path), { headers: { Range: `bytes=${at}-${at + length - 1}` } });
      const remote = Buffer.from(await res.arrayBuffer());
      const local = Buffer.alloc(length);
      readSync(fd, local, 0, length, at);
      if (!remote.equals(local)) {
        differ.push(`${f.path} (at byte ${at})`);
        break;
      }
    }
  } finally {
    closeSync(fd);
  }
});
if (differ.length) {
  console.error(`The bucket's copy differs from the local one for ${differ.length} file(s):\n  ${differ.sort().join("\n  ")}`);
  console.error("Upload those files again (or delete them from the bucket), then run this again.");
  process.exit(1);
}
console.log(`${files.length} files compared with the bucket`);

// One file per line, so a change shows as a readable diff.
const lines = files.map((f) => `    ${JSON.stringify(f)}`).join(",\n");
writeFileSync(new URL("../src/lib/game-files.json", import.meta.url), `{\n  "files": [\n${lines}\n  ]\n}\n`);
console.log("wrote src/lib/game-files.json");
