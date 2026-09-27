import { readFile } from "node:fs/promises";
import { signUser } from "reflet-sdk/server";

const api = process.env.REFLET_API_URL ?? "https://harmless-clam-802.convex.site";
const publicKey = process.env.NEXT_PUBLIC_REFLET_PUBLIC_KEY;
const secretKey = process.env.REFLET_SECRET_KEY;

if (!publicKey || !secretKey) {
  console.error("Set NEXT_PUBLIC_REFLET_PUBLIC_KEY and REFLET_SECRET_KEY first, for example in .env.local.");
  process.exit(1);
}

const { categories, bugs, type } = JSON.parse(await readFile(new URL("./known-bugs.json", import.meta.url), "utf8"));

async function call(path, { method = "GET", body, admin = false, token } = {}) {
  const headers = { Authorization: `Bearer ${admin ? secretKey : publicKey}`, "Content-Type": "application/json" };
  if (token) headers["X-User-Token"] = token;
  const response = await fetch(`${api}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(`${method} ${path} failed: ${data.error ?? response.status}`);
  return data;
}

const normalize = (value) => value.trim().toLowerCase();
const statusKey = (name) => name.toLowerCase().replace(/[ _-]/g, "");
const statusNames = {
  open: "open",
  underreview: "under_review",
  planned: "planned",
  inprogress: "in_progress",
  completed: "completed",
  done: "completed",
  closed: "closed",
};

const existing = new Set();
for (const status of ["open", "under_review", "planned", "in_progress", "completed", "closed"]) {
  for (let offset = 0; ; offset += 100) {
    const page = await call(`/api/v1/feedback/list?status=${status}&limit=100&offset=${offset}`);
    for (const item of page.items) existing.add(normalize(item.title));
    if (!page.hasMore) break;
  }
}

const tags = await call("/api/v1/admin/tags", { admin: true });
for (const category of categories) {
  if (tags.some((tag) => normalize(tag.name) === normalize(category.name))) continue;
  const { id } = await call("/api/v1/admin/tag/create", { method: "POST", admin: true, body: { ...category, isPublic: true } });
  tags.push({ id, ...category });
  console.log(`Created category: ${category.name}`);
}

const typeTag = tags.find((tag) => tag.slug === type);
const statuses = await call("/api/v1/admin/statuses", { admin: true }).catch(() => []);
const { token } = await signUser({ id: "team", name: "SUPER PEOPLE Revival" }, secretKey, 3600);

let added = 0;
for (const bug of bugs) {
  if (existing.has(normalize(bug.title))) {
    console.log(`Skipped, already on the board: ${bug.title}`);
    continue;
  }
  const { feedbackId, isApproved } = await call("/api/v1/feedback/create", {
    method: "POST",
    token,
    body: { title: bug.title, description: bug.description, ...(typeTag && { tagId: typeTag.id }) },
  });
  const match = statuses.find((status) => statusNames[statusKey(status.name)] === bug.status);
  await call("/api/v1/admin/feedback/set-status", {
    method: "POST",
    admin: true,
    body: { feedbackId, status: bug.status, ...(match && { statusId: match.id }) },
  });
  const tag = tags.find((t) => normalize(t.name) === normalize(bug.category));
  if (tag) {
    await call("/api/v1/admin/feedback/update-tags", { method: "POST", admin: true, body: { feedbackId, addTagIds: [tag.id] } });
  }
  added += 1;
  console.log(`Added [${bug.status}]${isApproved ? "" : " (needs approval in Reflet)"}: ${bug.title}`);
}

console.log(`Done: ${added} added, ${bugs.length - added} skipped.`);
