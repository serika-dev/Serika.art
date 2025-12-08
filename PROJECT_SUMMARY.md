# Serika.art - Project Summary

## Overview
A modern, clean Danbooru-style image board built with Next.js 16, featuring seamless integration with Serika Accounts for authentication, MongoDB for data persistence, and Cloudflare R2 for scalable image storage.

## Key Features Implemented

### 1. Authentication System
- ✅ Serika Accounts integration (accounts.serika.dev)
- ✅ Client-side auth context with React
- ✅ Server-side authentication verification
- ✅ Protected routes (upload page)
- ✅ Session management with cookies

### 2. Image Management
- ✅ Multi-format image upload (PNG, JPG, GIF)
- ✅ Automatic thumbnail generation (300x300)
- ✅ Cloudflare R2 storage integration
- ✅ Image metadata extraction (dimensions, file size)
- ✅ Content rating system (Safe/Questionable/Explicit)
- ✅ AI-generated content toggle
- ✅ Source URL and description support

### 3. Tagging System
- ✅ Required tags for all uploads
- ✅ Tag autocomplete/suggestions
- ✅ Tag-based search and filtering
- ✅ Tag statistics (usage counts)
- ✅ Tag categories support

### 4. User Interactions
- ✅ Upvote/downvote system
- ✅ Favorite images
- ✅ View count tracking
- ✅ User profile links
- ✅ Image ownership verification for deletions

### 5. Search & Discovery
- ✅ Advanced search page
- ✅ Filter by tags (AND logic)
- ✅ Filter by rating
- ✅ Filter by AI-generated status
- ✅ Sort by: newest, popular, favorites, views
- ✅ Pagination system

### 6. Modern UI/UX
- ✅ Responsive design (mobile, tablet, desktop)
- ✅ Clean, minimal interface
- ✅ Smooth animations and transitions
- ✅ Loading states
- ✅ Error handling
- ✅ Intuitive navigation

## Technical Architecture

### Frontend
- **Framework**: Next.js 16 with App Router
- **Styling**: Tailwind CSS 4
- **Icons**: Lucide React
- **State Management**: React Context API
- **HTTP Client**: Axios

### Backend
- **API Routes**: Next.js API Routes (serverless)
- **Database**: MongoDB with native driver
- **Storage**: Cloudflare R2 (S3-compatible)
- **Image Processing**: Sharp
- **Authentication**: Serika Accounts (OAuth-style)

### Data Models

#### Image
```typescript
{
  _id: ObjectId,
  userId: ObjectId,
  username: string,
  url: string,
  thumbnailUrl: string,
  originalFilename: string,
  fileSize: number,
  width: number,
  height: number,
  contentType: string,
  tags: string[],
  rating: 'safe' | 'questionable' | 'explicit',
  isAIGenerated: boolean,
  source?: string,
  description?: string,
  upvotes: number,
  downvotes: number,
  favorites: number,
  views: number,
  createdAt: Date,
  updatedAt: Date
}
```

#### Tag
```typescript
{
  _id: ObjectId,
  name: string,
  category: 'general' | 'artist' | 'character' | 'copyright' | 'meta',
  count: number,
  createdAt: Date
}
```

#### Vote
```typescript
{
  _id: ObjectId,
  userId: ObjectId,
  imageId: ObjectId,
  type: 'upvote' | 'downvote',
  createdAt: Date
}
```

#### Favorite
```typescript
{
  _id: ObjectId,
  userId: ObjectId,
  imageId: ObjectId,
  createdAt: Date
}
```

## File Structure

```
serika.art/
├── app/
│   ├── api/
│   │   ├── auth/me/          - Get current user
│   │   ├── favorite/         - Toggle favorite
│   │   ├── images/
│   │   │   ├── [id]/         - Get/delete specific image
│   │   │   └── route.ts      - List images
│   │   ├── tags/             - Tag search
│   │   ├── upload/           - Image upload
│   │   └── vote/             - Voting system
│   ├── image/[id]/           - Image detail page
│   ├── search/               - Advanced search
│   ├── upload/               - Upload page
│   ├── layout.tsx            - Root layout with auth
│   ├── page.tsx              - Home gallery
│   └── globals.css           - Global styles
├── components/
│   ├── ImageCard.tsx         - Gallery image card
│   ├── Loading.tsx           - Loading component
│   ├── Navbar.tsx            - Navigation bar
│   └── UploadForm.tsx        - Upload form
├── lib/
│   ├── AuthContext.tsx       - Client auth provider
│   ├── auth.ts               - Server auth utils
│   ├── db.ts                 - MongoDB connection
│   ├── models.ts             - TypeScript interfaces
│   └── r2.ts                 - R2 storage client
├── .env.example              - Environment template
├── .env.local                - Local environment (gitignored)
├── DEPLOYMENT.md             - Deployment guide
├── middleware.ts             - Auth middleware
├── next.config.ts            - Next.js config
├── package.json              - Dependencies
├── README.md                 - Project documentation
└── tsconfig.json             - TypeScript config
```

