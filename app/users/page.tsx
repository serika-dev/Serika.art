'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { Loader2, User as UserIcon, Search, ChevronLeft, ChevronRight, Crown, Shield } from 'lucide-react';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from '@/lib/utils';

type UserRank = 'user' | 'moderator' | 'admin' | 'owner';

interface User {
  _id: string;
  username: string;
  avatarUrl?: string;
  rank: UserRank;
  createdAt: string;
  uploadCount: number;
}

function UsersPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  
  // Get parameters from URL
  const page = parseInt(searchParams.get('page') || '1');
  const sort = searchParams.get('sort') || 'newest';
  const searchQuery = searchParams.get('q') || '';
  const [searchInput, setSearchInput] = useState(searchQuery);

  useEffect(() => {
    fetchUsers();
  }, [page, sort, searchQuery]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const queryParam = searchQuery ? `&q=${encodeURIComponent(searchQuery)}` : '';
      const response = await axios.get(`/api/v1/users?page=${page}&limit=50&sort=${sort}${queryParam}`);
      if (response.data.success) {
        setUsers(response.data.users);
        setTotalPages(response.data.pagination.pages);
        setTotalUsers(response.data.pagination.total);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateUrl = (newPage?: number, newSort?: string, newSearch?: string) => {
    const params = new URLSearchParams();
    
    const pageToUse = newPage || page;
    const sortToUse = newSort || sort;
    const searchToUse = newSearch !== undefined ? newSearch : searchQuery;
    
    if (pageToUse > 1) params.set('page', pageToUse.toString());
    if (sortToUse !== 'newest') params.set('sort', sortToUse);
    if (searchToUse) params.set('q', searchToUse);
    
    const queryString = params.toString();
    router.push(`/users${queryString ? '?' + queryString : ''}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateUrl(1, undefined, searchInput);
  };

  const getRankStyles = (rank: UserRank) => {
    switch (rank) {
      case 'owner':
        return 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0';
      case 'admin':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'moderator':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default:
        return 'bg-muted text-muted-foreground border-border/40';
    }
  };

  const getRankIcon = (rank: UserRank) => {
    if (rank === 'owner') return <Crown className="h-3 w-3" />;
    if (rank === 'admin' || rank === 'moderator') return <Shield className="h-3 w-3" />;
    return null;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Users</h1>
        <p className="text-muted-foreground">
          {totalUsers > 0 ? `${totalUsers.toLocaleString()} registered users` : 'Browse registered users'}
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search users..."
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary">Search</Button>
        </form>

        {/* Sort */}
        <Select value={sort} onValueChange={(value) => updateUrl(1, value, undefined)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest First</SelectItem>
            <SelectItem value="oldest">Oldest First</SelectItem>
            <SelectItem value="alphabetical">Username A-Z</SelectItem>
            <SelectItem value="alphabetical-reverse">Username Z-A</SelectItem>
            <SelectItem value="uploads">Most Uploads</SelectItem>
            <SelectItem value="uploads-asc">Least Uploads</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Clear search button */}
      {searchQuery && (
        <div className="mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearchInput('');
              updateUrl(1, undefined, '');
            }}
          >
            Clear search
          </Button>
        </div>
      )}

      {/* Users Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardContent className="p-6">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-20 w-20 rounded-full bg-muted animate-pulse" />
                  <div className="space-y-2 w-full">
                    <div className="h-4 bg-muted rounded animate-pulse" />
                    <div className="h-3 bg-muted rounded w-2/3 mx-auto animate-pulse" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
              <UserIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No users found</h3>
            <p className="text-muted-foreground">
              {searchQuery ? 'Try adjusting your search' : 'No users to display'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Users Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
            {users.map((user) => (
              <Link key={user._id} href={`/user/${encodeURIComponent(user.username.trim())}`}>
                <Card className="overflow-hidden hover:border-primary/50 transition-all group">
                  <CardContent className="p-6">
                    <div className="flex flex-col items-center gap-4">
                      {/* Avatar */}
                      <Avatar className="h-20 w-20 border-2 border-border group-hover:border-primary/50 transition-colors">
                        <AvatarImage src={user.avatarUrl} className="object-cover" />
                        <AvatarFallback className="text-2xl bg-muted">
                          {user.username[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      
                      {/* User Info */}
                      <div className="text-center space-y-2 w-full">
                        <div className="space-y-1">
                          <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                            {user.username}
                          </h3>
                          {user.rank && user.rank !== 'user' && (
                            <Badge className={cn("text-xs", getRankStyles(user.rank))}>
                              {getRankIcon(user.rank)}
                              <span className="ml-1">{user.rank}</span>
                            </Badge>
                          )}
                        </div>
                        
                        <div className="text-sm text-muted-foreground space-y-1">
                          <div>{user.uploadCount} uploads</div>
                          <div className="text-xs">
                            Joined {new Date(user.createdAt).toLocaleDateString('en-US', { 
                              month: 'short', 
                              year: 'numeric' 
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateUrl(Math.max(1, page - 1), undefined, undefined)}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <div className="flex items-center gap-1 px-2">
                <span className="text-sm text-muted-foreground">
                  Page <span className="font-medium text-foreground">{page}</span> of <span className="font-medium text-foreground">{totalPages}</span>
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateUrl(Math.min(totalPages, page + 1), undefined, undefined)}
                disabled={page === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function UsersPage() {
  return (
    <Suspense fallback={
      <div className="w-full h-screen flex items-center justify-center">
        <Loader2 className="animate-spin h-10 w-10 text-primary" />
      </div>
    }>
      <UsersPageContent />
    </Suspense>
  );
}
