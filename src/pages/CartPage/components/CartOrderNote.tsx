import { useCartPageContext } from '../../../context/cartPageState';

/**
 * Order/delivery note textarea wired directly to the monolithic CartPageContext.
 * Every keystroke dispatches SET_ORDER_NOTE, demonstrating Context re-render fan-out.
 */
export function CartOrderNote() {
  const { state, setOrderNote } = useCartPageContext();

  return (
    <section className="cart-panel" aria-labelledby="cart-note-heading">
      <div className="cart-panel__header">
        <h2 id="cart-note-heading" className="cart-panel__title">
          Order &amp; Delivery Note
        </h2>
      </div>

      <label htmlFor="cart-order-note" className="cart-note__hint">
        Add gift instructions or delivery preferences. Typing here updates the
        shared CartPageContext and re-renders every subscribed component.
      </label>

      <textarea
        id="cart-order-note"
        rows={3}
        maxLength={200}
        value={state.orderNote}
        onChange={(e) => setOrderNote(e.target.value)}
        placeholder="e.g., Leave package at reception, gift wrap requested..."
        className="cart-note__textarea"
      />

      <div className="cart-note__footer">
        <span className="cart-note__counter">
          {state.orderNote.length}/200 characters
        </span>
      </div>
    </section>
  );
}

export default CartOrderNote;
