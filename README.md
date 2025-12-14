# MiniMusiker - School Music Event Platform

A comprehensive web platform for managing school music events from initial parent notification through final product delivery. The system provides personalized landing pages for parents, automated email campaigns, and integrated e-commerce for merchandise and digital recordings.

## 🎯 Overview

MiniMusiker streamlines the entire lifecycle of school music events:
- **T-8 Weeks**: Initial parent notification
- **T-4 Weeks**: Follow-up reminder
- **T-2 Weeks**: Final pre-event reminder
- **Event Day**: Performance and recording
- **Post-Event**: Landing pages with purchase options
- **Fulfillment**: Digital delivery and physical shipping

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Airtable account and API access
- (Optional) Shopify store for e-commerce
- (Optional) SendGrid account for emails
- (Optional) Cloudflare R2 for file storage

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-org/minimusiker.git
cd minimusiker
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp .env.local.example .env.local
```

4. Configure your environment variables in `.env.local` with your actual credentials

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## 🏗️ Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS, Radix UI
- **Database**: Airtable
- **File Storage**: Cloudflare R2 (S3-compatible)
- **E-commerce**: Shopify Storefront API
- **Email**: SendGrid
- **Hosting**: Vercel
- **Authentication**: JWT tokens

## 📁 Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── event/[accessToken] # Parent landing pages
│   ├── admin/             # Admin dashboard
│   └── api/               # API routes
├── components/            # React components
│   ├── landing/          # Landing page components
│   ├── shared/           # Shared UI components
│   └── admin/            # Admin components
├── lib/                   # Core libraries
│   ├── services/         # External service integrations
│   ├── types/            # TypeScript definitions
│   └── utils/            # Utility functions
└── tests/                # Test files
    ├── unit/            # Unit tests
    └── e2e/             # End-to-end tests
```

## 🔑 Key Features

### Parent Portal
- Personalized landing pages via unique access tokens
- Student information display
- Event countdown timer
- Audio preview player
- Product shopping cart
- Secure checkout flow

### Admin Dashboard
- Event management
- Bulk parent/student import
- Audio file upload
- Email campaign management
- Analytics and reporting
- Order tracking

### Email Automation
- Scheduled campaigns (T-8, T-4, T-2 weeks)
- Post-event notifications
- Order confirmations
- Delivery notifications

### Digital Delivery
- Secure file storage with Cloudflare R2
- Presigned URLs with expiration
- Preview clips (30 seconds)
- Full recordings (post-purchase)
- Download tracking

## 📝 Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server

# Testing
npm run test         # Run unit tests
npm run test:watch   # Run tests in watch mode
npm run test:e2e     # Run E2E tests

# Code Quality
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript checks
npm run format       # Format code with Prettier

# Database
npm run db:sync      # Sync Airtable schema
npm run db:seed      # Seed test data
```

## 🗄️ Database Schema

The application uses Airtable with the following tables:
- **Schools**: School information and branding
- **Events**: Music events and recordings
- **Classes**: Class information
- **Students**: Student records
- **Parents**: Parent accounts with access tokens
- **Products**: Merchandise and recordings
- **Orders**: Purchase records
- **Email_Campaigns**: Campaign tracking

See `src/lib/types/airtable.ts` for detailed schema definitions.

## 🚀 Deployment

### Vercel Deployment

1. Connect your GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy with:
```bash
vercel --prod
```

### Environment Variables

Required environment variables (see `.env.local.example`):
- `AIRTABLE_API_KEY` - Airtable API key
- `AIRTABLE_BASE_ID` - Airtable base identifier
- `JWT_SECRET` - Secret for JWT tokens
- `NEXT_PUBLIC_APP_URL` - Your application URL

Optional integrations:
- Shopify credentials for e-commerce
- SendGrid API key for emails
- Cloudflare R2 credentials for file storage

## 🧪 Testing

### Unit Tests
```bash
npm run test
```

### E2E Tests
```bash
npm run test:e2e
```

### Test Coverage
```bash
npm run test -- --coverage
```

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/auth/verify-parent` - Verify parent access token
- `POST /api/auth/admin-login` - Admin authentication

### Data Endpoints
- `GET /api/airtable/get-parent-data` - Fetch parent portal data
- `GET /api/airtable/get-event-details` - Get event information
- `GET /api/airtable/get-products` - List available products
- `POST /api/airtable/update-order` - Create/update orders

### Integration Endpoints
- `POST /api/shopify/create-checkout` - Initialize checkout
- `GET /api/r2/generate-preview-url` - Get audio preview URL
- `GET /api/admin/dashboard-stats` - Admin statistics

## 🔒 Security

- JWT authentication for admin users
- Unique access tokens for parents (no passwords)
- Rate limiting on all API endpoints
- Presigned URLs with automatic expiration
- Environment variables for sensitive data
- HTTPS enforcement in production

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is proprietary software. All rights reserved.

## 💬 Support

For support, email support@minimusiker.com or open an issue in the repository.

## 🙏 Acknowledgments

- Built with Next.js and React
- UI components from Radix UI
- Styling with Tailwind CSS
- Deployed on Vercel