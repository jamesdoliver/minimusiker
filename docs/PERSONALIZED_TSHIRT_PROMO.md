# Personalized T-Shirt Promo Component

A promotional component that displays a t-shirt mockup with the school name overlaid, encouraging parents to order personalized merchandise before the event.

## Overview

The component appears in the parent portal below the audio recording preview. It shows:
- A t-shirt mockup with the school name dynamically overlaid
- A countdown timer showing time remaining until the personalization deadline
- Size selection from available Shopify product variants
- An "Add to Cart" button that integrates with the existing cart system

## Files

| File | Purpose |
|------|---------|
| `/src/components/parent-portal/PersonalizedTshirtPromo.tsx` | Main React component |
| `/public/images/tshirt-mockup.svg` | Placeholder mockup image (replace with actual) |
| `/src/app/familie/page.tsx` | Parent portal page (component integrated here) |

## Configuration

### Mockup Image

Replace the placeholder SVG with your actual t-shirt mockup:

```
/public/images/tshirt-mockup.png
```

Then update the component to use `.png`:

```tsx
// In PersonalizedTshirtPromo.tsx, line 165
src="/images/tshirt-mockup.png"
```

**Recommended image specs:**
- Format: PNG with transparent background
- Dimensions: ~400x500px (4:5 aspect ratio)
- The school name text overlays at approximately 35% from the top

### Shopify Product

The component automatically searches for a t-shirt product in your Shopify store. It looks for products in this order:

1. Product with handle matching `productHandle` prop (default: `"personalized-tshirt"`)
2. Product with `productType` containing "shirt"
3. Product with tags containing "shirt"

**Requirements:**
- Product must be tagged with `minimusiker-shop` (existing shop filter)
- Product should have size variants (named "Size" or "Größe")
- Variants must be `availableForSale: true`

### Deadline Calculation

The personalization deadline is calculated as **14 days before the event date**.

To change this, modify the `getDeadline` function in the component:

```tsx
function getDeadline(eventDate: string): Date {
  const event = new Date(eventDate);
  event.setDate(event.getDate() - 14); // Change 14 to desired days
  return event;
}
```

## Component Props

```tsx
interface PersonalizedTshirtPromoProps {
  schoolName: string;        // Displayed on the t-shirt
  eventDate: string;         // ISO date string (e.g., "2025-03-15")
  productHandle?: string;    // Shopify product handle (optional)
}
```

## Behavior

### Visibility Conditions

The component **will not render** if:
- `eventDate` is not provided
- The deadline has passed (less than 14 days until event)
- No t-shirt product is found in Shopify
- Products are still loading (shows skeleton instead)

### Multi-Child Support

When a parent has multiple children registered:
- The component uses the currently selected child's school name
- Switching children automatically updates the school name on the mockup

### Add to Cart Flow

1. User selects a size from available variants
2. Clicks "In den Warenkorb" (Add to Cart)
3. Product is added to cart via `CartContext.addItem()`
4. Cart drawer opens automatically
5. At checkout, `schoolName` is passed as a custom attribute

## Text Sizing

The school name font size adjusts based on length:

| Name Length | Font Size |
|-------------|-----------|
| < 15 chars  | `text-lg md:text-xl` |
| 15-24 chars | `text-base md:text-lg` |
| ≥ 25 chars  | `text-sm md:text-base` |

## Styling

The component uses:
- Tailwind CSS classes
- `sage-600` color scheme (matching site theme)
- Orange accent for countdown timer (urgency)

### Key CSS Classes

- Container: `bg-white rounded-xl shadow-lg p-6 mt-6`
- Countdown: `bg-orange-50 border-orange-200 text-orange-700`
- Size buttons: `bg-sage-600 text-white` (selected)
- Add to cart: `bg-sage-600 hover:bg-sage-700`

## Internationalization

Currently uses German text:
- "Personalisiertes T-Shirt"
- "Mit dem Namen deiner Schule!"
- "Größe wählen:"
- "In den Warenkorb"
- "Tag/Tage", "Stunde/Stunden"

To add translations, replace hardcoded strings with `useTranslations()` from `next-intl`.

## Usage Example

```tsx
<PersonalizedTshirtPromo
  schoolName="Grundschule am Park"
  eventDate="2025-02-15"
  productHandle="kids-tshirt-personalized"
/>
```

## Troubleshooting

### Component not appearing

1. **Check event date**: Must be more than 14 days in the future
2. **Check Shopify products**: Ensure t-shirt product exists with `minimusiker-shop` tag
3. **Check browser console**: Look for errors in product fetching

### School name not visible on mockup

1. **Check text color**: Default is dark blue (`#1a365d`)
2. **Adjust position**: Modify `top: '35%'` in the overlay div
3. **Check mockup image**: Ensure there's a clear area for text

### Size selector empty

1. **Check product variants**: Must have "Size" or "Größe" option
2. **Check availability**: Variants must be `availableForSale: true`

## Future Enhancements

Potential improvements:
- [ ] Add i18n translations for German/English
- [ ] Allow custom text positioning via props
- [ ] Support multiple mockup colors
- [ ] Add quantity selector
- [ ] Show personalization preview in cart
