# API Documentation

## Base URL

```
Development: http://localhost:3000/api
Production: https://yourdomain.com/api
```

## Authentication

The API uses two authentication methods:

1. **Parent Access**: Unique access tokens (no login required)
2. **Admin Access**: JWT tokens with email/password authentication

## Endpoints

### Authentication

#### Verify Parent Access Token

```http
POST /api/auth/verify-parent
Content-Type: application/json

{
  "accessToken": "unique_parent_token_here"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "parentId": "parent_123",
    "email": "parent@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

#### Admin Login

```http
POST /api/auth/admin-login
Content-Type: application/json

{
  "email": "admin@minimusiker.com",
  "password": "secure_password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "jwt_token_here",
    "user": {
      "id": "admin_1",
      "email": "admin@minimusiker.com",
      "role": "admin"
    }
  }
}
```

### Parent Portal Data

#### Get Parent Portal Data

```http
GET /api/airtable/get-parent-data?accessToken=unique_token
```

**Response:**
```json
{
  "success": true,
  "data": {
    "parent": {
      "parent_id": "parent_123",
      "email": "parent@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "student_ids": ["student_1", "student_2"]
    },
    "students": [
      {
        "student_id": "student_1",
        "first_name": "Jane",
        "last_name": "Doe",
        "class_id": "class_1",
        "grade": "5"
      }
    ],
    "event": {
      "event_id": "EVT_001",
      "event_date": "2024-12-15T19:00:00",
      "event_type": "concert",
      "recording_status": "pending"
    },
    "school": {
      "school_id": "SCH_001",
      "school_name": "Lincoln Elementary",
      "address": "123 Main St",
      "branding_color": "#4A90E2"
    },
    "products": [
      {
        "product_id": "PROD_001",
        "product_type": "recording",
        "price": 19.99,
        "description": "Full concert recording"
      }
    ],
    "orders": []
  }
}
```

### Events

#### Get Event Details

```http
GET /api/airtable/get-event-details?eventId=EVT_001
```

**Response:**
```json
{
  "success": true,
  "data": {
    "event": {
      "event_id": "EVT_001",
      "school_id": "SCH_001",
      "event_date": "2024-12-15T19:00:00",
      "event_type": "concert",
      "recording_status": "pending"
    },
    "classes": [
      {
        "class_id": "class_1",
        "class_name": "5th Grade",
        "teacher_name": "Mrs. Smith"
      }
    ],
    "products": [
      {
        "product_id": "PROD_001",
        "product_type": "recording",
        "price": 19.99
      }
    ]
  }
}
```

### Products

#### Get Products for Event

```http
GET /api/airtable/get-products?eventId=EVT_001
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "product_id": "PROD_001",
      "event_id": "EVT_001",
      "product_type": "recording",
      "shopify_product_id": "gid://shopify/Product/123",
      "price": 19.99,
      "early_bird_price": 14.99,
      "early_bird_deadline": "2024-12-01",
      "description": "Full concert recording",
      "currentPrice": 14.99,
      "isEarlyBird": true
    },
    {
      "product_id": "PROD_002",
      "product_type": "tshirt",
      "price": 15.00,
      "description": "Event T-Shirt",
      "sizes_available": ["S", "M", "L", "XL"]
    }
  ]
}
```

### Orders

#### Create Order

```http
POST /api/airtable/update-order
Content-Type: application/json

{
  "parent_id": "parent_123",
  "event_id": "EVT_001",
  "products": [
    {
      "product_id": "PROD_001",
      "quantity": 1,
      "price": 19.99
    }
  ],
  "subtotal": 19.99,
  "tax": 1.80,
  "total_amount": 21.79
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "order_id": "ORD_1234567890",
    "parent_id": "parent_123",
    "event_id": "EVT_001",
    "order_date": "2024-11-15T10:30:00Z",
    "fulfillment_status": "pending",
    "total_amount": 21.79
  }
}
```

#### Update Order

```http
PUT /api/airtable/update-order
Content-Type: application/json

