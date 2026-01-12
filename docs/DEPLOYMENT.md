# Deployment Guide

This guide covers deploying the MiniMusiker platform to production using Vercel.

## Prerequisites

Before deploying, ensure you have:

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub Repository**: Code pushed to GitHub
3. **Production Credentials**: All API keys and tokens for production
4. **Domain Name**: Custom domain (production: minimusiker.app)

## Step 1: Prepare Your Application

### 1.1 Environment Variables

Ensure all required environment variables are documented:

```bash
# Required
NEXT_PUBLIC_APP_URL=https://minimusiker.app
AIRTABLE_API_KEY=your_production_api_key
AIRTABLE_BASE_ID=your_production_base_id
JWT_SECRET=generate_secure_random_string

# Optional Services
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_STOREFRONT_ACCESS_TOKEN=your_token
SENDGRID_API_KEY=your_sendgrid_key
R2_ENDPOINT=https://account.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_r2_key
R2_SECRET_ACCESS_KEY=your_r2_secret
```

### 1.2 Database Setup

1. Create production Airtable base
2. Set up all required tables (see schema in README)
3. Configure API access and get credentials

### 1.3 Build Test

Run a production build locally:

```bash
npm run build
npm run start
```

Fix any build errors before proceeding.

## Step 2: Connect to Vercel

### 2.1 Install Vercel CLI

```bash
npm install -g vercel
```

### 2.2 Link Your Project

```bash
vercel link
```

Follow prompts to:
- Log in to your Vercel account
- Select your team/scope
- Link to existing project or create new

## Step 3: Configure Vercel Project

### 3.1 Environment Variables

Add all environment variables in Vercel dashboard:

1. Go to Project Settings → Environment Variables
2. Add each variable with appropriate values for:
   - Production
   - Preview (optional)
   - Development (optional)

### 3.2 Domain Configuration

1. Go to Project Settings → Domains
2. Add your custom domain
3. Configure DNS records as instructed

### 3.3 Build Settings

Vercel automatically detects Next.js. Verify settings:

- **Framework Preset**: Next.js
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

## Step 4: Deploy

### 4.1 Initial Deployment

Deploy to production:

```bash
vercel --prod
```

Or push to main branch if GitHub integration is configured.

### 4.2 Verify Deployment

After deployment:

1. Check build logs for errors
2. Test all critical paths:
   - Homepage loads
   - Admin login works
   - Parent portal accessible
   - API endpoints respond

### 4.3 Set Up Cron Jobs

Vercel Cron jobs are configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/send-t8-notifications",
      "schedule": "0 9 * * *"
    }
  ]
}
```

Verify cron jobs are active in Vercel dashboard → Functions → Cron Jobs.

## Step 5: Post-Deployment

### 5.1 Monitoring

Set up monitoring:

1. **Vercel Analytics**: Enable in dashboard
2. **Error Tracking**: Configure Sentry (optional)
3. **Uptime Monitoring**: Use service like Uptime Robot

### 5.2 SSL Certificate

Vercel provides automatic SSL. Verify:
- HTTPS works on your domain
- SSL certificate is valid
- Redirects from HTTP to HTTPS

### 5.3 Performance Optimization

1. Enable Vercel Edge Network
2. Configure caching headers
3. Optimize images with Next.js Image component
4. Monitor Core Web Vitals

## Troubleshooting

### Build Failures

If build fails:

1. Check build logs in Vercel dashboard
2. Verify all dependencies are in `package.json`
3. Ensure environment variables are set
4. Test build locally with `vercel build`

### Runtime Errors

For runtime issues:

1. Check Function logs in Vercel dashboard
2. Verify API keys are correct
3. Check database connectivity
4. Review error tracking logs

### Performance Issues

If site is slow:

1. Check Vercel Analytics for bottlenecks
2. Optimize API calls with caching
3. Enable ISR (Incremental Static Regeneration)
4. Review Function duration limits

## Rollback Procedures

If issues occur after deployment:

### Instant Rollback

In Vercel dashboard:
1. Go to Deployments tab
2. Find previous working deployment
3. Click "..." menu → "Promote to Production"

### Git Revert

```bash
git revert HEAD
git push origin main
```

## Security Checklist

Before going live:

- [ ] All API keys are production keys
- [ ] JWT secret is strong and unique
- [ ] Admin password is secure
- [ ] Rate limiting is configured
- [ ] CORS is properly configured
- [ ] Environment variables are not exposed
- [ ] Error messages don't leak sensitive info
- [ ] File uploads are validated
- [ ] SQL injection prevention (if applicable)
- [ ] XSS protection headers are set

## Maintenance

### Regular Updates

```bash
# Update dependencies
npm update
npm audit fix

# Deploy updates
vercel --prod
```

### Database Backups

1. Set up Airtable automated backups
2. Export data regularly
3. Test restore procedures

### Monitoring Checklist

Weekly:
- Review error logs
- Check performance metrics
- Monitor API usage limits
- Review security alerts

Monthly:
- Update dependencies
- Review and rotate API keys
- Audit user access
- Performance optimization review

## Support

For deployment issues:
- Vercel Support: [vercel.com/support](https://vercel.com/support)
- GitHub Issues: Open issue in repository
- Email: support@minimusiker.com