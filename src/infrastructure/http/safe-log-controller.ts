import { LogController, type FastifyReply, type FastifyRequest } from 'fastify';

// Fastify's default 404/error messages can repeat raw URLs and exception text.
export class SafeLogController extends LogController {
  public override defaultErrorLog(
    error: Error,
    request: FastifyRequest,
    reply: FastifyReply,
  ): void {
    if (this.isLogDisabled(request)) {
      return;
    }
    const details = { req: request, res: reply, err: error };
    if (reply.statusCode >= 500) {
      reply.log.error(details, 'HTTP request failed');
    } else {
      reply.log.info(details, 'HTTP request rejected');
    }
  }

  public override routeNotFound(
    request: FastifyRequest,
    reply: FastifyReply,
  ): void {
    if (this.isLogDisabled(request)) {
      return;
    }
    request.log.info({ req: request, res: reply }, 'HTTP route not found');
  }

  public override writeHeadError(
    error: Error,
    request: FastifyRequest,
    reply: FastifyReply,
  ): void {
    if (this.isLogDisabled(request)) {
      return;
    }
    reply.log.warn(
      { req: request, res: reply, err: error },
      'HTTP response headers failed',
    );
  }
}
