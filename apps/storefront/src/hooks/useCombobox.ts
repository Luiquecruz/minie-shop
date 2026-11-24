import { useCallback, useEffect, useId, useRef, useState } from 'react';

export interface UseComboboxOptions {
  itemsCount: number;
  isOpen: boolean;
  canOpenOnArrow?: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectIndex: (index: number) => void;
}

export interface ComboboxInputProps {
  id: string;
  role: 'combobox';
  'aria-expanded': boolean;
  'aria-controls': string;
  'aria-autocomplete': 'list';
  'aria-activedescendant': string | undefined;
  autoComplete: 'off';
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}

export interface ComboboxListboxProps {
  id: string;
  role: 'listbox';
}

export interface ComboboxOptionProps {
  id: string;
  role: 'option';
  'aria-selected': boolean;
  onMouseDown: (event: React.MouseEvent<HTMLLIElement>) => void;
  onMouseEnter: () => void;
  onClick: () => void;
}

/**
 * Proprietary headless combobox hook implementing the WAI-ARIA APG
 * Editable Combobox with List Autocomplete pattern:
 * - DOM focus remains on the input at all times (`aria-activedescendant`).
 * - Supports ArrowDown, ArrowUp, Home, End, Enter, Escape, Tab, and outside click.
 * - Scrolls highlighted options into view (`scrollIntoView({ block: 'nearest' })`).
 */
export function useCombobox({
  itemsCount,
  isOpen,
  canOpenOnArrow = true,
  onOpenChange,
  onSelectIndex,
}: UseComboboxOptions) {
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const listboxId = `${baseId}-listbox`;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const optionNodesRef = useRef<Map<number, HTMLElement>>(new Map());

  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [prevResetSig, setPrevResetSig] = useState<string>(
    `${isOpen ? 'open' : 'closed'}|${itemsCount}`,
  );

  const resetSig = `${isOpen ? 'open' : 'closed'}|${itemsCount}`;
  if (prevResetSig !== resetSig) {
    setPrevResetSig(resetSig);
    if (!isOpen || highlightedIndex >= itemsCount) {
      setHighlightedIndex(-1);
    }
  }

  const getOptionId = useCallback(
    (index: number): string => `${baseId}-option-${index}`,
    [baseId],
  );

  const registerOptionRef = useCallback(
    (index: number) =>
      (node: HTMLElement | null): void => {
        if (node) {
          optionNodesRef.current.set(index, node);
        } else {
          optionNodesRef.current.delete(index);
        }
      },
    [],
  );

  // Close popup on outside pointerdown without trapping focus
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target;
      if (
        containerRef.current &&
        target instanceof Node &&
        !containerRef.current.contains(target)
      ) {
        setHighlightedIndex(-1);
        onOpenChange(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen, onOpenChange]);

  // Keep active descendant scrolled into view inside the listbox
  useEffect(() => {
    if (!isOpen || highlightedIndex < 0) {
      return;
    }
    const activeNode = optionNodesRef.current.get(highlightedIndex);
    if (activeNode && typeof activeNode.scrollIntoView === 'function') {
      activeNode.scrollIntoView({ block: 'nearest' });
    }
  }, [isOpen, highlightedIndex]);

  const handleInputKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>): void => {
      switch (event.key) {
        case 'ArrowDown': {
          if (!isOpen) {
            if (!canOpenOnArrow) return;
            event.preventDefault();
            onOpenChange(true);
            if (itemsCount > 0) {
              setHighlightedIndex(0);
            }
            return;
          }
          if (itemsCount <= 0) return;
          event.preventDefault();
          setHighlightedIndex((prev) => (prev < 0 ? 0 : (prev + 1) % itemsCount));
          return;
        }
        case 'ArrowUp': {
          if (!isOpen) {
            if (!canOpenOnArrow) return;
            event.preventDefault();
            onOpenChange(true);
            if (itemsCount > 0) {
              setHighlightedIndex(itemsCount - 1);
            }
            return;
          }
          if (itemsCount <= 0) return;
          event.preventDefault();
          setHighlightedIndex((prev) =>
            prev <= 0 ? itemsCount - 1 : prev - 1,
          );
          return;
        }
        case 'Home': {
          if (isOpen && itemsCount > 0) {
            event.preventDefault();
            setHighlightedIndex(0);
          }
          return;
        }
        case 'End': {
          if (isOpen && itemsCount > 0) {
            event.preventDefault();
            setHighlightedIndex(itemsCount - 1);
          }
          return;
        }
        case 'Escape': {
          if (isOpen) {
            event.preventDefault();
            event.stopPropagation();
            setHighlightedIndex(-1);
            onOpenChange(false);
          }
          return;
        }
        case 'Enter': {
          if (isOpen && highlightedIndex >= 0 && highlightedIndex < itemsCount) {
            event.preventDefault();
            const chosenIndex = highlightedIndex;
            setHighlightedIndex(-1);
            onOpenChange(false);
            onSelectIndex(chosenIndex);
          }
          return;
        }
        default:
          return;
      }
    },
    [
      isOpen,
      canOpenOnArrow,
      itemsCount,
      highlightedIndex,
      onOpenChange,
      onSelectIndex,
    ],
  );

  const handleContainerBlur = useCallback(
    (event: React.FocusEvent<HTMLDivElement>): void => {
      const nextFocused = event.relatedTarget;
      if (
        containerRef.current &&
        (!(nextFocused instanceof Node) ||
          !containerRef.current.contains(nextFocused))
      ) {
        setHighlightedIndex(-1);
        onOpenChange(false);
      }
    },
    [onOpenChange],
  );

  const activeOptionId =
    isOpen && highlightedIndex >= 0 && highlightedIndex < itemsCount
      ? getOptionId(highlightedIndex)
      : undefined;

  const getInputProps = useCallback(
    (hasPopupOptions: boolean): ComboboxInputProps => ({
      id: inputId,
      role: 'combobox',
      'aria-expanded': isOpen && hasPopupOptions,
      'aria-controls': listboxId,
      'aria-autocomplete': 'list',
      'aria-activedescendant': activeOptionId,
      autoComplete: 'off',
      onKeyDown: handleInputKeyDown,
    }),
    [inputId, isOpen, listboxId, activeOptionId, handleInputKeyDown],
  );

  const getListboxProps = useCallback(
    (): ComboboxListboxProps => ({
      id: listboxId,
      role: 'listbox',
    }),
    [listboxId],
  );

  const getOptionProps = useCallback(
    (index: number): ComboboxOptionProps => ({
      id: getOptionId(index),
      role: 'option',
      'aria-selected': highlightedIndex === index,
      onMouseDown: (event: React.MouseEvent<HTMLLIElement>) => {
        // Keep focus on the combobox input while clicking an option
        event.preventDefault();
      },
      onMouseEnter: () => {
        setHighlightedIndex(index);
      },
      onClick: () => {
        setHighlightedIndex(-1);
        onOpenChange(false);
        onSelectIndex(index);
      },
    }),
    [getOptionId, highlightedIndex, onOpenChange, onSelectIndex],
  );

  return {
    containerRef,
    inputId,
    listboxId,
    highlightedIndex,
    setHighlightedIndex,
    registerOptionRef,
    handleContainerBlur,
    getInputProps,
    getListboxProps,
    getOptionProps,
  };
}
