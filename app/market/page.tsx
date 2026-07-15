"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { flagFor } from "@/lib/flags";

interface BoardRow {
  slug: string;
  team: string;
  name: string;
  price: number;
  base: number;
  prob: number;
  source: "dual-model" | "baseline";
  volume: number;
  turnover: number;
  delta: number;
  updatedAt: string;
}

interface BoardResponse {
  top: BoardRow[];
  movers: BoardRow[];
  cheapest: BoardRow[];
  mostTraded: BoardRow[];
  count: number;
  updatedAt: string;
}

interface PaymentTerms {
  x402Version: number;
  error: string;
  resource: { url: string; description: string; mimeType: string; serviceName: string };
  accepts: {
    scheme: string;
    network: string;
    asset: string;
    amount: string;
    payTo: string;
    maxTimeoutSeconds: number;
    extra: Record<string, string>;
  }[];
}

const SOURCE_LABEL: Record<BoardRow["source"], { label: string; color: string }> = {
  "dual-model": { label: "双模型", color: "var(--accent)" },
  baseline: { label: "基线", color: "var(--muted)" },
};

function dedupeRows(...lists: BoardRow[][]): BoardRow[] {
  const seen = new Map<string, BoardRow>();
  for (const list of lists) {
    for (const row of list) seen.set(`${row.team}::${row.slug}`, row);
  }
  return [...seen.values()].sort((a, b) => b.price - a.price);
}

