import { Body, Controller, Get, Inject, Post, Req, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import {
  authCustomerResponseSchema,
  csrfTokenResponseSchema,
  genericAcceptedResponseSchema,
  loginRequestSchema,
  registerRequestSchema,
} from '@minieshop/contracts';
import { parseOutput } from '../../common/parse-response.js';
import { loadEnv } from '../../config/env.js';
import { CsrfService } from './csrf.service.js';
import { CustomerAuthService } from './customer-auth.service.js';
import { CurrentCustomer, RequireCustomer } from './decorators.js';
import { getSessionCookieName, SessionService } from './session.service.js';
import type { CustomerPrincipal, RequestWithIdentity } from './types.js';

@Controller()
export class CustomerAuthController {
  constructor(
    @Inject(CustomerAuthService)
    private readonly customerAuthService: CustomerAuthService,
    @Inject(SessionService)
    private readonly sessionService: SessionService,
    @Inject(CsrfService)
    private readonly csrfService: CsrfService,
  ) {}

  @Post('auth/register')
  async register(
    @Body() rawBody: unknown,
    @Req() request: RequestWithIdentity,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const body = registerRequestSchema.parse(rawBody);
    const result = await this.customerAuthService.register({
      email: body.email,
      password: body.password,
      fullName: body.fullName,
      ipAddress: request.ip,
    });
    const payload = parseOutput(genericAcceptedResponseSchema, result);
    await reply.code(202).send(payload);
  }

  @Post('auth/login')
  async login(
    @Body() rawBody: unknown,
    @Req() request: RequestWithIdentity,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const body = loginRequestSchema.parse(rawBody);
    const env = loadEnv();
    const cookieName = getSessionCookieName('customer', env.COOKIE_SECURE);
    const existingRawToken =
      typeof request.cookies?.[cookieName] === 'string' ? request.cookies[cookieName] : undefined;

    const result = await this.customerAuthService.login({
      email: body.email,
      password: body.password,
      ipAddress: request.ip,
      userAgent: typeof request.headers['user-agent'] === 'string' ? request.headers['user-agent'] : null,
      existingRawToken,
    });

    this.sessionService.setSessionCookie(reply, 'customer', result.rawToken);
    const payload = parseOutput(authCustomerResponseSchema, { customer: result.customer });
    await reply.code(200).send(payload);
  }

  @Post('auth/logout')
  @RequireCustomer()
  async logout(
    @CurrentCustomer() customer: CustomerPrincipal,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    await this.customerAuthService.logout(customer.sessionId);
    this.sessionService.clearSessionCookie(reply, 'customer');
    await reply.code(204).send();
  }

  @Post('auth/logout-all')
  @RequireCustomer()
  async logoutAll(
    @CurrentCustomer() customer: CustomerPrincipal,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    await this.customerAuthService.logoutAll(customer.customerId);
    this.sessionService.clearSessionCookie(reply, 'customer');
    await reply.code(204).send();
  }

  @Get('auth/csrf')
  @RequireCustomer()
  async getCsrf(
    @CurrentCustomer() customer: CustomerPrincipal,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const csrfToken = this.csrfService.generateToken(customer.sessionId);
    const payload = parseOutput(csrfTokenResponseSchema, { csrfToken });
    await reply.code(200).send(payload);
  }

  @Get('me')
  @RequireCustomer()
  async getMe(
    @CurrentCustomer() customer: CustomerPrincipal,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const profile = await this.customerAuthService.getMe(customer.customerId);
    const payload = parseOutput(authCustomerResponseSchema, { customer: profile });
    await reply.code(200).send(payload);
  }
}
