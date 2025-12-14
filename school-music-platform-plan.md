# School Music Service Platform - Project Plan

## Project Overview
A custom web platform that manages the entire lifecycle of school music events - from initial parent notification through final product delivery. The system provides personalized landing pages for parents, automated email campaigns, and integrated e-commerce for merchandise and digital recordings.

## Core Business Flow
1. **T-8 Weeks**: Initial parent notification via school
2. **T-4 Weeks**: Follow-up reminder
3. **T-2 Weeks**: Final pre-event reminder
4. **Event Day**: Performance and recording
5. **Post-Event**: Landing page with purchase options (t-shirts + recordings)
6. **Fulfillment**: Digital delivery and physical shipping

## Technical Architecture

### Tech Stack
```
Frontend:       Next.js 14+ (App Router)
Backend:        Next.js API Routes
Database:       Airtable (existing)
File Storage:   Cloudflare R2 (S3-compatible)
CDN:            Cloudflare (included with R2)
E-commerce:     Shopify Storefront API
Email:          SendGrid/Resend
Hosting:        Vercel
Authentication: JWT tokens for parent access
```

### System Components
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│    Next.js      │────▶│    Airtable     │────▶│    Shopify      │
│    Frontend     │     │    Database     │     │    Checkout     │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                        │
         │                       │                        │
         ▼                       ▼                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│   SendGrid      │     │  Cloudflare R2  │     │   Fulfillment   │
│   Email API     │     │  Object Storage │     │    Webhook      │
│                 │     │   + Free CDN    │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

## Database Schema (Airtable)

### Schools Table
- `school_id` (unique identifier)
- `school_name`
- `address`
- `primary_contact`
- `branding_color`
- `logo_url`

### Events Table
- `event_id` (unique identifier)
- `school_id` (linked to Schools)
- `event_date`
- `event_type`
- `notification_schedule` (formula: calculates T-8, T-4, T-2)
- `recording_status` (pending/completed)
- `preview_key` (R2 object key for preview)
- `full_recording_key` (R2 object key for full recording)
- `recording_duration` (in seconds)
- `file_size_mb` (for full recording)

### Classes Table
- `class_id`
- `school_id` (linked to Schools)
- `class_name` (e.g., "3rd Grade", "Mrs. Smith's Class")
- `event_id` (linked to Events)

### Students Table
- `student_id`
- `first_name`
- `last_name`
- `class_id` (linked to Classes)
- `parent_ids` (linked to Parents, multiple)

### Parents Table
- `parent_id` (unique identifier)
- `email`
- `first_name`
- `last_name`
- `phone` (optional)
- `access_token` (generated unique URL token)
- `student_ids` (linked to Students)

### Products Table
- `product_id`
- `event_id` (linked to Events)
- `product_type` (tshirt/recording/bundle)
- `shopify_product_id`
- `shopify_variant_ids` (JSON array for sizes)
- `price`
- `description`

### Orders Table
- `order_id`
- `parent_id` (linked to Parents)
- `event_id` (linked to Events)
- `shopify_order_id`
- `order_date`
- `products` (JSON)
- `total_amount`
- `fulfillment_status`
- `digital_delivered` (boolean)

### Email_Campaigns Table
- `campaign_id`
- `event_id` (linked to Events)
- `send_date`
- `campaign_type` (T-8/T-4/T-2/post-event/follow-up)
- `sent_count`
- `opened_count`
- `clicked_count`
- `template_id`

## Development Phases

### Phase 1: Foundation (Week 1)
#### Setup & Configuration
- [ ] Initialize Next.js project with TypeScript
- [ ] Configure Tailwind CSS for styling
- [ ] Set up Vercel deployment pipeline
- [ ] Configure environment variables
- [ ] Install core dependencies:
  ```bash
  npm install @shopify/shopify-api @sendgrid/mail airtable axios
  npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
  npm install @radix-ui/react-components framer-motion
  npm install react-audio-player date-fns zod
  npm install multer @types/multer
  ```

#### Airtable Integration
- [ ] Create Airtable API service class
- [ ] Implement connection pooling
- [ ] Build typed interfaces for all tables
- [ ] Create CRUD operations for each table
- [ ] Implement filtering and relationship queries

