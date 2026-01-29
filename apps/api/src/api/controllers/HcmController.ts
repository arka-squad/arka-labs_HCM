import { Request, Response } from 'express';
import { HcmService, HcmRequest, HcmResponse, HcmErrorCode } from '../../hcmService';

export class HcmController {
  private hcmService: HcmService;

  constructor(hcmService: HcmService) {
    this.hcmService = hcmService;
  }

  /**
   * HTTP Envelope (v1.1)
   * All responses (success or error) use:
   * { ok: boolean, data: any, error: any, meta: any }
   */
  public async execute(req: Request, res: Response): Promise<void> {
    const start = Date.now();
    const { op, request_id, caller, payload } = req.body;

    // Basic structural validation (HTTP-level)
    if (!op || !request_id || !caller || !payload) {
      const meta = this.buildMeta(start, request_id || 'unknown', op || 'unknown');
      res.status(400).json({
        ok: false,
        data: null,
        error: {
          code: 'INVALID_PAYLOAD',
          message: 'Missing required fields: op, request_id, caller, payload'
        },
        meta
      });
      return;
    }

    const hcmRequest: HcmRequest = {
      op,
      request_id,
      caller,
      payload
    };

    try {
      const response: HcmResponse = await this.hcmService.handle(hcmRequest);
      const meta = this.buildMeta(start, response.request_id, response.op);

      if (response.status === 'ok') {
        res.status(200).json({
          ok: true,
          data: response.data ?? null,
          error: null,
          meta
        });
      } else {
        const statusCode = this.mapErrorToHttp(response.error?.code);
        res.status(statusCode).json({
          ok: false,
          data: null,
          error: response.error ?? {
            code: 'INTERNAL_ERROR',
            message: 'Unexpected HCM error'
          },
          meta
        });
      }
    } catch (error) {
      const meta = this.buildMeta(start, request_id, op);
      res.status(500).json({
        ok: false,
        data: null,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Unexpected server error',
          details: { original_error: error }
        },
        meta
      });
    }
  }

  private mapErrorToHttp(code?: HcmErrorCode): number {
    switch (code) {
      case 'MISSION_NOT_FOUND':
        return 404;
      case 'ACCESS_DENIED':
        return 403;
      case 'INVALID_PAYLOAD':
        return 400;
      case 'NOT_IMPLEMENTED':
        return 501;
      case 'CONFLICTING_UPDATE':
        return 409;
      case 'IO_ERROR':
      case 'INTERNAL_ERROR':
      default:
        return 500;
    }
  }

  private buildMeta(start: number, requestId: string | undefined, op: string | undefined) {
    return {
      request_id: requestId || 'unknown',
      op: op || 'unknown',
      duration_ms: Date.now() - start,
      hcm_version: '1.1'
    };
  }
}
