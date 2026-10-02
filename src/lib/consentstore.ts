import { CONSENT_VERSION, type Choice } from "./consent";
import { dbReady, query } from "./db";

// Each Discord account's data choice (lib/consent.ts), for the launcher's logs to follow. In Postgres
// (lib/db.ts, table consent).

export async function saveChoice(userId: string, choice: Choice) {
  if (!dbReady) return;
  await query(
    `insert into consent (user_id, choice, version, at) values ($1, $2, $3, $4)
     on conflict (user_id) do update set choice = excluded.choice, version = excluded.version, at = excluded.at`,
    [userId, JSON.stringify(choice), CONSENT_VERSION, Date.now()],
  );
}

// The account's choice; null when it never chose (or the store is down).
export async function choiceOf(userId: string): Promise<Choice | null> {
  if (!dbReady) return null;
  const [stored] = await query<{ choice: Choice; version: number }>("select choice, version from consent where user_id = $1", [userId]).catch(
    () => [],
  );
  return stored?.version === CONSENT_VERSION ? stored.choice : null;
}
