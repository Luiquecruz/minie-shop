import { useState, useRef, useEffect } from 'react';
import './Dropdown.css';

export interface DropdownOption<T extends string | number = string> {
  value: T;
  label: string;
}

export interface DropdownProps<T extends string | number = string> {
  options?: DropdownOption<T>[];
  value: T;
  onChange?: (value: T) => void;
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
  align?: 'left' | 'right';
  className?: string;
  ariaLabel?: string;
}

/**
 * Custom Dropdown component providing visual unity across operating systems and browsers.
 */
export function Dropdown<T extends string | number = string>({
  options = [],
  value,
  onChange,
  placeholder = 'Select',
  size = 'md',
  align = 'right',
  className = '',
  ariaLabel = 'Selector',
}: DropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close the menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: PointerEvent): void => {
      if (
        containerRef.current &&
        event.target instanceof Node &&
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
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape' && isOpen) {
      setIsOpen(false);
    }
  };

  const handleSelect = (optionValue: T): void => {
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
