import 'reflect-metadata';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { staffRoleCodeSchema, type StaffRoleCode } from '@minieshop/contracts';
import { DatabaseService } from '../database/database.service.js';
import {
  InMemoryRateLimiter,
  PasswordService,
  RbacSeedService,
  SessionService,
  StaffAdminService,
} from '../modules/identity/index.js';

function parseArgs(argv: string[]): { email: string; roles: StaffRoleCode[]; fullName: string } {
  let email = '';
  let fullName = '';
  const rawRoles: string[] = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--password' || arg?.startsWith('--password=')) {
      throw new Error(
        'Passing --password on the command line is forbidden (leaks to shell history). Use STAFF_PASSWORD env or interactive prompt.',
      );
    }
    if (arg === '--email' && argv[i + 1]) {
      email = argv[++i]!;
    } else if (arg?.startsWith('--email=')) {
      email = arg.slice('--email='.length);
    } else if (arg === '--role' && argv[i + 1]) {
      rawRoles.push(...argv[++i]!.split(','));
    } else if (arg?.startsWith('--role=')) {
      rawRoles.push(...arg.slice('--role='.length).split(','));
    } else if (arg === '--name' && argv[i + 1]) {
      fullName = argv[++i]!;
    } else if (arg?.startsWith('--name=')) {
      fullName = arg.slice('--name='.length);
    }
  }

  if (!email) {
    throw new Error('Usage: pnpm staff:create --email <email> --role <admin|catalog_manager|support> [--name <fullName>]');
  }
  if (rawRoles.length === 0) {
    throw new Error('At least one --role is required (admin, catalog_manager, support)');
  }

  const parsedRoles = rawRoles
    .map((r) => r.trim())
    .filter((r) => r.length > 0)
    .map((r) => staffRoleCodeSchema.parse(r));

  return {
    email,
    roles: parsedRoles,
    fullName: fullName || email.split('@')[0] || 'Staff User',
  };
}

async function resolvePassword(): Promise<string> {
  if (process.env.STAFF_PASSWORD && process.env.STAFF_PASSWORD.length > 0) {
    return process.env.STAFF_PASSWORD;
  }

  if (!stdin.isTTY) {
    throw new Error('No TTY detected. Provide password via STAFF_PASSWORD environment variable.');
  }

  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question('Staff password (min 12 chars): ');
    return answer;
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const { email, roles, fullName } = parseArgs(process.argv.slice(2));
  const password = await resolvePassword();

  const dbService = new DatabaseService();
  const passwordService = new PasswordService();
  const rbacSeedService = new RbacSeedService(dbService, passwordService);
  const sessionService = new SessionService(dbService);
  const rateLimiter = new InMemoryRateLimiter();
  const staffAdminService = new StaffAdminService(
    dbService,
    passwordService,
    sessionService,
    rateLimiter,
  );

  try {
    await rbacSeedService.seedRolesAndPermissions();
    const created = await staffAdminService.createStaffUser({
      email,
      password,
      fullName,
      roleCodes: roles,
    });
    console.log(
      JSON.stringify({
        created: true,
        id: created.id,
        email: created.email,
        fullName: created.fullName,
        roles: created.roles,
      }),
    );
  } finally {
    await dbService.onModuleDestroy();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[staff:create] Failed: ${message}`);
  process.exit(1);
});
