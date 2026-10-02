# superpeople.dev

The website of the SUPER PEOPLE community revival: https://superpeople.dev

It explains the project, links the launcher download and the Discord, and hosts the community pages
(ideas, roadmap and completed work). The whole site is available in 10 languages.

## Stack

- Next.js 16 (App Router), React 19 and TypeScript
- [Motion](https://motion.dev) for animations
- Launcher releases come from the GitHub API
- Ideas, votes, comments and the roadmap are the site's own, in Postgres on [Neon](https://neon.com), with images
  and videos in Neon's object storage; players sign in with Discord
- The site's own records (commenter profiles, bans, admins, downvotes, notifications, download limits) live in
  Postgres on [Neon](https://neon.com) ([`src/lib/db.ts`](src/lib/db.ts), tables in [`db/migrations`](db/migrations))

## Getting started

You need [Bun](https://bun.com) 1.3 or newer. Bun installs the packages and runs the site, including on Vercel
(see `bunVersion` in [`vercel.json`](vercel.json)). The one exception is `bun run build`: it runs `next build` on
Node.js, because Bun 1.3.14 crashes on exit after a Next.js build on Vercel's Linux build machines.

```bash
bun install
cp .env.example .env.local
bun dev
```

Open http://localhost:3000. The home and legal pages work without any environment variables. The
Bugs & Ideas, Roadmap and Completed pages need the database and Discord variables listed below; without them
they show a "not available" message.

Before opening a pull request, check that these pass:

```bash
bun run lint
bunx tsc --noEmit
bun run build
```

## Project layout

```
src/
  app/[lang]/     pages for each language: home, bugs-and-ideas, roadmap, completed, terms, privacy
  app/api/        Discord sign-in, votes, new ideas and admin actions
  components/     UI components; roadmap/ holds the community pages
  i18n/           language config, shared types and one dictionary per language
  lib/            GitHub, the boards (reflet.ts), sessions, SEO and data shared by every language (site.ts)
db/migrations/    the database's tables, applied in order by `bun run db:migrate`
public/og/        share images, one per language
```

## Text and translations

All text lives in [`src/i18n/dictionaries/`](src/i18n/dictionaries/), one file per language (`en.ts`,
`fr.ts`, ...). Every dictionary follows the same type in [`src/i18n/types.ts`](src/i18n/types.ts), so the
type check fails if a language is missing a string. When you change English text, update the other
languages too, or say in your pull request which ones still need a translation. Long texts support
`**bold**` and `` `code` ``.

Things that are the same in every language live in [`src/lib/site.ts`](src/lib/site.ts): the launcher
repo, the Discord invite, the timeline dates, the progress bar and the gallery images.

To add a language:

1. Add it to `locales` and `localeInfo` in [`src/i18n/config.ts`](src/i18n/config.ts).
2. Copy `en.ts`, translate it and register it in [`src/i18n/dictionaries/index.ts`](src/i18n/dictionaries/index.ts).
3. Add its flag to [`src/components/Flag.tsx`](src/components/Flag.tsx) and a 1200×630 share image as `public/og/<lang>.jpg`.
4. If it needs other fonts, see how the Japanese, Korean, Chinese, Devanagari and Cyrillic fonts are loaded in
   [`src/app/[lang]/layout.tsx`](src/app/[lang]/layout.tsx).

## Launcher download

The server fetches the latest release of `site.repo` from GitHub and caches it for 5 minutes
([`src/lib/github.ts`](src/lib/github.ts)). Publishing a new release updates every download button on
its own. `/download` always redirects to the newest installer.

## Community pages

| Page | Shows | Status |
| --- | --- | --- |
| `/bugs-and-ideas` | Approved ideas and bug reports. Signed-in players post and vote. | Open |
| `/bugs-and-ideas`, admins only | New posts waiting for review | Under review |
| `/roadmap` | To do, working on and recently completed | Planned, In progress, Completed |
| `/completed` | Everything completed, grouped by area, and the release notes | Completed |

- The kind of post (Bug, Feature, Improvement, Question) is a tag with that slug (`tags` table). Every other
  tag is an area (Game, Launcher, Servers, Website...).
- New posts start as "Under review" and stay hidden until an admin approves them.
- A player can have at most 3 posts waiting for review. Each approval or rejection frees a slot.
- Posts can include up to 4 images or videos (10 MB per image, 100 MB per video). The browser uploads
  them straight to the `media` bucket in Neon's object storage ([`src/lib/objects.ts`](src/lib/objects.ts)) with a
  short-lived upload link, and they show in the post's details.
- Clicking a card opens its details and comments. Signed-in players comment with their Discord name
  and avatar.
- Posts, votes and comments are in our Postgres database ([`src/lib/reflet.ts`](src/lib/reflet.ts), tables in
  [`db/migrations`](db/migrations)), with the Discord profile of each post and comment author and the ban list
  ([`src/lib/store.ts`](src/lib/store.ts)). Until 02.10.2026 they were in Reflet; what was there was imported,
  with the same ids, and the module keeps Reflet's function names and shapes.
- The database and the storage are only reached from the server ([`src/lib/`](src/lib/) and
  [`src/app/api/`](src/app/api/)), so the keys never reach the browser.

### Admins

A signed-in player is an admin when:

- their Discord user ID is listed in [`src/lib/admins.ts`](src/lib/admins.ts) or in
  `ADMIN_DISCORD_IDS`, or
- they have one of the `DISCORD_ADMIN_ROLE_IDS` roles on the `DISCORD_GUILD_ID` server. Roles are read
  when they sign in.

Admins can approve or reject new posts, edit a post's title, details, type and area, move cards between
stages (by dragging them on the roadmap, or from the ⋯ menu on any card), delete posts and comments, and ban players from posting, voting and commenting. Bans are
listed, and can be lifted, from the Bans button next to the admin's name.
To find a Discord ID, turn on Developer Mode in Discord's advanced settings, then right-click a user,
server or role and choose Copy ID.

### Discord announcements

When a post is approved, or moves to the roadmap, into progress or to completed, the site posts a message
to the Discord channel of `DISCORD_WEBHOOK_URL` ([`src/lib/announce.ts`](src/lib/announce.ts)), naming who
did it.

## Environment variables

| Name | Used for |
| --- | --- |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | Discord sign-in |
| `AUTH_SECRET` | Signing the sign-in cookie, any long random string |
| `DISCORD_GUILD_ID`, `DISCORD_ADMIN_ROLE_IDS` | Optional: role-based admins |
| `DISCORD_MODERATOR_ROLE_IDS` | Optional: Discord roles that may `/tempban` from the bot and lift those bans, but not ban until lifted. Default: the Moderator and Developer roles |
| `ADMIN_DISCORD_IDS` | Optional: extra admins by Discord user ID, comma-separated |
| `DATABASE_URL` | Postgres (Neon's pooled address): posts, votes, comments, bans, admins, notifications, API keys, download limits. `neon env pull` writes it, with `DATABASE_URL_UNPOOLED` |
| `DATABASE_URL_UNPOOLED` | The direct address, for `bun run db:migrate` (schema changes, `db/migrations/*.sql`, each applied once) |
| `NEON_S3_ENDPOINT`, `NEON_S3_REGION`, `NEON_S3_ACCESS_KEY_ID`, `NEON_S3_SECRET_ACCESS_KEY` | The branch's object storage, for images and videos on posts. Locally `neon env pull` writes them as `AWS_ENDPOINT_URL_S3`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, which work too (Vercel keeps the `AWS_` names for itself) |
| `DISCORD_WEBHOOK_URL` | Optional: Discord announcements |
| `GITHUB_TOKEN` | Optional: only if the GitHub API rate-limits the server |
| `NEXT_PUBLIC_SITE_URL` | Optional: replaces `https://superpeople.dev` in canonical links and the sitemap |

The Discord application needs these OAuth2 redirects: `http://localhost:3000/api/auth/discord/callback`
for local work and `https://superpeople.dev/api/auth/discord/callback` in production.

## Legal pages

The text of `/terms` and `/privacy` is in the `legal` section of each dictionary. When it changes,
update `legalUpdated` in [`src/lib/site.ts`](src/lib/site.ts).

## Contributing

- For anything bigger than a small fix, open an issue or ask in the
  [Discord](https://discord.com/invite/superpeopleofficial) first.
- Keep pull requests focused on one change.
- Follow the style of the surrounding code. The source doesn't use code comments.
- Visible text changes need all 10 dictionaries updated.

## Disclaimer

A fan-made, non-commercial project. Not affiliated with or endorsed by Wonder People. SUPER PEOPLE and
its assets belong to their respective owners.
