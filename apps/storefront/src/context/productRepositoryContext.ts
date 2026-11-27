import { createContext } from 'react';
import type { ProductRepository } from '../domain/repositories/ProductRepository';

export const ProductRepositoryContext = createContext<ProductRepository | null>(
  null,
);
