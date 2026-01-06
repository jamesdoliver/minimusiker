# i18n Manual Testing Checklist

## Prerequisites
- [ ] Development server running (`npm run dev`)
- [ ] Valid parent login credentials
- [ ] Browser console open (for debugging)

## 1. Default Language Behavior

### Main Portal
- [ ] Navigate to `/parent-login`
- [ ] Log in with valid parent credentials
- [ ] Verify page loads with **German** as default language
- [ ] Check browser localStorage shows `NEXT_LOCALE = "de"`
- [ ] Verify German text appears:
  - [ ] Header: "Elternportal"
  - [ ] Sign out button: "Abmelden"
  - [ ] Recording preview: "Schulaufnahme-Vorschau"
  - [ ] ProductSelector title: "Vervollständigen Sie Ihre Bestellung"

### Shop Page
- [ ] Navigate to `/parent-portal/shop`
- [ ] Verify German text appears:
  - [ ] Header: "MiniMusiker Shop"
  - [ ] Subtitle: "Exklusive Merchandise für unsere Musikfamilien"
  - [ ] Breadcrumb: "Elternportal"
  - [ ] Categories: "Alle Produkte", "Bekleidung", "Accessoires"

## 2. Language Selector Visibility

### Main Portal Header
- [ ] Verify language selector visible in top-right header
- [ ] Selector shows: "🇩🇪 Deutsch"
- [ ] Positioned next to "Shop" link and "Abmelden" button

### Shop Header
- [ ] Verify language selector visible in shop header
- [ ] Selector shows: "🇩🇪 Deutsch"
- [ ] Positioned next to cart icon

## 3. Language Switching (German → English)

### Switch to English
- [ ] Click language selector dropdown
- [ ] Verify dropdown shows both options:
  - [ ] "🇩🇪 Deutsch"
  - [ ] "🇬🇧 English"
- [ ] Click "🇬🇧 English"
- [ ] Page should reload automatically
- [ ] Verify browser localStorage shows `NEXT_LOCALE = "en"`

### Verify English Translation - Main Portal
- [ ] Header: "Parent Portal"
- [ ] Sign out: "Sign Out"
- [ ] Child selector (if visible): "Viewing for:"
- [ ] School banner: "Class: {className}"
- [ ] Recording preview: "School Recording Preview"
- [ ] ProductSelector:
  - [ ] Title: "Complete Your Order"
  - [ ] Subtitle: "Capture the memories from {schoolName}"
  - [ ] Audio section: "Choose Your Audio (Required)"
  - [ ] Clothing section: "Add Clothing (Optional)"
  - [ ] Order summary: "Order Summary"

### Verify English Translation - Shop
- [ ] Navigate to shop
- [ ] Header: "MiniMusiker Shop"
- [ ] Subtitle: "Exclusive merchandise for our music families"
- [ ] Breadcrumb: "Parent Portal"
- [ ] Categories: "All Products", "Apparel", "Accessories"

## 4. Language Switching (English → German)

- [ ] Click language selector (should show "🇬🇧 English")
- [ ] Click "🇩🇪 Deutsch"
- [ ] Page reloads
- [ ] Verify all German text is restored
- [ ] Check localStorage: `NEXT_LOCALE = "de"`

## 5. Persistence Testing

### Cross-Page Persistence
- [ ] Set language to English
- [ ] Navigate from parent portal to shop
- [ ] Verify English maintained in shop
- [ ] Navigate back to parent portal
- [ ] Verify English still active

### Reload Persistence
- [ ] Set language to English
- [ ] Hard reload page (Cmd+Shift+R / Ctrl+Shift+R)
- [ ] Verify English is maintained
- [ ] Change to German
- [ ] Hard reload
- [ ] Verify German is maintained

### Session Persistence
- [ ] Set language to English
- [ ] Close browser tab
- [ ] Reopen and navigate to `/parent-portal`
- [ ] Login again
- [ ] Verify English is remembered (localStorage persists)

## 6. ProductSelector Component Testing

### German Version
- [ ] Audio section:
  - [ ] "Wählen Sie Ihr Audio"
  - [ ] "(Erforderlich)"
  - [ ] Minicard: "Digitale Audiokarte mit QR-Code"
  - [ ] CD: "Physische CD mit Albumcover"
  - [ ] Bundle: "Beide Formate enthalten"
  - [ ] Savings badge: "Sparen Sie €5"
- [ ] Clothing section:
  - [ ] "Kleidung hinzufügen"
  - [ ] "(Optional)"
  - [ ] Discount banner: "Sparen Sie 10%, wenn Sie Kleidung zu Ihrer Bestellung hinzufügen!"
  - [ ] T-Shirt: "Premium Baumwolle Event-T-Shirt"
  - [ ] Add button: "Hinzufügen"
