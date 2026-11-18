import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type {
  AddToCartPayload,
  CalculatedPrice,
  CartItem,
  StockWarningsMap,
} from '../../types';
import type { RootState } from '../index';

const STORAGE_KEY = 'minieshop_cart';

export interface CartState {
  items: CartItem[];
  isOpen: boolean;
  stockWarnings: StockWarningsMap;
}

const isCalculatedPrice = (value: unknown): value is CalculatedPrice => {
  if (typeof value !== 'object' || value === null) return false;
  return (
    'regular_price' in value &&
    typeof value.regular_price === 'number' &&
    'special_price' in value &&
    (value.special_price === null || typeof value.special_price === 'number') &&
    'final_price' in value &&
    typeof value.final_price === 'number' &&
    'discount_percentage' in value &&
    typeof value.discount_percentage === 'number' &&
    'has_discount' in value &&
    typeof value.has_discount === 'boolean'
  );
};

const isValidCartItem = (item: unknown): item is CartItem => {
  if (typeof item !== 'object' || item === null) return false;
  return (
    'id' in item &&
    typeof item.id === 'number' &&
    'name' in item &&
    typeof item.name === 'string' &&
    'price' in item &&
    isCalculatedPrice(item.price) &&
    'image' in item &&
    typeof item.image === 'string' &&
    'category' in item &&
    typeof item.category === 'string' &&
    'stock' in item &&
    typeof item.stock === 'number' &&
    'quantity' in item &&
    typeof item.quantity === 'number'
  );
};

const getInitialCart = (): CartItem[] => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed.filter(isValidCartItem);
        }
      }
    }
  } catch (error: unknown) {
    console.warn('Failed to read cart from localStorage:', error);
  }
  return [];
};

const persistCart = (items: CartItem[]): void => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
  } catch (error: unknown) {
    console.warn('Failed to persist cart to localStorage:', error);
  }
};

const initialState: CartState = {
  items: getInitialCart(),
  isOpen: false,
  stockWarnings: {},
};

export const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addToCart: (state, action: PayloadAction<AddToCartPayload>) => {
      const payload = action.payload;
      const product = 'product' in payload ? payload.product : payload;
      const addQty =
        'product' in payload && typeof payload.quantity === 'number'
          ? payload.quantity
          : 1;

      if (!product || !product.id) return;

      const maxStock = typeof product.stock === 'number' ? product.stock : 99;
      const existing = state.items.find((item) => item.id === product.id);

      if (existing) {
        const targetQty = existing.quantity + addQty;
        if (targetQty > maxStock) {
          existing.quantity = maxStock;
          state.stockWarnings[product.id] = `Max stock reached (${maxStock} units).`;
        } else {
          existing.quantity = targetQty;
          delete state.stockWarnings[product.id];
        }
      } else {
        const initialQty = Math.min(Math.max(addQty, 1), maxStock);
        state.items.push({
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.image,
          category: product.category,
          stock: maxStock,
          quantity: initialQty,
        });
        if (addQty > maxStock) {
          state.stockWarnings[product.id] = `Only ${maxStock} units available.`;
        }
      }

      state.isOpen = true; // Automatically open mini-cart upon adding item
      persistCart(state.items);
    },

    updateQuantity: (
      state,
      action: PayloadAction<{ id: number; quantity: number }>,
    ) => {
      const { id, quantity } = action.payload;
      const item = state.items.find((i) => i.id === id);

      if (!item) return;

      const maxStock = typeof item.stock === 'number' ? item.stock : 99;

      if (quantity < 1) {
        item.quantity = 1;
        delete state.stockWarnings[id];
      } else if (quantity > maxStock) {
        item.quantity = maxStock;
        state.stockWarnings[id] = `Only ${maxStock} units in stock.`;
      } else {
        item.quantity = quantity;
        delete state.stockWarnings[id];
      }

      persistCart(state.items);
    },

    setStockWarning: (
      state,
      action: PayloadAction<{ id: number; message: string | null }>,
    ) => {
      const { id, message } = action.payload;
      if (message) {
        state.stockWarnings[id] = message;
      } else {
        delete state.stockWarnings[id];
      }
    },

    removeFromCart: (state, action: PayloadAction<number>) => {
      const id = action.payload;
      state.items = state.items.filter((item) => item.id !== id);
      delete state.stockWarnings[id];
      persistCart(state.items);
    },

    clearCart: (state) => {
      state.items = [];
      state.stockWarnings = {};
      persistCart(state.items);
    },

    openCart: (state) => {
      state.isOpen = true;
    },

    closeCart: (state) => {
      state.isOpen = false;
    },

    toggleCart: (state) => {
      state.isOpen = !state.isOpen;
    },
  },
});

export const {
  addToCart,
  updateQuantity,
  setStockWarning,
  removeFromCart,
  clearCart,
  openCart,
  closeCart,
  toggleCart,
} = cartSlice.actions;

export const selectCartItems = (state: RootState): CartItem[] => state.cart.items;
export const selectIsCartOpen = (state: RootState): boolean => state.cart.isOpen;
export const selectCartStockWarnings = (state: RootState): StockWarningsMap =>
  state.cart.stockWarnings;

export const selectCartCount = (state: RootState): number =>
  state.cart.items.reduce((total, item) => total + item.quantity, 0);

export const selectCartSubtotal = (state: RootState): number =>
  state.cart.items.reduce(
    (total, item) => total + (item.price?.final_price || 0) * item.quantity,
    0,
  );

export default cartSlice.reducer;
