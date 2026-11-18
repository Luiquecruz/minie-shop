import type { CalculatedPrice, CurrencyCode, RawPriceInput } from '../../types';
import { calculatePrice, formatCurrency } from '../../utils/price';
import { useCurrency } from '../../hooks/useCurrency';
import './PriceBox.css';

export interface PriceBoxProps {
  price: CalculatedPrice | RawPriceInput | number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  currency?: CurrencyCode;
}

/**
 * Reusable PriceBox component for Cards, PDP, and any price display.
 * Integrated with the multi-currency engine and Redux Toolkit global store.
 */
export function PriceBox({
  price,
  size = 'md',
  className = '',
  currency,
}: PriceBoxProps) {
  const { currentCurrency } = useCurrency();
  const activeCurrency = currency || currentCurrency;

  const resolved = calculatePrice(price);
  const { regular_price, final_price, discount_percentage, has_discount } =
    resolved;

  return (
    <div className={`price-box price-box--${size} ${className}`.trim()}>
      {has_discount && (
        <div className="price-box__discount-row">
          <span
            className="price-box__regular-price"
            aria-label={`Original price ${formatCurrency(regular_price, activeCurrency)}`}
          >
            {formatCurrency(regular_price, activeCurrency)}
          </span>
          <span
            className="price-box__discount-badge"
            aria-label={`${discount_percentage}% discount`}
          >
            -{discount_percentage}%
          </span>
        </div>
      )}

      <span
        className="price-box__final-price"
        aria-label={`Current price ${formatCurrency(final_price, activeCurrency)}`}
      >
        {formatCurrency(final_price, activeCurrency)}
      </span>
    </div>
  );
}

export default PriceBox;
