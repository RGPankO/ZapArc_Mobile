# Mobile App Skeleton

Cross-platform mobile app skeleton with React Native (Expo) frontend and NestJS backend. Full authentication, user management, payments, and ads ready for white-label development.

## Features

- **Authentication:** Email/password + Google OAuth, JWT tokens, email verification
- **User Management:** Profile editing, password change, account deletion
- **Premium Subscriptions:** Subscription and one-time payment support
- **Ads Integration:** Banner and interstitial ads with analytics
- **Cross-Platform:** iOS, Android, and Web support

## Project Structure

```
├── backend/                      # NestJS API
│   ├── src/
│   │   ├── modules/
│   │   │   ├── auth/             # Authentication & authorization
│   │   │   ├── user/             # User management
│   │   │   ├── payments/         # Premium subscriptions
│   │   │   ├── ads/              # Ad configuration & analytics
│   │   │   ├── email/            # Email service (Resend)
│   │   │   ├── prisma/           # Database client
│   │   │   ├── scheduler/        # Cron jobs
│   │   │   └── utility/          # Filters, pipes, global config
│   │   ├── decorators/           # Custom decorators (@GetUser)
│   │   ├── config/               # App configuration
│   │   └── main.ts               # Application entry
│   └── prisma/                   # Database schema & migrations
│
├── mobile-app/                   # React Native Expo app
│   ├── app/                      # Screens (Expo Router)
│   │   ├── (auth)/               # Auth screens (welcome, login, register)
│   │   ├── (main)/               # Main app screens
│   │   └── _layout.tsx           # Root layout
│   └── src/
│       ├── features/
│       │   ├── auth/             # Authentication screens
│       │   ├── profile/          # User profile & settings
│       │   ├── payments/         # Premium subscription
│       │   ├── ads/              # Ad components
│       │   └── home/             # Home screen
│       ├── hooks/                # Global hooks (useAuth, useUser)
│       ├── components/           # Shared components
│       ├── services/             # Token service
│       ├── lib/                  # API client, query client
│       ├── config/               # Network configuration
│       ├── types/                # TypeScript definitions
│       └── utils/                # Utilities
```

## Quick Start

### Prerequisites
- Node.js 18+
- Docker (for PostgreSQL database)
- Expo Go app (for mobile testing)

### Native Development (iOS Simulator / Android Emulator)

For local native builds without EAS cloud services, see **[docs/LOCAL_DEVELOPMENT.md](docs/LOCAL_DEVELOPMENT.md)** which covers:
- iOS: Xcode, CocoaPods, Simulator setup
- Android: Android Studio, SDK, Emulator setup  
- Appium: Automated UI testing / AI agent integration

### Setup

```bash
# Clone repository
git clone https://github.com/xAleksandar/mobile-skeleton-app.git
cd mobile-skeleton-app

# Run setup script (starts Docker, installs deps, seeds database)
./setup.sh            # macOS/Linux
setup.bat             # Windows

# Or manual setup:
docker-compose up -d  # Start PostgreSQL
cd backend && npm install && cp .env.example .env && npm run db:setup
cd ../mobile-app && npm install
```

**Start development:**
```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Mobile
cd mobile-app && npm start   # Press 'w' for web, scan QR for Expo Go
```

### Test Credentials
- `test@example.com` / `testpassword123`
- `premium@example.com` / `testpassword123`

## Configuration

### Backend (.env)

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/mobile_app
JWT_SECRET=your-secret
JWT_REFRESH_SECRET=your-refresh-secret
RESEND_API_KEY=re_...
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
```

### Mobile (src/config/network.ts)

For physical device testing, update `CURRENT_NETWORK_IP` with your local IP:

```typescript
const CURRENT_NETWORK_IP = '192.168.1.100';
```

### Google OAuth Setup

1. Create project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable Google Sign-In API
3. Create OAuth 2.0 credentials (Web, Android, iOS)
4. Add `GOOGLE_CLIENT_ID` to backend `.env`
5. Configure `webClientId` in mobile app

## Tech Stack

### Backend
- **NestJS** - Framework
- **Prisma** - ORM with PostgreSQL
- **Passport JWT** - Authentication
- **Resend** - Email service

### Mobile
- **React Native + Expo** - Framework
- **Expo Router** - Navigation
- **TanStack Query** - Data fetching
- **React Native Paper** - UI components

## Scripts

### Backend
```bash
npm run dev           # Development server
npm run build         # Production build
npm test              # Run tests
npm run db:setup      # Setup database
npm run db:studio     # Open Prisma Studio
```

### Mobile
```bash
npm start             # Expo dev server
npm run ios           # iOS simulator
npm run android       # Android emulator
npm run web           # Web browser
npm test              # Run tests
```

## Troubleshooting

**Backend not starting:** Check `DATABASE_URL` and ensure PostgreSQL is running

**Mobile network errors:** Update `CURRENT_NETWORK_IP` in `mobile-app/src/config/network.ts`

**Database issues:** Run `npm run db:setup` in backend

**Metro bundler:** Clear cache with `npx expo start --clear`

## License

MIT
