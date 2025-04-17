import React from 'react';

interface RecoveryDialogProps {
  sessionName: string;
  duration: number;
  onRecover: () => void;
  onDiscard: () => void;
}

const RecoveryDialog: React.FC<RecoveryDialogProps> = ({
  sessionName,
  duration,
  onRecover,
  onDiscard
}) => {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#1C1C1C] p-6 rounded-lg max-w-md w-full mx-4 border border-[#3A1078]/50 shadow-lg shadow-[#FFD700]/5">
        <h2 className="text-xl font-bold text-[#FFD700] mb-4">Recover Recording?</h2>
        <p className="text-gray-300 mb-4">
          A previous recording session was interrupted. Would you like to recover it?
        </p>
        <div className="space-y-2 mb-6">
          <div className="flex justify-between">
            <span className="text-gray-400">Session:</span>
            <span className="text-[#FFD700]">{sessionName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Duration:</span>
            <span className="text-[#FFD700]">{Math.floor(duration / 60)} minutes</span>
          </div>
        </div>
        <div className="flex space-x-4">
          <button
            onClick={onRecover}
            className="flex-1 px-4 py-2 bg-[#3A1078] hover:bg-[#3A1078]/90 rounded-lg text-[#FFD700] font-bold transition-colors duration-200"
          >
            Recover
          </button>
          <button
            onClick={onDiscard}
            className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-lg text-white font-bold transition-colors duration-200"
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecoveryDialog; 