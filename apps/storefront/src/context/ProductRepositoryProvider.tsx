import type { ReactNode } from 'react';
import type { ProductRepository } from '../domain/repositories/ProductRepository';
import { ProductRepositoryContext } from './productRepositoryContext';

export interface ProductRepositoryProviderProps {
  repository: ProductRepository;
  children: ReactNode;
}

/**
 * Dependency injection boundary for the catalog ProductRepository.
 * The composition root (`main.tsx`) injects `HttpProductRepository`;
 * tests inject `MockProductRepository`.
 */
export function ProductRepositoryProvider({
  repository,
  children,
}: ProductRepositoryProviderProps) {
  return (
    <ProductRepositoryContext.Provider value={repository}>
      {children}
    </ProductRepositoryContext.Provider>
  );
}
