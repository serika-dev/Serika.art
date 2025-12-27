import { ObjectId } from 'mongodb';

export type UserRank = 'user' | 'moderator' | 'admin' | 'owner';

export interface User {
  _id: ObjectId;
  username: string;
  email: string;
  avatarUrl?: string;
  rank: UserRank;
  createdAt: Date;
  updatedAt: Date;
}

export interface Tag {
  _id: ObjectId;
  name: string;
  type: 'general' | 'artist' | 'character' | 'copyright' | 'meta';
  count: number;
  createdAt: Date;
}

export interface Image {
  _id: ObjectId;
  sequentialId: number;
  userId: ObjectId;
  username: string;
  url: string;
  thumbnailUrl?: string;
  originalFilename: string;
  fileSize: number;
  width: number;
  height: number;
  contentType: string;
  tags: ObjectId[];
  rating: 'safe' | 'questionable' | 'explicit';
  isAIGenerated: boolean;
  source?: string;
  description?: string;
  upvotes: number;
  downvotes: number;
  favorites: number;
  views: number;
  createdAt: Date;
  updatedAt: Date;
  // Moderation fields
  deleted?: boolean;
  deletedAt?: Date;
  deletedBy?: ObjectId;
  deletedByUsername?: string;
  deletionReason?: string;
  deletionReversibleUntil?: Date;
  unlisted?: boolean;
  unlistedAt?: Date;
  unlistedBy?: ObjectId;
  unlistedByUsername?: string;
  unlistReason?: string;
  unlistReversibleUntil?: Date;
  restoredAt?: Date;
  restoredBy?: ObjectId;
  restoredByUsername?: string;
  dmcaRequestId?: ObjectId;
}

export interface Vote {
  _id: ObjectId;
  userId: ObjectId;
  imageId: ObjectId;
  type: 'upvote' | 'downvote';
  createdAt: Date;
}

export interface Favorite {
  _id: ObjectId;
  userId: ObjectId;
  imageId: ObjectId;
  createdAt: Date;
}

export interface Comment {
  _id: ObjectId;
  imageId: ObjectId;
  userId: ObjectId;
  username: string;
  avatarUrl?: string;
  rank?: UserRank;
  content: string;
  parentId?: ObjectId;
  asArtist?: boolean; // If user is commenting as verified artist
  artistTagId?: ObjectId; // Which artist tag they're commenting as
  createdAt: Date;
  updatedAt: Date;
}

export interface Artist {
  _id: ObjectId;
  tagId: ObjectId; // Reference to the artist tag
  tagName: string; // Cached tag name for display
  claimedByUserId?: ObjectId; // User who claimed this artist page
  claimedByUsername?: string; // Cached username
  verified: boolean;
  avatarUrl?: string;
  bannerUrl?: string;
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
  createdAt: Date;
  updatedAt: Date;
}

export type ArtistClaimStatus = 'pending' | 'approved' | 'rejected';

export interface ArtistClaim {
  _id: ObjectId;
  artistTagId: ObjectId;
  artistTagName: string;
  userId: ObjectId;
  username: string;
  userEmail: string;
  verificationWords: string[]; // 4 random words for verification
  verificationMethod: 'social' | 'website' | 'dm'; // How they plan to verify
  additionalInfo?: string;
  status: ArtistClaimStatus;
  reviewedBy?: ObjectId;
  reviewedByUsername?: string;
  reviewNotes?: string;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Artist Reviews
export interface ArtistReview {
  _id: ObjectId;
  artistTagId: ObjectId;
  artistTagName: string;
  userId: ObjectId;
  username: string;
  ratings: {
    trust: number; // 1-5
    quality: number; // 1-5
    communication: number; // 1-5
    pricing?: number; // 1-5, optional for commission artists
  };
  comment?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Artist Wiki
export interface ArtistWiki {
  _id: ObjectId;
  artistTagId: ObjectId;
  artistTagName: string;
  content: string; // Markdown content
  infobox?: {
    status?: string;
    specialties?: string[];
    tools?: string[];
    commissions?: 'open' | 'closed' | 'waitlist';
    priceRange?: string;
    languages?: string[];
    customFields?: { label: string; value: string }[];
  };
  lastEditedBy: ObjectId;
  lastEditedByUsername: string;
  editHistory: {
    userId: ObjectId;
    username: string;
    content: string;
    editedAt: Date;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

