# Teacher Portal Redesign

## Overview

Full redesign of the teacher portal to match client specifications. The functionality (add class, add songs to class) remains unchanged, but the frontend design is rebuilt to match the client's PDF mockup.

**Reference:** `context/screenshots_for_help/Willkommen, Admin.pdf`

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Layout approach | Full redesign | Client design uses full-width sections with alternating backgrounds |
| Styling | Extend Tailwind config | Single source of truth, good IDE support |
| Typography | Playfair Display via next/font | Match client's italic serif welcome text exactly |
| Component strategy | New `teacher-v2/` folder | Safe parallel development, easy rollback |
| Scope | All 8 sections | Full design as shown in PDF |

## Design System

### Color Palette (Tailwind Config)

```js
// tailwind.config.js - extend colors
{
  'mm-primary-dark': '#1e3a4c',  // Header, hero background
  'mm-accent': '#d85a6a',        // Buttons, highlights, coral sections
  'mm-bg-light': '#f7f7f7',      // Page background
  'mm-bg-muted': '#e8e8e8',      // Contact section background
  'mm-success': '#4caf50',       // Checkmarks
  'mm-warning': '#f5a623',       // Alert icons
}
```

### Typography

- **Welcome text:** Playfair Display Italic (Google Font)
- **Headings:** System sans-serif, bold
- **Body:** System sans-serif, 16px base

### Spacing

- Section padding: 64px vertical (py-16)
- Max content width: 1100px
- Card padding: 24px (p-6)
- Component gap: 16px / 24px

### Border Radius

- Cards: 12px (rounded-xl)
- Buttons: 8px (rounded-lg)
- Badges: 20px (rounded-full)

## File Structure

```
src/
├── app/
│   └── teacher/
│       └── page.tsx              # Update to use v2 components
├── components/
│   └── teacher-v2/               # NEW folder
│       ├── TopNav.tsx
│       ├── HeroSection.tsx
│       ├── SchoolInfoCard.tsx
│       ├── ProjectSection.tsx
│       ├── ProjectCard.tsx
│       ├── ProjectTabs.tsx
│       ├── MusicianIntroSection.tsx
│       ├── ContactSection.tsx
│       ├── ResourcesSection.tsx
│       ├── ResourceCard.tsx
│       ├── ShopAccessSection.tsx
│       ├── TipsSection.tsx
│       └── TipAccordionItem.tsx
```

## Component Specifications

### 1. TopNav

**Purpose:** Sticky header with login area and logout button

```tsx
interface TopNavProps {
  teacherName: string;
  schoolName: string;
  onLogout: () => void;
}
```

**Layout:**
- White background, subtle bottom border
- Left: "Login-Bereich" label + user info
- Right: "Abmelden" outlined button
- Sticky positioning, z-50
- Max-width 1100px centered

---

### 2. HeroSection

**Purpose:** Welcome banner with school info card overlay

```tsx
interface HeroSectionProps {
  firstName: string;
  schoolInfo: {
    schoolName: string;
    address?: string;
    email: string;
    phone?: string;
  };
  onEditInfo: () => void;
}
```

**Layout:**
- Full-width `bg-mm-primary-dark`
- Two-column grid on desktop
- Left: Italic welcome text (Playfair Display) + description
- Right: White SchoolInfoCard
- Decorative dotted circle pattern top-right

---

### 3. SchoolInfoCard

**Purpose:** Display school contact info with edit option

```tsx
interface SchoolInfoCardProps {
  schoolName: string;
  address?: string;
  email: string;
  phone?: string;
  onEdit: () => void;
}
```

**Layout:**
- White card, rounded-xl, shadow-lg
- School name as heading
- Address, email (as link), phone listed
- "Daten ändern" text link at bottom
- Reuses existing EditSchoolInfoModal

---

### 4. ProjectSection

**Purpose:** Container for project tabs and cards

```tsx
interface ProjectSectionProps {
  events: TeacherEventView[];
  activeFilter: 'all' | 'upcoming' | 'completed';
  onFilterChange: (filter: 'all' | 'upcoming' | 'completed') => void;
}
```

**Layout:**
- White background section
- ProjectTabs at top
- Two-column grid: ProjectCard left, empty state right
- Handles navigation between multiple projects

---

### 5. ProjectTabs

**Purpose:** Filter tabs for projects

```tsx
interface ProjectTabsProps {
  activeFilter: 'all' | 'upcoming' | 'completed';
  counts: { total: number; upcoming: number; completed: number };
  onChange: (filter: 'all' | 'upcoming' | 'completed') => void;
}
```

**Styling:**
- Active tab: `bg-mm-primary-dark text-white rounded-full`
- Inactive tabs: `border border-gray-300 text-gray-600 rounded-full`

---

### 6. ProjectCard

**Purpose:** Display single project with progress

```tsx
interface ProjectCardProps {
  event: TeacherEventView;
}
```

**Layout:**
- Coral header (`bg-mm-accent`) with calendar icon + date
- Status badges (pill shaped, coral tint)
- Checklist items with check/warning icons
- "Was ist noch zu tun?" link
- "Zur Liederliste" button (`bg-mm-primary-dark`)

