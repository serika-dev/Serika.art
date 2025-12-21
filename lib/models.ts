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
  createdAt: Date;
  updatedAt: Date;
}

