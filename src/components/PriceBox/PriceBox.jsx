import { calculatePrice, formatCurrency } from '../../utils/price.js';
import { useCurrency } from '../../hooks/useCurrency.js';
import './PriceBox.css';

/**
 * Componente PriceBox reutilizável para Cards, PDP e onde mais houver exibição de preço.
 * Integrado ao motor de currency e store global do Redux Toolkit.
 *
 * @param {Object} props
 * @param {Object|number} props.price - Estrutura de preço ({ regular_price, special_price, final_price, discount_percentage })
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Tamanho do bloco de preço
 * @param {string} [props.className=''] - Classes CSS adicionais
 * @param {string} [props.currency] - Moeda opcional para override ('BRL' | 'USD' | 'EUR')
 */
export function PriceBox({ price, size = 'md', className = '', currency }) {
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
            aria-label={`Preço original ${formatCurrency(regular_price, activeCurrency)}`}
          >
            {formatCurrency(regular_price, activeCurrency)}
          </span>
          <span
            className="price-box__discount-badge"
            aria-label={`Desconto de ${discount_percentage}%`}
          >
            -{discount_percentage}%
          </span>
        </div>
      )}

      <span
        className="price-box__final-price"
        aria-label={`Preço atual ${formatCurrency(final_price, activeCurrency)}`}
      >
        {formatCurrency(final_price, activeCurrency)}
      </span>
    </div>
  );
}

export default PriceBox;
