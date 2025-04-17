import React, { useState, useEffect } from 'react';
import sessionService, { Session } from '../../services/SessionService';

const SessionsView: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editNote, setEditNote] = useState('');
  const [newTag, setNewTag] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    const allSessions = await sessionService.getAllSessions();
    setSessions(allSessions.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    ));
  };

  const handleSearch = async () => {
    if (searchQuery.trim()) {
      const results = await sessionService.searchSessions(searchQuery);
      setSessions(results);
    } else {
      loadSessions();
    }
  };

  const handleDeleteSession = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this session?')) {
      await sessionService.deleteSession(id);
      loadSessions();
      if (selectedSession?.id === id) {
        setSelectedSession(null);
      }
    }
  };

  const handleSaveNote = async () => {
    if (selectedSession && editNote.trim()) {
      await sessionService.addNoteToSession(selectedSession.id, editNote);
      loadSessions();
      setIsEditing(false);
    }
  };

  const handleAddTag = async () => {
    if (selectedSession && newTag.trim()) {
      await sessionService.addTagsToSession(selectedSession.id, [newTag.trim()]);
      loadSessions();
      setNewTag('');
    }
  };

  const handleRemoveTag = async (tag: string) => {
    if (selectedSession) {
      await sessionService.removeTagFromSession(selectedSession.id, tag);
      loadSessions();
    }
  };

  const handleExportSession = async () => {
    if (!selectedSession) return;

    setIsExporting(true);
    setExportError(null);

    try {
      await sessionService.exportSessionToFile(selectedSession.id);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Failed to export session');
    } finally {
      setIsExporting(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="flex h-full gap-6">
      {/* Sessions List */}
      <div className="w-1/2">
        <div className="mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search sessions..."
              className="flex-1 px-4 py-2 bg-[#1C1C1C] border border-[#3A1078]/30 rounded-lg focus:outline-none focus:border-[#FFD700]/50 text-white placeholder-gray-400"
            />
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-[#3A1078] hover:bg-[#3A1078]/90 text-white rounded-lg transition-colors duration-200"
            >
              Search
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {sessions.map(session => (
            <div
              key={session.id}
              className={`p-4 rounded-lg cursor-pointer transition-all duration-200 ${
                selectedSession?.id === session.id
                  ? 'bg-[#3A1078] border border-[#FFD700]/20 shadow-lg shadow-[#FFD700]/5'
                  : 'bg-[#1C1C1C] hover:bg-[#3A1078]/20 border border-[#3A1078]/20'
              }`}
              onClick={() => setSelectedSession(session)}
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold text-white">{session.metadata.sessionName}</h3>
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
                  className="text-red-400 hover:text-red-300 transition-colors duration-200"
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
        <div className="w-1/2">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">{selectedSession.metadata.sessionName}</h2>
            <button
              onClick={handleExportSession}
              disabled={isExporting}
              className={`px-4 py-2 rounded-lg text-white transition-all duration-200 ${
                isExporting
                  ? 'bg-gray-600 cursor-not-allowed'
                  : 'bg-[#3A1078] hover:bg-[#3A1078]/90'
              }`}
            >
              {isExporting ? 'Exporting...' : 'Export Session'}
            </button>
          </div>
          
          {exportError && (
            <div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
              {exportError}
            </div>
          )}

          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3 text-white">Details</h3>
              <div className="bg-[#1C1C1C] p-4 rounded-lg border border-[#3A1078]/20">
                <div className="space-y-2 text-gray-300">
                  <p>Created: {formatDate(selectedSession.createdAt)}</p>
                  <p>Duration: {formatDuration(selectedSession.metadata.duration)}</p>
                  <p>Format: {selectedSession.metadata.format.toUpperCase()}</p>
                  <p>Quality: {selectedSession.metadata.quality}kbps</p>
                  <p>File Size: {(selectedSession.metadata.fileSize / (1024 * 1024)).toFixed(2)}MB</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3 text-white">Notes</h3>
              {isEditing ? (
                <div className="space-y-3">
                  <textarea
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    className="w-full h-32 px-4 py-2 bg-[#1C1C1C] border border-[#3A1078]/30 rounded-lg focus:outline-none focus:border-[#FFD700]/50 text-white"
                    placeholder="Add notes about this session..."
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveNote}
                      className="px-4 py-2 bg-[#4CAF50] hover:bg-[#4CAF50]/90 text-white rounded-lg transition-colors duration-200"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors duration-200"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="bg-[#1C1C1C] p-4 rounded-lg border border-[#3A1078]/20 cursor-pointer hover:bg-[#3A1078]/10 transition-colors duration-200"
                  onClick={() => {
                    setIsEditing(true);
                    setEditNote(selectedSession.notes || '');
                  }}
                >
                  <p className="text-gray-300">
                    {selectedSession.notes || 'Click to add notes...'}
                  </p>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3 text-white">Tags</h3>
              <div className="bg-[#1C1C1C] p-4 rounded-lg border border-[#3A1078]/20">
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedSession.tags?.map(tag => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-[#3A1078] rounded-full text-sm text-white flex items-center gap-1"
                    >
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="text-xs hover:text-red-400 transition-colors duration-200"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                    placeholder="Add a tag..."
                    className="flex-1 px-4 py-2 bg-[#1C1C1C] border border-[#3A1078]/30 rounded-lg focus:outline-none focus:border-[#FFD700]/50 text-white placeholder-gray-400"
                  />
                  <button
                    onClick={handleAddTag}
                    className="px-4 py-2 bg-[#3A1078] hover:bg-[#3A1078]/90 text-white rounded-lg transition-colors duration-200"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionsView; 