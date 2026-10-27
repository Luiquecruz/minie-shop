import { createSlice } from '@reduxjs/toolkit';

const STORAGE_KEY = 'minieshop_cart';

const getInitialCart = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    }
  } catch (error) {
    console.warn('Failed to read cart from localStorage:', error);
  }
  return [];
};

const persistCart = (items) => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    }
  } catch (error) {
    console.warn('Failed to persist cart to localStorage:', error);
  }
};

const initialState = {
  items: getInitialCart(),
  isOpen: false,
  stockWarnings: {}, // map of { [productId]: warningMessage }
};

export const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addToCart: (state, action) => {
      const payload = action.payload;
      const product = payload.product || payload;
      const addQty = typeof payload.quantity === 'number' ? payload.quantity : 1;

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

    updateQuantity: (state, action) => {
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

    setStockWarning: (state, action) => {
      const { id, message } = action.payload;
      if (message) {
        state.stockWarnings[id] = message;
      } else {
        delete state.stockWarnings[id];
      }
    },

    removeFromCart: (state, action) => {
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

export const selectCartItems = (state) => state.cart.items;
export const selectIsCartOpen = (state) => state.cart.isOpen;
export const selectCartStockWarnings = (state) => state.cart.stockWarnings;

export const selectCartCount = (state) =>
  state.cart.items.reduce((total, item) => total + item.quantity, 0);

export const selectCartSubtotal = (state) =>
  state.cart.items.reduce(
    (total, item) => total + (item.price?.final_price || 0) * item.quantity,
    0,
  );

export default cartSlice.reducer;
