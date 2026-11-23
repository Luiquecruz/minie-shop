import type { MoneyDTO } from '@minieshop/contracts';
import { formatMoney } from '../../utils/money';
import './PriceBox.css';

export interface PriceBoxProps {
  price: MoneyDTO;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Reusable PriceBox component rendering integer-cents MoneyDTO via `formatMoney`.
 */
export function PriceBox({
  price,
  size = 'md',
  className = '',
}: PriceBoxProps) {
  const formatted = formatMoney(price);

  return (
    <div className={`price-box price-box--${size} ${className}`.trim()}>
      <span
        className="price-box__final-price"
        aria-label={`Current price ${formatted}`}
      >
        {formatted}
      </span>
    </div>
  );
}

export default PriceBox;
