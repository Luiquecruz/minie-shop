import { Body, Controller, Get, Inject, Post, Req, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import {
  authCustomerResponseSchema,
  changePasswordRequestSchema,
  changePasswordResponseSchema,
  csrfTokenResponseSchema,
  forgotPasswordRequestSchema,
  genericAcceptedResponseSchema,
  loginRequestSchema,
  registerRequestSchema,
  resendVerificationRequestSchema,
  resetPasswordRequestSchema,
  resetPasswordResponseSchema,
  verifyEmailRequestSchema,
  verifyEmailResponseSchema,
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

  @Post('auth/verify-email')
  async verifyEmail(@Body() rawBody: unknown, @Res() reply: FastifyReply): Promise<void> {
    const body = verifyEmailRequestSchema.parse(rawBody);
    const result = await this.customerAuthService.verifyEmail(body.token);
    const payload = parseOutput(verifyEmailResponseSchema, result);
    await reply.code(200).send(payload);
  }

  @Post('auth/resend-verification')
  async resendVerification(
    @Body() rawBody: unknown,
    @Req() request: RequestWithIdentity,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const body = resendVerificationRequestSchema.parse(rawBody);
    const result = await this.customerAuthService.resendVerification({
      email: body.email,
      ipAddress: request.ip,
    });
    const payload = parseOutput(genericAcceptedResponseSchema, result);
    await reply.code(202).send(payload);
  }

  @Post('auth/forgot-password')
  async forgotPassword(
    @Body() rawBody: unknown,
    @Req() request: RequestWithIdentity,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const body = forgotPasswordRequestSchema.parse(rawBody);
    const result = await this.customerAuthService.forgotPassword({
      email: body.email,
      ipAddress: request.ip,
    });
    const payload = parseOutput(genericAcceptedResponseSchema, result);
    await reply.code(202).send(payload);
  }

  @Post('auth/reset-password')
  async resetPassword(@Body() rawBody: unknown, @Res() reply: FastifyReply): Promise<void> {
    const body = resetPasswordRequestSchema.parse(rawBody);
    const result = await this.customerAuthService.resetPassword({
      token: body.token,
      newPassword: body.newPassword,
    });
    const payload = parseOutput(resetPasswordResponseSchema, result);
    await reply.code(200).send(payload);
  }

  @Post('auth/change-password')
  @RequireCustomer()
  async changePassword(
    @CurrentCustomer() customer: CustomerPrincipal,
    @Body() rawBody: unknown,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const body = changePasswordRequestSchema.parse(rawBody);
    const result = await this.customerAuthService.changePassword({
      customerId: customer.customerId,
      currentSessionId: customer.sessionId,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });
    const payload = parseOutput(changePasswordResponseSchema, result);
    await reply.code(200).send(payload);
  }
}