### Phase 2: Parent Portal (Week 2)
#### Landing Page System
- [ ] Create dynamic route: `/event/[accessToken]`
- [ ] Build parent authentication middleware
- [ ] Design responsive landing page template
- [ ] Implement school branding customization
- [ ] Create components:
  - Parent welcome header
  - Student information cards
  - Event countdown timer
  - Preview audio player

#### Personalization Engine
- [ ] Parent data fetching from access token
- [ ] Multi-child household handling
- [ ] Class-specific content filtering
- [ ] School branding application

### Phase 3: E-commerce Integration (Week 3)
#### Shopify Setup
- [ ] Configure Shopify Storefront API
- [ ] Create product sync service
- [ ] Implement cart management
- [ ] Build checkout redirect flow
- [ ] Set up webhook handlers:
  ```javascript
  // Webhook endpoints needed:
  /api/webhooks/order-created
  /api/webhooks/order-fulfilled
  /api/webhooks/order-cancelled
  ```

#### Product Display
- [ ] T-shirt size selector component
- [ ] Bundle package cards
- [ ] Pricing display with early-bird logic
- [ ] Add to cart functionality
- [ ] Cart sidebar/modal

### Phase 4: Email Automation (Week 4)
#### Campaign System
- [ ] SendGrid/Resend integration
- [ ] Email template builder
- [ ] Dynamic content injection
- [ ] Scheduled job system (cron or Vercel Cron)
- [ ] Campaign triggers:
  ```javascript
  // Automation triggers:
  - checkAndSendT8Notifications()  // Daily at 9am
  - checkAndSendT4Notifications()  // Daily at 9am
  - checkAndSendT2Notifications()  // Daily at 9am
  - sendPostEventEmails()          // Manual trigger
  - sendFollowUpReminders()        // 7 days post-event
  ```

#### Email Templates
- [ ] Initial notification (T-8)
- [ ] Reminder emails (T-4, T-2)
- [ ] Post-event purchase invitation
- [ ] Order confirmation
- [ ] Digital delivery notification

### Phase 5: Digital Delivery (Week 5)
#### File Management with Cloudflare R2
- [ ] Configure R2 bucket and access credentials
- [ ] Implement S3-compatible client using AWS SDK
- [ ] Create presigned URL generation service
- [ ] Set up bucket structure:
  ```
  school-recordings/
  ├── events/
  │   ├── {eventId}/
  │   │   ├── preview.mp3
  │   │   ├── full-recording.mp3
  │   │   └── metadata.json
  ├── assets/
  │   ├── watermarks/
  │   └── thumbnails/
  └── temp/
      └── uploads/
  ```
- [ ] Implement secure upload system for admins
- [ ] Create URL expiration logic (preview: 30min, purchased: 24hr)
- [ ] Download tracking and analytics

#### R2 Integration Code
- [ ] File upload service:
  ```javascript
  // services/r2Service.ts
  class R2Service {
    async uploadRecording(eventId: string, file: Buffer, type: 'preview' | 'full')
    async generateSignedUrl(key: string, expiresIn: number)
    async deleteFile(key: string)
    async getFileMetadata(key: string)
  }
  ```

#### Audio Player
- [ ] HTML5 audio player with custom controls
- [ ] Streaming from R2 signed URLs
- [ ] Preview clip with watermark audio
- [ ] Full recording (post-purchase)
- [ ] Mobile-optimized player
- [ ] Bandwidth-adaptive streaming

### Phase 6: Admin Dashboard (Week 6)
#### Admin Features
- [ ] Login system for staff
- [ ] Event creation and management
- [ ] Bulk parent/student import (CSV)
- [ ] Email campaign monitoring
- [ ] Order tracking dashboard
- [ ] Recording upload interface

#### Analytics
- [ ] Conversion tracking
- [ ] Email open rates
- [ ] Preview play counts
- [ ] Revenue by school/event

## API Routes Structure
```
/api/
├── auth/
│   ├── verify-parent
│   └── admin-login
├── airtable/
│   ├── get-parent-data
│   ├── get-event-details
│   ├── get-products
│   └── update-order
├── shopify/
│   ├── create-checkout
│   ├── retrieve-checkout
│   └── webhooks/
│       ├── order-created
│       └── order-fulfilled
├── email/
│   ├── send-campaign
│   └── track-open
├── r2/
│   ├── generate-preview-url
│   ├── generate-download-url
│   ├── upload-recording
│   └── track-download
└── admin/
    ├── import-data
    ├── create-event
    ├── upload-audio
    └── dashboard-stats
```

