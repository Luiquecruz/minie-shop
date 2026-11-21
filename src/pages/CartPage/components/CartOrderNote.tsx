import { memo } from 'react';
import { MAX_ORDER_NOTE_LENGTH } from '../../../store/slices/cartSlice';
import {
  useCartActions,
  useCartOrderNoteState,
} from '../../../hooks/useCart';

/**
 * Memoized order/delivery note textarea subscribed strictly to `cart.orderNote`.
 * Typing here does not re-render line items, promo box, shipping selector, or header.
 */
export const CartOrderNote = memo(function CartOrderNote() {
  const orderNote = useCartOrderNoteState();
  const { setOrderNote } = useCartActions();

  return (
    <section className="cart-panel" aria-labelledby="cart-note-heading">
      <div className="cart-panel__header">
        <h2 id="cart-note-heading" className="cart-panel__title">
          Order &amp; Delivery Note
        </h2>
      </div>

      <label htmlFor="cart-order-note" className="cart-note__hint">
        Add gift instructions or delivery preferences.
      </label>

      <textarea
        id="cart-order-note"
        rows={3}
        maxLength={MAX_ORDER_NOTE_LENGTH}
        value={orderNote}
        onChange={(e) => setOrderNote(e.target.value)}
        placeholder="e.g., Leave package at reception, gift wrap requested..."
        className="cart-note__textarea"
      />

      <div className="cart-note__footer">
        <span className="cart-note__counter">
          {orderNote.length}/{MAX_ORDER_NOTE_LENGTH} characters
        </span>
      </div>
    </section>
  );
});

export default CartOrderNote;
