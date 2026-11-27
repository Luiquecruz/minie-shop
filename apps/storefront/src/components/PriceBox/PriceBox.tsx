import type { MoneyDTO } from '@minieshop/contracts';
import { useCurrency } from '../../hooks/useCurrency';
import { useI18n } from '../../i18n';
import { cn } from '../../utils/cn';

export interface PriceBoxProps {
  price: MoneyDTO;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<PriceBoxProps['size']>, string> = {
  sm: 'text-base font-bold',
  md: 'text-lg font-extrabold',
  lg: 'text-3xl font-extrabold tracking-tight',
};

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
    <div className={cn('inline-flex items-baseline gap-1.5', className)}>
      <span
        className={cn('tabular-nums text-fg-heading', SIZE_CLASSES[size])}
        aria-label={t('price.currentPriceAria', { price: formatted })}
      >
        {formatted}
      </span>
    </div>
  );
}

export default PriceBox;
