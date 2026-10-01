import { devJson } from "@/lib/devapi";

// What the developer API offers, for an agent that finds it (no key needed to read this).
export function GET() {
  return devJson({
    about:
      "SUPER PEOPLE Revival roadmap API for the team's agents: create tasks and ideas, move them, assign them, comment. Every other call needs an admin's API key (admin panel, API tab) as Authorization: Bearer spk_... It acts as that admin, with their permissions.",
    docs: "https://github.com/superpeople-dev/sp-docs/blob/main/docs/ROADMAP-API.md",
    endpoints: [
      { method: "GET", path: "/api/dev/me", does: "Who the key belongs to and their permissions." },
      { method: "GET", path: "/api/dev/meta", does: "Statuses, types (slugs), platforms (ids and names) and the admins items can be assigned to." },
      {
        method: "GET",
        path: "/api/dev/items?status=open,planned,in_progress&q=words&type=bug-report&platform=game&assignee=me&limit=50",
        does: "List or search items. status: comma list or all (default open,planned,in_progress); q: all words in title or description; assignee: me, team (nobody in particular) or an admin. Each item says who it is assigned to (assignee, null: the whole team).",
      },
      {
        method: "POST",
        path: "/api/dev/items",
        body: { title: "3-100 chars", description: "up to 2000 chars", type: "bug-report", platform: "game", status: "completed", assignee: "me" },
        does: 'Create an item. status: open (an idea on Bugs & Ideas), planned (To do), in_progress or completed. assignee is optional; a task created in_progress is yours unless it says otherwise. pending: true when Reflet holds it until it is approved; it is created, shows on the site once approved, and is not to be sent again. Needs "manage".',
      },
      { method: "GET", path: "/api/dev/items/{id}", does: "One item." },
      {
        method: "PATCH",
        path: "/api/dev/items/{id}",
        body: { status: "completed", assignee: "me", title: "...", description: "...", type: "...", platform: "..." },
        does: `Move, assign and/or edit an item; only the fields sent change. assignee: "me", "team" (nobody in particular) or an admin's id, username or name; the admin gets a notification. Moved to in_progress with nobody on it, it becomes yours unless assignee says otherwise. Needs "manage" ("review" to approve an idea under review).`,
      },
      { method: "POST", path: "/api/dev/items/{id}/comments", body: { body: "What changed, in a sentence." }, does: "Comment as the key's admin." },
    ],
  });
}
