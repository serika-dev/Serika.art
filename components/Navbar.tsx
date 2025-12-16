'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/AuthContext';
import { Upload, Search, User, LogOut, Menu, X, Settings, Heart, Shield, Key, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const ACCOUNTS_URL = process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'https://accounts.serika.dev';

export default function Navbar() {
  const { user, logout } = useAuth();

  const handleLogin = async () => {
    const currentPath = window.location.pathname;
    window.location.href = `/login?returnUrl=${encodeURIComponent(currentPath)}`;
  };

  return (
    <nav className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/40 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2">
              <Image
                src="/logo.svg"
                alt="Serika Booru"
                width={32}
                height={32}
                className="h-8 w-auto drop-shadow-sm"
                priority
              />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            <Button variant="ghost" asChild>
              <Link href="/posts">Posts</Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/tags">Tags</Link>
            </Button>
            
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.avatarUrl} alt={user.username} />
                      <AvatarFallback>{user.username[0].toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.username}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={`/user/${user.username}`}>
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/favorites">
                      <Heart className="mr-2 h-4 w-4" />
                      <span>Favorites</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/api-keys">
                      <Key className="mr-2 h-4 w-4" />
                      <span>API Keys</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/api-docs">
                      <BookOpen className="mr-2 h-4 w-4" />
                      <span>API Docs</span>
                    </Link>
                  </DropdownMenuItem>
                  {(user.rank === 'admin' || user.rank === 'owner') && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="text-red-400 focus:text-red-400">
                          <Shield className="mr-2 h-4 w-4" />
                          <span>Admin Panel</span>
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <a href={`${ACCOUNTS_URL}/account`} target="_blank" rel="noopener noreferrer">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-red-400 focus:text-red-400">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button onClick={handleLogin}>Login</Button>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right">
                {/* Mobile Menu Content */}
                <div className="flex flex-col space-y-4 mt-4">
                  {user ? (
                    <>
                      <div className="flex items-center gap-4 mb-4">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.avatarUrl} alt={user.username} />
                          <AvatarFallback>{user.username[0].toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium">{user.username}</span>
                          <span className="text-xs text-muted-foreground">Logged in</span>
                        </div>
                      </div>
                      
                      <Button variant="ghost" className="justify-start" asChild>
                        <Link href={`/user/${user.username}`}>
                          <User className="mr-2 h-4 w-4" />
                          Profile
                        </Link>
                      </Button>
                      <Button variant="ghost" className="justify-start" asChild>
                        <Link href="/posts">
                          <Search className="mr-2 h-4 w-4" />
                          Browse
                        </Link>
                      </Button>
                      <Button variant="ghost" className="justify-start" asChild>
                        <Link href="/favorites">
                          <Heart className="mr-2 h-4 w-4" />
                          Favorites
                        </Link>
                      </Button>
                      
                      <Button variant="ghost" className="justify-start" asChild>
                         <a href={`${ACCOUNTS_URL}/account`} target="_blank" rel="noopener noreferrer">
                          <Settings className="mr-2 h-4 w-4" />
                          Settings
                        </a>
                      </Button>

                      {(user.rank === 'admin' || user.rank === 'owner') && (
                        <Button variant="ghost" className="justify-start text-red-400 hover:text-red-400" asChild>
                          <Link href="/admin">
                            <Shield className="mr-2 h-4 w-4" />
                            Admin Panel
                          </Link>
                        </Button>
                      )}

                      <Button variant="ghost" className="justify-start text-red-400 hover:text-red-400" onClick={logout}>
                        <LogOut className="mr-2 h-4 w-4" />
                        Log out
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button onClick={handleLogin} className="w-full">Login / Sign Up</Button>
                      <Button variant="ghost" asChild className="w-full justify-start">
                        <Link href="/posts">Continue as Guest</Link>
                      </Button>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
}
