import { site } from "@/lib/site";
import { Icon } from "./Icon";

export function DownloadButton({ href, label, large }: { href: string; label: string; large?: boolean }) {
  return (
    <a className={`btn btn--primary${large ? " btn--lg" : ""}`} href={href}>
      <Icon name="download" />
      {label}
    </a>
  );
}

export function DiscordButton({ label, large }: { label: string; large?: boolean }) {
  return (
    <a
      className={`btn btn--discord${large ? " btn--lg" : ""}`}
      href={site.discord}
      target="_blank"
      rel="noopener"
    >
      <Icon name="discord" />
      {label}
    </a>
  );
}
