import { configureStore } from '@reduxjs/toolkit';
import currencyReducer from './slices/currencySlice.js';
import cartReducer from './slices/cartSlice.js';

export const store = configureStore({
  reducer: {
    currency: currencyReducer,
    cart: cartReducer,
  },
});

export default store;
