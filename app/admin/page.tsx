'use client';

import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import { Tags, Upload, Users, Settings, AlertCircle } from 'lucide-react';

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || (user.rank !== 'admin' && user.rank !== 'owner'))) {
      router.push('/posts');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user || (user.rank !== 'admin' && user.rank !== 'owner')) {
    return null;
  }

  const adminOptions = [
    {
      title: 'Manage Tags',
      description: 'Create, edit, and organize tags across the site',
      icon: Tags,
      href: '/admin/tags',
      color: 'from-blue-600 to-blue-700',
    },
    {
      title: 'Import from Danbooru',
      description: 'Bulk import posts from Danbooru with automatic tagging',
      icon: Upload,
      href: '/admin/import',
      color: 'from-green-600 to-green-700',
    },
    {
      title: 'Manage Users',
      description: 'View and manage user accounts and permissions',
      icon: Users,
      href: '/admin/users',
      color: 'from-purple-600 to-purple-700',
    },
  ];

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-white mb-2">Admin Panel</h1>
          <p className="text-zinc-400">Manage and configure Serika.art</p>
        </div>

        {/* Admin Options Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {adminOptions.map((option) => {
            const Icon = option.icon;
            return (
              <Link key={option.href} href={option.href}>
                <div className="group h-full bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition cursor-pointer hover:shadow-xl hover:shadow-black/50">
                  {/* Gradient Background */}
                  <div className={`h-24 bg-gradient-to-r ${option.color} opacity-20 group-hover:opacity-30 transition`}></div>

                  {/* Content */}
                  <div className="px-6 py-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`p-3 rounded-lg bg-gradient-to-r ${option.color} text-white`}>
                        <Icon size={24} />
                      </div>
                      <h2 className="text-xl font-bold text-white">{option.title}</h2>
                    </div>
                    <p className="text-zinc-400 text-sm">{option.description}</p>

                    {/* Arrow */}
                    <div className="mt-4 text-blue-400 group-hover:translate-x-1 transition">
                      →
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Info Section */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <div className="flex gap-4">
            <AlertCircle size={24} className="text-blue-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-white font-bold mb-2">Admin Information</h3>
              <p className="text-zinc-400 text-sm">
                You have full access to all admin features. Be careful when making changes as they affect all users and content on the platform.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