- [ ] Order summary:
  - [ ] "Bestellübersicht"
  - [ ] "Zwischensumme"
  - [ ] "Kombi-Rabatt (10%)"
  - [ ] "Gesamt"
  - [ ] Checkout button: "Zur Kasse - €{total}"
  - [ ] Trust badges: "Sicher", "Schnelle Lieferung"

### English Version
- [ ] Switch to English
- [ ] Verify all ProductSelector text translated correctly
- [ ] Audio: "Choose Your Audio (Required)"
- [ ] Clothing: "Add Clothing (Optional)"
- [ ] Order summary: "Order Summary", "Subtotal", "Total"
- [ ] Checkout: "Checkout - €{total}"

## 7. Shop Component Testing

### Product Catalog
- [ ] Categories translate correctly
- [ ] Empty state: "No Products Available" / "Keine Produkte verfügbar"
- [ ] Product count: "Showing X of Y products" / "Zeige X von Y Produkten"

### Product Card
- [ ] "SALE" badge visible (same in both languages)
- [ ] "Out of Stock" / "Nicht verfügbar"
- [ ] "Size" / "Größe"
- [ ] "Quantity" / "Menge"
- [ ] "Add to Cart" / "In den Warenkorb"
- [ ] "Adding..." / "Wird hinzugefügt..."

### Cart Drawer
- [ ] Open cart by clicking cart icon
- [ ] Header: "Your Cart (X)" / "Ihr Warenkorb (X)"
- [ ] Empty state: "Your cart is empty" / "Ihr Warenkorb ist leer"
- [ ] "Continue Shopping" / "Weiter einkaufen"
- [ ] "Remove" / "Entfernen"
- [ ] "Subtotal" / "Zwischensumme"
- [ ] Info text: "Shipping and taxes calculated at checkout" / "Versand und Steuern werden an der Kasse berechnet"
- [ ] Checkout button: "Proceed to Checkout" / "Zur Kasse gehen"
- [ ] Processing: "Processing..." / "Wird verarbeitet..."

### Featured Products
- [ ] Section title: "Shop Our Merchandise" / "Unsere Merchandise-Produkte"
- [ ] "View All" / "Alle anzeigen"
- [ ] Quick add: "Add to Cart" / "In den Warenkorb"
- [ ] "View Options" / "Optionen anzeigen"

## 8. Layout & Design Testing

### German Text (Long Words)
- [ ] Check for text overflow in buttons
- [ ] Verify all text fits within containers
- [ ] No horizontal scrolling caused by long German words
- [ ] Headings maintain proper line height
- [ ] Buttons don't wrap awkwardly

### Responsive Design
- [ ] Test at mobile width (375px):
  - [ ] Language selector accessible
  - [ ] Text remains readable
  - [ ] No layout breaks
- [ ] Test at tablet width (768px):
  - [ ] Components scale properly
  - [ ] Language selector visible
- [ ] Test at desktop width (1920px):
  - [ ] Layout looks balanced
  - [ ] Text sizing appropriate

### Visual Consistency
- [ ] Sage/cream color scheme maintained in both languages
- [ ] Font sizes consistent
- [ ] Spacing/padding unchanged
- [ ] Icons and emojis display correctly

## 9. Cart State During Language Switch

- [ ] Add item to cart in German
- [ ] Switch to English
- [ ] Verify cart items preserved
- [ ] Verify cart count badge shows correct number
- [ ] Open cart drawer
- [ ] Verify product names and prices unchanged
- [ ] Switch back to German
- [ ] Verify cart still intact

## 10. Edge Cases

### Invalid Locale
- [ ] Open browser console
- [ ] Run: `localStorage.setItem('NEXT_LOCALE', 'invalid')`
- [ ] Reload page
- [ ] Verify fallback to German (default)

### Missing Translation Keys
- [ ] Check browser console for warnings
- [ ] No "[missing translation]" text visible
- [ ] All keys properly defined

### Browser Compatibility
- [ ] Test in Chrome
- [ ] Test in Firefox
- [ ] Test in Safari
- [ ] Test in Edge (if accessible)

## 11. Performance

- [ ] Language switch happens quickly (< 2 seconds)
- [ ] No visible flash of untranslated content (FOUC)
- [ ] Page reload smooth
- [ ] No console errors during switch

## 12. Accessibility

- [ ] Language selector keyboard accessible (Tab to focus)
- [ ] Can select language with Enter/Space
- [ ] Screen reader announces language change
- [ ] Focus maintained after language switch
- [ ] Dropdown navigable with arrow keys

---

## Issues Found

Document any issues discovered during testing:

| Issue | Severity | Description | Steps to Reproduce | Language |
|-------|----------|-------------|-------------------|----------|
|       |          |             |                   |          |

---

## Sign-off

- [ ] All critical tests passed
- [ ] All major tests passed
- [ ] Minor issues documented above
- [ ] Ready for production

**Tester Name:** _________________
**Date:** _________________
**Time Spent:** _________________
