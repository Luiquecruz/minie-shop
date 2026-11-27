import { useContext } from 'react';
import type { ProductRepository } from '../domain/repositories/ProductRepository';
import { ProductRepositoryContext } from '../context/productRepositoryContext';

export function useProductRepository(): ProductRepository {
  const repository = useContext(ProductRepositoryContext);
  if (!repository) {
    throw new Error(
      'useProductRepository must be used within a ProductRepositoryProvider',
    );
  }
  return repository;
}
