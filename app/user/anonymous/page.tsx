'use client';

import { useState, useEffect } from 'react';
import { Image as ImageType } from '@/lib/models';
import ImageCard from '@/components/ImageCard';
import { Loader2, Calendar, User as UserIcon, Shield, ImageIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

export default function AnonymousUserPage() {
  const [images, setImages] = useState<ImageType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch anonymous user images - get all anonymous images
        const imagesRes = await fetch(`/api/images?userId=null&limit=1000`);
        const imagesData = await imagesRes.json();

        if (imagesData.success) {
          setImages(imagesData.images || []);
        } else {
          console.error('Failed to fetch images:', imagesData.error);
        }
      } catch (err: any) {
        console.error('Error fetching anonymous user images:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="animate-spin h-10 w-10 text-primary" />
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Banner */}
      <div className="relative h-48 md:h-64 w-full bg-gradient-to-r from-purple-500/20 via-pink-500/10 to-blue-500/20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Profile Header Card */}
        <div className="relative -mt-24 mb-8 z-10">
          <Card className="border-border/50">
            <CardContent className="p-6 md:p-8">
              <div className="flex flex-col md:flex-row gap-6 md:gap-8">
                {/* Avatar */}
                <Avatar className="h-40 w-40 md:h-48 md:w-48 border-4 border-background shadow-xl flex-shrink-0">
                  <AvatarFallback className="text-5xl bg-gradient-to-br from-muted to-muted/50 text-muted-foreground">
                    ?
                  </AvatarFallback>
                </Avatar>

                {/* User Info */}
                <div className="flex-1 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Anonymous</h1>
                      <Badge className="bg-muted text-muted-foreground border-border">
                        <Shield className="h-3.5 w-3.5 mr-1.5" />
                        SYSTEM
                      </Badge>
                    </div>
                    <p className="text-muted-foreground">
                      Posts uploaded without an account
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="flex flex-wrap gap-6 pt-4">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="h-5 w-5 text-primary" />
                      <div>
                        <div className="text-2xl font-bold">{images.length}</div>
                        <div className="text-sm text-muted-foreground">
                          {images.length === 1 ? 'Upload' : 'Uploads'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Uploads Section */}
        <div className="mb-8">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight mb-6">
            Anonymous Uploads
          </h2>

          {images.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-4">
                  <ImageIcon className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No uploads yet</h3>
                <p className="text-muted-foreground">
                  No content from anonymous users yet
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4 pb-8">
              {images.map((image) => (
                <ImageCard key={image._id?.toString() || image.url} image={image} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
