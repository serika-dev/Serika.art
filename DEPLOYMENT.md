# Deployment Guide for Serika.art

## Prerequisites

Before deploying, ensure you have:

1. **MongoDB Database**
   - Production MongoDB instance
   - Database name: `serika-art`
   - Collections will be auto-created

2. **Cloudflare R2 Bucket**
   - Account ID
   - Access Key ID
   - Secret Access Key
   - Bucket name
   - Custom domain (optional)

3. **Serika Accounts Access**
   - Accounts URL: `https://accounts.serika.dev`
   - Internal API key

## Environment Setup

### Production Environment Variables

Create these environment variables in your hosting platform:

```env
# Serika Accounts
ACCOUNTS_URL=https://accounts.serika.dev
ACCOUNTS_INTERNAL_KEY=your-production-internal-key
NEXT_PUBLIC_ACCOUNTS_URL=https://accounts.serika.dev

# MongoDB
MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/
MONGO_DB=serika-art

# Cloudflare R2
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET_NAME=serika-art-images
R2_CUSTOM_DOMAIN=cdn.serika.art
```

## Deploy to Vercel

1. **Install Vercel CLI** (optional)
   ```bash
   npm i -g vercel
   ```

2. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

3. **Deploy via Vercel Dashboard**
   - Go to [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Configure environment variables
   - Deploy!

4. **Or deploy via CLI**
   ```bash
   vercel --prod
   ```

## Deploy to Railway

1. **Create Railway Project**
   - Go to [railway.app](https://railway.app)
   - Create new project from GitHub repo

2. **Add Environment Variables**
   - Add all required environment variables in Railway dashboard

3. **Deploy**
   - Railway will automatically deploy on push to main branch

## Deploy to Custom VPS

### Using PM2

1. **Install Node.js 18+**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **Clone Repository**
   ```bash
   git clone https://github.com/your-username/serika-art.git
   cd serika-art
   ```

3. **Install Dependencies**
   ```bash
   npm install
   ```

4. **Create .env.local**
   ```bash
   cp .env.example .env.local
   nano .env.local  # Edit with your values
   ```

5. **Build**
   ```bash
   npm run build
   ```

6. **Install PM2**
   ```bash
   npm install -g pm2
   ```

7. **Start Application**
   ```bash
   pm2 start npm --name "serika-art" -- start
   pm2 save
   pm2 startup
   ```

8. **Setup Nginx Reverse Proxy**
   ```nginx
   server {
       listen 80;
       server_name serika.art;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

9. **SSL with Certbot**
   ```bash
   sudo certbot --nginx -d serika.art
   ```

## Docker Deployment

1. **Create Dockerfile**
   ```dockerfile
   FROM node:18-alpine

   WORKDIR /app

   COPY package*.json ./
   RUN npm ci

   COPY . .
   RUN npm run build

   EXPOSE 3000

   CMD ["npm", "start"]
   ```

2. **Create docker-compose.yml**
   ```yaml
   version: '3.8'
   services:
     app:
       build: .
       ports:
         - "3000:3000"
       env_file:
         - .env.local
       restart: unless-stopped
   ```

3. **Build and Run**
   ```bash
   docker-compose up -d
   ```

## Post-Deployment Checklist

- [ ] Verify all environment variables are set
- [ ] Test image upload functionality
- [ ] Test authentication with Serika Accounts
- [ ] Verify MongoDB connection
- [ ] Test R2 image storage
- [ ] Check SSL certificate
- [ ] Configure CDN/caching (optional)
- [ ] Set up monitoring (optional)
- [ ] Configure backups for MongoDB

## Monitoring

### Recommended Tools

- **Uptime**: UptimeRobot, Pingdom
- **Error Tracking**: Sentry
- **Analytics**: Vercel Analytics, Google Analytics
- **Performance**: New Relic, Datadog

## Scaling Considerations

### Database
- Use MongoDB Atlas with auto-scaling
- Enable connection pooling
- Add database indexes for tags and userId

### Storage
- R2 automatically scales
- Use custom domain for better performance
- Enable browser caching

### Application
- Use Vercel Edge Functions for API routes
- Enable ISR (Incremental Static Regeneration) where possible
- Add Redis for caching (optional)

## Troubleshooting

### Images not uploading
- Check R2 credentials
- Verify bucket permissions
- Check file size limits

### Authentication failing
- Verify ACCOUNTS_URL and ACCOUNTS_INTERNAL_KEY
- Check CORS settings

### Database connection errors
- Verify MONGO_URI format
- Check IP whitelist in MongoDB Atlas
- Ensure database name is correct

## Support

For deployment issues, check:
- [Next.js Deployment Docs](https://nextjs.org/docs/deployment)
- [Vercel Documentation](https://vercel.com/docs)
- GitHub Issues

## Security Recommendations

1. **Use strong secrets** for all API keys
2. **Enable rate limiting** for API endpoints
3. **Configure CORS** properly
4. **Use HTTPS** everywhere
5. **Keep dependencies updated**
6. **Monitor logs** for suspicious activity
7. **Implement backup strategy**

## Maintenance

### Regular Tasks
- Update dependencies monthly
- Monitor disk space
- Review logs weekly
- Backup database daily
- Check SSL certificate expiry

### Updates
```bash
# Pull latest changes
git pull origin main

# Install dependencies
npm install

# Build
npm run build

# Restart (PM2)
pm2 restart serika-art

# Or restart (Docker)
docker-compose restart
```
