# Serika.art - Modern Image Board

A clean, modern Danbooru-style image board built with Next.js 16, featuring user authentication via Serika Accounts, MongoDB for data storage, and Cloudflare R2 for image hosting.

## Features

- 🎨 **Modern UI** - Clean, responsive design with Tailwind CSS
- 🔐 **Authentication** - Integrated with Serika Accounts (accounts.serika.dev)
- 📤 **Image Upload** - Support for images with proper tagging system
- 🤖 **AI Toggle** - Mark and filter AI-generated content
- 🏷️ **Tagging System** - Comprehensive tag-based organization
- ⭐ **Interactions** - Upvote, downvote, and favorite images
- 🔍 **Advanced Search** - Filter by tags, rating, AI status
- 📊 **Statistics** - View counts, ratings, and engagement metrics
- 🎯 **Content Rating** - Safe, Questionable, and Explicit ratings

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS
- **Database**: MongoDB
- **Storage**: Cloudflare R2
- **Authentication**: Serika Accounts
- **Image Processing**: Sharp
- **Icons**: Lucide React

## Environment Variables

Required environment variables (see `.env.example`):

```env
# Serika Accounts
ACCOUNTS_URL=https://accounts.serika.dev
ACCOUNTS_INTERNAL_KEY=your-internal-key
NEXT_PUBLIC_ACCOUNTS_URL=https://accounts.serika.dev

# MongoDB
MONGO_URI=mongodb://localhost:27017
MONGO_DB=serika-art

# Cloudflare R2
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET_NAME=serika-art-images
R2_CUSTOM_DOMAIN=cdn.serika.art
```

## Getting Started

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment**
   - Copy `.env.example` to `.env.local`
   - Fill in your credentials

3. **Run development server**
   ```bash
   npm run dev
   ```

4. **Open browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
app/
├── api/              # API routes
├── image/[id]/       # Image detail page
├── search/           # Search page
├── upload/           # Upload page
└── page.tsx          # Gallery home

components/
├── Navbar.tsx        # Navigation
├── ImageCard.tsx     # Image cards
└── UploadForm.tsx    # Upload form

lib/
├── db.ts             # MongoDB
├── r2.ts             # Cloudflare R2
├── auth.ts           # Authentication
├── models.ts         # Data models
└── AuthContext.tsx   # Auth provider
```

## Key Features

### Upload System
- Multi-format support (PNG, JPG, GIF)
- Automatic thumbnail generation
- Required tagging with auto-suggest
- Content rating (Safe/Questionable/Explicit)
- AI-generated toggle
- Optional source and description

### Search & Filtering
- Keyword search
- Tag-based filtering
- Rating filters
- AI content filter
- Sort by: newest, popular, favorites, views

### User Interactions
- Upvote/downvote system
- Favorite images
- View tracking
- User profiles

## API Endpoints

- `GET /api/images` - List images
- `GET /api/images/[id]` - Get image
- `POST /api/upload` - Upload image
- `POST /api/vote` - Vote on image
- `POST /api/favorite` - Toggle favorite
- `GET /api/tags` - Search tags

## Troubleshooting

### R2 Upload SSL/TLS Errors

If you encounter `EPROTO` or SSL handshake failures when uploading to R2:

1. **Check R2 Credentials**
   - Verify `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` are correct
   - Ensure your R2 bucket exists and is properly configured

2. **Network Issues**
   - Check if your network/firewall is blocking Cloudflare R2
   - Try disabling VPN if you're using one
   - Ensure you have a stable internet connection

3. **Node.js Version**
   - Use Node.js 18+ for better TLS support
   - Update to the latest LTS version if issues persist

4. **R2 Bucket Configuration**
   - Make sure your R2 bucket has proper CORS settings
   - Verify public access is enabled if using custom domain
   - Check bucket permissions for your access key

5. **Alternative: Local Storage**
   - For development, you can temporarily modify `lib/r2.ts` to save files locally

### MongoDB Connection Issues

If MongoDB fails to connect:

1. Ensure MongoDB is running: `mongod` or your MongoDB service
2. Check `MONGO_URI` is correct (default: `mongodb://localhost:27017`)
3. Verify `MONGO_DB` database name is set

### Serika Accounts Integration

If authentication fails:

1. Ensure Serika Accounts is running at the URL specified in `ACCOUNTS_URL`
2. Verify `ACCOUNTS_INTERNAL_KEY` matches your Serika Accounts configuration
3. Check that the service key is registered in Serika Accounts

## Development Tips

- Use `bun dev` or `npm run dev` for hot reloading
- Check browser console and terminal logs for errors
- MongoDB data persists between restarts
- Clear cookies if authentication seems stuck

## Deployment

Deploy to Vercel, Netlify, or any Node.js host:

1. Set environment variables in your hosting platform
2. Build: `npm run build` or `bun build`
3. Deploy or start: `npm start`

## License

See LICENSE file for details.
