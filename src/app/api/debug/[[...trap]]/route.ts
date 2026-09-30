import { trap } from "@/lib/honeypot";

// A decoy: nothing calls this, so whoever does is probing (lib/honeypot.ts).
export { trap as GET, trap as POST, trap as PUT, trap as PATCH, trap as DELETE };
