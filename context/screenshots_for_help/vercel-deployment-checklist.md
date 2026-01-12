# Vercel Deployment Checklist for MiniMusiker

## Pre-Deployment Steps

### 1. Push Code to GitHub
- [ ] Ensure all changes are committed
- [ ] Push to your GitHub repository
- [ ] Verify `.gitignore` excludes `.env.local` (sensitive data)

### 2. Create Vercel Project
- [ ] Go to [vercel.com](https://vercel.com) and sign in
- [ ] Click "Add New Project"
- [ ] Import your GitHub repository
- [ ] Select "Next.js" as framework preset

---

## Environment Variables (Add in Vercel Dashboard)

Go to: **Project Settings → Environment Variables**

### Required - Core Application
| Variable | Value | Notes |
|----------|-------|-------|
| `NEXT_PUBLIC_APP_URL` | `https://minimusiker.app` | Production domain |
| `NODE_ENV` | `production` | |

### Required - Airtable
| Variable | Value | Notes |
|----------|-------|-------|
| `AIRTABLE_API_KEY` | `patsNJNW3XQz4Wa4J...` | Your Personal Access Token |
| `AIRTABLE_BASE_ID` | `appkxiAojCif76bA7` | Your base ID |

### Required - SimplyBook
| Variable | Value | Notes |
|----------|-------|-------|
| `SIMPLY_BOOK_ACCOUNT_NAME` | Your company login | |
| `SIMPLYBOOK_API_KEY` | Your API key | |
| `SIMPLYBOOK_API_SECRET` | Your API secret | |
| `SIMPLYBOOK_USER_LOGIN` | Admin username | |
| `SIMPLYBOOK_USER_PASSWORD` | Admin password | |
| `SIMPLYBOOK_JSON_RCP_API_ENDPOINT` | `https://user-api.simplybook.it/` | |
| `SIMPLYBOOK_RESP_API_ENDPOINT` | `https://user-api-v2.simplybook.it/` | |

### Required - Authentication
| Variable | Value | Notes |
|----------|-------|-------|
| `JWT_SECRET` | Generate random string | Run: `openssl rand -base64 32` |
| `ADMIN_PASSWORD_HASH` | bcrypt hash | Hash your admin password |
| `STAFF_JWT_SECRET` | Generate random string | |
| `TEACHER_JWT_SECRET` | Generate random string | |
| `PARENT_JWT_SECRET` | Generate random string | |
| `ENGINEER_JWT_SECRET` | Generate random string | |

### Optional - Email (SendGrid)
| Variable | Value | Notes |
|----------|-------|-------|
| `SENDGRID_API_KEY` | `SG.xxxxx` | For teacher magic links |
| `SENDGRID_FROM_EMAIL` | `noreply@yourdomain.com` | |
| `SENDGRID_FROM_NAME` | `MiniMusiker` | |

### Optional - Cloudflare R2 (Recordings)
| Variable | Value | Notes |
|----------|-------|-------|
| `R2_ENDPOINT` | `https://xxx.r2.cloudflarestorage.com` | |
| `R2_ACCESS_KEY_ID` | Your access key | |
| `R2_SECRET_ACCESS_KEY` | Your secret key | |
| `R2_BUCKET_NAME` | `school-recordings` | |

### Optional - Shopify
| Variable | Value | Notes |
|----------|-------|-------|
| `ENABLE_SHOPIFY_INTEGRATION` | `false` | Set `true` when ready |
| `SHOPIFY_STORE_DOMAIN` | `your-store.myshopify.com` | |
| `NEXT_PUBLIC_SHOPIFY_STOREFRONT_ACCESS_TOKEN` | Storefront token | |
| `SHOPIFY_ADMIN_ACCESS_TOKEN` | Admin token | |

---

## Deploy

### 3. Initial Deployment
- [ ] Click "Deploy" in Vercel
- [ ] Wait for build to complete
- [ ] Production URL: `https://minimusiker.app`

### 4. Verify NEXT_PUBLIC_APP_URL
- [ ] Confirm `NEXT_PUBLIC_APP_URL` is set to `https://minimusiker.app`
- [ ] If not set, add it and redeploy (Deployments → ... → Redeploy)

---

## Post-Deployment: Configure SimplyBook Webhook

### 5. Register Webhook in SimplyBook
- [ ] Log into SimplyBook admin dashboard
- [ ] Go to **Custom Features** → **API** or **Webhooks**
- [ ] Add new webhook notification
- [ ] Set URL to: `https://minimusiker.app/api/simplybook/webhook`
- [ ] Enable notifications for: `create` (booking created)
- [ ] Save configuration

### 6. Test Webhook
- [ ] Create a test booking in SimplyBook
- [ ] Check Vercel logs: **Project → Deployments → Functions**
- [ ] Verify booking appears in Airtable SchoolBookings table

---

## Verification Checklist

### Test Each Portal
- [ ] **Admin Portal** (`/admin`) - Login with admin password
- [ ] **Teacher Portal** (`/teacher`) - Request magic link (if SendGrid configured)
- [ ] **Staff Portal** (`/staff`) - Login works
- [ ] **Parent Portal** (`/`) - Registration flow works

### Test API Endpoints
- [ ] `GET /api/simplybook/webhook` - Returns `{"status":"ok"}`
- [ ] `GET /api/admin/bookings` - Returns booking data (requires auth)

---

## Troubleshooting

### Build Fails
- Check Vercel build logs for errors
- Ensure all required env vars are set
- Verify TypeScript compiles: `npm run build` locally

### Webhook Not Working
- Verify URL is correct in SimplyBook
- Check Vercel function logs for errors
- Test webhook endpoint: `curl https://minimusiker.app/api/simplybook/webhook`

### Auth Issues
- Verify JWT secrets are set and match between sessions
- Check that password hashes are valid bcrypt hashes

---

## Quick Commands

Generate JWT secrets:
```bash
openssl rand -base64 32
```

Generate bcrypt password hash (Node.js):
```javascript
const bcrypt = require('bcryptjs');
console.log(bcrypt.hashSync('your-password', 10));
```

---

## Summary

1. **Push to GitHub** → Import to Vercel
2. **Add all environment variables** in Vercel dashboard
3. **Deploy** and note your URL
4. **Configure SimplyBook webhook** with your Vercel URL
5. **Test** all portals and webhook
