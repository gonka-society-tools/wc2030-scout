import { notFound } from "next/navigation";
import Link from "next/link";
import { loadSquads } from "@/lib/data";
import { getPlayerEntry } from "@/lib/team";
import { flagFor, COUNTRY_ZH } from "@/lib/flags";
import { ProbabilityBar } from "@/components/ProbabilityBar";
import { PlayerDetailClient } from "./PlayerDetailClient";

export function generateStaticParams() {
  const { teams } = loadSquads();
  return teams.flatMap((t) =>
    t.players.map((p) => ({ code: t.code, player: encodeURIComponent(p.name) })),
  );
}

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ code: string; player: string }>;
}) {
  const { code, player: playerParam } = await params;
  const { teams } = loadSquads();
  const team = teams.find((t) => t.code.toLowerCase() === code.toLowerCase());
  if (!team) notFound();

  const playerName = decodeURIComponent(playerParam);
  const entry = getPlayerEntry(team.code, playerName);
  if (!entry) notFound();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <Link
        href={`/team/${team.code}`}
        className="text-xs text-[var(--muted)] hover:text-[var(--accent)]"
      >
        ← 返回 {COUNTRY_ZH[team.country] ?? team.country} 名单
      </Link>

      <div className="flex items-center gap-3 mt-4 mb-2">
        <span className="text-3xl">{flagFor(team.code)}</span>
        <div>
          <h1 className="text-2xl font-bold">{entry.player.name}</h1>
          <p className="text-sm text-[var(--muted)]">
            {entry.player.position} · {entry.player.club} · {entry.player.league} ·{" "}
            {entry.player.birthYear}生 · {2030 - entry.player.birthYear}岁@2030
          </p>
        </div>
      </div>

      <div className="mb-6">
        <ProbabilityBar label="2030 概率" value={entry.displayProbability} />
      </div>

      <PlayerDetailClient entry={entry} />
    </div>
  );
}
