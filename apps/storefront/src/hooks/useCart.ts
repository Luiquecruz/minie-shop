import { useMemo } from 'react';
import { shallowEqual } from 'react-redux';
import type {
  AppliedCoupon,
  CartItem,
  CartProductInput,
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
  addToCart: (product: CartProductInput, quantity?: number) => void;
  updateQuantity: (id: string, quantity: number) => void;
  setStockWarning: (id: string, message: string | null) => void;
  removeFromCart: (id: string) => void;
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
      addToCart: (product: CartProductInput, quantity: number = 1) => {
        dispatch(addToCartAction({ product, quantity }));
      },
      updateQuantity: (id: string, quantity: number) => {
        dispatch(updateQuantityAction({ id, quantity }));
      },
      setStockWarning: (id: string, message: string | null) => {
        dispatch(setStockWarningAction({ id, message }));
      },
      removeFromCart: (id: string) => {
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

export function useCartHasItems(): boolean {
  return useAppSelector(selectCartHasItems);
}

export function useCartPageMeta(): { totalUnits: number; hasItems: boolean } {
  const totalUnits = useAppSelector(selectCartCount);
  const hasItems = useAppSelector(selectCartHasItems);
  return { totalUnits, hasItems };
}

export function useCartItemIds(): string[] {
  return useAppSelector(selectCartItemIds, shallowEqual);
}

export function useCartItemState(id: string): {
  item: CartItem | undefined;
  stockWarning: string | null;
} {
  const item = useAppSelector((state) => selectCartItemById(state, id));
  const stockWarning = useAppSelector((state) =>
    selectCartStockWarningById(state, id),
  );
  return { item, stockWarning };
}

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

export function useCartOrderNoteState(): string {
  return useAppSelector(selectCartOrderNote);
}

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
