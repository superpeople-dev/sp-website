export type Admin = { name: string; discordId: string };

// The first admins, with every permission until an owner changes theirs in the admin panel.
export const admins: Admin[] = [
  { name: "Alice", discordId: "1452631393304711341" },
  { name: "Shooter", discordId: "341312377129533445" },
  { name: "SP_Gaz", discordId: "1023568946735108137" },
  { name: "Kapitche", discordId: "1252359015308984430" },
  { name: "qbie", discordId: "309769149641523210" },
  { name: "Reokin", discordId: "621396343423893507" },
];

// Owners have every permission and are the only ones who can add, change or remove admins.
export const owners = ["1252359015308984430", "1452631393304711341"]; // Kapitche, Alice
