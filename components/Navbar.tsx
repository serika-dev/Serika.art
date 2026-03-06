'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { Upload, Search, User, LogOut, Menu, X, Settings, Heart, Shield, Key, BookOpen, Hash } from 'lucide-react';
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
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';

const ACCOUNTS_URL = process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'https://accounts.serika.dev';

export default function Navbar() {
  const { user, logout } = useAuth();
  const [sheetOpen, setSheetOpen] = useState(false);
  const pathname = usePathname();

  // Auto-close sheet on navigation
  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  const handleLogin = async () => {
    const currentPath = window.location.pathname;
    window.location.href = `/login?returnUrl=${encodeURIComponent(currentPath)}`;
  };

  return (
    <nav className="bg-background/80 backdrop-blur-xl border-b border-border/40 sticky top-0 z-40 transition-all duration-300">
      <div className="w-full px-4 sm:px-6 lg:px-12 xl:px-16 2xl:px-24">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <div className="flex items-center relative z-30">
            <Link href="/" className="flex items-center group">
              <Image
                src="/logo.svg"
                alt="Serika Booru"
                width={32}
                height={32}
                className="h-8 w-auto drop-shadow-sm transition-transform duration-300 group-hover:scale-110"
                priority
              />
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            <Button variant="ghost" asChild className="font-bold text-sm hover:bg-primary/5 hover:text-primary transition-all rounded-xl">
              <Link href="/posts">Posts</Link>
            </Button>
            <Button variant="ghost" asChild className="font-bold text-sm hover:bg-primary/5 hover:text-primary transition-all rounded-xl">
              <Link href="/tags">Tags</Link>
            </Button>
            <Button variant="ghost" asChild className="font-bold text-sm hover:bg-primary/5 hover:text-primary transition-all rounded-xl">
              <Link href="/upload">
                <Upload className="mr-2 h-4 w-4" />
                Upload
              </Link>
            </Button>
            
            <div className="w-px h-6 bg-border/60 mx-2" />
            
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-xl p-0 hover:bg-primary/5 transition-all">
                    <Avatar className="h-8 w-8 rounded-lg border border-border/50">
                      <AvatarImage src={user.avatarUrl} alt={user.username} className="object-cover" />
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                        {user.username[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 p-2 rounded-2xl border-border/50 bg-card/95 backdrop-blur-xl shadow-2xl" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal p-3">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-black leading-none text-foreground">{user.username}</p>
                      <p className="text-xs leading-none text-muted-foreground font-medium">
                        {user.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-border/50" />
                  <div className="p-1 space-y-1">
                    <DropdownMenuItem asChild className="rounded-xl focus:bg-primary/10 focus:text-primary cursor-pointer py-2.5">
                      <Link href={`/user/${user.username}`} className="flex items-center">
                        <User className="mr-3 h-4 w-4" />
                        <span className="font-bold text-sm">Profile</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="rounded-xl focus:bg-primary/10 focus:text-primary cursor-pointer py-2.5">
                      <Link href="/favorites" className="flex items-center">
                        <Heart className="mr-3 h-4 w-4" />
                        <span className="font-bold text-sm">Favorites</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="rounded-xl focus:bg-primary/10 focus:text-primary cursor-pointer py-2.5">
                      <Link href="/api-keys" className="flex items-center">
                        <Key className="mr-3 h-4 w-4" />
                        <span className="font-bold text-sm">API Keys</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="rounded-xl focus:bg-primary/10 focus:text-primary cursor-pointer py-2.5">
                      <Link href="/api-docs" className="flex items-center">
                        <BookOpen className="mr-3 h-4 w-4" />
                        <span className="font-bold text-sm">API Docs</span>
                      </Link>
                    </DropdownMenuItem>
                  </div>
                  
                  {(user.rank === 'admin' || user.rank === 'owner') && (
                    <>
                      <DropdownMenuSeparator className="bg-border/50" />
                      <div className="p-1">
                        <DropdownMenuItem asChild className="rounded-xl focus:bg-red-500/10 focus:text-red-500 text-red-400 cursor-pointer py-2.5">
                          <Link href="/admin" className="flex items-center">
                            <Shield className="mr-3 h-4 w-4" />
                            <span className="font-bold text-sm">Admin Panel</span>
                          </Link>
                        </DropdownMenuItem>
                      </div>
                    </>
                  )}
                  
                  <DropdownMenuSeparator className="bg-border/50" />
                  <div className="p-1 space-y-1">
                    <DropdownMenuItem asChild className="rounded-xl focus:bg-primary/10 focus:text-primary cursor-pointer py-2.5">
                      <Link href="/settings" className="flex items-center">
                        <Settings className="mr-3 h-4 w-4" />
                        <span className="font-bold text-sm">Settings</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={logout} className="rounded-xl focus:bg-red-500/10 focus:text-red-500 text-red-400 cursor-pointer py-2.5">
                      <LogOut className="mr-3 h-4 w-4" />
                      <span className="font-bold text-sm">Log out</span>
                    </DropdownMenuItem>
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button onClick={handleLogin} className="font-bold rounded-xl px-6 bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all active:scale-95">
                Login
              </Button>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="pt-14 w-[280px] sm:w-[320px]">
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                {/* Mobile Menu Content */}
                <div className="flex flex-col space-y-4 mt-2">
                  {user ? (
                    <>
                      <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-muted/50">
                        <Avatar className="h-12 w-12 flex-shrink-0">
                          <AvatarImage src={user.avatarUrl} alt={user.username} className="object-cover" />
                          <AvatarFallback className="text-lg">{user.username[0].toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold truncate">{user.username}</span>
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
                          Browse Posts
                        </Link>
                      </Button>
                      <Button variant="ghost" className="justify-start" asChild>
                        <Link href="/tags">
                          <Hash className="mr-2 h-4 w-4" />
                          Tags
                        </Link>
                      </Button>
                      <Button variant="ghost" className="justify-start" asChild>
                        <Link href="/favorites">
                          <Heart className="mr-2 h-4 w-4" />
                          Favorites
                        </Link>
                      </Button>
                      <Button variant="ghost" className="justify-start" asChild>
                        <Link href="/upload">
                          <Upload className="mr-2 h-4 w-4" />
                          Upload
                        </Link>
                      </Button>
                      <Button variant="ghost" className="justify-start" asChild>
                        <Link href="/api-docs">
                          <BookOpen className="mr-2 h-4 w-4" />
                          API Docs
                        </Link>
                      </Button>
                      
                      <Button variant="ghost" className="justify-start" asChild>
                        <Link href="/settings">
                          <Settings className="mr-2 h-4 w-4" />
                          Settings
                        </Link>
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
                      <Button variant="ghost" asChild className="w-full justify-start">
                        <Link href="/upload">
                          <Upload className="mr-2 h-4 w-4" />
                          Upload
                        </Link>
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
