/** Player photo avatar with graceful fallback to a flag-emoji circle when no
 *  Wikipedia photo is available (see scripts/enrich.ts / lib/data.ts). */
export function PlayerAvatar({
  photo,
  flag,
  name,
  size = 32,
  className = "",
}: {
  photo: string | null | undefined;
  flag: string;
  name: string;
  size?: number;
  className?: string;
}) {
  const style = { width: size, height: size };
  if (photo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- external hotlinked Wikipedia photos, sizes vary per player
      <img
        src={photo}
        alt={name}
        loading="lazy"
        style={style}
        className={`rounded-full object-cover shrink-0 bg-[var(--background-elevated)] border border-[var(--border)] ${className}`}
      />
    );
  }
  return (
    <div
      style={{ ...style, fontSize: size * 0.5 }}
      className={`rounded-full shrink-0 flex items-center justify-center bg-[var(--background-elevated)] border border-[var(--border)] ${className}`}
    >
      {flag}
    </div>
  );
}
