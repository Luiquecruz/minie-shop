import { useState, useRef, useEffect } from 'react';
import './Dropdown.css';

/**
 * Custom Dropdown component providing visual unity across operating systems and browsers.
 *
 * @param {Object} props
 * @param {Array<{ value: string|number, label: string }>} props.options - List of options
 * @param {string|number} props.value - Currently selected value
 * @param {(value: string|number) => void} props.onChange - Callback triggered on option select
 * @param {string} [props.placeholder='Select'] - Placeholder if no value is selected
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Dropdown size variant
 * @param {'left'|'right'} [props.align='right'] - Alignment of the floating menu
 * @param {string} [props.className=''] - Additional CSS classes
 * @param {string} [props.ariaLabel='Selector'] - Accessibility label
 */
export function Dropdown({
  options = [],
  value,
  onChange,
  placeholder = 'Select',
  size = 'md',
  align = 'right',
  className = '',
  ariaLabel = 'Selector',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close the menu when clicking outside
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

  // Close on Escape key press
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
