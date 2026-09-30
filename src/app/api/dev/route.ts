import { devJson } from "@/lib/devapi";

// What the developer API offers, for an agent that finds it (no key needed to read this).
export function GET() {
  return devJson({
    about:
      "SUPER PEOPLE Revival roadmap API for the team's agents: create tasks and ideas, move them, comment. Every other call needs an admin's API key (admin panel, API tab) as Authorization: Bearer spk_... It acts as that admin, with their permissions.",
    docs: "https://github.com/superpeople-dev/sp-docs/blob/main/docs/ROADMAP-API.md",
    endpoints: [
      { method: "GET", path: "/api/dev/me", does: "Who the key belongs to and their permissions." },
      { method: "GET", path: "/api/dev/meta", does: "Statuses, types (slugs) and platforms (ids and names) to use." },
      {
        method: "GET",
        path: "/api/dev/items?status=open,planned,in_progress&q=words&type=bug-report&platform=game&limit=50",
        does: "List or search items. status: comma list or all (default open,planned,in_progress); q: all words in title or description.",
      },
      {
        method: "POST",
        path: "/api/dev/items",
        body: { title: "3-100 chars", description: "up to 2000 chars", type: "bug-report", platform: "game", status: "completed" },
        does: 'Create an item. status: open (an idea on Bugs & Ideas), planned (To do), in_progress or completed. Needs "manage".',
      },
      { method: "GET", path: "/api/dev/items/{id}", does: "One item." },
      {
        method: "PATCH",
        path: "/api/dev/items/{id}",
        body: { status: "completed", title: "...", description: "...", type: "...", platform: "..." },
        does: 'Move and/or edit an item; only the fields sent change. Needs "manage" ("review" to approve an idea under review).',
      },
      { method: "POST", path: "/api/dev/items/{id}/comments", body: { body: "Fixed in https://github.com/..." }, does: "Comment as the key's admin." },
    ],
  });
}
