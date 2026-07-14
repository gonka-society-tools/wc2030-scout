"use client";
import { useState } from "react";
import { RadarChart } from "@/components/RadarChart";
import { GonkaBadge, type GonkaRequestEntry } from "@/components/GonkaBadge";
import type { RosterEntry } from "@/lib/team";

const SIGNAL_STYLE: Record<string, { label: string; color: string }> = {
  上升: { label: "📈 上升", color: "#a3e635" },
  平稳: { label: "➡️ 平稳", color: "#8b93a7" },
  下滑: { label: "📉 下滑", color: "#fb7185" },
};

export function PlayerDetailClient({ entry }: { entry: RosterEntry }) {
  const [requestIds, setRequestIds] = useState<GonkaRequestEntry[]>(() => {
    const seeded: GonkaRequestEntry[] = [];
    if (entry.prediction) {
      seeded.push({
        requestId: entry.prediction.kimi.requestId,
        model: entry.prediction.kimi.model,
        step: "Kimi · 2030留队预测",
      });
      seeded.push({
        requestId: entry.prediction.minimax.requestId,
        model: entry.prediction.minimax.model,
        step: "MiniMax · 2030留队预测",
      });
    }
    return seeded;
  });

  const [news, setNews] = useState<{
    signal: string;
    summary: string;
    requestId: string;
    model: string;
  } | null>(null);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);

  async function fetchNews() {
    setNewsLoading(true);
    setNewsError(null);
    try {
      const res = await fetch(`/api/news?player=${encodeURIComponent(entry.player.name)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setNews(data);
      setRequestIds((prev) => [
        ...prev,
        { requestId: data.requestId, model: data.model, step: "最新动态摘要" },
      ]);
    } catch (err) {
      setNewsError((err as Error).message);
    } finally {
      setNewsLoading(false);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="card p-5 flex flex-col items-center">
          <h3 className="text-sm font-semibold self-start mb-2">五维雷达 · Radar</h3>
          <RadarChart dims={entry.radar} />
          <p className="text-[10px] text-[var(--muted)] mt-2 text-center">
            年龄纵深 / 联赛水平 / 国际经验 / 数据产出 / 生涯趋势 — 基于公开数据启发式计算，非模型输出
          </p>
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold mb-3">模型推理 · Model Reasoning</h3>
          {entry.prediction ? (
            <div className="flex flex-col gap-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-mono text-[var(--accent)]">Kimi K2.6</span>
                  <span className="text-xs font-mono">{entry.prediction.kimi.probability2030}%</span>
                </div>
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  {entry.prediction.kimi.reasoning}
                </p>
                <p className="text-[10px] text-[var(--muted)] mt-1 font-mono truncate">
                  req: {entry.prediction.kimi.requestId}
                </p>
              </div>
              <div className="border-t border-[var(--border)] pt-3">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-mono text-[var(--accent-2)]">MiniMax M2.7</span>
                  <span className="text-xs font-mono">
                    {entry.prediction.minimax.probability2030}%
                  </span>
                </div>
                <p className="text-xs text-[var(--muted)] leading-relaxed">
                  {entry.prediction.minimax.reasoning}
                </p>
                <p className="text-[10px] text-[var(--muted)] mt-1 font-mono truncate">
                  req: {entry.prediction.minimax.requestId}
                </p>
              </div>
              <div className="border-t border-[var(--border)] pt-3 text-xs text-[var(--muted)]">
                模型分歧（divergence）：
                <span className={entry.prediction.divergence >= 20 ? "text-amber-400" : ""}>
                  {" "}
                  {entry.prediction.divergence}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[var(--muted)]">
              尚无 Gonka 预测数据，当前概率为本地启发式估算（年龄/趋势/联赛加权）。运行{" "}
              <code className="pill px-1">scripts/precompute.ts</code> 生成真实推断。
            </p>
          )}
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">最新动态 · Latest Signal</h3>
          <button
            onClick={fetchNews}
            disabled={newsLoading}
            className="pill px-3 py-1.5 text-xs bg-[var(--accent)] text-[#05070c] font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {newsLoading ? "查询中..." : "查询最新动态"}
          </button>
        </div>
        {newsError && <p className="text-xs text-[var(--danger)]">获取失败：{newsError}</p>}
        {news && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span
                className="pill px-2 py-0.5 text-xs font-medium"
                style={{ color: SIGNAL_STYLE[news.signal]?.color ?? "#8b93a7" }}
              >
                {SIGNAL_STYLE[news.signal]?.label ?? news.signal}
              </span>
            </div>
            <p className="text-xs text-[var(--muted)] leading-relaxed">{news.summary}</p>
            <p className="text-[10px] text-[var(--muted)] mt-2 font-mono truncate">
              req: {news.requestId}
            </p>
          </div>
        )}
        {!news && !newsError && (
          <p className="text-xs text-[var(--muted)]">
            基于 DuckDuckGo 公开搜索结果 + Gonka Kimi 摘要，实时判断球员近期状态信号。
          </p>
        )}
      </div>

      <GonkaBadge entries={requestIds} />
    </div>
  );
}
