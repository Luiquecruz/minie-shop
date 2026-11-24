import { Body, Controller, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import {
  pricingQuoteRequestSchema,
  pricingQuoteResponseSchema,
  type PricingQuoteResponseDTO,
} from '@minieshop/contracts';
import { parseOutput } from '../../common/parse-response.js';
import { PricingService } from './pricing.service.js';

@Controller('pricing')
export class PricingController {
  constructor(
    @Inject(PricingService)
    private readonly pricingService: PricingService,
  ) {}

  @Post('quote')
  @HttpCode(HttpStatus.OK)
  async quoteCart(@Body() rawBody: unknown): Promise<PricingQuoteResponseDTO> {
    const request = pricingQuoteRequestSchema.parse(rawBody ?? {});
    const result = await this.pricingService.quoteCart(request);
    return parseOutput(pricingQuoteResponseSchema, result);
  }
}
