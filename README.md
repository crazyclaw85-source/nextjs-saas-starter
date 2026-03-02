# Next.js SaaS Starter Template

A comprehensive SaaS boilerplate built with Next.js 15, featuring authentication, subscriptions, teams, and multi-tenancy.

## Stack

- **Frontend**: Next.js 15 App Router, TypeScript, Tailwind CSS, shadcn/ui
- **Auth**: Clerk Authentication with organizations
- **Database**: PostgreSQL with Drizzle ORM
- **Payments**: Paddle integration (checkout, webhooks, customer portal)
- **API**: tRPC for type-safe APIs
- **Rate Limiting**: Upstash Redis
- **Deployment**: Vercel with CI/CD

## Features

### ✅ Core SaaS Features
- [x] User authentication (sign up, sign in, profile management)
- [x] Organization/team management with roles (owner, admin, member)
- [x] Subscription management with Paddle
- [x] Multi-tenancy (org-scoped data isolation)
- [x] Member invitations via email
- [x] Dashboard with sidebar navigation
- [x] Onboarding flow for new users
- [x] Rate limiting and usage metering
- [x] Admin panel functionality

### ✅ Technical Features
- [x] TypeScript strict mode
- [x] Database migrations with Drizzle
- [x] Webhook handlers for Paddle events
- [x] API routes with tRPC
- [x] Responsive design
- [x] ESLint + Prettier
- [x] GitHub Actions CI/CD
- [x] Vercel deployment config

## Quick Start

```bash
# Clone the repository
git clone https://github.com/crazyclaw85-source/nextjs-saas-starter.git
cd nextjs-saas-starter

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your values

# Set up database
npm run db:migrate

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

Create a `.env.local` file with the following variables:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/database

# Auth (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/onboarding
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding

# Paddle (Billing)
NEXT_PUBLIC_PADDLE_CLIENT_TOKEN=live_... # or sandbox_...
PADDLE_API_KEY=...
PADDLE_WEBHOOK_SECRET=...

# Rate Limiting (Upstash Redis)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

## Database Schema

The starter includes a comprehensive database schema:

- **Users**: Extended user profiles
- **Organizations**: Teams/companies with settings
- **Members**: User-organization relationships with roles
- **Subscriptions**: Paddle subscription management
- **Invites**: Email-based team invitations
- **Usage**: Tracking for rate limiting and metering

## Scripts

```bash
# Development
npm run dev              # Start development server
npm run build           # Production build
npm run start           # Start production server

# Code Quality
npm run lint            # ESLint
npm run format          # Prettier formatting
npm run typecheck       # TypeScript check

# Database
npm run db:generate     # Generate migrations
npm run db:migrate      # Run migrations
npm run db:push         # Push schema to database
npm run db:studio       # Open Drizzle Studio
npm run db:seed         # Seed database
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   └── webhooks/      # Paddle webhook handlers
│   ├── dashboard/         # Main dashboard
│   ├── onboarding/        # New user onboarding
│   ├── team/              # Team management
│   └── settings/          # User/org settings
├── components/
│   ├── layout/            # Dashboard layout components
│   └── ui/                # Reusable UI components
├── lib/
│   ├── db/                # Database schema and utilities
│   ├── trpc/              # tRPC router and procedures
│   ├── auth.ts            # Authentication utilities
│   ├── paddle.ts          # Paddle integration
│   └── rate-limit.ts      # Rate limiting setup
└── middleware.ts          # Next.js middleware
```

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Configure environment variables in Vercel dashboard
4. Deploy!

The project includes a `vercel.json` configuration file.

### Environment Setup

1. **Database**: Set up a PostgreSQL database (Neon, Supabase, or Railway)
2. **Clerk**: Create a Clerk application and copy the API keys
3. **Paddle**: Set up a Paddle account and configure webhooks
4. **Upstash Redis**: Create a Redis database for rate limiting

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see [LICENSE](LICENSE) for details.

## Support

For issues and questions:
- Open an issue on GitHub
- Check the documentation
- Review the example code in the repository