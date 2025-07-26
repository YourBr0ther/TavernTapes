import React, { useEffect, useMemo, useCallback } from 'react';
import sessionService from '../../services/SessionService';
import ProgressIndicator from '../ProgressIndicator';
import { useDebounce } from '../../hooks/useDebounce';
import { useSessionsReducer } from '../../hooks/useSessionsReducer';

const SessionsView: React.FC = () => {
  const [state, dispatch] = useSessionsReducer();
  const {
    sessions,
    selectedSession,
    searchQuery,
    isEditing,
    editNote,
    newTag,
    isExporting,
    exportError
  } = state;
  
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = useCallback(async () => {
    const allSessions = await sessionService.getAllSessions();
    dispatch({
      type: 'SET_SESSIONS',
      payload: allSessions.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    });
  }, [dispatch]);

  const handleSearch = useCallback(async (query: string) => {
    if (query.trim()) {
      const results = await sessionService.searchSessions(query);
      dispatch({ type: 'SET_SESSIONS', payload: results });
    } else {
      loadSessions();
    }
  }, [loadSessions, dispatch]);

  // Auto-search when debounced query changes
  useEffect(() => {
    handleSearch(debouncedSearchQuery);
  }, [debouncedSearchQuery, handleSearch]);

  const handleDeleteSession = useCallback(async (id: string) => {
    if (window.confirm('Are you sure you want to delete this session?')) {
      try {
        await sessionService.deleteSession(id);
        loadSessions();
        if (selectedSession?.id === id) {
          dispatch({ type: 'SET_SELECTED_SESSION', payload: null });
        }
      } catch (error) {
        console.error('Error deleting session:', error);
        alert('Failed to delete session. Please try again.');
      }
    }
  }, [selectedSession]);

  const handleSaveNote = useCallback(async () => {
    if (selectedSession && editNote.trim()) {
      try {
        await sessionService.addNoteToSession(selectedSession.id, editNote);
        loadSessions();
        dispatch({ type: 'SET_IS_EDITING', payload: false });
      } catch (error) {
        console.error('Error saving note:', error);
        alert('Failed to save note. Please try again.');
      }
    }
  }, [selectedSession, editNote]);

  const handleAddTag = useCallback(async () => {
    if (selectedSession && newTag.trim()) {
      try {
        await sessionService.addTagsToSession(selectedSession.id, [newTag.trim()]);
        loadSessions();
        dispatch({ type: 'CLEAR_NEW_TAG' });
      } catch (error) {
        console.error('Error adding tag:', error);
        alert('Failed to add tag. Please try again.');
      }
    }
  }, [selectedSession, newTag]);

  const handleRemoveTag = useCallback(async (tag: string) => {
    if (selectedSession) {
      try {
        await sessionService.removeTagFromSession(selectedSession.id, tag);
        loadSessions();
      } catch (error) {
        console.error('Error removing tag:', error);
        alert('Failed to remove tag. Please try again.');
      }
    }
  }, [selectedSession]);

  const handleExportSession = useCallback(async () => {
    if (!selectedSession) return;

    dispatch({ type: 'SET_IS_EXPORTING', payload: true });
    dispatch({ type: 'CLEAR_EXPORT_ERROR' });

    try {
      const blob = await sessionService.exportSession(selectedSession.id);
      // Create a download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedSession.metadata.sessionName}.${selectedSession.metadata.format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      dispatch({ 
        type: 'SET_EXPORT_ERROR', 
        payload: error instanceof Error ? error.message : 'Failed to export session'
      });
    } finally {
      dispatch({ type: 'SET_IS_EXPORTING', payload: false });
    }
  }, [selectedSession]);

  const formatDuration = useMemo(() => (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  }, []);

  const formatDate = useMemo(() => (date: Date): string => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  return (
    <div className="flex h-full gap-6">
      {/* Sessions List */}
      <div className="w-1/2">
        <div className="mb-6">
          <div className="flex gap-2">
            <label htmlFor="session-search" className="sr-only">
              Search sessions by name, tags, or notes
            </label>
            <input
              id="session-search"
              type="text"
              value={searchQuery}
              onChange={(e) => dispatch({ type: 'SET_SEARCH_QUERY', payload: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
              placeholder="Search sessions..."
              aria-label="Search sessions by name, tags, or notes"
              className="flex-1 px-4 py-2 bg-[#1C1C1C] border border-[#3A1078]/30 rounded-lg focus:outline-none focus:border-[#FFD700]/50 text-white placeholder-gray-400"
            />
            <button
              onClick={() => handleSearch(searchQuery)}
              aria-label="Search sessions"
              className="px-4 py-2 bg-[#3A1078] hover:bg-[#3A1078]/90 text-[#FFD700] rounded-lg transition-colors duration-200"
            >
              Search
            </button>
          </div>
        </div>

        <div className="space-y-3" role="list" aria-label="Recording sessions">
          {sessions.map(session => (
            <div
              key={session.id}
              role="listitem"
              tabIndex={0}
              className={`p-4 rounded-lg cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#FFD700]/50 ${
                selectedSession?.id === session.id
                  ? 'bg-[#3A1078] border border-[#FFD700]/20 shadow-lg shadow-[#FFD700]/5'
                  : 'bg-[#1C1C1C] hover:bg-[#3A1078]/20 border border-[#3A1078]/20'
              }`}
              onClick={() => dispatch({ type: 'SET_SELECTED_SESSION', payload: session })}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  dispatch({ type: 'SET_SELECTED_SESSION', payload: session });
                }
              }}
              aria-selected={selectedSession?.id === session.id}
              aria-label={`Session ${session.metadata.sessionName}, created ${formatDate(session.createdAt)}, duration ${formatDuration(session.metadata.duration)}`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold text-[#FFD700]">{session.metadata.sessionName}</h3>
                  <p className="text-sm text-gray-400">
                    {formatDate(session.createdAt)}
                  </p>
                  <p className="text-sm text-gray-400">
                    Duration: {formatDuration(session.metadata.duration)}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSession(session.id);
                  }}
                  aria-label={`Delete session ${session.metadata.sessionName}`}
                  className="text-[#F44336] hover:text-[#F44336]/80 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#F44336]/50 rounded px-2 py-1"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Session Details */}
      {selectedSession && (
        <section className="w-1/2" aria-labelledby="session-details-heading">
          <div className="flex justify-between items-center mb-6">
            <h2 id="session-details-heading" className="text-2xl font-bold text-[#FFD700]">{selectedSession.metadata.sessionName}</h2>
            {isExporting ? (
              <div className="flex items-center space-x-3">
                <ProgressIndicator
                  indeterminate
                  size="small"
                  variant="circular"
                />
                <span className="text-[#FFD700]">Exporting...</span>
              </div>
            ) : (
              <button
                onClick={handleExportSession}
                aria-label={`Export session ${selectedSession.metadata.sessionName}`}
                className="px-4 py-2 rounded-lg text-[#FFD700] bg-[#3A1078] hover:bg-[#3A1078]/90 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#FFD700]/50"
              >
                Export Session
              </button>
            )}
          </div>
          
          {exportError && (
            <div className="mb-6 p-4 bg-[#1C1C1C] border border-[#F44336]/50 rounded-lg text-red-200">
              {exportError}
            </div>
          )}

          <div className="space-y-6">
            <section aria-labelledby="session-details-section">
              <h3 id="session-details-section" className="text-lg font-semibold mb-3 text-[#FFD700]">Details</h3>
              <div className="bg-[#1C1C1C] p-4 rounded-lg border border-[#3A1078]/20">
                <div className="space-y-2 text-gray-300">
                  <p>Created: {formatDate(selectedSession.createdAt)}</p>
                  <p>Duration: {formatDuration(selectedSession.metadata.duration)}</p>
                  <p>Format: {selectedSession.metadata.format.toUpperCase()}</p>
                  <p>Quality: {selectedSession.metadata.quality}kbps</p>
                  <p>File Size: {(selectedSession.metadata.fileSize / (1024 * 1024)).toFixed(2)}MB</p>
                </div>
              </div>
            </section>

            <section aria-labelledby="session-notes-section">
              <h3 id="session-notes-section" className="text-lg font-semibold mb-3 text-[#FFD700]">Notes</h3>
              {isEditing ? (
                <div className="space-y-3">
                  <label htmlFor="session-notes" className="sr-only">
                    Session notes
                  </label>
                  <textarea
                    id="session-notes"
                    value={editNote}
                    onChange={(e) => dispatch({ type: 'SET_EDIT_NOTE', payload: e.target.value })}
                    className="w-full h-32 px-4 py-2 bg-[#1C1C1C] border border-[#3A1078]/30 rounded-lg focus:outline-none focus:border-[#FFD700]/50 text-white"
                    placeholder="Add notes about this session..."
                    aria-label="Edit session notes"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveNote}
                      aria-label="Save session notes"
                      className="px-4 py-2 bg-[#4CAF50] hover:bg-[#4CAF50]/90 text-white rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#4CAF50]/50"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => dispatch({ type: 'SET_IS_EDITING', payload: false })}
                      aria-label="Cancel editing notes"
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-400/50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="bg-[#1C1C1C] p-4 rounded-lg border border-[#3A1078]/20 cursor-pointer hover:bg-[#3A1078]/10 transition-colors duration-200"
                  onClick={() => {
                    dispatch({ type: 'SET_IS_EDITING', payload: true });
                    dispatch({ type: 'SET_EDIT_NOTE', payload: selectedSession.notes?.join('\n') || '' });
                  }}
                >
                  <p className="text-gray-300">
                    {selectedSession.notes?.join('\n') || 'Click to add notes...'}
                  </p>
                </div>
              )}
            </section>

            <section aria-labelledby="session-tags-section">
              <h3 id="session-tags-section" className="text-lg font-semibold mb-3 text-[#FFD700]">Tags</h3>
              <div className="bg-[#1C1C1C] p-4 rounded-lg border border-[#3A1078]/20">
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedSession.tags?.map(tag => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-[#3A1078] rounded-full text-sm text-[#FFD700] flex items-center gap-1"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        aria-label={`Remove tag ${tag}`}
                        className="text-xs hover:text-[#F44336] transition-colors duration-200 focus:outline-none focus:ring-1 focus:ring-[#F44336]/50 rounded"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <label htmlFor="new-tag" className="sr-only">
                    Add new tag
                  </label>
                  <input
                    id="new-tag"
                    type="text"
                    value={newTag}
                    onChange={(e) => dispatch({ type: 'SET_NEW_TAG', payload: e.target.value })}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                    placeholder="Add a tag..."
                    aria-label="Add new tag to session"
                    className="flex-1 px-4 py-2 bg-[#1C1C1C] border border-[#3A1078]/30 rounded-lg focus:outline-none focus:border-[#FFD700]/50 text-white placeholder-gray-400"
                  />
                  <button
                    onClick={handleAddTag}
                    aria-label="Add tag to session"
                    className="px-4 py-2 bg-[#3A1078] hover:bg-[#3A1078]/90 text-[#FFD700] rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#FFD700]/50"
                  >
                    Add
                  </button>
                </div>
              </div>
            </section>
          </div>
        </section>
      )}
    </div>
  );
};

export default SessionsView; 