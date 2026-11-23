import { useMemo } from 'react';
import { shallowEqual } from 'react-redux';
import type {
  AppliedCoupon,
  CartItem,
  Product,
  ShippingMethodId,
  StockWarningsMap,
} from '../types';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  addToCart as addToCartAction,
  applyCoupon as applyCouponAction,
  clearCart as clearCartAction,
  closeCart as closeCartAction,
  openCart as openCartAction,
  removeCoupon as removeCouponAction,
  removeFromCart as removeFromCartAction,
  setCouponInput as setCouponInputAction,
  setOrderNote as setOrderNoteAction,
  setShippingMethod as setShippingMethodAction,
  setStockWarning as setStockWarningAction,
  toggleCart as toggleCartAction,
  updateQuantity as updateQuantityAction,
} from '../store/slices/cartSlice';
import {
  selectCartAppliedCoupon,
  selectCartCount,
  selectCartCouponError,
  selectCartCouponInput,
  selectCartDiscountAmount,
  selectCartFreeShippingRemaining,
  selectCartHasFreeShippingCoupon,
  selectCartHasItems,
  selectCartItemById,
  selectCartItemIds,
  selectCartItems,
  selectCartOrderNote,
  selectCartQualifiesForFreeStandardShipping,
  selectCartShippingCost,
  selectCartShippingMethod,
  selectCartStockWarningById,
  selectCartStockWarnings,
  selectCartSubtotal,
  selectCartTotal,
  selectIsCartOpen,
} from '../store/selectors/cartSelectors';

export interface CartActions {
  addToCart: (product: Product, quantity?: number) => void;
  updateQuantity: (id: number, quantity: number) => void;
  setStockWarning: (id: number, message: string | null) => void;
  removeFromCart: (id: number) => void;
  clearCart: () => void;
  setCouponInput: (value: string) => void;
  applyCoupon: (codeOverride?: string) => void;
  removeCoupon: () => void;
  setShippingMethod: (method: ShippingMethodId) => void;
  setOrderNote: (note: string) => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
}

export interface UseCartReturn extends CartActions {
  items: CartItem[];
  isOpen: boolean;
  cartCount: number;
  subtotal: number;
  stockWarnings: StockWarningsMap;
}

/**
 * Returns stable, memoized Redux cart action dispatchers.
 */
export function useCartActions(): CartActions {
  const dispatch = useAppDispatch();

  return useMemo<CartActions>(
    () => ({
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
      setCouponInput: (value: string) => {
        dispatch(setCouponInputAction(value));
      },
      applyCoupon: (codeOverride?: string) => {
        dispatch(applyCouponAction(codeOverride));
      },
      removeCoupon: () => {
        dispatch(removeCouponAction());
      },
      setShippingMethod: (method: ShippingMethodId) => {
        dispatch(setShippingMethodAction(method));
      },
      setOrderNote: (note: string) => {
        dispatch(setOrderNoteAction(note));
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
    }),
    [dispatch],
  );
}

/**
 * Custom hook encapsulating global shopping cart state and actions (Navbar, MiniCart, PLP, PDP).
 */
export function useCart(): UseCartReturn {
  const actions = useCartActions();
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
    ...actions,
  };
}

/**
 * Granular CartPage hook returning only item presence.
 */
export function useCartHasItems(): boolean {
  return useAppSelector(selectCartHasItems);
}

/**
 * Granular CartPage hook returning only item presence and total unit count.
 */
export function useCartPageMeta(): { totalUnits: number; hasItems: boolean } {
  const totalUnits = useAppSelector(selectCartCount);
  const hasItems = useAppSelector(selectCartHasItems);
  return { totalUnits, hasItems };
}

/**
 * Granular CartPage hook returning memoized item IDs with shallow equality
 * so quantity edits on one item do not re-render the list container.
 */
export function useCartItemIds(): number[] {
  return useAppSelector(selectCartItemIds, shallowEqual);
}

/**
 * Granular CartPage hook subscribing a single CartItemRow only to its own
 * item reference and stock warning.
 */
export function useCartItemState(id: number): {
  item: CartItem | undefined;
  stockWarning: string | null;
} {
  const item = useAppSelector((state) => selectCartItemById(state, id));
  const stockWarning = useAppSelector((state) =>
    selectCartStockWarningById(state, id),
  );
  return { item, stockWarning };
}

/**
 * Granular CartPage hook for promo coupon state.
 */
export function useCartPromoState(): {
  couponInput: string;
  appliedCoupon: AppliedCoupon | null;
  couponError: string | null;
} {
  const couponInput = useAppSelector(selectCartCouponInput);
  const appliedCoupon = useAppSelector(selectCartAppliedCoupon);
  const couponError = useAppSelector(selectCartCouponError);
  return { couponInput, appliedCoupon, couponError };
}

/**
 * Granular CartPage hook for shipping selection state.
 */
export function useCartShippingState(): {
  shippingMethod: ShippingMethodId;
  qualifiesForFreeStandard: boolean;
  hasFreeShippingCoupon: boolean;
} {
  const shippingMethod = useAppSelector(selectCartShippingMethod);
  const qualifiesForFreeStandard = useAppSelector(
    selectCartQualifiesForFreeStandardShipping,
  );
  const hasFreeShippingCoupon = useAppSelector(selectCartHasFreeShippingCoupon);
  return { shippingMethod, qualifiesForFreeStandard, hasFreeShippingCoupon };
}

/**
 * Granular CartPage hook for order note state.
 */
export function useCartOrderNoteState(): string {
  return useAppSelector(selectCartOrderNote);
}

/**
 * Granular CartPage hook for sticky Order Summary pricing breakdown.
 */
export function useCartSummaryState(): {
  totalUnits: number;
  subtotal: number;
  discountAmount: number;
  shippingCost: number;
  freeShippingRemaining: number;
  total: number;
  appliedCoupon: AppliedCoupon | null;
  shippingMethod: ShippingMethodId;
  orderNote: string;
} {
  const totalUnits = useAppSelector(selectCartCount);
  const subtotal = useAppSelector(selectCartSubtotal);
  const discountAmount = useAppSelector(selectCartDiscountAmount);
  const shippingCost = useAppSelector(selectCartShippingCost);
  const freeShippingRemaining = useAppSelector(selectCartFreeShippingRemaining);
  const total = useAppSelector(selectCartTotal);
  const appliedCoupon = useAppSelector(selectCartAppliedCoupon);
  const shippingMethod = useAppSelector(selectCartShippingMethod);
  const orderNote = useAppSelector(selectCartOrderNote);

  return {
    totalUnits,
    subtotal,
    discountAmount,
    shippingCost,
    freeShippingRemaining,
    total,
    appliedCoupon,
    shippingMethod,
    orderNote,
  };
}

export default useCart;
