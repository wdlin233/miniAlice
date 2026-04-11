import { NextResponse } from "next/server";

import { createSandbox, loadSandbox, listSandboxes } from "@/lib/sandbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CreateSandboxRequest {
  sandboxId?: string;
}

interface SetPlayheadTimeRequest {
  sandboxId: string;
  time: string;
}

interface AdvancePlayheadTimeRequest {
  sandboxId: string;
  delta: number;
}

interface RollbackPlayheadTimeRequest {
  sandboxId: string;
  time: string;
}

interface SandboxActionRequest {
  sandboxId: string;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    switch (action) {
      case "create": {
        const body = (await request.json()) as CreateSandboxRequest;
        const sandbox = await createSandbox(body.sandboxId);
        
        const response: ApiResponse<{
          sandboxId: string;
          playheadTime: string;
        }> = {
          success: true,
          data: {
            sandboxId: sandbox.getSandboxId(),
            playheadTime: sandbox.getPlayheadTime().toISOString(),
          },
        };

        return NextResponse.json(response);
      }

      case "list": {
        const sandboxes = await listSandboxes();
        
        const response: ApiResponse<string[]> = {
          success: true,
          data: sandboxes,
        };

        return NextResponse.json(response);
      }

      case "getState": {
        const body = (await request.json()) as SandboxActionRequest;
        const sandbox = await loadSandbox(body.sandboxId);
        
        const response: ApiResponse<{
          sandboxId: string;
          playheadTime: string;
          walletState: { staging: unknown; commits: unknown[] };
          sessionCount: number;
        }> = {
          success: true,
          data: {
            sandboxId: sandbox.getSandboxId(),
            playheadTime: sandbox.getPlayheadTime().toISOString(),
            walletState: sandbox.getWalletState(),
            sessionCount: sandbox.getSessionCount(),
          },
        };

        return NextResponse.json(response);
      }

      case "setPlayheadTime": {
        const body = (await request.json()) as SetPlayheadTimeRequest;
        const sandbox = await loadSandbox(body.sandboxId);
        sandbox.setPlayheadTime(new Date(body.time));
        await sandbox.saveState();
        
        const response: ApiResponse<{
          sandboxId: string;
          playheadTime: string;
        }> = {
          success: true,
          data: {
            sandboxId: sandbox.getSandboxId(),
            playheadTime: sandbox.getPlayheadTime().toISOString(),
          },
        };

        return NextResponse.json(response);
      }

      case "advancePlayheadTime": {
        const body = (await request.json()) as AdvancePlayheadTimeRequest;
        const sandbox = await loadSandbox(body.sandboxId);
        sandbox.advancePlayheadTime(body.delta);
        await sandbox.saveState();
        
        const response: ApiResponse<{
          sandboxId: string;
          playheadTime: string;
        }> = {
          success: true,
          data: {
            sandboxId: sandbox.getSandboxId(),
            playheadTime: sandbox.getPlayheadTime().toISOString(),
          },
        };

        return NextResponse.json(response);
      }

      case "rollbackPlayheadTime": {
        const body = (await request.json()) as RollbackPlayheadTimeRequest;
        const sandbox = await loadSandbox(body.sandboxId);
        sandbox.rollbackPlayheadTime(new Date(body.time));
        await sandbox.saveState();
        
        const response: ApiResponse<{
          sandboxId: string;
          playheadTime: string;
        }> = {
          success: true,
          data: {
            sandboxId: sandbox.getSandboxId(),
            playheadTime: sandbox.getPlayheadTime().toISOString(),
          },
        };

        return NextResponse.json(response);
      }

      case "reset": {
        const body = (await request.json()) as SandboxActionRequest;
        const sandbox = await loadSandbox(body.sandboxId);
        sandbox.reset();
        await sandbox.saveState();
        
        const response: ApiResponse<{
          sandboxId: string;
          playheadTime: string;
        }> = {
          success: true,
          data: {
            sandboxId: sandbox.getSandboxId(),
            playheadTime: sandbox.getPlayheadTime().toISOString(),
          },
        };

        return NextResponse.json(response);
      }

      case "cleanup": {
        const body = (await request.json()) as SandboxActionRequest;
        const sandbox = await loadSandbox(body.sandboxId);
        await sandbox.cleanup();
        
        const response: ApiResponse<{
          sandboxId: string;
          message: string;
        }> = {
          success: true,
          data: {
            sandboxId: body.sandboxId,
            message: "Sandbox cleaned up successfully",
          },
        };

        return NextResponse.json(response);
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: "Invalid action. Supported actions: create, list, getState, setPlayheadTime, advancePlayheadTime, rollbackPlayheadTime, reset, cleanup",
          } as ApiResponse<never>,
          { status: 400 }
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sandbox API route failed.";
    return NextResponse.json(
      { success: false, error: message } as ApiResponse<never>,
      { status: 500 }
    );
  }
}
