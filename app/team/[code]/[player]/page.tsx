import { notFound } from "next/navigation";
import Link from "next/link";
import { loadSquads } from "@/lib/data";
import { getPlayerEntryBySlug, getRoster } from "@/lib/team";
import { flagFor, COUNTRY_ZH } from "@/lib/flags";
import { ProbabilityBar } from "@/components/ProbabilityBar";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { PlayerDetailClient } from "./PlayerDetailClient";

// Route param is a plain ASCII slug (see lib/slug.ts), not the raw player
// name — generateStaticParams must return the *raw* (unencoded) segment
// value; Next.js takes care of URL-encoding it for the static manifest and
// for matching incoming requests. Names with spaces/parens/accents made the
// old encodeURIComponent(name)-as-param approach fragile and double-encoded.
export function generateStaticParams() {
  const { teams } = loadSquads();
  return teams.flatMap((t) =>
    getRoster(t.code).map((entry) => ({ code: t.code, player: entry.slug })),
  );
}

const POSITION_LABEL: Record<string, string> = {
  GK: "门将 GK",
  DF: "后卫 DF",
  MF: "中场 MF",
  FW: "前锋 FW",
};

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ code: string; player: string }>;
}) {
  const { code, player: slug } = await params;
  const { teams } = loadSquads();
  const team = teams.find((t) => t.code.toLowerCase() === code.toLowerCase());
  if (!team) notFound();

  const entry = getPlayerEntryBySlug(team.code, slug);
  if (!entry) notFound();

  const { enrichment } = entry;
  const flag = flagFor(team.code);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <Link
        href={`/team/${team.code}`}
        className="text-xs text-[var(--muted)] hover:text-[var(--accent)]"
      >
        ← 返回 {COUNTRY_ZH[team.country] ?? team.country} 名单
      </Link>

      {/* Hero */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 mt-4 mb-6 text-center sm:text-left">
        <PlayerAvatar
          photo={enrichment?.photo}
          flag={flag}
          name={entry.player.name}
          size={96}
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-baseline gap-x-3 gap-y-1">
            <h1 className="text-2xl font-bold">{entry.player.name}</h1>
            {enrichment?.nameZh && (
              <span className="text-lg text-[var(--muted)]">{enrichment.nameZh}</span>
            )}
          </div>
          <div className="flex flex-wrap justify-center sm:justify-start gap-1.5 mt-2 mb-3">
            <span className="pill text-[10px] px-2 py-0.5 text-[var(--accent)]">
              {POSITION_LABEL[entry.player.position] ?? entry.player.position}
            </span>
            <span className="pill text-[10px] px-2 py-0.5 text-[var(--muted)]">
              {entry.player.club}
            </span>
            <span className="pill text-[10px] px-2 py-0.5 text-[var(--muted)]">
              {entry.player.league}
            </span>
            <span className="pill text-[10px] px-2 py-0.5 text-[var(--muted)]">
              {flag} {COUNTRY_ZH[team.country] ?? team.country}
            </span>
            <span className="pill text-[10px] px-2 py-0.5 text-[var(--muted)]">
              {entry.player.birthYear}生 · {2030 - entry.player.birthYear}岁@2030
            </span>
          </div>
          {enrichment?.bio.zh && (
            <p className="text-sm text-[var(--muted)] leading-relaxed max-w-2xl">
              {enrichment.bio.zh}
            </p>
          )}
        </div>
      </div>

      <div className="mb-6">
        <ProbabilityBar label="2030 概率" value={entry.displayProbability} />
      </div>

      {/* Career */}
      {enrichment && (
        <div className="card p-5 mb-8">
          <h3 className="text-sm font-semibold mb-4">生涯履历 · Career</h3>

          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="rounded-lg border border-[var(--border)] p-3 text-center">
              <div className="text-xl font-bold font-mono text-[var(--accent)]">
                {entry.player.caps}
              </div>
              <div className="text-[10px] text-[var(--muted)] mt-1">国家队出场 Caps</div>
            </div>
            <div className="rounded-lg border border-[var(--border)] p-3 text-center">
              <div className="text-xl font-bold font-mono text-[var(--accent-2)]">
                {entry.player.goals}
              </div>
              <div className="text-[10px] text-[var(--muted)] mt-1">国家队进球 Goals</div>
            </div>
          </div>

          {enrichment.career.formerClubs.length > 0 && (
            <div className="mb-4">
              <div className="text-xs text-[var(--muted)] mb-2">历任俱乐部 Former clubs</div>
              <div className="flex flex-wrap items-center gap-2">
                {enrichment.career.formerClubs.map((club, i) => (
                  <span key={club} className="flex items-center gap-2">
                    <span className="pill text-xs px-2.5 py-1">{club}</span>
                    {i < enrichment.career.formerClubs.length - 1 && (
                      <span className="text-[var(--muted)] text-xs">→</span>
                    )}
                  </span>
                ))}
                <span className="text-[var(--muted)] text-xs">→</span>
                <span className="pill text-xs px-2.5 py-1 border-[var(--accent)] text-[var(--accent)]">
                  {entry.player.club} (现)
                </span>
              </div>
            </div>
          )}

          {enrichment.career.honours && enrichment.career.honours.length > 0 && (
            <div>
              <div className="text-xs text-[var(--muted)] mb-2">主要荣誉 Honours</div>
              <ul className="flex flex-col gap-1">
                {enrichment.career.honours.map((h) => (
                  <li key={h} className="text-xs flex items-start gap-1.5">
                    <span className="text-[var(--accent-2)]">🏆</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <PlayerDetailClient entry={entry} />
    </div>
  );
}
