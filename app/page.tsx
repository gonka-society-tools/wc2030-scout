import Link from "next/link";
import { loadSquads, isUsingSampleData } from "@/lib/data";
import { flagFor, COUNTRY_ZH } from "@/lib/flags";

function avgAge(players: { birthYear: number }[], forYear: number) {
  const total = players.reduce((sum, p) => sum + (forYear - p.birthYear), 0);
  return (total / players.length).toFixed(1);
}

export default function HomePage() {
  const { teams } = loadSquads();
  const usingSample = isUsingSampleData();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <section className="relative overflow-hidden rounded-2xl border border-[var(--border)] mb-10 px-6 sm:px-10 py-10 sm:py-14">
        {/* Pure-CSS "stadium under lights" gradient — no external assets. */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 120% 80% at 50% 120%, rgba(163,230,53,0.16) 0%, transparent 55%)," +
              "radial-gradient(circle at 15% 20%, rgba(34,211,238,0.18) 0%, transparent 45%)," +
              "radial-gradient(circle at 85% 15%, rgba(34,211,238,0.12) 0%, transparent 40%)," +
              "linear-gradient(180deg, #0d1320 0%, #05070c 100%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-24 -z-10 opacity-40"
          style={{
            backgroundImage:
              "repeating-linear-gradient(90deg, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 2px, transparent 2px, transparent 48px)",
            maskImage: "linear-gradient(to top, black, transparent)",
          }}
        />
        <p className="text-sm text-[var(--accent)] font-mono mb-2">
          OPEN PUBLIC SPORTS KNOWLEDGE ENGINE
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
          2030年世界杯，谁还会在场上？
        </h1>
        <p className="text-[var(--muted)] max-w-2xl leading-relaxed">
          WC2030 Scout 基于公开球员数据与 Gonka 双模型（Kimi K2.6 / MiniMax M2.7）交叉推断，
          预测2026年世界杯26人大名单球员在2030年世界杯的留队概率。这是一个开放的公共体育知识引擎，
          <strong className="text-[var(--foreground)]">不构成博彩建议</strong>。
        </p>
        {usingSample && (
          <div className="mt-4 inline-flex items-center gap-2 pill px-3 py-1.5 text-xs text-amber-300 bg-amber-500/10 border-amber-500/30">
            ⚠️ 当前展示示例数据 (predictions.sample.json)，尚未运行真实 Gonka 预测批处理
          </div>
        )}
      </section>

      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        {teams.map((team) => {
          const age2026 = avgAge(team.players, 2026);
          const age2030 = avgAge(team.players, 2030);
          return (
            <Link
              key={team.code}
              href={`/team/${team.code}`}
              className="card p-4 sm:p-5 flex flex-col items-center gap-1.5 sm:gap-2 hover:border-[var(--accent)] transition-colors group"
            >
              <span className="text-3xl sm:text-4xl group-hover:scale-110 transition-transform">
                {flagFor(team.code)}
              </span>
              <span className="font-semibold text-center text-sm sm:text-base">
                {COUNTRY_ZH[team.country] ?? team.country}
              </span>
              <span className="text-[10px] sm:text-xs text-[var(--muted)]">{team.country}</span>
              <div className="w-full mt-1 sm:mt-2 text-xs text-center border-t border-[var(--border)] pt-2">
                <div className="flex justify-between text-[var(--muted)]">
                  <span>2026均龄</span>
                  <span className="text-[var(--foreground)]">{age2026}</span>
                </div>
                <div className="flex justify-between text-[var(--muted)] mt-1">
                  <span>2030均龄</span>
                  <span className="text-[var(--accent-2)]">{age2030}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </section>
    </div>
  );
}
