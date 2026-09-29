import { DataSet, englishDataset, englishRecommendedTransformers, pattern, RegExpMatcher } from "obscenity";

// What nobody can post (ideas, comments) or carry in their Discord name to post: slurs, insults and
// sexual words. The list is obscenity's English one, which also catches spellings like "f4gg0t"
// without flagging words that merely contain one ("Scunthorpe", "cocktail", "assassin").
// Taken out: words that are harmless in the site's other languages ("negro" is black in Spanish and
// Portuguese, "Abo" a German subscription) and mild swearing that insults nobody. Added: telling
// someone to kill themselves.
const allowed = new Set(["negro", "abo", "shit", "piss", "turd"]);

const dataset = new DataSet<{ originalWord: string }>()
  .addAll(englishDataset)
  .removePhrasesIf((phrase) => allowed.has(phrase.metadata?.originalWord ?? ""))
  .addPhrase((phrase) =>
    phrase
      .setMetadata({ originalWord: "kill yourself" })
      .addPattern(pattern`kill yourself`)
      .addPattern(pattern`killyourself`)
      .addPattern(pattern`kill urself`)
      .addPattern(pattern`killurself`)
      .addPattern(pattern`|kys|`),
  );

const matcher = new RegExpMatcher({ ...dataset.build(), ...englishRecommendedTransformers });

// Letters spaced out to slip through ("n i g g e r", "k.y.s") are read joined up.
const spacedOut = /\b(?:\p{L}[\s._-]+){2,}\p{L}\b/gu;

export const isOffensive = (text: string) =>
  matcher.hasMatch(text) || matcher.hasMatch(text.replace(spacedOut, (run) => run.replace(/[\s._-]+/g, "")));

// A Discord display name or username that can't post here.
export const offensiveName = (user: { name: string; username?: string }) =>
  isOffensive(user.name) || (user.username ? isOffensive(user.username) : false);
