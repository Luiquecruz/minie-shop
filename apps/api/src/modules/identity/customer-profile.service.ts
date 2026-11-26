import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq } from 'drizzle-orm';
import type {
  BrazilUF,
  CreateAddressRequest,
  CustomerAddressDTO,
  CustomerProfileDTO,
  UpdateAddressRequest,
  UpdateMeRequest,
} from '@minieshop/contracts';
import { notFoundError, unauthenticatedError, validationError } from '../../common/errors.js';
import { DatabaseService } from '../../database/database.service.js';
import { customerAddresses, customers } from '../../database/schema/identity.js';
import { toCustomerProfileDto } from './customer-auth.service.js';

export const MAX_ADDRESSES_PER_CUSTOMER = 10;

function toAddressDto(row: typeof customerAddresses.$inferSelect): CustomerAddressDTO {
  return {
    id: row.id,
    label: row.label ?? null,
    recipientName: row.recipientName,
    phone: row.phone ?? null,
    postalCode: row.postalCode,
    street: row.street,
    number: row.number,
    complement: row.complement ?? null,
    neighborhood: row.neighborhood,
    city: row.city,
    state: row.state as BrazilUF,
    country: 'BR',
    isDefault: row.isDefault,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

@Injectable()
export class CustomerProfileService {
  constructor(
    @Inject(DatabaseService)
    private readonly databaseService: DatabaseService,
  ) {}

  async updateProfile(customerId: string, input: UpdateMeRequest): Promise<CustomerProfileDTO> {
    const patch: Partial<typeof customers.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.fullName !== undefined) {
      patch.fullName = input.fullName;
    }
    if (input.phone !== undefined) {
      patch.phone = input.phone;
    }

    const [updated] = await this.databaseService.db
      .update(customers)
      .set(patch)
      .where(eq(customers.id, customerId))
      .returning();

    if (!updated) {
      throw unauthenticatedError();
    }

    return toCustomerProfileDto(updated);
  }

  async listAddresses(customerId: string): Promise<CustomerAddressDTO[]> {
    const rows = await this.databaseService.db
      .select()
      .from(customerAddresses)
      .where(eq(customerAddresses.customerId, customerId))
      .orderBy(desc(customerAddresses.isDefault), asc(customerAddresses.createdAt));

    return rows.map(toAddressDto);
  }

  async getAddress(customerId: string, addressId: string): Promise<CustomerAddressDTO> {
    const [row] = await this.databaseService.db
      .select()
      .from(customerAddresses)
      .where(
        and(eq(customerAddresses.id, addressId), eq(customerAddresses.customerId, customerId)),
      )
      .limit(1);

    if (!row) {
      // Ownership check: return 404 (never 403) so existence is never leaked
      throw notFoundError('Address not found');
    }

    return toAddressDto(row);
  }

  async createAddress(
    customerId: string,
    input: CreateAddressRequest,
  ): Promise<CustomerAddressDTO> {
    return this.databaseService.db.transaction(async (tx) => {
      const [countRow] = await tx
        .select({ total: count() })
        .from(customerAddresses)
        .where(eq(customerAddresses.customerId, customerId));

      const currentCount = countRow?.total ?? 0;
      if (currentCount >= MAX_ADDRESSES_PER_CUSTOMER) {
        throw validationError([
          {
            path: 'addresses',
            message: `Maximum of ${MAX_ADDRESSES_PER_CUSTOMER} addresses per customer reached`,
          },
        ]);
      }

      const shouldBeDefault = input.isDefault === true || currentCount === 0;
      if (shouldBeDefault) {
        await tx
          .update(customerAddresses)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(
            and(
              eq(customerAddresses.customerId, customerId),
              eq(customerAddresses.isDefault, true),
            ),
          );
      }

      const [created] = await tx
        .insert(customerAddresses)
        .values({
          customerId,
          label: input.label ?? null,
          recipientName: input.recipientName,
          phone: input.phone,
          postalCode: input.postalCode,
          street: input.street,
          number: input.number,
          complement: input.complement ?? null,
          neighborhood: input.neighborhood,
          city: input.city,
          state: input.state,
          country: 'BR',
          isDefault: shouldBeDefault,
        })
        .returning();

      if (!created) {
        throw new Error('Failed to create address');
      }

      return toAddressDto(created);
    });
  }

  async updateAddress(
    customerId: string,
    addressId: string,
    input: UpdateAddressRequest,
  ): Promise<CustomerAddressDTO> {
    return this.databaseService.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(customerAddresses)
        .where(
          and(eq(customerAddresses.id, addressId), eq(customerAddresses.customerId, customerId)),
        )
        .limit(1);

      if (!existing) {
        throw notFoundError('Address not found');
      }

      if (input.isDefault === true && !existing.isDefault) {
        await tx
          .update(customerAddresses)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(
            and(
              eq(customerAddresses.customerId, customerId),
              eq(customerAddresses.isDefault, true),
            ),
          );
      }

      const patch: Partial<typeof customerAddresses.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (input.label !== undefined) patch.label = input.label;
      if (input.recipientName !== undefined) patch.recipientName = input.recipientName;
      if (input.phone !== undefined) patch.phone = input.phone;
      if (input.postalCode !== undefined) patch.postalCode = input.postalCode;
      if (input.street !== undefined) patch.street = input.street;
      if (input.number !== undefined) patch.number = input.number;
      if (input.complement !== undefined) patch.complement = input.complement;
      if (input.neighborhood !== undefined) patch.neighborhood = input.neighborhood;
      if (input.city !== undefined) patch.city = input.city;
      if (input.state !== undefined) patch.state = input.state;
      if (input.country !== undefined) patch.country = input.country;
      if (input.isDefault !== undefined) patch.isDefault = input.isDefault;

      const [updated] = await tx
        .update(customerAddresses)
        .set(patch)
        .where(
          and(eq(customerAddresses.id, addressId), eq(customerAddresses.customerId, customerId)),
        )
        .returning();

      if (!updated) {
        throw notFoundError('Address not found');
      }

      return toAddressDto(updated);
    });
  }

  async deleteAddress(customerId: string, addressId: string): Promise<void> {
    await this.databaseService.db.transaction(async (tx) => {
      const [deleted] = await tx
        .delete(customerAddresses)
        .where(
          and(eq(customerAddresses.id, addressId), eq(customerAddresses.customerId, customerId)),
        )
        .returning({ id: customerAddresses.id, isDefault: customerAddresses.isDefault });

      if (!deleted) {
        throw notFoundError('Address not found');
      }

      if (deleted.isDefault) {
        const [nextAddress] = await tx
          .select({ id: customerAddresses.id })
          .from(customerAddresses)
          .where(eq(customerAddresses.customerId, customerId))
          .orderBy(asc(customerAddresses.createdAt))
          .limit(1);

        if (nextAddress) {
          await tx
            .update(customerAddresses)
            .set({ isDefault: true, updatedAt: new Date() })
            .where(eq(customerAddresses.id, nextAddress.id));
        }
      }
    });
  }
}
