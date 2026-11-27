import { memo } from 'react';
import {
  MAX_ORDER_NOTE_LENGTH,
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
    <section
      className="flex flex-col gap-2.5 rounded-2xl border border-border bg-surface p-5 shadow-card-sm"
      aria-labelledby="cart-note-heading"
    >
      <div className="flex items-center justify-between">
        <h2 id="cart-note-heading" className="m-0 text-base font-bold text-fg-heading">
          {t('cart.noteHeading')}
        </h2>
      </div>

      <label htmlFor="cart-order-note" className="text-xs text-fg-muted">
        {t('cart.noteHint')}
      </label>

      <textarea
        id="cart-order-note"
        rows={3}
        maxLength={MAX_ORDER_NOTE_LENGTH}
        value={orderNote}
        onChange={(e) => setOrderNote(e.target.value)}
        placeholder={t('cart.notePlaceholder')}
        className="w-full resize-y rounded-xl border border-border bg-surface-input p-3 text-sm text-fg-heading placeholder:text-fg-muted focus:border-brand focus:outline-none"
      />

      <div className="flex justify-end">
        <span className="text-xs tabular-nums text-fg-muted">
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
