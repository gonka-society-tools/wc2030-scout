"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Quote {
  slug: string;
  nameEn: string;
  price: number;
  base: number;
  prob: number;
  source: "dual-model" | "baseline";
  volume: number;
  updatedAt: string;
}

/** Client-fetched "预测市场" card for the (server-rendered) player detail
 *  page — shows the live demo price + volume and links to /market for the
 *  full x402 trading flow. */
export function PlayerMarketCard({ slug, team }: { slug: string; team: string }) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/market/quote?player=${encodeURIComponent(slug)}&team=${encodeURIComponent(team)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!cancelled) setQuote(data);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, team]);

  return (
    <div className="card p-5 mb-8">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">预测市场 · Prediction Market</h3>
        <Link href="/market" className="text-xs text-[var(--accent)] hover:underline">
          查看全部 →
        </Link>
      </div>
      {error && <p className="text-xs text-[var(--danger)]">获取失败：{error}</p>}
      {!quote && !error && <p className="text-xs text-[var(--muted)]">加载中...</p>}
      {quote && (
        <div className="flex items-center gap-6">
          <div>
            <div className="text-2xl font-bold font-mono text-[var(--accent-2)]">
              ${quote.price.toFixed(4)}
            </div>
            <div className="text-[10px] text-[var(--muted)] mt-1">
              demo 价格 · PIEUSD (kite-testnet)
            </div>
          </div>
          <div className="text-xs text-[var(--muted)]">
            <div>成交量 Volume: {quote.volume}</div>
            <div>
              来源:{" "}
              <span className={quote.source === "dual-model" ? "text-[var(--accent)]" : ""}>
                {quote.source === "dual-model" ? "双模型" : "基线"}
              </span>
            </div>
          </div>
        </div>
      )}
      <p className="text-[10px] text-[var(--muted)] mt-3">
        测试网演示 · 非真实资产 · 非博彩 — 前往 <Link href="/market" className="underline">/market</Link>{" "}
        使用 x402 Agent 支付入口买卖。
      </p>
    </div>
  );
}