## Component Structure
```
/components/
├── landing/
│   ├── HeroSection.tsx
│   ├── StudentCard.tsx
│   ├── PreviewPlayer.tsx
│   ├── ProductGrid.tsx
│   └── CheckoutButton.tsx
├── shared/
│   ├── Navigation.tsx
│   ├── Footer.tsx
│   ├── LoadingSpinner.tsx
│   └── ErrorBoundary.tsx
├── admin/
│   ├── DataTable.tsx
│   ├── ImportWizard.tsx
│   └── StatsCards.tsx
└── email/
    └── templates/
        ├── BaseTemplate.tsx
        └── CampaignTemplates.tsx
```

## Security Considerations
1. **Access Control**
   - Unique tokens for parent access (no passwords needed)
   - JWT for admin authentication
   - Rate limiting on all API endpoints

2. **Data Protection**
   - Environment variables for all API keys
   - Encrypted storage of sensitive data
   - GDPR compliance for EU schools

3. **File Security with R2**
   - Presigned URLs with automatic expiration
   - Preview files: 30-minute access window
   - Purchased files: 24-hour access window
   - IP-based rate limiting for downloads
   - Separate buckets for preview vs full content
   - CloudFlare DDoS protection included
   - No public bucket access - all files require signed URLs

## Testing Strategy
### Unit Tests
- Airtable service methods
- Email template rendering
- Price calculation logic
- Date/time utilities

### Integration Tests
- Parent access flow
- Purchase completion flow
- Email delivery pipeline
- File access control

### E2E Tests
- Complete parent journey
- Multi-child household scenarios
- Early bird pricing transitions
- Admin import workflows

## Deployment Checklist
### Pre-Launch
- [ ] SSL certificate configured
- [ ] Domain DNS settings
- [ ] Environment variables set
- [ ] Database backup system
- [ ] Error monitoring (Sentry)
- [ ] Analytics (Plausible/Fathom)

### Launch Day
- [ ] Test email flow with real addresses
- [ ] Verify Shopify webhook connectivity
- [ ] Test file preview/download links
- [ ] Monitor error logs
- [ ] Test on multiple devices/browsers

### Post-Launch
- [ ] Daily backup automation
- [ ] Performance monitoring
- [ ] Customer support documentation
- [ ] Feedback collection system

## MVP vs Future Features

### MVP (Launch Ready)
- Parent personalized landing pages
- Basic email automation
- Shopify checkout integration
- Digital file delivery
- Simple admin import

### Phase 2 Features
- WhatsApp notifications
- Social sharing features
- Parent portal with order history
- Automated reminder SMS
- Class photo galleries
- Multi-language support
- Referral program
- Early access for returning customers

## Development Commands
```bash
# Development
npm run dev

# Build
npm run build

# Type checking
npm run type-check

# Linting
npm run lint

# Testing
npm run test
npm run test:e2e

# Database
npm run db:sync  # Sync Airtable schema
npm run db:seed  # Seed test data

# Deployment
npm run deploy:staging
npm run deploy:production
```

## Monitoring & Maintenance
- **Daily**: Check email delivery rates, order fulfillment
- **Weekly**: Review analytics, backup data
- **Monthly**: Performance optimization, security updates
- **Per Event**: Archive old data, generate reports

## Support Documentation Needed
1. Parent FAQ
2. School administrator guide
3. Technical troubleshooting guide
4. Email template customization guide
5. Shopify product setup guide

## Cost Estimates
- **Vercel**: ~$20/month (Pro plan)
- **SendGrid**: ~$20-50/month (depending on volume)
- **Airtable**: Existing (Pro plan assumed)
- **Cloudflare R2**: 
  - Storage: $0.015/GB/month (~$1.50 for 100GB)
  - Egress: FREE (huge advantage)
  - Operations: $0.36 per million requests
  - Estimated: ~$5-10/month for typical usage
- **Shopify**: Existing (percentage of sales)
- **Domain**: ~$12/year

