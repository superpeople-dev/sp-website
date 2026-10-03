import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { defaultLocale, locales, type Locale } from "@/i18n/config";

// News posts are written in English and translated into the site's other languages with Claude when
// they are published or edited (app/api/admin/news). Needs ANTHROPIC_API_KEY on Vercel; without it
// posts stay English in every language. A language whose translation fails shows the English post.

export const translateReady = Boolean(process.env.ANTHROPIC_API_KEY);

const languageNames: Record<Exclude<Locale, "en">, string> = {
  fr: "French",
  es: "Spanish (Spain)",
  pt: "Brazilian Portuguese",
  de: "German",
  ru: "Russian",
  hi: "Hindi",
  ja: "Japanese",
  ko: "Korean",
  zh: "Simplified Chinese",
};

const Translation = z.object({ title: z.string(), summary: z.string(), body: z.string() });
export type TranslatedPost = z.infer<typeof Translation> & { locale: Locale };

const system = `You translate news posts for SUPER PEOPLE Revival, a community-run revival of the battle royale game SUPER PEOPLE, from English into the language the user names.
Write the way a gaming community manager in that language would: natural, friendly, not literal.
Keep unchanged: the game's name "SUPER PEOPLE", names of people, servers, classes, weapons, items and maps, version numbers, URLs, and every piece of Markdown syntax (headings, lists, bold, links, and image lines like ![caption](address), where only the caption is translated).
Translate the title, the summary and the body, and nothing else.`;

let client: Anthropic | null = null;

async function translateOne(locale: Exclude<Locale, "en">, post: { title: string; summary: string; body: string }): Promise<TranslatedPost> {
  client ??= new Anthropic();
  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(Translation) },
    system,
    messages: [
      {
        role: "user",
        content: `Translate into ${languageNames[locale]}.\n\n<title>${post.title}</title>\n<summary>${post.summary}</summary>\n<body>\n${post.body}\n</body>`,
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new Error(`declined (${response.stop_details?.category ?? "no category"})`);
  if (response.stop_reason === "max_tokens") throw new Error("the translation was cut off");
  if (!response.parsed_output) throw new Error("no translation in the answer");
  return { locale, ...response.parsed_output };
}

// Every other language at once. Returns the ones that worked; the others are logged.
export async function translatePost(post: { title: string; summary: string; body: string }) {
  const targets = locales.filter((locale): locale is Exclude<Locale, "en"> => locale !== defaultLocale);
  const results = await Promise.allSettled(targets.map((locale) => translateOne(locale, post)));
  const done: TranslatedPost[] = [];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") done.push(result.value);
    else console.error(`[news] translation to ${targets[i]} failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
  });
  return done;
}