{
  "orderId": "ORD_1234567890",
  "updates": {
    "fulfillment_status": "shipped",
    "tracking_number": "1Z999AA10123456784"
  }
}
```

### E-commerce

#### Create Shopify Checkout

```http
POST /api/shopify/create-checkout
Content-Type: application/json

{
  "lineItems": [
    {
      "productId": "gid://shopify/Product/123",
      "variantId": "gid://shopify/ProductVariant/456",
      "quantity": 1
    }
  ],
  "customAttributes": {
    "parentId": "parent_123",
    "eventId": "EVT_001"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "checkoutId": "checkout_session_123",
    "checkoutUrl": "https://your-store.myshopify.com/checkout/..."
  }
}
```

### Digital Delivery

#### Generate Preview URL

```http
GET /api/r2/generate-preview-url?eventId=EVT_001
```

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://signed-url.r2.cloudflarestorage.com/preview.mp3",
    "expiresAt": "2024-11-15T11:00:00Z"
  }
}
```

#### Generate Download URL (Post-Purchase)

```http
GET /api/r2/generate-download-url?eventId=EVT_001&orderId=ORD_123
Authorization: Bearer parent_access_token
```

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://signed-url.r2.cloudflarestorage.com/full-recording.mp3",
    "expiresAt": "2024-11-16T10:30:00Z"
  }
}
```

### Admin Endpoints

#### Get Dashboard Statistics

```http
GET /api/admin/dashboard-stats
Cookie: admin_token=jwt_token_here
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalEvents": 15,
    "activeEvents": 5,
    "totalParents": 450,
    "totalOrders": 234,
    "totalRevenue": 12500,
    "emailsSent": 3200,
    "emailOpenRate": 65.5,
    "conversionRate": 28.3
  }
}
```

#### Upload Recording

```http
POST /api/r2/upload-recording
Content-Type: multipart/form-data
Cookie: admin_token=jwt_token_here

FormData:
- file: audio_file.mp3
- eventId: EVT_001
- type: "preview" | "full"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "key": "events/EVT_001/preview.mp3",
    "size": 2457600,
    "duration": 30
  }
}
```

## Error Responses

All endpoints follow a consistent error format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

### Common HTTP Status Codes

- `200 OK`: Successful request
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Authentication required or failed
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

- **Public endpoints**: 100 requests per minute
- **Authenticated endpoints**: 500 requests per minute
- **Upload endpoints**: 10 requests per minute

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1699123200
```

## Webhooks

### Shopify Order Webhook

```http
POST /api/shopify/webhooks/order-created
X-Shopify-Hmac-SHA256: webhook_signature
Content-Type: application/json

{
  "id": 1234567890,
  "email": "customer@example.com",
  "line_items": [...],
  "total_price": "45.00"
}
```

### Email Status Webhook

```http
POST /api/email/webhook
Content-Type: application/json

{
  "event": "delivered",
  "email": "parent@example.com",
  "campaign_id": "campaign_123",
  "timestamp": "2024-11-15T10:30:00Z"
}
```

## Testing

### Test Environment

Use the following test credentials in development:

```json
{
  "testParentToken": "test_parent_token_123",
  "testAdminEmail": "admin@test.com",
  "testAdminPassword": "test_password"
}
```

### Postman Collection

Import the Postman collection from `/docs/postman-collection.json` for easy API testing.

## SDK Examples

### JavaScript/TypeScript

```typescript
// Parent Portal Access
const response = await fetch('/api/auth/verify-parent', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    accessToken: 'parent_token_here'
  }),
});

const data = await response.json();
if (data.success) {
  console.log('Parent verified:', data.data);
}
```

### cURL

```bash
# Admin Login
curl -X POST https://yourdomain.com/api/auth/admin-login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@minimusiker.com","password":"secure_password"}'

# Get Event Details
curl https://yourdomain.com/api/airtable/get-event-details?eventId=EVT_001
```

## Support

For API support:
- GitHub Issues: [github.com/your-org/minimusiker/issues](https://github.com/your-org/minimusiker/issues)
- Email: api-support@minimusiker.com
- Documentation: [docs.minimusiker.com](https://docs.minimusiker.com)