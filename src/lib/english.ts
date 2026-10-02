// Whether a post on Bugs & Ideas reads as English, the one language the whole team reads. It doesn't when
// most of its letters are of another script (Cyrillic, Hangul, kana and kanji, Devanagari, Arabic…),
// when most of its letters carry accents (Vietnamese), or when it has more of another language's
// little words ("le", "der", "não", "que"…) than of English ones. Text with none of those signs (game
// words, a player's name) counts as English: this stops posts written in another language, not English
// with a foreign word in it. The title is checked on its own as well (postReadsAsEnglish), so a long
// English description doesn't carry a title in another language.

// Little words of English, and of the languages players most often write in instead. Words both use
// ("a", "in", "no", "die", "on", "so", "de"…) are in neither list.
const englishWords = new Set(
  "the an is are was were be been being am to of at for with and or but not it its it's this that these those i i'm i've you you're he she we they my your his her our their me him us them what when where why how which who can can't cannot could would should will won't do does did don't doesn't didn't have has had if then than there here from by as just also very too only after before while because about into out up down all any some more most get got make makes please every never always sometimes again still".split(
    " ",
  ),
);
const otherWords = new Set(
  [
    // French
    "le la les des du est et je tu il elle nous vous ils pas une que qui dans pour avec sur ne ce cette mais ou quand jeu très avoir être fait peut mon ma mes sont ça c'est j'ai votre notre merci bonjour ajouter un",
    // Spanish
    "el los las del que y es por con una para pero cuando juego muy se lo mi al está este esta hay todo puedo tengo también hola gracias favor agregar añadir mis sus nos",
    // Portuguese
    "os não nao é um uma com para mas quando jogo muito do da dos das em isso você voce eu está tem também obrigado olá adicionar meu minha",
    // German
    "der das und ist nicht ich ein eine einen mit zu auf wenn beim spiel sehr kann wird bitte noch aber oder den dem es sich auch wir mein habe gibt kein keine bei nach über warum geht funktioniert hinzu",
    // Italian
    "il gli che non per sono gioco molto della nel quando ho grazie ciao aggiungere",
    // Dutch, Polish, Turkish, Indonesian
    "het een niet van ik maar nie jest się że bir ve bu için değil çok ama yang dan tidak ini itu saya untuk dengan ada",
  ]
    .join(" ")
    .split(" "),
);

// French joins a little word to the next one: d'ajouter, l'équipe, qu'il.
const elided = /^(?:[dljmnstc]|qu)'\p{L}/u;
const letters = /\p{L}/gu;
const latin = /\p{Script=Latin}/u;

export function readsAsEnglish(text: string): boolean {
  const all = text.match(letters) ?? [];
  if (all.length === 0) return true;
  // Mostly another script. In a short text two or three letters are enough when they are most of it:
  // in Chinese or Japanese that is a whole title (高跟鞋, "high heels").
  const foreign = all.filter((letter) => !latin.test(letter)).length;
  if (foreign >= 2 && foreign / all.length > (foreign >= 4 ? 0.3 : 0.5)) return false;
  // Mostly accented letters (Vietnamese); French, Spanish or Portuguese have a few.
  const accented = all.filter((letter) => letter.normalize("NFD").length > 1).length;
  if (accented >= 6 && accented / all.length > 0.15) return false;
  // More of another language's little words than of English ones.
  const words = text.toLowerCase().replace(/[’`]/g, "'").match(/[\p{L}']+/gu) ?? [];
  const ours = words.filter((word) => englishWords.has(word)).length;
  const theirs = words.filter((word) => otherWords.has(word) || elided.test(word)).length;
  return !(theirs >= 2 && theirs > ours);
}

// A post: its title on its own, and the whole of it.
export const postReadsAsEnglish = (title: string, description: string) =>
  readsAsEnglish(title) && readsAsEnglish(`${title}\n${description}`);
