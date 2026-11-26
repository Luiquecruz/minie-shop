import { Controller, Get, Inject, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import {
  healthStatusSchema,
  readinessStatusSchema,
  type HealthStatus,
  type ReadinessStatus,
} from '@minieshop/contracts';
import { parseOutput } from '../common/parse-response.js';
import { DatabaseService } from '../database/database.service.js';

@Controller()
export class HealthController {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
  ) {}

  @Get('health')
  getHealth(): HealthStatus {
    return parseOutput(healthStatusSchema, {
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  }

  @Get('ready')
  async getReady(@Res() reply: FastifyReply): Promise<void> {
    const isUp = await this.databaseService.checkConnection();
    const payload: ReadinessStatus = parseOutput(readinessStatusSchema, {
      status: isUp ? 'ready' : 'not_ready',
      database: isUp ? 'up' : 'down',
      timestamp: new Date().toISOString(),
    });

    await reply.code(isUp ? 200 : 503).send(payload);
  }
}
