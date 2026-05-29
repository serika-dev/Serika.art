export type UserRank = 'user' | 'moderator' | 'admin' | 'owner';

export interface User {
  _id?: any;
  id: string;
  username: string;
  email: string;
  avatar_url?: string;
  avatarUrl?: string;
  rank: UserRank;
  created_at: Date;
  createdAt?: Date;
  updated_at: Date;
  updatedAt?: Date;
}

export interface Tag {
  _id?: any;
  id: number;
  name: string;
  type: 'general' | 'artist' | 'character' | 'copyright' | 'meta';
  count: number;
  created_at: Date;
  createdAt?: Date;
}

export interface Image {
  _id?: any;
  id: number;
  sequential_id: number;
  sequentialId?: number;
  user_id: string | null;
  userId?: string | null;
  username: string;
  url: string;
  thumbnail_url?: string;
  thumbnailUrl?: string;
  original_filename: string;
  originalFilename?: string;
  file_size: number;
  fileSize?: number;
  width: number;
  height: number;
  content_type: string;
  contentType?: string;
  rating: 'safe' | 'questionable' | 'explicit';
  is_ai_generated: boolean;
  isAIGenerated?: boolean;
  source?: string;
  description?: string;
  upvotes: number;
  downvotes: number;
  favorites: number;
  views: number;
  created_at: Date;
  createdAt?: Date;
  updated_at: Date;
  updatedAt?: Date;
  // Moderation fields
  deleted?: boolean;
  deleted_at?: Date;
  deleted_by?: string;
  deleted_by_username?: string;
  deletion_reason?: string;
  deletion_reversible_until?: Date;
  unlisted?: boolean;
  unlisted_at?: Date;
  unlisted_by?: string;
  unlisted_by_username?: string;
  unlist_reason?: string;
  unlist_reversible_until?: Date;
  restored_at?: Date;
  restored_by?: string;
  restored_by_username?: string;
  dmca_request_id?: number;
  // Populated fields (from joins)
  tags?: PopulatedTag[];
}

export interface PopulatedTag {
  _id?: any;
  id: number;
  name: string;
  type: string;
  count?: number;
}

export interface Vote {
  id: number;
  user_id: string;
  image_id: number;
  type: 'upvote' | 'downvote';
  created_at: Date;
}

export interface Favorite {
  id: number;
  user_id: string;
  image_id: number;
  created_at: Date;
}

export interface Comment {
  _id?: any;
  id: number;
  image_id: number;
  user_id: string;
  userId?: string;
  username: string;
  avatar_url?: string;
  avatarUrl?: string;
  rank?: UserRank;
  content: string;
  parent_id?: number;
  parentId?: any;
  as_artist?: boolean;
  asArtist?: boolean;
  artist_tag_id?: number;
  artistTagId?: number;
  created_at: Date;
  createdAt?: any;
  updated_at: Date;
  updatedAt?: any;
}

export interface Artist {
  id: number;
  tag_id: number;
  tag_name: string;
  claimed_by_user_id?: string;
  claimed_by_username?: string;
  verified: boolean;
  avatar_url?: string;
  banner_url?: string;
  bio?: string;
  socials: {
    twitter?: string;
    bluesky?: string;
    youtube?: string;
    pixiv?: string;
    deviantart?: string;
    artstation?: string;
    patreon?: string;
    linktree?: string;
    carrd?: string;
    website?: string;
  };
  created_at: Date;
  updated_at: Date;
}

export type ArtistClaimStatus = 'pending' | 'approved' | 'rejected';

export interface ArtistClaim {
  id: number;
  artist_tag_id: number;
  artist_tag_name: string;
  user_id: string;
  username: string;
  user_email: string;
  verification_words: string[];
  verification_method: 'social' | 'website' | 'dm';
  additional_info?: string;
  proof_file_url?: string;
  status: ArtistClaimStatus;
  reviewed_by?: string;
  reviewed_by_username?: string;
  review_notes?: string;
  reviewed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ArtistReview {
  id: number;
  artist_tag_id: number;
  artist_tag_name: string;
  user_id: string;
  username: string;
  ratings: {
    trust: number;
    quality: number;
    communication: number;
    pricing?: number;
  };
  comment?: string;
  created_at: Date;
  updated_at: Date;
}

export interface ArtistWiki {
  id: number;
  artist_tag_id: number;
  artist_tag_name: string;
  content: string;
  infobox?: {
    status?: string;
    specialties?: string[];
    tools?: string[];
    commissions?: 'open' | 'closed' | 'waitlist';
    priceRange?: string;
    languages?: string[];
    customFields?: { label: string; value: string }[];
  };
  last_edited_by: string;
  last_edited_by_username: string;
  edit_history: {
    userId: string;
    username: string;
    content: string;
    editedAt: Date;
  }[];
  created_at: Date;
  updated_at: Date;
}

export interface ApiKey {
  id: number;
  user_id: string;
  username: string;
  name: string;
  key_hash: string;
  permissions: string[];
  rate_limit: number;
  usage_count: number;
  last_used_at?: Date;
  expires_at?: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ImportJob {
  id: number;
  type: 'artist' | 'tags' | 'single';
  query: string;
  limit: number;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  progress: {
    current: number;
    total: number;
    successful: number;
    failed: number;
    skipped: number;
  };
  post_ids?: number[];
  current_post_index?: number;
  error?: string;
  created_by?: string;
  started_at?: Date;
  completed_at?: Date;
  created_at: Date;
}
