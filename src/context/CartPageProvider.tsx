import { useEffect, useReducer, useRef, type ReactNode } from 'react';
import type { CartItem } from '../types';
import { useCart } from '../hooks/useCart';
import {
  areCartItemsEqual,
  CartPageContext,
  cartPageReducer,
  createInitialCartPageState,
  FREE_SHIPPING_THRESHOLD_BRL,
  SHIPPING_OPTIONS,
  type CartPageContextValue,
  type ShippingMethodId,
} from './cartPageState';

export interface CartPageProviderProps {
  children: ReactNode;
}

/**
 * Provides CartPage state via a single React Context + useReducer.
 * Intentionally keeps state and dispatch callbacks in one un-memoized value
 * object for Increment 1 so Context re-render propagation is observable.
 */
export function CartPageProvider({ children }: CartPageProviderProps) {
  const { items: reduxItems, replaceCartItems } = useCart();

  const [state, dispatch] = useReducer(
    cartPageReducer,
    reduxItems,
    createInitialCartPageState,
  );

  const prevReduxItemsRef = useRef<CartItem[]>(reduxItems);
  const prevContextItemsRef = useRef<CartItem[]>(state.items);

  useEffect(() => {
    if (reduxItems !== prevReduxItemsRef.current) {
      prevReduxItemsRef.current = reduxItems;
      if (!areCartItemsEqual(reduxItems, state.items)) {
        dispatch({ type: 'SYNC_ITEMS', payload: reduxItems });
      }
      return;
    }

    if (state.items !== prevContextItemsRef.current) {
      prevContextItemsRef.current = state.items;
      if (!areCartItemsEqual(state.items, reduxItems)) {
        replaceCartItems(state.items);
      }
    }
  }, [reduxItems, state.items, replaceCartItems]);

  const totalUnits = state.items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = state.items.reduce(
    (sum, item) => sum + (item.price?.final_price || 0) * item.quantity,
    0,
  );

  const discountAmount = state.appliedCoupon?.discountPercent
    ? (subtotal * state.appliedCoupon.discountPercent) / 100
    : 0;

  const selectedShippingOption =
    SHIPPING_OPTIONS.find((option) => option.id === state.shippingMethod) ??
    SHIPPING_OPTIONS[0];

  const qualifiesForFreeStandard = subtotal >= FREE_SHIPPING_THRESHOLD_BRL;
  const hasFreeShippingCoupon = Boolean(state.appliedCoupon?.freeShipping);

  const shippingCost =
    state.items.length === 0
      ? 0
      : selectedShippingOption.id === 'pickup'
        ? 0
        : hasFreeShippingCoupon ||
            (selectedShippingOption.id === 'standard' && qualifiesForFreeStandard)
          ? 0
          : selectedShippingOption.basePriceBrl;

  const freeShippingRemaining = Math.max(0, FREE_SHIPPING_THRESHOLD_BRL - subtotal);
  const total = Math.max(0, subtotal - discountAmount) + shippingCost;

  const value: CartPageContextValue = {
    state,
    totalUnits,
    subtotal,
    discountAmount,
    shippingCost,
    freeShippingRemaining,
    total,
    updateQuantity: (id: number, quantity: number) => {
      dispatch({ type: 'UPDATE_QUANTITY', payload: { id, quantity } });
    },
    removeItem: (id: number) => {
      dispatch({ type: 'REMOVE_ITEM', payload: id });
    },
    clearCart: () => {
      dispatch({ type: 'CLEAR_CART' });
    },
    setStockWarning: (id: number, message: string | null) => {
      dispatch({ type: 'SET_STOCK_WARNING', payload: { id, message } });
    },
    setCouponInput: (couponValue: string) => {
      dispatch({ type: 'SET_COUPON_INPUT', payload: couponValue });
    },
    applyCoupon: (codeOverride?: string) => {
      dispatch({ type: 'APPLY_COUPON', payload: codeOverride });
    },
    removeCoupon: () => {
      dispatch({ type: 'REMOVE_COUPON' });
    },
    setShippingMethod: (method: ShippingMethodId) => {
      dispatch({ type: 'SET_SHIPPING_METHOD', payload: method });
    },
    setOrderNote: (note: string) => {
      dispatch({ type: 'SET_ORDER_NOTE', payload: note });
    },
  };

  return (
    <CartPageContext.Provider value={value}>{children}</CartPageContext.Provider>
  );
}

export default CartPageProvider;
