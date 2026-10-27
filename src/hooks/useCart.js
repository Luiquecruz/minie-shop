import { useSelector, useDispatch } from 'react-redux';
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
} from '../store/slices/cartSlice.js';

export function useCart() {
  const dispatch = useDispatch();

  const items = useSelector(selectCartItems);
  const isOpen = useSelector(selectIsCartOpen);
  const cartCount = useSelector(selectCartCount);
  const subtotal = useSelector(selectCartSubtotal);
  const stockWarnings = useSelector(selectCartStockWarnings);

  return {
    items,
    isOpen,
    cartCount,
    subtotal,
    stockWarnings,
    addToCart: (product, quantity = 1) =>
      dispatch(addToCartAction({ product, quantity })),
    updateQuantity: (id, quantity) =>
      dispatch(updateQuantityAction({ id, quantity })),
    setStockWarning: (id, message) =>
      dispatch(setStockWarningAction({ id, message })),
    removeFromCart: (id) => dispatch(removeFromCartAction(id)),
    clearCart: () => dispatch(clearCartAction()),
    openCart: () => dispatch(openCartAction()),
    closeCart: () => dispatch(closeCartAction()),
    toggleCart: () => dispatch(toggleCartAction()),
  };
}

export default useCart;
