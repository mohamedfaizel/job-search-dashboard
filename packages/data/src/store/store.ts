import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import { jobsTableSlice } from './jobsTableSlice';

export function makeStore() {
  return configureStore({
    reducer: { [jobsTableSlice.name]: jobsTableSlice.reducer },
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];

// Typed versions of the react-redux hooks, so components get autocompletion on state.
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