export default function MarketPage() {
  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalTerms, setModalTerms] = useState<PaymentTerms | null>(null);
  const [modalTrade, setModalTrade] = useState<{ player: string; team: string; side: "buy" | "sell"; qty: number } | null>(
    null,
  );
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/market/board")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setBoard)
      .catch((err) => setError((err as Error).message));
  }, []);

  async function handleTrade(row: BoardRow, side: "buy" | "sell") {
    const key = `${row.team}::${row.slug}::${side}`;
    setPendingKey(key);
    const tradeBody = { player: row.slug, team: row.team, side, qty: 1 };
    try {
      const res = await fetch("/api/market/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tradeBody),
      });
      if (res.status === 402) {
        const terms = (await res.json()) as PaymentTerms;
        setModalTerms(terms);
        setModalTrade(tradeBody);
      } else {
        const data = await res.json().catch(() => null);
        setError(`意外响应 HTTP ${res.status}: ${JSON.stringify(data)}`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPendingKey(null);
    }
  }

  const rows = board ? dedupeRows(board.top, board.movers, board.cheapest, board.mostTraded) : [];

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-2xl sm:text-3xl font-bold mb-2">预测市场 · Prediction Market</h1>
      <p className="text-sm text-[var(--muted)] mb-8">
        每位球员的「2030留队概率」映射为一个测试网 PIEUSD 计价的demo价格 · 交易走 x402 · Kite testnet
        <br />
        Demo prices derived from 2030 retention probability — settled via x402 on Kite testnet.
      </p>

      {error && (
        <div className="card p-4 mb-6 border-[var(--danger)]/40 bg-[var(--danger)]/5 text-sm text-[var(--danger)]">
          {error}
        </div>
      )}

      {!board && !error && <p className="text-sm text-[var(--muted)]">加载中...</p>}

      {board && (
        <>
          {/* Desktop table */}
          <div className="hidden md:block card overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--muted)] border-b border-[var(--border)]">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">球员 Player</th>
                  <th className="px-4 py-3 font-medium">概率 Prob</th>
                  <th className="px-4 py-3 font-medium">价格 Price</th>
                  <th className="px-4 py-3 font-medium">来源 Source</th>
                  <th className="px-4 py-3 font-medium">成交量 Volume</th>
                  <th className="px-4 py-3 font-medium text-right">操作 Trade</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={`${row.team}::${row.slug}`} className="border-b border-[var(--border)] last:border-0">
                    <td className="px-4 py-3 text-[var(--muted)] font-mono">{i + 1}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/team/${row.team}/${row.slug}`}
                        className="flex items-center gap-2 hover:text-[var(--accent)]"
                      >
                        <span>{flagFor(row.team)}</span>
                        <span className="font-medium">{row.name}</span>
                        <span className="text-[var(--muted)] text-xs">{row.team}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono">{row.prob}%</td>
                    <td className="px-4 py-3 font-mono text-[var(--accent-2)]">${row.price.toFixed(4)}</td>
                    <td className="px-4 py-3">
                      <span
                        className="pill text-[10px] px-2 py-0.5"
                        style={{ color: SOURCE_LABEL[row.source].color }}
                      >
                        {SOURCE_LABEL[row.source].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[var(--muted)]">{row.volume}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleTrade(row, "buy")}
                          disabled={pendingKey === `${row.team}::${row.slug}::buy`}
                          className="pill px-3 py-1 text-xs bg-[var(--accent-2)] text-[#05070c] font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                        >
                          买入
                        </button>
                        <button
                          onClick={() => handleTrade(row, "sell")}
                          disabled={pendingKey === `${row.team}::${row.slug}::sell`}
                          className="pill px-3 py-1 text-xs bg-[var(--danger)] text-[#05070c] font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                        >
                          卖出
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile stacked cards */}
          <div className="md:hidden flex flex-col gap-3">
            {rows.map((row, i) => (
              <div key={`${row.team}::${row.slug}`} className="card p-4">
                <div className="flex items-center justify-between mb-2">
                  <Link href={`/team/${row.team}/${row.slug}`} className="flex items-center gap-2">
                    <span className="text-[var(--muted)] font-mono text-xs">#{i + 1}</span>
                    <span>{flagFor(row.team)}</span>
                    <span className="font-medium">{row.name}</span>
                  </Link>
                  <span
                    className="pill text-[10px] px-2 py-0.5"
                    style={{ color: SOURCE_LABEL[row.source].color }}
                  >
                    {SOURCE_LABEL[row.source].label}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm mb-3">
                  <span className="text-[var(--muted)]">
                    概率 {row.prob}% · 成交量 {row.volume}
                  </span>
                  <span className="font-mono text-[var(--accent-2)]">${row.price.toFixed(4)}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleTrade(row, "buy")}
                    disabled={pendingKey === `${row.team}::${row.slug}::buy`}
                    className="flex-1 pill px-3 py-1.5 text-xs bg-[var(--accent-2)] text-[#05070c] font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    买入
                  </button>
                  <button
                    onClick={() => handleTrade(row, "sell")}
                    disabled={pendingKey === `${row.team}::${row.slug}::sell`}
                    className="flex-1 pill px-3 py-1.5 text-xs bg-[var(--danger)] text-[#05070c] font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    卖出
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="text-xs text-[var(--muted)] mt-8 text-center">
        测试网演示 · 非真实资产 · 非博彩 — Testnet demo only, not real assets, not gambling.
      </p>

      {modalTerms && modalTrade && (
        <PaymentModal
          terms={modalTerms}
          trade={modalTrade}
          onClose={() => {
            setModalTerms(null);
            setModalTrade(null);
          }}
        />
      )}
    </div>
  );
}

function PaymentModal({
  terms,
  trade,
  onClose,
}: {
  terms: PaymentTerms;
  trade: { player: string; team: string; side: "buy" | "sell"; qty: number };
  onClose: () => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  const curlCmd = `curl -s -X POST ${terms.resource.url} \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(trade)}'`;
  const dryRunCmd = `node scripts/trade-agent.mjs --dry-run --base ${new URL(terms.resource.url).origin}`;

  function copy(text: string, label: string) {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        className="card p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto scrollbar-thin"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold">Agent 支付入口 (x402 · Kite testnet)</h3>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--foreground)]">
            ✕
          </button>
        </div>
        <p className="text-xs text-[var(--muted)] mb-4">
          该交易需要 x402 支付才能结算。以下是服务端返回的 402 PaymentRequirements —
          Agent 侧需签名一笔 EIP-3009 transferWithAuthorization 并带 X-PAYMENT 头重试请求。
        </p>

        <div className="mb-4">
          <div className="text-xs text-[var(--muted)] mb-1">PaymentRequirements (accepts[0])</div>
          <pre className="text-[10px] bg-[var(--background)] border border-[var(--border)] rounded-lg p-3 overflow-x-auto">
            {JSON.stringify(terms.accepts[0], null, 2)}
          </pre>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-[var(--muted)]">等效 curl (会得到同样的 402)</span>
            <button
              onClick={() => copy(curlCmd, "curl")}
              className="text-[10px] text-[var(--accent)] hover:underline"
            >
              {copied === "curl" ? "已复制 ✓" : "复制"}
            </button>
          </div>
          <pre className="text-[10px] bg-[var(--background)] border border-[var(--border)] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
            {curlCmd}
          </pre>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-[var(--muted)]">等效 trade-agent 干跑命令</span>
            <button
              onClick={() => copy(dryRunCmd, "dry-run")}
              className="text-[10px] text-[var(--accent)] hover:underline"
            >
              {copied === "dry-run" ? "已复制 ✓" : "复制"}
            </button>
          </div>
          <pre className="text-[10px] bg-[var(--background)] border border-[var(--border)] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
            {dryRunCmd}
          </pre>
        </div>
      </div>
    </div>
  );
}
