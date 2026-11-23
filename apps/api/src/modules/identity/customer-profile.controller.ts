import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';
import {
  addressListResponseSchema,
  addressResponseSchema,
  authCustomerResponseSchema,
  createAddressRequestSchema,
  updateAddressRequestSchema,
  updateMeRequestSchema,
} from '@minieshop/contracts';
import { parseOutput } from '../../common/parse-response.js';
import { CustomerProfileService } from './customer-profile.service.js';
import { CurrentCustomer, RequireCustomer } from './decorators.js';
import type { CustomerPrincipal } from './types.js';

const addressIdParamSchema = z.object({ id: z.string().uuid('Invalid address ID') });

@Controller('me')
@RequireCustomer()
export class CustomerProfileController {
  constructor(
    @Inject(CustomerProfileService)
    private readonly profileService: CustomerProfileService,
  ) {}

  @Patch()
  async updateMe(
    @CurrentCustomer() customer: CustomerPrincipal,
    @Body() rawBody: unknown,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const body = updateMeRequestSchema.parse(rawBody);
    const updated = await this.profileService.updateProfile(customer.customerId, body);
    const payload = parseOutput(authCustomerResponseSchema, { customer: updated });
    await reply.code(200).send(payload);
  }

  @Get('addresses')
  async listAddresses(
    @CurrentCustomer() customer: CustomerPrincipal,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const items = await this.profileService.listAddresses(customer.customerId);
    const payload = parseOutput(addressListResponseSchema, { items });
    await reply.code(200).send(payload);
  }

  @Get('addresses/:id')
  async getAddress(
    @CurrentCustomer() customer: CustomerPrincipal,
    @Param('id') rawId: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const { id } = addressIdParamSchema.parse({ id: rawId });
    const address = await this.profileService.getAddress(customer.customerId, id);
    const payload = parseOutput(addressResponseSchema, { address });
    await reply.code(200).send(payload);
  }

  @Post('addresses')
  async createAddress(
    @CurrentCustomer() customer: CustomerPrincipal,
    @Body() rawBody: unknown,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const body = createAddressRequestSchema.parse(rawBody);
    const address = await this.profileService.createAddress(customer.customerId, body);
    const payload = parseOutput(addressResponseSchema, { address });
    await reply.code(201).send(payload);
  }

  @Patch('addresses/:id')
  async updateAddress(
    @CurrentCustomer() customer: CustomerPrincipal,
    @Param('id') rawId: string,
    @Body() rawBody: unknown,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const { id } = addressIdParamSchema.parse({ id: rawId });
    const body = updateAddressRequestSchema.parse(rawBody);
    const address = await this.profileService.updateAddress(customer.customerId, id, body);
    const payload = parseOutput(addressResponseSchema, { address });
    await reply.code(200).send(payload);
  }

  @Delete('addresses/:id')
  async deleteAddress(
    @CurrentCustomer() customer: CustomerPrincipal,
    @Param('id') rawId: string,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const { id } = addressIdParamSchema.parse({ id: rawId });
    await this.profileService.deleteAddress(customer.customerId, id);
    await reply.code(204).send();
  }
}
