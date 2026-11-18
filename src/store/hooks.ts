import { useDispatch, useSelector } from 'react-redux';
import type { AppDispatch, RootState } from './index';

/**
 * Pre-typed Redux hooks for the Minie Shop store.
 */
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
