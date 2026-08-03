// ============================================================
// PS2 Cloud Gaming Platform — Navbar Component
// ============================================================

import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { HiSearch, HiUser, HiLogout, HiCog, HiViewGrid } from 'react-icons/hi';
import { useState } from 'react';

export default function Navbar() {
  const { user, isAdmin, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/library?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
    setShowUserMenu(false);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-ps2-darker/80 backdrop-blur-xl border-b border-ps2-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-ps2-accent to-purple-500 flex items-center justify-center font-display font-bold text-sm shadow-lg shadow-ps2-accent/20 group-hover:shadow-ps2-accent/40 transition-shadow">
              PS2
            </div>
            <span className="font-display font-bold text-lg hidden sm:block">
              Cloud <span className="text-gradient">Gaming</span>
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-1">
            <Link to="/" className="btn-ghost text-sm">Home</Link>
            <Link to="/library" className="btn-ghost text-sm">Library</Link>
            {isAuthenticated && (
              <>
                <Link to="/favorites" className="btn-ghost text-sm">Favorites</Link>
              </>
            )}
            {isAdmin && (
              <Link to="/admin" className="btn-ghost text-sm text-ps2-accent">Admin</Link>
            )}
          </div>

          {/* Search + User */}
          <div className="flex items-center gap-3">
            {/* Search */}
            <form onSubmit={handleSearch} className="relative hidden sm:block">
              <HiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-4 h-4" />
              <input
                type="text"
                placeholder="Search games..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-ps2-card/50 border border-ps2-border/50 rounded-xl pl-9 pr-4 py-2 text-sm w-48 focus:w-64 transition-all focus:outline-none focus:ring-1 focus:ring-ps2-accent/50 placeholder:text-gray-600"
              />
            </form>

            {/* User Menu */}
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 btn-ghost text-sm"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-ps2-accent to-purple-500 flex items-center justify-center text-xs font-bold">
                    {user?.username?.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden lg:block">{user?.username}</span>
                </button>

                {showUserMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                    <div className="absolute right-0 mt-2 w-56 glass-card p-2 z-50 animate-fade-in">
                      <div className="px-3 py-2 border-b border-ps2-border/50 mb-1">
                        <p className="font-medium text-sm">{user?.username}</p>
                        <p className="text-xs text-gray-500">{user?.email || user?.role}</p>
                      </div>
                      <Link to="/profile" onClick={() => setShowUserMenu(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                        <HiUser className="w-4 h-4" /> Profile
                      </Link>
                      <Link to="/settings" onClick={() => setShowUserMenu(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                        <HiCog className="w-4 h-4" /> Settings
                      </Link>
                      {isAdmin && (
                        <Link to="/admin" onClick={() => setShowUserMenu(false)} className="flex items-center gap-2 px-3 py-2 text-sm text-ps2-accent hover:bg-white/5 rounded-lg transition-colors">
                          <HiViewGrid className="w-4 h-4" /> Admin Panel
                        </Link>
                      )}
                      <hr className="border-ps2-border/50 my-1" />
                      <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors w-full text-left">
                        <HiLogout className="w-4 h-4" /> Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login" className="btn-ghost text-sm">Sign In</Link>
                <Link to="/register" className="btn-primary text-sm !py-2 !px-4">Register</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
