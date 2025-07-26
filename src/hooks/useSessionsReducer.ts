import { useReducer } from 'react';
import { Session } from '../types/Session';

/**
 * State interface for the sessions reducer
 */
interface SessionsState {
  /** Array of all sessions */
  sessions: Session[];
  /** Currently selected session for viewing details */
  selectedSession: Session | null;
  /** Current search query string */
  searchQuery: string;
  /** Whether the user is currently editing notes */
  isEditing: boolean;
  /** The note being edited */
  editNote: string;
  /** New tag being added */
  newTag: string;
  /** Whether a session export is in progress */
  isExporting: boolean;
  /** Error message from export operation */
  exportError: string | null;
}

/**
 * Action types for the sessions reducer
 */
type SessionsAction =
  | { type: 'SET_SESSIONS'; payload: Session[] }
  | { type: 'SET_SELECTED_SESSION'; payload: Session | null }
  | { type: 'SET_SEARCH_QUERY'; payload: string }
  | { type: 'SET_IS_EDITING'; payload: boolean }
  | { type: 'SET_EDIT_NOTE'; payload: string }
  | { type: 'SET_NEW_TAG'; payload: string }
  | { type: 'SET_IS_EXPORTING'; payload: boolean }
  | { type: 'SET_EXPORT_ERROR'; payload: string | null }
  | { type: 'CLEAR_NEW_TAG' }
  | { type: 'CLEAR_EXPORT_ERROR' };


/**
 * Initial state for the sessions reducer
 */
const initialState: SessionsState = {
  sessions: [],
  selectedSession: null,
  searchQuery: '',
  isEditing: false,
  editNote: '',
  newTag: '',
  isExporting: false,
  exportError: null,
};

/**
 * Reducer function for managing sessions state
 * @param state - Current state
 * @param action - Action to perform
 * @returns New state
 */
function sessionsReducer(state: SessionsState, action: SessionsAction): SessionsState {
  switch (action.type) {
    case 'SET_SESSIONS':
      return { ...state, sessions: action.payload };
    case 'SET_SELECTED_SESSION':
      return { 
        ...state, 
        selectedSession: action.payload,
        isEditing: false,
        editNote: '',
        exportError: null
      };
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };
    case 'SET_IS_EDITING':
      return { ...state, isEditing: action.payload };
    case 'SET_EDIT_NOTE':
      return { ...state, editNote: action.payload };
    case 'SET_NEW_TAG':
      return { ...state, newTag: action.payload };
    case 'SET_IS_EXPORTING':
      return { ...state, isExporting: action.payload };
    case 'SET_EXPORT_ERROR':
      return { ...state, exportError: action.payload };
    case 'CLEAR_NEW_TAG':
      return { ...state, newTag: '' };
    case 'CLEAR_EXPORT_ERROR':
      return { ...state, exportError: null };
    default:
      return state;
  }
}

/**
 * Custom hook that provides a reducer for managing sessions state.
 * This helps manage complex state logic for the SessionsView component,
 * providing better organization than multiple useState hooks.
 * 
 * @returns A tuple containing the current state and dispatch function
 * 
 * @example
 * ```tsx
 * const [state, dispatch] = useSessionsReducer();
 * const { sessions, selectedSession, isEditing } = state;
 * 
 * // Set sessions
 * dispatch({ type: 'SET_SESSIONS', payload: newSessions });
 * 
 * // Select a session
 * dispatch({ type: 'SET_SELECTED_SESSION', payload: session });
 * ```
 */
export function useSessionsReducer() {
  return useReducer(sessionsReducer, initialState);
}