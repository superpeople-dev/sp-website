import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const body = Barlow({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body" });
const display = Barlow_Condensed({ subsets: ["latin"], weight: ["700", "900"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "Page not found · SUPER PEOPLE Revival",
  robots: { index: false, follow: true },
};

export default function GlobalNotFound() {
  return (
    <html lang="en" className={`${body.variable} ${display.variable}`}>
      <body>
        <main className="notfound">
          <p className="notfound__code">404</p>
          <h1>Page not found</h1>
          <p>This page doesn&apos;t exist. The servers are elsewhere.</p>
          <Link className="btn btn--primary" href="/">
            Back to SUPER PEOPLE Revival
          </Link>
        </main>
      </body>
    </html>
  );
}
