import { useContext } from 'react';
import type { ProductRepository } from '../domain/repositories/ProductRepository';
import {
  getDefaultProductRepository,
  ProductRepositoryContext,
} from '../context/productRepositoryContext';

export function useProductRepository(): ProductRepository {
  const repository = useContext(ProductRepositoryContext);
  return repository ?? getDefaultProductRepository();
}
