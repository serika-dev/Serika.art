# Getting Started Checklist

Use this checklist to ensure everything is properly configured before running Serika.art.

## Prerequisites

### 1. Development Environment
- [ ] Node.js 18+ installed
- [ ] npm or yarn installed
- [ ] Git installed
- [ ] Code editor (VS Code recommended)

### 2. External Services

#### MongoDB
- [ ] MongoDB instance running (local or Atlas)
- [ ] Connection string obtained
- [ ] Database created (or auto-create enabled)
- [ ] User has read/write permissions

#### Cloudflare R2
- [ ] R2 account created
- [ ] Bucket created
- [ ] Access credentials obtained:
  - [ ] Account ID
  - [ ] Access Key ID
  - [ ] Secret Access Key
- [ ] Custom domain configured (optional)

#### Serika Accounts
- [ ] Access to accounts.serika.dev
- [ ] Internal API key obtained
- [ ] OAuth redirect configured

## Installation Steps

### 1. Clone Repository
```bash
git clone https://github.com/your-username/serika-art.git
cd serika-art
```
- [ ] Repository cloned
- [ ] In project directory

### 2. Install Dependencies
```bash
npm install
```
- [ ] All dependencies installed
- [ ] No errors in installation

### 3. Configure Environment
```bash
cp .env.example .env.local
# Edit .env.local with your values
```
- [ ] `.env.local` created
- [ ] `ACCOUNTS_URL` set
- [ ] `ACCOUNTS_INTERNAL_KEY` set
- [ ] `NEXT_PUBLIC_ACCOUNTS_URL` set
- [ ] `MONGO_URI` set
- [ ] `MONGO_DB` set
- [ ] `R2_ACCOUNT_ID` set
- [ ] `R2_ACCESS_KEY_ID` set
- [ ] `R2_SECRET_ACCESS_KEY` set
- [ ] `R2_BUCKET_NAME` set
- [ ] `R2_CUSTOM_DOMAIN` set (optional)

### 4. Verify Configuration

#### Test MongoDB Connection
```bash
# Try connecting via MongoDB Compass or CLI
mongosh "your-connection-string"
```
- [ ] MongoDB connection successful
- [ ] Can list databases
- [ ] Database accessible

#### Test R2 Access
- [ ] Can access R2 dashboard
- [ ] Bucket is visible
- [ ] Can upload test file manually

#### Test Serika Accounts
- [ ] Can access accounts.serika.dev
- [ ] Can log in
- [ ] API key is valid

### 5. Run Development Server
```bash
npm run dev
```
- [ ] Server starts without errors
- [ ] Accessible at http://localhost:3000
- [ ] No console errors

## Functional Testing

### 6. Test Basic Features

#### Without Login
- [ ] Home page loads
- [ ] Can view images (if any exist)
- [ ] Can search
- [ ] Pagination works
- [ ] Image detail page loads

#### With Login
- [ ] Can click login button
- [ ] Redirected to Serika Accounts
- [ ] Can log in successfully
- [ ] Redirected back to site
- [ ] Username shows in navbar
- [ ] Upload button appears

#### Image Upload
- [ ] Upload page accessible
- [ ] Can select image file
- [ ] Preview shows
- [ ] Can add tags
- [ ] Can select rating
- [ ] Can toggle AI generated
- [ ] Upload succeeds
- [ ] Redirected to image page
- [ ] Image displays correctly
- [ ] Thumbnail generated

#### Image Interactions
- [ ] Can upvote
- [ ] Can downvote
- [ ] Can favorite
- [ ] View count increments
- [ ] Can view image details
- [ ] Can download image
- [ ] Can delete own image

#### Search & Filtering
- [ ] Keyword search works
- [ ] Tag filter works
- [ ] Rating filter works
- [ ] AI filter works
- [ ] Sort options work

## Troubleshooting

### Common Issues

#### "Cannot connect to MongoDB"
- [ ] Check MONGO_URI format
- [ ] Verify MongoDB is running
- [ ] Check firewall/network settings
- [ ] Verify credentials

#### "Failed to upload to R2"
- [ ] Verify R2 credentials
- [ ] Check bucket name
- [ ] Verify account ID
- [ ] Check CORS settings

#### "Authentication failed"
- [ ] Verify ACCOUNTS_URL is correct
- [ ] Check ACCOUNTS_INTERNAL_KEY
- [ ] Ensure Serika Accounts is accessible
- [ ] Check for CORS issues

#### "Module not found" errors
- [ ] Run `npm install` again
- [ ] Delete node_modules and reinstall
- [ ] Check Node.js version (18+)
- [ ] Clear npm cache: `npm cache clean --force`

#### Port already in use
```bash
# Windows: Find and kill process on port 3000
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Or use different port
npm run dev -- -p 3001
```

## Production Checklist

When ready to deploy:

- [ ] All tests passing locally
- [ ] Environment variables documented
- [ ] Production MongoDB configured
- [ ] Production R2 bucket configured
- [ ] SSL/TLS certificates ready
- [ ] Domain configured
- [ ] Backup strategy in place
- [ ] Monitoring set up
- [ ] Error tracking configured
- [ ] Build succeeds: `npm run build`
- [ ] Production server starts: `npm start`
- [ ] All features work in production build

## Support

If you encounter issues:

1. Check this checklist
2. Review README.md
3. Check DEPLOYMENT.md
4. Review PROJECT_SUMMARY.md
5. Check console for errors
6. Review server logs
7. Open GitHub issue if needed

## Quick Start Commands

```bash
# Setup (first time)
./setup.ps1  # Windows PowerShell

# Or manually:
npm install
cp .env.example .env.local
# Edit .env.local
npm run dev

# Development
npm run dev          # Start dev server
npm run build        # Build for production
npm start            # Start production server
npm run lint         # Run linter

# Deployment
vercel               # Deploy to Vercel
# or
docker-compose up    # Deploy with Docker
```

## Notes

- Development server runs on http://localhost:3000
- API routes are at http://localhost:3000/api/*
- Hot reload enabled in development
- TypeScript type checking automatic
- ESLint configured for code quality

---

✅ **All checks passed?** You're ready to start developing!

🚀 **Run**: `npm run dev` and visit http://localhost:3000
