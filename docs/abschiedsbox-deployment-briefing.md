# Deployment Briefing: Grundschul-Abschieds-Box

## What this is
A static landing page (HTML/CSS/JS). No frameworks, no build step, no dependencies. All paths are relative — can be served 1:1 from the target path.

## Target URL
**https://minimusiker.app/abschiedsbox**

## What to deploy
Upload the project folder as-is:

```
index.html
styles.css
app.js
schools.js          ← 168 Minimusikertag schools (generated from Termine_2025 Farewell.xlsx)
images/             ← 4 JPGs (~1.1 MB total)
audio/              ← 4 MP3 song previews
```

Do **not** upload: `BRIEFING.md`, `.claude/`, any other local-only files.

## External resources (for CSP, if configured)
| Purpose | Domain |
|---|---|
| Fonts (Inter + Fraunces) | `fonts.googleapis.com`, `fonts.gstatic.com` |
| Video embed (YouTube nocookie) | `www.youtube-nocookie.com`, `www.youtube.com` |
| Shopify Storefront API (once wired) | `*.myshopify.com` |

---

## What still needs wiring — Shopify

### 1. Configuration in `app.js`
At the top of the file:

```js
const SHOPIFY_CONFIG = {
  domain: 'YOUR-SHOP.myshopify.com',                // ← Shopify domain
  storefrontAccessToken: '',                         // ← Storefront API token
  variants: {
    box: 'gid://shopify/ProductVariant/0',           // ← variant ID for "Grundschul-Abschieds-Box" (€44.99)
    upsellLieder: 'gid://shopify/ProductVariant/0',  // ← variant ID for "Eigene Schullieder" upsell (€0.00)
  },
};
```

The Storefront access token is a **public** read-only token (not to be confused with an Admin API token) and is safe to expose in the frontend. Create one at:
*Shopify Admin → Settings → Apps and sales channels → Develop apps → Create app → Configure Storefront API*

### 2. Checkout hookup
The submit handler in `initCheckout` (inside `app.js`) currently shows an `alert(...)` as a placeholder. Replace it — three patterns are listed in the comment block right next to it:

- **Recommended: Storefront API `cartCreate` mutation**, then redirect to `cart.checkoutUrl`. Keeps the custom-checkout flow.
- Alternative: Permalink redirect via `https://{domain}/cart/{variantId}:{qty}?attributes...` (simplest, less flexible).
- Alternative: Shopify Buy Button SDK.

### 3. Order data passed in
For each order the following is prepared:

**Box line item**
- `variantId`, `quantity`

**Upsell line item (only if checkbox is active)**
- `variantId`, `quantity: 1`
- `customAttributes`:
  - `Schule` → plain text, e.g. `"Grundschule Langförden — Vechta"`
  - `KundenID` → numeric, from the Termine spreadsheet
  - `EventID` → numeric, from the Termine spreadsheet

These `customAttributes` automatically appear on the order in the Shopify admin. For packing slips / Order Printer templates, add them explicitly so the IDs are visible in print.

### 4. Shipping and VAT display
The summary shows "Wird im nächsten Schritt berechnet" for shipping and "MwSt. (enthalten)" as a note. The actual calculation happens in Shopify's checkout.

### 5. Payment methods
The UI visualises four methods (Card / PayPal / Klarna / Invoice). Which ones are actually available depends on what's enabled in Shopify Payments. The UI selection is **not** forwarded to Shopify — Shopify decides this in its own checkout flow. The four-button row is decorative / for trust signalling.

---

## Maintenance notes

### Cutoff date "31. Juli 2026"
Hardcoded in four places in `index.html` (top sticky bar, hero subtext implicitly, checkout urgency note, FAQ "Bis wann …"). If the cutoff shifts, update all four.

### Updating the school list
`schools.js` was generated from `Termine_2025 Farewell.xlsx`. When new schools are added, regenerate it — the generation script can be provided separately on request.

### Images
Four JPGs in `images/`. Optional pre-deploy step: convert to `.webp` (~40–50 % size reduction). Current sizes are fine (all under 350 KB).
