import { createContext } from 'react';
import type { ProductRepository } from '../domain/repositories/ProductRepository';
import { HttpProductRepository } from '../infrastructure/repositories/HttpProductRepository';

export const ProductRepositoryContext = createContext<ProductRepository | null>(
  null,
);

let defaultHttpRepository: HttpProductRepository | null = null;

export function getDefaultProductRepository(): ProductRepository {
  if (!defaultHttpRepository) {
    defaultHttpRepository = new HttpProductRepository();
  }
  return defaultHttpRepository;
}