**Major Cost Advantage**: Unlike AWS S3 or other providers, Cloudflare R2 has ZERO egress fees, meaning parents can stream/download recordings repeatedly without increasing costs.

## Success Metrics
- Parent engagement rate (email opens/clicks)
- Conversion rate (visits to purchases)
- Average order value
- Digital delivery success rate
- Support ticket volume (lower is better)
- School satisfaction scores

## Risk Mitigation
| Risk | Mitigation Strategy |
|------|-------------------|
| Email deliverability | Use authenticated domain, warm up IP |
| High traffic spikes | Vercel auto-scaling, Cloudflare CDN for assets |
| Airtable API limits | Implement caching layer, batch operations |
| Payment failures | Clear error messaging, support contact |
| File access issues | R2 multi-region replication, presigned URL retry logic |
| Large file uploads | Chunked uploads, progress indicators, resume capability |
| Bandwidth costs | R2's free egress eliminates this risk entirely |

## Contact Points for Questions
- **Technical Architecture**: Review with senior developer
- **Airtable Schema**: Validate with data team
- **Shopify Integration**: Consult Shopify partner support
- **Email Deliverability**: SendGrid technical support
- **School Requirements**: Client stakeholder meetings

## Cloudflare R2 Implementation Details

### R2 Setup Process
1. **Create Cloudflare Account** and enable R2
2. **Create Bucket**: `school-recordings`
3. **Configure CORS** for browser uploads:
   ```json
   {
     "AllowedOrigins": ["https://yourdomain.com"],
     "AllowedMethods": ["GET", "PUT", "POST"],
     "AllowedHeaders": ["*"],
     "MaxAgeSeconds": 3600
   }
   ```
4. **Generate API Credentials**:
   - Account ID
   - Access Key ID  
   - Secret Access Key
   - R2 Endpoint URL

### Example R2 Service Implementation
```typescript
// lib/r2Service.ts
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export class R2Service {
  private client: S3Client;
  
  constructor() {
    this.client = new S3Client({
      region: "auto",
      endpoint: process.env.R2_ENDPOINT,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }

  // Generate signed URL for preview (30 minutes)
  async getPreviewUrl(eventId: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: "school-recordings",
      Key: `events/${eventId}/preview.mp3`,
    });
    
    return await getSignedUrl(this.client, command, { 
      expiresIn: 1800 // 30 minutes
    });
  }

  // Generate signed URL for full recording (24 hours, post-purchase)
  async getFullRecordingUrl(eventId: string, parentId: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: "school-recordings",
      Key: `events/${eventId}/full-recording.mp3`,
      ResponseContentDisposition: `attachment; filename="concert-recording.mp3"`,
    });
    
    // Log access for analytics
    await this.logAccess(eventId, parentId, 'full');
    
    return await getSignedUrl(this.client, command, { 
      expiresIn: 86400 // 24 hours
    });
  }

  // Upload recording (admin only)
  async uploadRecording(
    eventId: string, 
    file: Buffer, 
    type: 'preview' | 'full'
  ): Promise<void> {
    const key = `events/${eventId}/${type === 'preview' ? 'preview' : 'full-recording'}.mp3`;
    
    const command = new PutObjectCommand({
      Bucket: "school-recordings",
      Key: key,
      Body: file,
      ContentType: "audio/mpeg",
      Metadata: {
        eventId,
        uploadDate: new Date().toISOString(),
        type,
      },
    });
    
    await this.client.send(command);
  }
}
```

### Environment Variables
```bash
# .env.local
R2_ENDPOINT=https://[account-id].r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your-access-key-id
R2_SECRET_ACCESS_KEY=your-secret-access-key
R2_BUCKET_NAME=school-recordings
```

---

## Quick Start for Development

1. Clone the repository
2. Copy `.env.example` to `.env.local`
3. Install dependencies: `npm install`
4. Set up Airtable base with provided schema
5. Configure Shopify private app
6. Set up Cloudflare R2:
   - Create Cloudflare account
   - Enable R2 and create bucket
   - Generate API credentials
   - Add credentials to `.env.local`
7. Run development server: `npm run dev`
8. Access at `http://localhost:3000`

---

*This plan is designed to be executed using Claude Code for rapid development with AI assistance throughout the build process.*
