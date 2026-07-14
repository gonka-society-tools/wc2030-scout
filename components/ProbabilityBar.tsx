export function ProbabilityBar({
  label,
  value,
  color = "var(--accent)",
}: {
  label?: string;
  value: number;
  color?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2 w-full">
      {label && <span className="text-xs text-[var(--muted)] w-16 shrink-0">{label}</span>}
      <div className="flex-1 h-2 rounded-full bg-[#1a2030] overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${clamped}%`, background: color }}
        />
      </div>
      <span className="text-xs font-mono w-9 text-right shrink-0">{clamped}%</span>
    </div>
  );
}
