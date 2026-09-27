import { releasesUrl, site } from "./site";

const REVALIDATE_SECONDS = 300;

async function github<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${site.repo}${path}`, {
      headers: {
        Accept: "application/vnd.github+json",
        ...(process.env.GITHUB_TOKEN && { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }),
      },
      cache: "force-cache",
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

type GitHubRelease = {
  tag_name: string;
  published_at: string;
  assets: { name: string; size: number; browser_download_url: string }[];
};

export type Release = {
  tag: string | null;
  publishedAt: string | null;
  sizeBytes: number | null;
  downloadUrl: string;
};

export async function getLatestRelease(): Promise<Release> {
  const rel = await github<GitHubRelease>("/releases/latest");
  const installer =
    rel?.assets.find((a) => /setup\.exe$/i.test(a.name)) ??
    rel?.assets.find((a) => /\.(exe|msi)$/i.test(a.name));
  return {
    tag: rel?.tag_name ?? null,
    publishedAt: rel?.published_at ?? null,
    sizeBytes: installer?.size ?? null,
    downloadUrl: installer?.browser_download_url ?? releasesUrl,
  };
}
