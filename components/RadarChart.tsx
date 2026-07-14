"use client";
import type { RadarDims } from "@/lib/heuristics";

const DIM_LABELS: { key: keyof RadarDims; label: string }[] = [
  { key: "ageScore", label: "年龄" },
  { key: "leagueScore", label: "联赛" },
  { key: "capsScore", label: "经验" },
  { key: "outputScore", label: "产出" },
  { key: "trendScore", label: "趋势" },
];

/** Simple dependency-free SVG radar chart for the 5 heuristic dims (0-100 each). */
export function RadarChart({ dims, size = 220 }: { dims: RadarDims; size?: number }) {
  const center = size / 2;
  const radius = size * 0.36;
  const n = DIM_LABELS.length;

  const pointFor = (i: number, value: number) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const r = (value / 100) * radius;
    return [center + r * Math.cos(angle), center + r * Math.sin(angle)];
  };

  const dataPoints = DIM_LABELS.map((d, i) => pointFor(i, dims[d.key]));
  const dataPath = dataPoints.map((p) => p.join(",")).join(" ");

  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {rings.map((r) => {
        const ringPts = DIM_LABELS.map((_, i) => pointFor(i, r * 100).join(",")).join(" ");
        return (
          <polygon
            key={r}
            points={ringPts}
            fill="none"
            stroke="#232a3a"
            strokeWidth={1}
          />
        );
      })}
      {DIM_LABELS.map((_, i) => {
        const [x, y] = pointFor(i, 100);
        return (
          <line key={i} x1={center} y1={center} x2={x} y2={y} stroke="#232a3a" strokeWidth={1} />
        );
      })}
      <polygon points={dataPath} fill="rgba(34,211,238,0.25)" stroke="#22d3ee" strokeWidth={2} />
      {dataPoints.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3} fill="#22d3ee" />
      ))}
      {DIM_LABELS.map((d, i) => {
        const [x, y] = pointFor(i, 118);
        return (
          <text
            key={d.key}
            x={x}
            y={y}
            fontSize={11}
            fill="#8b93a7"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}
