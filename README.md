<div align="center">

# 🎨 Serika.art

**A modern, feature-rich image board platform**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-green?style=for-the-badge&logo=mongodb)](https://www.mongodb.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)

[Live Site](https://serika.art) • [Android App](https://serika.art/android-app) • [API Docs](https://serika.art/api-docs) • [Contact](https://serika.art/contact)

</div>

---

## ✨ Overview

Serika.art is a clean, modern Danbooru-style image board built from the ground up with Next.js 16. It features a beautiful responsive UI, comprehensive tagging system, user authentication via Serika Accounts, and a native Android app for mobile users.

<div align="center">

| 🖼️ Gallery | 🔍 Search | 📱 Mobile |
|:---:|:---:|:---:|
| Browse thousands of curated images | Powerful tag-based filtering | Native Android app available |

</div>

---

## 🚀 Features

### Core Platform
| Feature | Description |
|---------|-------------|
| 🎨 **Modern UI** | Beautiful, responsive design with dark mode and smooth animations |
| 🔐 **Authentication** | Secure login via Serika Accounts (accounts.serika.dev) |
| 📤 **Image Upload** | Drag-and-drop upload with automatic thumbnail generation |
| 🏷️ **Smart Tagging** | Comprehensive tag system with auto-suggestions and categories |
| 🔍 **Advanced Search** | Filter by tags, rating, AI status, date, and more |
| ⭐ **Interactions** | Upvote, downvote, favorite, and comment on images |
| 👤 **User Profiles** | Customizable profiles with upload history and favorites |
| 🤖 **AI Detection** | Mark and filter AI-generated content |

### Content Management
- **Rating System** — Safe, Questionable, and Explicit content ratings
- **Artist Pages** — Dedicated pages for artists with their full portfolio
- **Tag Wiki** — Community-maintained tag descriptions and guidelines
- **DMCA Handling** — Built-in copyright claim processing system
- **Moderation Tools** — Admin panel for content moderation and user management

### API & Integration
- **RESTful API** — Full API access for third-party integrations
- **API Keys** — Generate personal API keys for programmatic access
- **Danbooru Import** — Import metadata and images from Danbooru
- **Webhook Support** — Receive notifications for uploads and interactions

---

## 📱 Android App

A native Android app is available for mobile users:

- **[Download APK](https://serika.art/android-app)** — Get the latest release
- Built with Kotlin & Jetpack Compose
- Material You design language
- Offline favorites support
- Push notifications

---

## 🛠️ Tech Stack

<table>
<tr>
<td>

### Frontend
- **Next.js 16** — App Router & Server Components
- **React 19** — UI library
- **Tailwind CSS** — Utility-first styling
- **Framer Motion** — Animations
- **Lucide React** — Icon set

</td>
<td>

### Backend
- **MongoDB** — Document database
- **Cloudflare R2** — Image storage & CDN
- **Sharp** — Image processing
- **Serika Accounts** — Authentication service

</td>
</tr>
</table>

---

## 📋 Prerequisites

- **Node.js** 18+ or **Bun** 1.0+
- **MongoDB** 6.0+ (local or Atlas)
- **Cloudflare R2** bucket (or compatible S3 storage)
- **Serika Accounts** instance for authentication

---

## ⚡ Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/serika-dev/Serika.art.git
cd Serika.art
npm install  # or: bun install
```

### 2. Configure Environment

Create `.env.local` with your credentials:

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
R2_ACCESS_KEY_ID=your-access-key
R2_SECRET_ACCESS_KEY=your-secret-key
R2_BUCKET_NAME=serika-art
R2_CUSTOM_DOMAIN=cdn.yourdomain.com
```

### 3. Run Development Server

```bash
npm run dev  # or: bun dev
```

Open [http://localhost:3000](http://localhost:3000) 🎉

---

## 📁 Project Structure

```
serika.art/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── images/        # Image CRUD operations
│   │   ├── upload/        # File upload handling
│   │   ├── tags/          # Tag management
│   │   ├── vote/          # Voting system
│   │   └── ...
│   ├── image/[id]/        # Image detail page
│   ├── artist/[tagName]/  # Artist portfolio page
│   ├── tags/              # Tag browser
│   ├── upload/            # Upload form
│   ├── admin/             # Admin dashboard
│   └── ...
│
├── components/            # React components
│   ├── ui/               # Shadcn/ui components
│   ├── Navbar.tsx        # Navigation bar
│   ├── ImageCard.tsx     # Image grid cards
│   └── ...
│
├── lib/                   # Utilities & services
│   ├── db.ts             # MongoDB connection
│   ├── r2.ts             # Cloudflare R2 client
│   ├── auth.ts           # Authentication helpers
│   └── models.ts         # TypeScript interfaces
│
├── android/              # Native Android app
│   └── ...               # Kotlin + Jetpack Compose
│
└── public/               # Static assets
```

---

## 🔌 API Reference

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/images` | List images with pagination & filters |
| `GET` | `/api/images/[id]` | Get single image details |
| `GET` | `/api/tags` | Search and list tags |
| `GET` | `/api/artists` | List artists |

### Authenticated Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/upload` | Upload new image |
| `POST` | `/api/vote` | Vote on an image |
| `POST` | `/api/favorite` | Toggle favorite status |
| `GET` | `/api/users/[id]/favorites` | Get user's favorites |

> 📖 Full API documentation available at [serika.art/api-docs](https://serika.art/api-docs)

---

## 🚀 Deployment

### Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/serika-dev/Serika.art)

1. Click the button above or import from GitHub
2. Configure environment variables
3. Deploy!

### Self-Hosted

```bash
# Build
npm run build

# Start production server
npm start

# Or with PM2
pm2 start npm --name "serika-art" -- start
```

### Docker

```bash
docker build -t serika-art .
docker run -p 3000:3000 --env-file .env serika-art
```

---

## 🔧 Troubleshooting

<details>
<summary><strong>R2 Upload SSL/TLS Errors</strong></summary>

If you encounter `EPROTO` or SSL handshake failures:
- Verify R2 credentials are correct
- Use Node.js 18+ for better TLS support
- Check firewall/VPN isn't blocking Cloudflare
- Ensure R2 bucket has proper CORS settings

</details>

<details>
<summary><strong>MongoDB Connection Issues</strong></summary>

- Ensure MongoDB is running: `systemctl status mongod`
- Verify `MONGO_URI` format: `mongodb://localhost:27017`
- Check database user permissions if using authentication

</details>

<details>
<summary><strong>Authentication Problems</strong></summary>

- Verify Serika Accounts is accessible at `ACCOUNTS_URL`
- Ensure `ACCOUNTS_INTERNAL_KEY` matches your configuration
- Clear browser cookies and try logging in again

</details>

---

## 🤝 Contributing

While this project uses a source-available license that restricts commercial use, we welcome:

- 🐛 Bug reports and feature requests via [Issues](https://github.com/serika-dev/Serika.art/issues)
- 📝 Documentation improvements
- 🌐 Translation contributions

Please read the [LICENSE](LICENSE) carefully before contributing.

---

## 📄 License

**Source Available — All Rights Reserved**

This software is provided for **viewing and educational purposes only**. You may:
- ✅ View and study the source code
- ✅ Fork for personal, non-commercial experimentation
- ✅ Submit bug reports and suggestions

You may **NOT**:
- ❌ Use this software for commercial purposes
- ❌ Deploy this software publicly or privately without permission
- ❌ Redistribute or sublicense this software
- ❌ Create derivative works for distribution

See the full [LICENSE](LICENSE) file for complete terms.

---

<div align="center">

**Built with ❤️ by the Serika team**

[Website](https://serika.art) • [Twitter](https://twitter.com/serikaart) • [Discord](https://discord.gg/serika)

</div>
