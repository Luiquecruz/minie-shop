import { useMemo, type ReactNode } from 'react';
import type { ProductRepository } from '../domain/repositories/ProductRepository';
import {
  getDefaultProductRepository,
  ProductRepositoryContext,
} from './productRepositoryContext';

export interface ProductRepositoryProviderProps {
  repository?: ProductRepository;
  children: ReactNode;
}

/**
 * Dependency injection boundary for the catalog ProductRepository.
 * Production uses HttpProductRepository; tests inject MockProductRepository.
 */
export function ProductRepositoryProvider({
  repository,
  children,
}: ProductRepositoryProviderProps) {
  const resolvedRepository = useMemo(
    () => repository ?? getDefaultProductRepository(),
    [repository],
  );

  return (
    <ProductRepositoryContext.Provider value={resolvedRepository}>
      {children}
    </ProductRepositoryContext.Provider>
  );
}