---

### 7. MusicianIntroSection

**Purpose:** Introduce the visiting musician

```tsx
interface MusicianIntroSectionProps {
  representative: MinimusikanRepresentative | null;
  isLoading: boolean;
  onContactClick: () => void;
}
```

**Layout:**
- Full-width `bg-mm-accent` coral background
- Centered heading: "Am Minimusikertag komme ICH zu euch!"
- Circular photo with white border
- Bio text + "Kontakt zu [Name]" link
- Reuses existing RepresentativeContactModal

---

### 8. ContactSection

**Purpose:** General support contact info

**Layout:**
- Full-width `bg-mm-bg-muted` gray background
- Two-column: content left, decorative image right
- Heading: "Fragen zum Ablauf oder der Organisation?"
- Support text + email/phone links
- Decorative image hidden on mobile

---

### 9. ResourcesSection

**Purpose:** Display downloadable PDFs and videos

```tsx
interface Resource {
  id: string;
  title: string;
  thumbnail: string;
  type: 'pdf' | 'video';
  href: string;
}

interface ResourcesSectionProps {
  resources: Resource[];
}
```

**Layout:**
- White background
- Heading + intro paragraph
- 4-column grid (2-column on mobile)
- ResourceCard: thumbnail + coral download button

---

### 10. ShopAccessSection

**Purpose:** Display discount code and shop link

```tsx
interface ShopAccessSectionProps {
  discountCode: string;
  shopUrl?: string;
}
```

**Layout:**
- White background
- Heading + intro paragraph
- Coral "zum Shop" button
- Dashed border box with discount code

---

### 11. TipsSection

**Purpose:** Expandable preparation tips

```tsx
interface TipsSectionProps {
  tips: PreparationTip[];
  isLoading: boolean;
}
```

**Layout:**
- White background
- Two-column: accordion left, decorative image right
- TipAccordionItem with rotating chevron
- Smooth expand/collapse animation
- Reuses existing `/api/teacher/tips` endpoint

---

### 12. TipAccordionItem

**Purpose:** Single expandable tip

```tsx
interface TipAccordionItemProps {
  title: string;
  content: string;
  defaultOpen?: boolean;
}
```

**Styling:**
- Border-bottom separator
- Chevron icon rotates on open
- CSS transition for smooth animation

## Page Layout

```tsx
<div className="min-h-screen bg-mm-bg-light">
  <TopNav />
  <main>
    <HeroSection />           {/* bg-mm-primary-dark */}
    <ProjectSection />        {/* bg-white */}
    <MusicianIntroSection />  {/* bg-mm-accent */}
    <ContactSection />        {/* bg-mm-bg-muted */}
    <ResourcesSection />      {/* bg-white */}
    <ShopAccessSection />     {/* bg-white */}
    <TipsSection />           {/* bg-white */}
  </main>
</div>
```

## Responsive Breakpoints

| Breakpoint | Behavior |
|------------|----------|
| Desktop (1200px+) | Full layout, 2-column grids, 4-column resources |
| Tablet (768-1199px) | 2-column resources, stacked project section |
| Mobile (<768px) | Single column, hidden decorative images, 2-column resources |

## Data Sources

| Section | Source | Status |
|---------|--------|--------|
| TopNav | Existing teacher auth | Ready |
| HeroSection | `/api/teacher/profile` | Ready |
| ProjectSection | `/api/teacher/events` | Ready |
| MusicianIntroSection | `/api/teacher/representative` | Ready |
| ContactSection | Hardcoded/config | Ready |
| ResourcesSection | Placeholder | Placeholder for now |
| ShopAccessSection | Placeholder | Placeholder for now |
| TipsSection | `/api/teacher/tips` | Ready |

## Accessibility Considerations

- Focus rings on all interactive elements
- ARIA labels for icon-only buttons
- Keyboard navigation for accordion
- Sufficient color contrast (verify coral on white)
- Screen reader text for decorative elements
- Reduced motion support for animations

## Implementation Phases

### Phase 1: Foundation
- [ ] Add color tokens to tailwind.config.js
- [ ] Set up Playfair Display font
- [ ] Create `src/components/teacher-v2/` directory
- [ ] Create base page layout structure

### Phase 2: Header & Hero
- [ ] Build TopNav component
- [ ] Build HeroSection component
- [ ] Build SchoolInfoCard component
- [ ] Integrate EditSchoolInfoModal

### Phase 3: Projects
- [ ] Build ProjectTabs component
- [ ] Build ProjectCard component
- [ ] Build ProjectSection container
- [ ] Handle empty state

### Phase 4: Feature Sections
- [ ] Build MusicianIntroSection
- [ ] Build ContactSection
- [ ] Build ResourcesSection + ResourceCard
- [ ] Build ShopAccessSection
- [ ] Build TipsSection + TipAccordionItem

### Phase 5: Integration & Polish
- [ ] Wire up page.tsx with v2 components
- [ ] Test all breakpoints
- [ ] Add hover/focus states
- [ ] Accessibility audit
- [ ] Remove old components (after validation)
