import { useState, useEffect } from 'react';

/**
 * Custom hook to debounce a value. Useful for delaying API calls or expensive operations
 * until the user has stopped typing or changing a value for a specified amount of time.
 * 
 * @template T - The type of the value being debounced
 * @param value - The value to debounce (e.g., search query, form input)
 * @param delay - The delay in milliseconds to wait before updating the debounced value
 * @returns The debounced value that only updates after the delay period without changes
 * 
 * @example
 * ```tsx
 * const [searchQuery, setSearchQuery] = useState('');
 * const debouncedQuery = useDebounce(searchQuery, 300);
 * 
 * useEffect(() => {
 *   if (debouncedQuery) {
 *     // Perform search API call
 *     searchAPI(debouncedQuery);
 *   }
 * }, [debouncedQuery]);
 * ```
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}