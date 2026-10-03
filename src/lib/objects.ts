import { presign } from "./s3";

// Images and videos on Bugs & Ideas posts, in Neon Object Storage (the SuperPeople project's bucket
// "media", one per database branch). The bucket is private: the browser uploads with a short-lived PUT
// link (the bucket's CORS rule lets superpeople.dev do it), and pages show files with short-lived GET
// links. On Vercel the credentials are NEON_S3_* (Vercel keeps the AWS_* names for itself); locally
// `neon env pull` writes them as AWS_*.
const env = (...names: string[]) => names.map((name) => process.env[name]?.trim()).find(Boolean);
const endpoint = env("NEON_S3_ENDPOINT", "AWS_ENDPOINT_URL_S3");
const region = env("NEON_S3_REGION", "AWS_REGION") ?? "us-east-2";
const accessKey = env("NEON_S3_ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID");
const secretKey = env("NEON_S3_SECRET_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY");
export const bucket = "media";

export const objectsReady = Boolean(endpoint && accessKey && secretKey);

function link(method: "GET" | "PUT" | "DELETE", key: string, expires: number, params?: Record<string, string>) {
  if (!endpoint || !accessKey || !secretKey) throw new Error("Object storage is not configured");
  const url = new URL(endpoint);
  return presign({ method, host: url.host, path: `/${bucket}/${key}`, accessKey, secretKey, region, expires, now: new Date(), params });
}

// Every file whose key starts with `prefix`, with when it was stored (S3 ListObjectsV2, 1000 a page).
export async function listObjects(prefix: string, pages = 20) {
  const found: { key: string; storedAt: number }[] = [];
  let token = "";
  for (let page = 0; page < pages; page++) {
    const params: Record<string, string> = { "list-type": "2", prefix };
    if (token) params["continuation-token"] = token;
    const res = await fetch(link("GET", "", 60, params));
    if (!res.ok) throw new Error(`Object storage listing failed (${res.status})`);
    const xml = await res.text();
    const text = (block: string, tag: string) => new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(block)?.[1] ?? "";
    for (const [, block] of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const key = text(block, "Key").replaceAll("&amp;", "&");
      if (key) found.push({ key, storedAt: Date.parse(text(block, "LastModified")) || 0 });
    }
    token = text(xml, "NextContinuationToken");
    if (text(xml, "IsTruncated") !== "true" || !token) break;
  }
  return found;
}

// Where a browser may PUT one file (with its Content-Type) for the next `seconds`.
export const uploadLink = (key: string, seconds = 15 * 60) => link("PUT", key, seconds);

// A link to show or download a file, for the next `seconds`.
export const viewLink = (key: string, seconds = 60 * 60) => link("GET", key, seconds);

export async function deleteObject(key: string) {
  const res = await fetch(link("DELETE", key, 60), { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw new Error(`Object storage delete failed (${res.status})`);
}

// From the server (the import from Reflet): stores `body` under `key`.
export async function putObject(key: string, body: ArrayBuffer, contentType: string) {
  const res = await fetch(uploadLink(key, 60), { method: "PUT", headers: { "Content-Type": contentType }, body });
  if (!res.ok) throw new Error(`Object storage upload failed (${res.status})`);
}

// Whether a file is there now (a browser said it uploaded it), and its size.
export async function objectSize(key: string) {
  const res = await fetch(link("GET", key, 60), { headers: { Range: "bytes=0-0" } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Object storage check failed (${res.status})`);
  const total = res.headers.get("content-range")?.split("/")[1] ?? res.headers.get("content-length");
  return total ? Number(total) : null;
}
