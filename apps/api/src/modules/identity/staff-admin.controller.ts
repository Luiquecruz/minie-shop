import { Body, Controller, Get, Inject, Param, Post, Put, Query, Req, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  adminCustomerListQuerySchema,
  adminCustomerListResponseSchema,
  adminMeResponseSchema,
  adminStaffListResponseSchema,
  csrfTokenResponseSchema,
  staffLoginRequestSchema,
  updateStaffRolesRequestSchema,
  updateStaffRolesResponseSchema,
} from '@minieshop/contracts';
import { parseOutput } from '../../common/parse-response.js';
import { loadEnv } from '../../config/env.js';
import { CsrfService } from './csrf.service.js';
import {
  AllowAnyStaff,
  CurrentStaff,
  PublicAdminRoute,
  RequirePermission,
} from './decorators.js';
import { getSessionCookieName, SessionService } from './session.service.js';
import { StaffAdminService } from './staff-admin.service.js';
import type { RequestWithIdentity, StaffPrincipal } from './types.js';

const uuidParamSchema = z.object({ id: z.string().uuid('Invalid staff ID') });

@Controller('admin')
export class StaffAdminController {
  constructor(
    @Inject(StaffAdminService)
    private readonly staffAdminService: StaffAdminService,
    @Inject(SessionService)
    private readonly sessionService: SessionService,
    @Inject(CsrfService)
    private readonly csrfService: CsrfService,
  ) {}

  @Post('auth/login')
  @PublicAdminRoute()
  async login(
    @Body() rawBody: unknown,
    @Req() request: RequestWithIdentity,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const body = staffLoginRequestSchema.parse(rawBody);
    const env = loadEnv();
    const cookieName = getSessionCookieName('staff', env.COOKIE_SECURE);
    const existingRawToken =
      typeof request.cookies?.[cookieName] === 'string' ? request.cookies[cookieName] : undefined;

    const result = await this.staffAdminService.login({
      email: body.email,
      password: body.password,
      ipAddress: request.ip,
      userAgent:
        typeof request.headers['user-agent'] === 'string' ? request.headers['user-agent'] : null,
      existingRawToken,
    });

    this.sessionService.setSessionCookie(reply, 'staff', result.rawToken);
    const payload = parseOutput(adminMeResponseSchema, { staff: result.staff });
    await reply.code(200).send(payload);
  }

  @Post('auth/logout')
  @AllowAnyStaff()
  async logout(@CurrentStaff() staff: StaffPrincipal, @Res() reply: FastifyReply): Promise<void> {
    await this.staffAdminService.logout(staff.sessionId);
    this.sessionService.clearSessionCookie(reply, 'staff');
    await reply.code(204).send();
  }

  @Post('auth/logout-all')
  @AllowAnyStaff()
  async logoutAll(
    @CurrentStaff() staff: StaffPrincipal,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    await this.staffAdminService.logoutAll(staff.staffUserId);
    this.sessionService.clearSessionCookie(reply, 'staff');
    await reply.code(204).send();
  }

  @Get('auth/csrf')
  @AllowAnyStaff()
  async getCsrf(
    @CurrentStaff() staff: StaffPrincipal,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const csrfToken = this.csrfService.generateToken(staff.sessionId);
    const payload = parseOutput(csrfTokenResponseSchema, { csrfToken });
    await reply.code(200).send(payload);
  }

  @Get('me')
  @AllowAnyStaff()
  async getMe(@CurrentStaff() staff: StaffPrincipal, @Res() reply: FastifyReply): Promise<void> {
    const profile = await this.staffAdminService.getMe(staff.staffUserId);
    const payload = parseOutput(adminMeResponseSchema, { staff: profile });
    await reply.code(200).send(payload);
  }

  @Get('customers')
  @RequirePermission('customers:read')
  async listCustomers(
    @Query() rawQuery: Record<string, unknown>,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const query = adminCustomerListQuerySchema.parse(rawQuery);
    const result = await this.staffAdminService.listCustomers(query);
    const payload = parseOutput(adminCustomerListResponseSchema, result);
    await reply.code(200).send(payload);
  }

  @Get('staff')
  @RequirePermission('staff:manage')
  async listStaff(@Res() reply: FastifyReply): Promise<void> {
    const items = await this.staffAdminService.listStaff();
    const payload = parseOutput(adminStaffListResponseSchema, { items });
    await reply.code(200).send(payload);
  }

  @Put('staff/:id/roles')
  @RequirePermission('staff:manage')
  async updateStaffRoles(
    @Param('id') rawId: string,
    @Body() rawBody: unknown,
    @CurrentStaff() staff: StaffPrincipal,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const { id } = uuidParamSchema.parse({ id: rawId });
    const body = updateStaffRolesRequestSchema.parse(rawBody);
    const result = await this.staffAdminService.updateStaffRoles({
      actorStaffId: staff.staffUserId,
      targetStaffId: id,
      roleCodes: body.roles,
    });
    const payload = parseOutput(updateStaffRolesResponseSchema, { staff: result.staff });
    await reply.code(200).send(payload);
  }
}
