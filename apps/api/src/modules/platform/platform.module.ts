import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service.js';
import { OutboxService } from './outbox.service.js';

@Global()
@Module({
  providers: [OutboxService, AuditService],
  exports: [OutboxService, AuditService],
})
export class PlatformModule {}
