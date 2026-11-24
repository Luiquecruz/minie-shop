import { memo } from 'react';
import { MAX_ORDER_NOTE_LENGTH } from '../../../store/slices/cartSlice';
import {
  useCartActions,
  useCartOrderNoteState,
} from '../../../hooks/useCart';
import { useI18n } from '../../../i18n';

/**
 * Memoized order/delivery note textarea subscribed strictly to `cart.orderNote`.
 * Typing here does not re-render line items, promo box, shipping selector, or header.
 */
export const CartOrderNote = memo(function CartOrderNote() {
  const orderNote = useCartOrderNoteState();
  const { setOrderNote } = useCartActions();
  const { t } = useI18n();

  return (
    <section className="cart-panel" aria-labelledby="cart-note-heading">
      <div className="cart-panel__header">
        <h2 id="cart-note-heading" className="cart-panel__title">
          {t('cart.noteHeading')}
        </h2>
      </div>

      <label htmlFor="cart-order-note" className="cart-note__hint">
        {t('cart.noteHint')}
      </label>

      <textarea
        id="cart-order-note"
        rows={3}
        maxLength={MAX_ORDER_NOTE_LENGTH}
        value={orderNote}
        onChange={(e) => setOrderNote(e.target.value)}
        placeholder={t('cart.notePlaceholder')}
        className="cart-note__textarea"
      />

      <div className="cart-note__footer">
        <span className="cart-note__counter">
          {t('cart.noteCounter', {
            length: orderNote.length,
            max: MAX_ORDER_NOTE_LENGTH,
          })}
        </span>
      </div>
    </section>
  );
});

export default CartOrderNote;
