import { createHash, createHmac } from "node:crypto";

// Short-lived download links for the game's files in the team's Storj bucket (S3-compatible),
// handed to signed-in players by app/api/launcher/game/link. The bucket itself is private: without
// a link from here, nobody downloads anything. The key only needs to read that one bucket; it is
// set in Vercel, never in the launcher.
const endpoint = (process.env.STORJ_S3_ENDPOINT || "https://gateway.storjshare.io").replace(/\/+$/, "");
const bucket = process.env.STORJ_BUCKET || "sp-launcher-files";
const prefix = process.env.STORJ_PREFIX ?? "game/";
const accessKey = process.env.STORJ_ACCESS_KEY_ID;
const secretKey = process.env.STORJ_SECRET_ACCESS_KEY;
// Storj's gateway takes any region; it only has to be the one signed.
const region = process.env.STORJ_REGION || "us-1";

export const signingReady = Boolean(accessKey && secretKey);

// AWS's URI encoding: everything but unreserved characters, with "/" kept in a path.
const encode = (text: string, keepSlash = false) =>
  encodeURIComponent(text)
    .replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%2F/g, keepSlash ? "/" : "%2F");

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");
const hmac = (key: Buffer | string, text: string) => createHmac("sha256", key).update(text).digest();

export type Presign = {
  host: string;
  /** The object's path as requested, starting with "/". */
  path: string;
  accessKey: string;
  secretKey: string;
  region: string;
  /** Seconds the link works for. */
  expires: number;
  now: Date;
};

// A GET link signed with AWS Signature Version 4 in the query string ("presigned URL").
export function presignGet({ host, path, accessKey, secretKey, region, expires, now }: Presign) {
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const day = amzDate.slice(0, 8);
  const scope = `${day}/${region}/s3/aws4_request`;
  const query = [
    ["X-Amz-Algorithm", "AWS4-HMAC-SHA256"],
    ["X-Amz-Credential", `${accessKey}/${scope}`],
    ["X-Amz-Date", amzDate],
    ["X-Amz-Expires", String(expires)],
    ["X-Amz-SignedHeaders", "host"],
  ]
    .map(([key, value]) => `${encode(key)}=${encode(value)}`)
    .sort()
    .join("&");
  const canonicalPath = encode(path, true);
  const request = ["GET", canonicalPath, query, `host:${host}`, "", "host", "UNSIGNED-PAYLOAD"].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(request)].join("\n");
  const key = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, day), region), "s3"), "aws4_request");
  const signature = createHmac("sha256", key).update(toSign).digest("hex");
  return `https://${host}${canonicalPath}?${query}&X-Amz-Signature=${signature}`;
}

// A link to one of the game's files (its path in the list, lib/game-files.json).
export function gameFileLink(path: string, expires: number) {
  if (!accessKey || !secretKey) throw new Error("Storj signing is not configured");
  const url = new URL(endpoint);
  return presignGet({
    host: url.host,
    path: `${url.pathname.replace(/\/$/, "")}/${bucket}/${prefix}${path}`,
    accessKey,
    secretKey,
    region,
    expires,
    now: new Date(),
  });
}
