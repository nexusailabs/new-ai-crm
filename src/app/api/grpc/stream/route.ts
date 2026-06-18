/**
 * gRPC Stream Control API
 * Start/stop/status for the Match-Trade gRPC ledger stream
 * Created: 2025-12-29
 * Mission: MISSION-20251229-0001 - Real-time Sync System
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getStreamService,
  startGlobalStream,
  stopGlobalStream,
} from '@/lib/grpc/ledger-stream';

export const dynamic = 'force-dynamic';

// ============================================================================
// GET - Stream Status
// ============================================================================

export async function GET() {
  const service = getStreamService();

  if (!service) {
    return NextResponse.json({
      status: 'stopped',
      message: 'gRPC stream service is not running',
    });
  }

  const stats = service.getStats();

  return NextResponse.json({
    status: stats.isConnected ? 'connected' : 'disconnected',
    stats: {
      totalReceived: stats.totalReceived,
      depositsReceived: stats.depositsReceived,
      withdrawalsReceived: stats.withdrawalsReceived,
      lastEventAt: stats.lastEventAt?.toISOString() || null,
      reconnectCount: stats.reconnectCount,
    },
  });
}

// ============================================================================
// POST - Start/Stop Stream
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'start';

    // API key validation
    const apiKey = request.headers.get('x-api-key');
    const expectedKey = process.env.GRPC_API_KEY || process.env.SYNC_API_KEY;

    if (expectedKey && apiKey !== expectedKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (action === 'start') {
      const service = await startGlobalStream();
      const stats = service.getStats();

      return NextResponse.json({
        status: 'started',
        message: 'gRPC stream service started',
        stats: {
          isConnected: stats.isConnected,
        },
      });
    }

    if (action === 'stop') {
      stopGlobalStream();

      return NextResponse.json({
        status: 'stopped',
        message: 'gRPC stream service stopped',
      });
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "start" or "stop"' },
      { status: 400 }
    );

  } catch (error) {
    console.error('[gRPC API] Error:', error);
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
