import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-purple-900 p-4">
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <img src="/logo.png" alt="TavernTapes" className="h-8 w-8" />
            <h1 className="text-xl font-bold">TavernTapes</h1>
          </div>
          <nav className="flex space-x-4">
            <Link
              to="/"
              className={`px-3 py-2 rounded ${
                location.pathname === '/' ? 'bg-purple-700' : 'hover:bg-purple-800'
              }`}
            >
              Record
            </Link>
            <Link
              to="/sessions"
              className={`px-3 py-2 rounded ${
                location.pathname === '/sessions' ? 'bg-purple-700' : 'hover:bg-purple-800'
              }`}
            >
              Sessions
            </Link>
            <Link
              to="/settings"
              className={`px-3 py-2 rounded ${
                location.pathname === '/settings' ? 'bg-purple-700' : 'hover:bg-purple-800'
              }`}
            >
              Settings
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto p-4">
        {children}
      </main>
    </div>
  );
};

export default MainLayout; 