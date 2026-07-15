import { NextResponse } from "next/server";
import { getBoard } from "@/lib/market";

export const dynamic = "force-dynamic";

/**
 * GET /api/market/board
 * Free — no x402 payment required. Three ranked lists (top price, biggest
 * movers, cheapest) capped at 20 rows each, used by /market and by
 * scripts/trade-agent.mjs's divergence scan.
 */
export async function GET() {
  const board = getBoard(20);
  return NextResponse.json({
    top: board.highestPriced,
    movers: board.topMovers,
    cheapest: board.lowestPriced,
    mostTraded: board.mostTraded,
    count: board.count,
    updatedAt: board.generatedAt,
  });
}
