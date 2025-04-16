import React from 'react';

const SessionsView: React.FC = () => {
  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Recorded Sessions</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Placeholder for session list */}
        <div className="bg-gray-800 p-4 rounded-lg">
          <h3 className="text-lg font-semibold">Session Name</h3>
          <p className="text-gray-400">Date: 2024-04-16</p>
          <p className="text-gray-400">Duration: 2:15:42</p>
          <div className="mt-4 flex space-x-2">
            <button className="btn-primary">Play</button>
            <button className="btn-secondary">Export</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionsView; 