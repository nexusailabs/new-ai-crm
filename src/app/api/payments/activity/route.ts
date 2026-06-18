/**
 * Payment Activity API Route
 * GET /api/payments/activity - Fetch combined payment activity feed
 * Created: 2025-12-29
 */

import { NextRequest, NextResponse } from "next/server";
import { generateActivityFeed } from "@/lib/mockPaymentData";
import type { PaymentEvent } from "@/types/payment";

// In-memory store for activity feed
let activityFeed = generateActivityFeed(30);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");
    const type = searchParams.get("type"); // DEPOSIT | WITHDRAWAL | null

    let filteredActivity = [...activityFeed];

    // Filter by type if specified
    if (type === "DEPOSIT" || type === "WITHDRAWAL") {
      filteredActivity = filteredActivity.filter((a) => a.type === type);
    }

    // Apply limit
    filteredActivity = filteredActivity.slice(0, limit);

    return NextResponse.json({
      activity: filteredActivity,
      total: activityFeed.length,
    });
  } catch (error) {
    console.error("Activity API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity" },
      { status: 500 }
    );
  }
}
