/**
 * Slugify helper for player route params.
 *
 * Why: the old route used encodeURIComponent(p.name) as both the
 * generateStaticParams value and the URL segment. Next.js dynamic segments
 * are matched by their *decoded* value — generateStaticParams should return
 * the raw param, and Next encodes it itself when building the static
 * manifest / matching incoming requests. Returning an already-encoded
 * string caused it to be encoded *again* (e.g. "Kylian%2520Mbapp%25C3%25A9..."),
 * so the manifest entry never matched the actual (singly-encoded) request
 * URL → 404. Names with spaces, parens ("(captain)"), and accents
 * (Mbappé, Tagliafico, Kō Itakura) made this especially fragile.
 *
 * The robust fix: use a plain ASCII slug as the route param instead of the
 * raw name, and look the player up by slug server-side.
 */
export function slugify(name: string): string {
  return name
    .replace(/\s*\(captain\)\s*$/i, "") // drop captain suffix, e.g. "Kylian Mbappé (captain)"
    .normalize("NFD") // decompose accented chars, e.g. é -> e + combining acute accent
    .replace(/[̀-ͯ]/g, "") // strip the combining diacritical marks
    .replace(/'/g, "") // drop apostrophes, e.g. N'Golo -> NGolo
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // any run of non-alphanumerics -> single dash
    .replace(/^-+|-+$/g, ""); // trim leading/trailing dashes
}
