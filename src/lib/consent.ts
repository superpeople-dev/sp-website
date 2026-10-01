// The data choice (components/Consent.tsx): whether the launcher may record a player's hardware,
// location and IP when they start the game (#launcher-logs, lib/discord.ts). Kept in a cookie on the
// device and, once they are signed in, on their Discord account (lib/consentstore.ts), which is what
// the launcher follows (api/launcher/log). No choice yet counts as accepted until they decline
// (privacy policy, "Your choices"). Sign-ins and download counts are not part of it: they protect
// the service. This file is shared with the browser: no server code here.

export type Choice = "accepted" | "declined";

export const consentCookie = "sp_consent";
// Raised when the policy collects something new: everyone is asked again.
export const CONSENT_VERSION = 1;

// "1.accepted": this version's choice, or null (none yet, or an older version's). A "." because
// cookies are written URL-encoded, which would turn a ":" into "%3A"; decoded anyway, to be safe.
export function parseChoice(value: string | undefined | null): Choice | null {
  let text = value ?? "";
  try {
    text = decodeURIComponent(text);
  } catch {
    return null;
  }
  const [version, choice] = text.split(".");
  return Number(version) === CONSENT_VERSION && (choice === "accepted" || choice === "declined") ? choice : null;
}

export const cookieValue = (choice: Choice) => `${CONSENT_VERSION}.${choice}`;
