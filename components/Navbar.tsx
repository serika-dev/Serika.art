'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/AuthContext';
import { Upload, Search, User, LogOut, Menu, X, Settings, Heart, Shield, Key, BookOpen } from 'lucide-react';
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
              <Image
                src="/logo.svg"
                alt="Serika Booru"
                width={32}
                height={32}
                className="h-8 w-auto drop-shadow-[0_2px_6px_rgba(0,0,0,0.4)]"
                priority
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
              href="/tags"
              className="px-3 py-2 text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-md transition"
            >
              Tags
            </Link>
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-800 rounded-md transition"
                >
                  {user.avatarUrl ? (
                    <Image
                      src={user.avatarUrl}
                      alt={user.username}
                      width={32}
                      height={32}
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
                    <Link
                      href="/api-keys"
                      className="flex items-center gap-3 px-4 py-2 text-zinc-300 hover:bg-zinc-800 hover:text-white transition"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      <Key size={18} />
                      <span>API Keys</span>
                    </Link>
                    <Link
                      href="/api-docs"
                      className="flex items-center gap-3 px-4 py-2 text-zinc-300 hover:bg-zinc-800 hover:text-white transition"
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      <BookOpen size={18} />
                      <span>API Docs</span>
                    </Link>
                    {(user.rank === 'admin' || user.rank === 'owner') && (
                      <>
                        <div className="border-t border-zinc-800 my-2"></div>
                        <Link
                          href="/admin"
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
        <div className="fixed inset-0 z-50 bg-zinc-950 md:hidden flex flex-col animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="flex items-center justify-end px-4 h-16">
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 text-zinc-400 hover:text-white"
            >
              <X size={28} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col items-center pt-8 pb-8 px-6">
            {user ? (
              <>
                {/* Profile Section */}
                <div className="flex flex-col items-center mb-12">
                  <div className="w-32 h-32 rounded-full overflow-hidden mb-4 bg-zinc-800 border-4 border-zinc-900 shadow-xl">
                    {user.avatarUrl ? (
                      <Image
                        src={user.avatarUrl}
                        alt={user.username}
                        width={128}
                        height={128}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-5xl text-zinc-500 bg-zinc-800">
                        {user.username[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <h2 className="text-2xl font-bold text-white">{user.username}</h2>
                </div>

                {/* Navigation Links */}
                <div className="w-full space-y-4 mb-auto">
                  <Link
                    href={`/user/${user.id}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-3 w-full py-3 text-white font-bold text-lg border border-blue-500/30 bg-blue-500/10 rounded-xl hover:bg-blue-500/20 transition"
                  >
                    <User size={20} className="text-blue-400" />
                    My Profile
                  </Link>

                  <div className="grid grid-cols-2 gap-3">
                    <Link
                      href="/posts"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex flex-col items-center justify-center p-4 bg-zinc-900 rounded-xl border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 transition"
                    >
                      <Search size={24} className="mb-2 text-zinc-400" />
                      <span className="text-sm font-medium text-zinc-300">Browse</span>
                    </Link>
                    <Link
                      href="/favorites"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex flex-col items-center justify-center p-4 bg-zinc-900 rounded-xl border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 transition"
                    >
                      <Heart size={24} className="mb-2 text-zinc-400" />
                      <span className="text-sm font-medium text-zinc-300">Favorites</span>
                    </Link>
                  </div>

                  <div className="space-y-2">
                    <a
                      href={`${ACCOUNTS_URL}/account`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 w-full px-4 py-3 bg-zinc-900 rounded-xl border border-zinc-800 hover:bg-zinc-800 transition text-zinc-300"
                    >
                      <Settings size={20} />
                      Account Settings
                    </a>

                    {(user.rank === 'admin' || user.rank === 'owner') && (
                      <Link
                        href="/admin"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 w-full px-4 py-3 bg-zinc-900 rounded-xl border border-zinc-800 hover:bg-zinc-800 transition text-red-400"
                      >
                        <Shield size={20} />
                        Admin Panel
                      </Link>
                    )}
                  </div>
                </div>

                {/* Logout */}
                <button
                  onClick={() => {
                    logout();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center justify-center gap-2 w-full py-4 text-red-500 font-bold text-lg mt-4 hover:bg-red-500/10 rounded-xl transition"
                >
                  <LogOut size={20} />
                  Log out
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full w-full space-y-6">
                <div className="w-24 h-24 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
                  <User size={48} className="text-zinc-500" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-8">Guest</h2>
                
                <button
                  onClick={() => {
                    handleLogin();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-blue-500 transition shadow-lg shadow-blue-900/20"
                >
                  Log In / Sign Up
                </button>
                
                <Link
                  href="/posts"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-zinc-400 hover:text-white transition"
                >
                  Continue as Guest
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
