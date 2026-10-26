import { useState, useRef, useEffect } from 'react';
import './Dropdown.css';

/**
 * Componente Dropdown customizado para garantir unidade visual entre sistemas operacionais e navegadores.
 *
 * @param {Object} props
 * @param {Array<{ value: string|number, label: string }>} props.options - Lista de opções
 * @param {string|number} props.value - Valor atualmente selecionado
 * @param {(value: string|number) => void} props.onChange - Callback acionado ao selecionar uma opção
 * @param {string} [props.placeholder='Selecione'] - Placeholder caso nenhum valor esteja selecionado
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Tamanho do dropdown
 * @param {'left'|'right'} [props.align='right'] - Alinhamento do menu flutuante
 * @param {string} [props.className=''] - Classes adicionais
 * @param {string} [props.ariaLabel='Seletor'] - Rótulo de acessibilidade
 */
export function Dropdown({
  options = [],
  value,
  onChange,
  placeholder = 'Selecione',
  size = 'md',
  align = 'right',
  className = '',
  ariaLabel = 'Seletor',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Fecha o menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('pointerdown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [isOpen]);

  // Tecla Escape para fechar
  const handleKeyDown = (event) => {
    if (event.key === 'Escape' && isOpen) {
      setIsOpen(false);
    }
  };

  const handleSelect = (optionValue) => {
    if (onChange) {
      onChange(optionValue);
    }
    setIsOpen(false);
  };

  return (
    <div
      ref={containerRef}
      className={`custom-dropdown custom-dropdown--${size} custom-dropdown--align-${align} ${
        isOpen ? 'custom-dropdown--open' : ''
      } ${className}`.trim()}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        className="custom-dropdown__trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
      >
        <span className="custom-dropdown__label">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg
          className="custom-dropdown__chevron"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div
          className="custom-dropdown__menu"
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                className={`custom-dropdown__option ${
                  isSelected ? 'custom-dropdown__option--selected' : ''
                }`}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(option.value)}
              >
                <span className="custom-dropdown__option-text">
                  {option.label}
                </span>
                {isSelected && (
                  <svg
                    className="custom-dropdown__check-icon"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Dropdown;
