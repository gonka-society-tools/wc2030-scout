import { NextRequest, NextResponse } from "next/server";
import { getQuote } from "@/lib/market";

export const dynamic = "force-dynamic";

/**
 * GET /api/market/quote?player=<slug>[&team=<code>]
 * Free — no x402 payment required. Live read-only price snapshot for one
 * player, used by the /market page + PlayerMarketCard.
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("player")?.trim();
  const team = req.nextUrl.searchParams.get("team")?.trim() || undefined;
  if (!slug) {
    return NextResponse.json({ error: "Missing ?player=<slug> query param" }, { status: 400 });
  }

  const quote = getQuote(slug, team);
  if (!quote) {
    return NextResponse.json({ error: "player not found" }, { status: 404 });
  }

  return NextResponse.json({
    slug: quote.slug,
    nameEn: quote.name,
    team: quote.team,
    price: quote.price,
    base: quote.base,
    prob: quote.prob,
    source: quote.source,
    volume: quote.volume,
    turnover: quote.turnover,
    delta: quote.delta,
    updatedAt: quote.updatedAt,
  });
}
