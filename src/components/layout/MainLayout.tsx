import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#1C1C1C] text-white font-sans">
      {/* Header */}
      <header className="bg-[#3A1078] border-b border-[#FFD700]/20">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            {/* Brand */}
            <h1 className="text-xl font-bold tracking-wide">TavernTapes</h1>

            {/* Navigation */}
            <nav className="flex space-x-1">
              <Link
                to="/"
                className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                  location.pathname === '/'
                    ? 'bg-[#FFD700]/10 text-[#FFD700] shadow-lg shadow-[#FFD700]/10'
                    : 'hover:bg-[#FFD700]/5 hover:text-[#FFD700]/80'
                }`}
              >
                Record
              </Link>
              <Link
                to="/sessions"
                className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                  location.pathname === '/sessions'
                    ? 'bg-[#FFD700]/10 text-[#FFD700] shadow-lg shadow-[#FFD700]/10'
                    : 'hover:bg-[#FFD700]/5 hover:text-[#FFD700]/80'
                }`}
              >
                Sessions
              </Link>
              <Link
                to="/settings"
                className={`px-4 py-2 rounded-lg transition-all duration-200 ${
                  location.pathname === '/settings'
                    ? 'bg-[#FFD700]/10 text-[#FFD700] shadow-lg shadow-[#FFD700]/10'
                    : 'hover:bg-[#FFD700]/5 hover:text-[#FFD700]/80'
                }`}
              >
                Settings
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-6">
        <div className="bg-[#212121] rounded-xl shadow-lg border border-[#3A1078]/20">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-4 border-t border-[#3A1078]/20">
        <div className="container mx-auto px-4 text-center text-sm text-gray-400">
          <p>© {new Date().getFullYear()} TavernTapes - Your D&D Session Recorder</p>
        </div>
      </footer>
    </div>
  );
};

export default MainLayout; 