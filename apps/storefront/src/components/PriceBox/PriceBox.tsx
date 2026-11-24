import type { MoneyDTO } from '@minieshop/contracts';
import { useCurrency } from '../../hooks/useCurrency';
import { useI18n } from '../../i18n';
import './PriceBox.css';

export interface PriceBoxProps {
  price: MoneyDTO;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Reusable PriceBox component rendering integer-cents MoneyDTO via `useCurrency().formatPrice`.
 */
export function PriceBox({
  price,
  size = 'md',
  className = '',
}: PriceBoxProps) {
  const { formatPrice } = useCurrency();
  const { t } = useI18n();
  const formatted = formatPrice(price.amount, price.currency);

  return (
    <div className={`price-box price-box--${size} ${className}`.trim()}>
      <span
        className="price-box__final-price"
        aria-label={t('price.currentPriceAria', { price: formatted })}
      >
        {formatted}
      </span>
    </div>
  );
}

export default PriceBox;
