import { notFound } from "next/navigation";
import Link from "next/link";
import { loadSquads } from "@/lib/data";
import { getRosterSorted, getPredictedLineup, getNewcomers } from "@/lib/team";
import { flagFor, COUNTRY_ZH } from "@/lib/flags";
import { ProbabilityBar } from "@/components/ProbabilityBar";
import type { Player } from "@/lib/types";

export function generateStaticParams() {
  const { teams } = loadSquads();
  return teams.map((t) => ({ code: t.code }));
}

const POSITION_LABEL: Record<Player["position"], string> = {
  GK: "门将 GK",
  DF: "后卫 DF",
  MF: "中场 MF",
  FW: "前锋 FW",
};

export default async function TeamPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const { teams } = loadSquads();
  const team = teams.find((t) => t.code.toLowerCase() === code.toLowerCase());
  if (!team) notFound();

  const roster = getRosterSorted(team.code);
  const lineup = getPredictedLineup(team.code);
  const newcomers = getNewcomers(team.code);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <Link href="/" className="text-xs text-[var(--muted)] hover:text-[var(--accent)]">
        ← 返回首页 Home
      </Link>

      <div className="flex items-center gap-4 mt-4 mb-8">
        <span className="text-5xl">{flagFor(team.code)}</span>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">
            {COUNTRY_ZH[team.country] ?? team.country}
          </h1>
          <p className="text-sm text-[var(--muted)]">{team.country} · 26人大名单</p>
        </div>
      </div>

      {/* 2030 predicted lineup */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-1">2030 预测阵容</h2>
        <p className="text-xs text-[var(--muted)] mb-4">
          Predicted 2030 XI — 按位置取留队概率最高球员（1 GK / 4 DF / 3 MF / 3 FW）
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(["GK", "DF", "MF", "FW"] as const).map((pos) => (
            <div key={pos} className="card p-4">
              <div className="text-xs text-[var(--accent)] font-mono mb-3">
                {POSITION_LABEL[pos]}
              </div>
              <div className="flex flex-col gap-3">
                {lineup[pos].map((entry) => (
                  <Link
                    key={entry.player.name}
                    href={`/team/${team.code}/${encodeURIComponent(entry.player.name)}`}
                    className="block hover:bg-white/5 rounded-lg p-2 -m-2 transition-colors"
                  >
                    <div className="text-sm font-medium truncate">{entry.player.name}</div>
                    <ProbabilityBar value={entry.displayProbability} />
                  </Link>
                ))}
                {lineup[pos].length === 0 && (
                  <span className="text-xs text-[var(--muted)]">暂无数据</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Full roster */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-1">完整名单（按2030留队概率排序）</h2>
        <p className="text-xs text-[var(--muted)] mb-4">
          Full roster sorted by 2030 retention probability · ⚠ 分歧较大标记 = 两模型预测差异 ≥20
        </p>
        <div className="card divide-y divide-[var(--border)]">
          {roster.map((entry) => (
            <Link
              key={entry.player.name}
              href={`/team/${team.code}/${encodeURIComponent(entry.player.name)}`}
              className="flex items-center gap-4 p-4 hover:bg-white/5 transition-colors"
            >
              <span className="pill text-[10px] px-2 py-0.5 text-[var(--muted)] shrink-0 w-12 text-center">
                {entry.player.position}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{entry.player.name}</span>
                  {entry.prediction && entry.prediction.divergence >= 20 && (
                    <span
                      title={`模型分歧 ${entry.prediction.divergence}`}
                      className="text-amber-400 text-xs"
                    >
                      ⚠
                    </span>
                  )}
                  {entry.isHeuristicFallback && (
                    <span className="text-[10px] text-[var(--muted)] pill px-1.5">启发式估算</span>
                  )}
                </div>
                <div className="text-xs text-[var(--muted)] truncate">
                  {entry.player.club} · {entry.player.league} · {entry.player.birthYear}生
                </div>
              </div>
              <div className="w-32 shrink-0 hidden sm:block">
                <ProbabilityBar value={entry.displayProbability} />
              </div>
              <span className="font-mono text-sm w-10 text-right sm:hidden">
                {entry.displayProbability}%
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Newcomers */}
      <section>
        <h2 className="text-lg font-semibold mb-1">2030 潜在新星（模型推断）</h2>
        <p className="text-xs text-[var(--muted)] mb-4">
          Model-inferred 2030 newcomers — 基于公开青训/俱乐部趋势的模型推测，非确定性事实
        </p>
        {newcomers.length === 0 ? (
          <div className="card p-6 text-sm text-[var(--muted)]">
            暂无新星推断数据，请先运行 scripts/precompute.ts
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {newcomers.map((n) => (
              <div key={n.name} className="card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="pill text-[10px] px-2 py-0.5 text-[var(--muted)]">
                    {n.position}
                  </span>
                  <span className="font-medium">{n.name}</span>
                </div>
                <p className="text-xs text-[var(--muted)] leading-relaxed">{n.note}</p>
                <p className="text-[10px] text-[var(--muted)] mt-2 font-mono truncate">
                  req: {n.requestId}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
