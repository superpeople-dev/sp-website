// News categories, shared by the server (lib/news.ts) and the browser (the editor, the filters).
export const newsCategories = ["update", "patch", "event", "dev"] as const;
export type NewsCategory = (typeof newsCategories)[number];
export const isNewsCategory = (value: unknown): value is NewsCategory => (newsCategories as readonly unknown[]).includes(value);
