import { useCallback, useEffect, useId, useRef, useState } from 'react';
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
 * Accessible custom Dropdown (WAI-ARIA APG listbox button pattern) supporting
 * ArrowDown/ArrowUp, Home/End, Enter/Space selection, Escape dismissal, and
 * trigger focus restoration.
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
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const selectedIndex = options.findIndex((opt) => opt.value === value);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;
  const isMenuOpen = isOpen && options.length > 0;
  const effectiveFocusedIndex =
    !isMenuOpen
      ? -1
      : Math.min(Math.max(focusedIndex, 0), options.length - 1);

  const focusOptionAt = useCallback((index: number): void => {
    setFocusedIndex(index);
    optionRefs.current[index]?.focus();
  }, []);

  const openMenuAt = useCallback(
    (targetIndex: number): void => {
      if (options.length === 0) return;
      const clamped = Math.max(0, Math.min(options.length - 1, targetIndex));
      setFocusedIndex(clamped);
      setIsOpen(true);
    },
    [options.length],
  );

  const closeMenu = useCallback((restoreFocus: boolean): void => {
    setIsOpen(false);
    setFocusedIndex(-1);
    if (restoreFocus) {
      triggerRef.current?.focus();
    }
  }, []);

  // Reconcile DOM focus when the menu opens or when the options list changes dynamically.
  useEffect(() => {
    optionRefs.current.length = options.length;
    if (!isOpen) return;
    if (options.length === 0) {
      triggerRef.current?.focus();
      return;
    }
    if (effectiveFocusedIndex >= 0) {
      optionRefs.current[effectiveFocusedIndex]?.focus();
    }
  }, [isOpen, effectiveFocusedIndex, options.length]);

  // Close the menu when clicking outside.
  useEffect(() => {
    const handleClickOutside = (event: PointerEvent): void => {
      if (
        containerRef.current &&
        event.target instanceof Node &&
        !containerRef.current.contains(event.target)
      ) {
        closeMenu(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('pointerdown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [isMenuOpen, closeMenu]);

  const handleSelect = (optionValue: T): void => {
    onChange?.(optionValue);
    closeMenu(true);
  };

  const handleTriggerKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
  ): void => {
    if (options.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      openMenuAt(selectedIndex >= 0 ? selectedIndex : 0);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      openMenuAt(selectedIndex >= 0 ? selectedIndex : options.length - 1);
    } else if (event.key === 'Home' && isMenuOpen) {
      event.preventDefault();
      focusOptionAt(0);
    } else if (event.key === 'End' && isMenuOpen) {
      event.preventDefault();
      focusOptionAt(options.length - 1);
    } else if (event.key === 'Escape' && isMenuOpen) {
      event.preventDefault();
      closeMenu(true);
    }
  };

  const handleOptionKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ): void => {
    if (options.length === 0) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusOptionAt((index + 1) % options.length);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusOptionAt((index - 1 + options.length) % options.length);
        break;
      case 'Home':
        event.preventDefault();
        focusOptionAt(0);
        break;
      case 'End':
        event.preventDefault();
        focusOptionAt(options.length - 1);
        break;
      case 'Escape':
        event.preventDefault();
        closeMenu(true);
        break;
      case 'Tab':
        closeMenu(false);
        break;
      default:
        break;
    }
  };

  const handleTriggerClick = (): void => {
    if (isMenuOpen) {
      closeMenu(false);
    } else {
      openMenuAt(selectedIndex >= 0 ? selectedIndex : 0);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`custom-dropdown custom-dropdown--${size} custom-dropdown--align-${align} ${
        isMenuOpen ? 'custom-dropdown--open' : ''
      } ${className}`.trim()}
    >
      <button
        ref={triggerRef}
        type="button"
        className="custom-dropdown__trigger"
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isMenuOpen}
        aria-controls={isMenuOpen ? listboxId : undefined}
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

      {isMenuOpen && (
        <div
          id={listboxId}
          className="custom-dropdown__menu"
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                ref={(el) => {
                  optionRefs.current[index] = el;
                }}
                type="button"
                className={`custom-dropdown__option ${
                  isSelected ? 'custom-dropdown__option--selected' : ''
                }`}
                role="option"
                aria-selected={isSelected}
                tabIndex={effectiveFocusedIndex === index ? 0 : -1}
                onClick={() => handleSelect(option.value)}
                onKeyDown={(event) => handleOptionKeyDown(event, index)}
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
