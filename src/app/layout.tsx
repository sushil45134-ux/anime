import Link from "next/link";
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AniRoll — Watch Anime",
  description:
    "Anime streaming with four servers per episode, popup-free by design. Every player runs in a sandboxed iframe so ad popups never reach you.",
  metadataBase: new URL("https://example.com"),
  icons: {
    icon: [
      {
        url:
          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath d='M6 32C16 14 48 14 58 32C48 50 16 50 6 32Z' fill='%23f47521'/%3E%3Ccircle cx='32' cy='32' r='15' fill='%23202227'/%3E%3Cpath d='M28 23L43 32L28 41Z' fill='white'/%3E%3C/svg%3E",
      },
    ],
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#000000" };

const BrandMark = () => (
  <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
    <path d="M6 32C16 14 48 14 58 32C48 50 16 50 6 32Z" fill="#f47521" />
    <circle cx="32" cy="32" r="15" fill="#202227" />
    <path d="M28 23L43 32L28 41Z" fill="#fff" />
  </svg>
);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&family=Nunito:wght@900&family=Roboto+Condensed:wght@400;700;900&display=swap"
        />
      </head>
      <body>
        <a className="sr-only" href="#main">
          Skip to content
        </a>
        <header className="topbar">
          <a className="brand" href="/" aria-label="AniRoll home">
            <BrandMark />
            <span className="brand-word">
              ani<span className="accent">roll</span>
            </span>
          </a>
          <nav className="main-nav" aria-label="Primary navigation">
            <a href="/" aria-current="page" style={{ padding: "0 17px", fontWeight: 700, color: "#dadada", textDecoration: "none" }}>
              Home
            </a>
            <a href="/#browse" style={{ padding: "0 17px", fontWeight: 700, color: "#dadada", textDecoration: "none" }}>
              Browse
            </a>
            <a href="/#movies" style={{ padding: "0 17px", fontWeight: 700, color: "#dadada", textDecoration: "none" }}>
              Movies
            </a>
          </nav>
          <div className="top-actions">
            <Link href="/search" className="icon-btn" aria-label="Search anime" style={{ textDecoration: "none" }}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-4-4" />
              </svg>
            </Link>
            <span className="avatar" aria-label="Guest profile">
              G7
            </span>
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className="footer">
          <div className="footer-intro">
            <BrandMark />
            <div>
              <p>
                AniRoll keeps four playback servers per episode and refuses to let any of them open a popup — the
                player frame is sandboxed without <code>allow-popups</code>. Catalog metadata comes from TMDB.
              </p>
              <details className="sources" style={{ marginTop: 14 }}>
                <summary>Playback rules</summary>
                <p style={{ marginTop: 10 }}>
                  Every embed loads sandboxed (scripts, same-origin, forms, presentation only). A server that does not
                  answer in 11 seconds is marked dead and the &quot;Try another server&quot; overlay takes over. Sources
                  in the catalog are only ever links we are licensed or authorised to embed.
                </p>
              </details>
            </div>
          </div>
          <div>
            <p style={{ textAlign: "right" }}>
              Servers blocked on Jio? Use the 1.1.1.1 app.
              <br />
              Not loading after that? Switch tabs — one of the four usually answers.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
