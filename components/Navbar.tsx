'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/AuthContext';
import { Upload, Search, User, LogOut, Menu, X, Settings, Heart, Shield } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

const ACCOUNTS_URL = process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'https://accounts.serika.dev';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogin = async () => {
    const currentPath = window.location.pathname;
    window.location.href = `/login?returnUrl=${encodeURIComponent(currentPath)}`;
  };

  return (
    <nav className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2">
              <img
                src="/logo.svg"
                alt="Serika Booru"
                className="h-8 w-auto drop-shadow-[0_2px_6px_rgba(0,0,0,0.4)]"
              />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            <Link
              href="/posts"
              className="px-3 py-2 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-md transition"
            >
              Posts
            </Link>
            <Link
              href="/upload"
              className="px-3 py-2 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-md transition flex items-center gap-2"
            >
              <Upload size={18} />
              Upload
            </Link>
            <Link
              href="/search"
              className="px-3 py-2 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-md transition flex items-center gap-2"
            >
              <Search size={18} />
              Search
            </Link>
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-800 rounded-md transition"
                >
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt={user.username}
                      className="w-8 h-8 rounded-full"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white">
                      {user.username[0].toUpperCase()}
                    </div>
                  )}
                  <span className="text-zinc-300">{user.username}</span>
                </button>

                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl py-2 z-50">
                    <Link
                      href={`/user/${user.id}`}
                      className="flex items-center gap-3 px-4 py-2 text-zinc-300 hover:bg-zinc-800 hover:text-white transition"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      <User size={18} />
                      <span>Profile</span>
                    </Link>
                    <Link
                      href="/favorites"
                      className="flex items-center gap-3 px-4 py-2 text-zinc-300 hover:bg-zinc-800 hover:text-white transition"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      <Heart size={18} />
                      <span>Favorites</span>
                    </Link>
                    {(user.rank === 'admin' || user.rank === 'owner') && (
                      <>
                        <div className="border-t border-zinc-800 my-2"></div>
                        <Link
                          href="/admin/tags"
                          className="flex items-center gap-3 px-4 py-2 text-red-400 hover:bg-zinc-800 hover:text-red-300 transition"
                          onClick={() => setProfileDropdownOpen(false)}
                        >
                          <Shield size={18} />
                          <span>Admin Panel</span>
                        </Link>
                      </>
                    )}
                    <a
                      href={`${ACCOUNTS_URL}/account`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 px-4 py-2 text-zinc-300 hover:bg-zinc-800 hover:text-white transition"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      <Settings size={18} />
                      <span>Settings</span>
                    </a>
                    <div className="border-t border-zinc-800 my-2"></div>
                    <button
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        logout();
                      }}
                      className="flex items-center gap-3 px-4 py-2 text-red-400 hover:bg-zinc-800 hover:text-red-300 transition w-full text-left"
                    >
                      <LogOut size={18} />
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={handleLogin}
                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-500 rounded-md transition"
              >
                Login
              </button>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-zinc-800 bg-zinc-900">
          <div className="px-2 pt-2 pb-3 space-y-1">
            <Link
              href="/posts"
              className="block px-3 py-2 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-md"
              onClick={() => setMobileMenuOpen(false)}
            >
              Posts
            </Link>
            <Link
              href="/search"
              className="block px-3 py-2 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-md"
              onClick={() => setMobileMenuOpen(false)}
            >
              Search
            </Link>
            {user ? (
              <>
                <Link
                  href="/upload"
                  className="block px-3 py-2 bg-blue-600 text-white hover:bg-blue-500 rounded-md"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Upload
                </Link>
                <Link
                  href={`/user/${user.id}`}
                  className="block px-3 py-2 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-md"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Profile
                </Link>
                <button
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-md"
                >
                  Logout
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  handleLogin();
                  setMobileMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 bg-blue-600 text-white hover:bg-blue-500 rounded-md"
              >
                Login
              </button>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
