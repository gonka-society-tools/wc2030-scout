import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "WC2030 Scout · 世界杯2030阵容预测",
  description:
    "Open public sports knowledge engine predicting 2030 FIFA World Cup squads. AI 推断仅供参考，非博彩建议。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="border-b border-[var(--border)] sticky top-0 z-40 backdrop-blur bg-[rgba(10,14,23,0.85)]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="text-2xl">⚽</span>
              <span className="font-bold text-lg tracking-tight">
                WC2030 <span className="text-[var(--accent)]">Scout</span>
              </span>
            </Link>
            <nav className="flex items-center gap-4 text-sm text-[var(--muted)]">
              <Link href="/" className="hover:text-[var(--foreground)] transition-colors">
                首页 <span className="hidden sm:inline">Home</span>
              </Link>
              <Link
                href="/market"
                className="hover:text-[var(--foreground)] transition-colors"
              >
                市场 <span className="hidden sm:inline">Market</span>
              </Link>
              <Link
                href="/methodology"
                className="hover:text-[var(--foreground)] transition-colors"
              >
                方法论 <span className="hidden sm:inline">Methodology</span>
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-[var(--border)] py-6 mt-12">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 text-xs text-[var(--muted)] flex flex-col sm:flex-row gap-2 sm:justify-between">
            <span>
              数据截至 2026-07 · AI 推断仅供参考，非博彩建议 · Data as of 2026-07, AI inference
              for reference only — not betting advice.
            </span>
            <span>AI³ Hackathon · Gonka Track</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
