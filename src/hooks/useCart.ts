import type { CartItem, Product, StockWarningsMap } from '../types';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  selectCartItems,
  selectIsCartOpen,
  selectCartCount,
  selectCartSubtotal,
  selectCartStockWarnings,
  addToCart as addToCartAction,
  updateQuantity as updateQuantityAction,
  setStockWarning as setStockWarningAction,
  removeFromCart as removeFromCartAction,
  clearCart as clearCartAction,
  openCart as openCartAction,
  closeCart as closeCartAction,
  toggleCart as toggleCartAction,
} from '../store/slices/cartSlice';

export interface UseCartReturn {
  items: CartItem[];
  isOpen: boolean;
  cartCount: number;
  subtotal: number;
  stockWarnings: StockWarningsMap;
  addToCart: (product: Product, quantity?: number) => void;
  updateQuantity: (id: number, quantity: number) => void;
  setStockWarning: (id: number, message: string | null) => void;
  removeFromCart: (id: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
}

/**
 * Custom hook encapsulating shopping cart Redux state and actions.
 */
export function useCart(): UseCartReturn {
  const dispatch = useAppDispatch();

  const items = useAppSelector(selectCartItems);
  const isOpen = useAppSelector(selectIsCartOpen);
  const cartCount = useAppSelector(selectCartCount);
  const subtotal = useAppSelector(selectCartSubtotal);
  const stockWarnings = useAppSelector(selectCartStockWarnings);

  return {
    items,
    isOpen,
    cartCount,
    subtotal,
    stockWarnings,
    addToCart: (product: Product, quantity: number = 1) => {
      dispatch(addToCartAction({ product, quantity }));
    },
    updateQuantity: (id: number, quantity: number) => {
      dispatch(updateQuantityAction({ id, quantity }));
    },
    setStockWarning: (id: number, message: string | null) => {
      dispatch(setStockWarningAction({ id, message }));
    },
    removeFromCart: (id: number) => {
      dispatch(removeFromCartAction(id));
    },
    clearCart: () => {
      dispatch(clearCartAction());
    },
    openCart: () => {
      dispatch(openCartAction());
    },
    closeCart: () => {
      dispatch(closeCartAction());
    },
    toggleCart: () => {
      dispatch(toggleCartAction());
    },
  };
}

export default useCart;