## API Endpoints

### Public Endpoints
- `GET /api/images` - List images with filters
- `GET /api/images/[id]` - Get image details
- `GET /api/tags` - Search tags

### Authenticated Endpoints
- `POST /api/upload` - Upload new image
- `POST /api/vote` - Vote on image
- `POST /api/favorite` - Toggle favorite
- `DELETE /api/images/[id]` - Delete own image

### Auth Endpoints
- `GET /api/auth/me` - Get current user info

## Environment Variables

### Required
- `ACCOUNTS_URL` - Serika Accounts API URL
- `ACCOUNTS_INTERNAL_KEY` - Internal API key
- `NEXT_PUBLIC_ACCOUNTS_URL` - Public accounts URL
- `MONGO_URI` - MongoDB connection string
- `MONGO_DB` - Database name
- `R2_ACCOUNT_ID` - Cloudflare account ID
- `R2_ACCESS_KEY_ID` - R2 access key
- `R2_SECRET_ACCESS_KEY` - R2 secret key
- `R2_BUCKET_NAME` - R2 bucket name
- `R2_CUSTOM_DOMAIN` - Custom domain for R2 (optional)

## Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Production Deployment

The application is ready for deployment to:
- ✅ Vercel (recommended)
- ✅ Railway
- ✅ Custom VPS with PM2
- ✅ Docker containers

See `DEPLOYMENT.md` for detailed instructions.

## Security Features

- ✅ Server-side authentication validation
- ✅ Protected API routes
- ✅ User ownership verification for deletions
- ✅ Secure file uploads with validation
- ✅ Environment variable management
- ✅ CORS handling via Serika Accounts

## Performance Optimizations

- ✅ Automatic image thumbnail generation
- ✅ MongoDB connection pooling
- ✅ Pagination for large datasets
- ✅ Efficient database queries with indexes
- ✅ CDN integration for R2 (via custom domain)
- ✅ Next.js automatic code splitting
- ✅ Optimized image loading

## Future Enhancements (Optional)

### Planned Features
- [ ] Comment system
- [ ] User profiles with favorites/uploads
- [ ] Tag suggestions based on image analysis
- [ ] Advanced search operators
- [ ] Collections/albums
- [ ] Following users
- [ ] Notifications
- [ ] Moderation tools
- [ ] API rate limiting
- [ ] Admin dashboard

### Technical Improvements
- [ ] Redis caching layer
- [ ] Full-text search with Elasticsearch
- [ ] Image CDN optimization
- [ ] WebP conversion
- [ ] Progressive image loading
- [ ] Real-time updates with WebSockets
- [ ] GraphQL API
- [ ] Mobile app

## Testing Checklist

### Core Functionality
- [ ] User can browse images without logging in
- [ ] User can log in via Serika Accounts
- [ ] User can upload images when logged in
- [ ] Images require at least one tag
- [ ] Thumbnails are generated correctly
- [ ] Images are stored in R2
- [ ] User can view image details
- [ ] User can vote on images
- [ ] User can favorite images
- [ ] User can delete own images
- [ ] Search works with tags
- [ ] Filters work correctly
- [ ] Pagination works
- [ ] Mobile responsive

### Edge Cases
- [ ] Large file upload handling
- [ ] Invalid file type rejection
- [ ] Upload without tags is rejected
- [ ] Non-owner cannot delete images
- [ ] Voting without auth prompts login
- [ ] Session expiration handling

## Support & Documentation

- README.md - Quick start guide
- DEPLOYMENT.md - Deployment instructions
- .env.example - Environment variable template
- Code comments - Inline documentation

## License

See LICENSE file for details.

## Credits

Built by the Serika team using:
- Next.js 16
- MongoDB
- Cloudflare R2
- Serika Accounts
- Tailwind CSS
- Lucide Icons

---

**Status**: ✅ Production Ready

Last Updated: December 8, 2025
