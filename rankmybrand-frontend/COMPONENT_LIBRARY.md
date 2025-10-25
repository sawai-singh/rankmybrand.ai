# RankMyBrand.ai Component Library

**Version:** 2.0
**Last Updated:** 2025-10-25
**Status:** Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Components](#components)
   - [Button](#button)
   - [Input](#input)
   - [Card](#card)
   - [Avatar](#avatar)
   - [Alert](#alert)
   - [Breadcrumbs](#breadcrumbs)
   - [Skeleton](#skeleton)
3. [Design System](#design-system)
4. [Usage Examples](#usage-examples)

---

## Overview

This component library provides a comprehensive set of UI components built with:
- **React 18+** with TypeScript
- **Tailwind CSS** for styling
- **Radix UI** for accessibility primitives
- **Class Variance Authority (CVA)** for variant management
- **Framer Motion** for animations (where applicable)

All components are:
- ✅ **Fully accessible** (WCAG AA compliant)
- ✅ **Dark mode compatible**
- ✅ **Responsive** (mobile-first approach)
- ✅ **Type-safe** with TypeScript
- ✅ **Customizable** via className prop

---

## Components

### Button

Enhanced button component with gradient support, loading states, and icon support.

#### Import

```tsx
import { Button } from '@/components/ui/button';
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'default' \| 'destructive' \| 'outline' \| 'secondary' \| 'ghost' \| 'link' \| 'success'` | `'default'` | Button style variant |
| `size` | `'default' \| 'sm' \| 'lg' \| 'xl' \| 'icon'` | `'default'` | Button size |
| `loading` | `boolean` | `false` | Shows loading spinner |
| `leftIcon` | `React.ReactNode` | - | Icon on left side |
| `rightIcon` | `React.ReactNode` | - | Icon on right side |
| `asChild` | `boolean` | `false` | Render as child element |

#### Variants

**Default** - Primary purple gradient
```tsx
<Button>Get Started</Button>
```

**Success** - Green gradient
```tsx
<Button variant="success">Save Changes</Button>
```

**Destructive** - Red for dangerous actions
```tsx
<Button variant="destructive">Delete Account</Button>
```

**Outline** - Bordered button
```tsx
<Button variant="outline">Cancel</Button>
```

**Ghost** - Minimal button
```tsx
<Button variant="ghost">Learn More</Button>
```

**Link** - Text link style
```tsx
<Button variant="link">View Details</Button>
```

#### Sizes

```tsx
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="xl">Extra Large</Button>
<Button size="icon"><Icon /></Button>
```

#### Loading State

```tsx
<Button loading>Processing...</Button>
```

#### With Icons

```tsx
import { ArrowRight, Download } from 'lucide-react';

<Button leftIcon={<Download />}>Download</Button>
<Button rightIcon={<ArrowRight />}>Continue</Button>
```

#### Features

- ✅ Primary gradient using brand colors
- ✅ Loading state with spinner
- ✅ Icon support (left/right)
- ✅ Active scale effect (0.98)
- ✅ Focus ring with primary color
- ✅ Disabled state handling

---

### Input

Enhanced input component with size variants, icon support, and error states.

#### Import

```tsx
import { Input } from '@/components/ui/input';
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'default' \| 'error' \| 'success'` | `'default'` | Input style variant |
| `inputSize` | `'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` | Input size |
| `leftIcon` | `React.ReactNode` | - | Icon on left side |
| `rightIcon` | `React.ReactNode` | - | Icon on right side |
| `error` | `string` | - | Error message to display |

#### Basic Usage

```tsx
<Input placeholder="Enter your email" />
```

#### With Icons

```tsx
import { Mail, Search } from 'lucide-react';

<Input leftIcon={<Mail />} placeholder="Email" />
<Input rightIcon={<Search />} placeholder="Search..." />
```

#### Size Variants

```tsx
<Input inputSize="sm" placeholder="Small input" />
<Input inputSize="md" placeholder="Medium input" />
<Input inputSize="lg" placeholder="Large input" />
<Input inputSize="xl" placeholder="Extra large input" />
```

#### Error State

```tsx
<Input
  error="Email is required"
  id="email"
  placeholder="Enter your email"
/>
```

#### Success State

```tsx
<Input
  variant="success"
  placeholder="Email verified"
/>
```

#### Features

- ✅ Size variants (sm, md, lg, xl)
- ✅ Icon support with proper spacing
- ✅ Error state with red border and message
- ✅ Success state with green border
- ✅ ARIA attributes for accessibility
- ✅ Focus ring with primary color

---

### Card

Enhanced card component with elevation shadows and hover effects.

#### Import

```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `elevation` | `'none' \| 'low' \| 'medium' \| 'high'` | `'low'` | Shadow elevation level |
| `hover` | `'none' \| 'lift'` | `'none'` | Hover effect |

#### Basic Usage

```tsx
<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description text</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Card content goes here</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>
```

#### Elevation Variants

```tsx
<Card elevation="low">Low elevation card</Card>
<Card elevation="medium">Medium elevation card</Card>
<Card elevation="high">High elevation card</Card>
<Card elevation="none">No shadow card</Card>
```

#### Hover Effect

```tsx
<Card hover="lift">
  Lifts on hover with elevated shadow
</Card>
```

#### Features

- ✅ Elevation shadows from design system
- ✅ Semantic color tokens (theme-aware)
- ✅ Compound component pattern
- ✅ Hover lift effect option
- ✅ Smooth transitions

---

### Avatar

Avatar component with fallback, status indicators, and multiple sizes.

#### Import

```tsx
import { Avatar } from '@/components/ui/avatar';
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `src` | `string` | - | Image source URL |
| `alt` | `string` | - | Image alt text |
| `fallback` | `string` | - | Fallback text (2 chars max) |
| `size` | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl' \| '2xl'` | `'md'` | Avatar size |
| `shape` | `'circle' \| 'square'` | `'circle'` | Avatar shape |
| `status` | `'online' \| 'offline' \| 'away' \| 'busy'` | - | Status indicator |

#### Basic Usage

```tsx
<Avatar
  src="/avatar.jpg"
  alt="John Doe"
/>
```

#### With Fallback

```tsx
<Avatar
  alt="John Doe"
  fallback="JD"
/>
```

#### Auto-Generated Initials

```tsx
<Avatar alt="John Doe" />
<!-- Automatically generates "JD" -->
```

#### Sizes

```tsx
<Avatar size="xs" alt="User" />
<Avatar size="sm" alt="User" />
<Avatar size="md" alt="User" />
<Avatar size="lg" alt="User" />
<Avatar size="xl" alt="User" />
<Avatar size="2xl" alt="User" />
```

#### With Status

```tsx
<Avatar
  src="/avatar.jpg"
  alt="John Doe"
  status="online"
/>
```

#### Square Shape

```tsx
<Avatar
  shape="square"
  src="/avatar.jpg"
  alt="Company Logo"
/>
```

#### Features

- ✅ 6 size variants
- ✅ Circle and square shapes
- ✅ Automatic initials generation
- ✅ Status indicators (4 states)
- ✅ Gradient fallback using brand colors
- ✅ Error handling for broken images

---

### Alert

Alert component for displaying notifications and messages.

#### Import

```tsx
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'default' \| 'success' \| 'error' \| 'warning' \| 'info'` | `'default'` | Alert style |
| `dismissible` | `boolean` | `false` | Show close button |
| `onDismiss` | `() => void` | - | Called when dismissed |
| `icon` | `React.ReactNode` | - | Custom icon |
| `hideIcon` | `boolean` | `false` | Hide icon |

#### Basic Usage

```tsx
<Alert>
  <AlertTitle>Information</AlertTitle>
  <AlertDescription>
    This is an informational alert.
  </AlertDescription>
</Alert>
```

#### Variants

**Success**
```tsx
<Alert variant="success">
  <AlertTitle>Success!</AlertTitle>
  <AlertDescription>
    Your changes have been saved.
  </AlertDescription>
</Alert>
```

**Error**
```tsx
<Alert variant="error">
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>
    Something went wrong.
  </AlertDescription>
</Alert>
```

**Warning**
```tsx
<Alert variant="warning">
  <AlertTitle>Warning</AlertTitle>
  <AlertDescription>
    Please review your changes.
  </AlertDescription>
</Alert>
```

**Info**
```tsx
<Alert variant="info">
  <AlertTitle>Did you know?</AlertTitle>
  <AlertDescription>
    You can customize this alert.
  </AlertDescription>
</Alert>
```

#### Dismissible

```tsx
<Alert
  variant="success"
  dismissible
  onDismiss={() => console.log('Dismissed')}
>
  <AlertTitle>Dismissible Alert</AlertTitle>
  <AlertDescription>
    Click the X to dismiss.
  </AlertDescription>
</Alert>
```

#### Custom Icon

```tsx
import { Sparkles } from 'lucide-react';

<Alert icon={<Sparkles />}>
  <AlertTitle>Custom Icon</AlertTitle>
  <AlertDescription>
    Using a custom icon.
  </AlertDescription>
</Alert>
```

#### Features

- ✅ 5 semantic variants
- ✅ Automatic icon mapping
- ✅ Dismissible with animation
- ✅ Custom icon support
- ✅ Dark mode support
- ✅ ARIA role="alert"

---

### Breadcrumbs

Navigation breadcrumb component with collapse support.

#### Import

```tsx
import { Breadcrumbs } from '@/components/ui/breadcrumbs';
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `items` | `BreadcrumbItem[]` | - | Array of breadcrumb items |
| `separator` | `React.ReactNode` | `<ChevronRight />` | Custom separator |
| `showHome` | `boolean` | `true` | Show home icon |
| `maxItems` | `number` | - | Max items before collapse |

#### BreadcrumbItem Type

```tsx
interface BreadcrumbItem {
  label: string
  href?: string
  icon?: React.ReactNode
  current?: boolean
}
```

#### Basic Usage

```tsx
<Breadcrumbs
  items={[
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Settings', href: '/settings' },
    { label: 'Profile', current: true }
  ]}
/>
```

#### With Icons

```tsx
import { Settings, User } from 'lucide-react';

<Breadcrumbs
  items={[
    { label: 'Settings', href: '/settings', icon: <Settings /> },
    { label: 'Profile', current: true, icon: <User /> }
  ]}
/>
```

#### Collapsed Breadcrumbs

```tsx
<Breadcrumbs
  maxItems={4}
  items={[
    { label: 'Level 1', href: '/1' },
    { label: 'Level 2', href: '/2' },
    { label: 'Level 3', href: '/3' },
    { label: 'Level 4', href: '/4' },
    { label: 'Level 5', current: true }
  ]}
/>
```

#### Custom Separator

```tsx
<Breadcrumbs
  separator={<span>/</span>}
  items={[...]}
/>
```

#### Without Home Icon

```tsx
<Breadcrumbs
  showHome={false}
  items={[...]}
/>
```

#### Features

- ✅ Flexible item structure
- ✅ Custom separator support
- ✅ Auto-collapse long paths
- ✅ Expand collapsed items
- ✅ Icon support per item
- ✅ ARIA attributes (aria-current)
- ✅ Semantic HTML (nav, ol, li)

---

### Skeleton

Loading skeleton component with multiple variants and presets.

#### Import

```tsx
import {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonAvatar,
  SkeletonTable
} from '@/components/ui/skeleton';
```

#### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'default' \| 'shimmer' \| 'wave'` | `'default'` | Animation style |
| `width` | `string \| number` | - | Custom width |
| `height` | `string \| number` | - | Custom height |
| `circle` | `boolean` | `false` | Circular skeleton |

#### Basic Usage

```tsx
<Skeleton className="h-4 w-full" />
```

#### Variants

**Default** - Simple pulse animation
```tsx
<Skeleton variant="default" className="h-12 w-12" />
```

**Shimmer** - Gradient shimmer effect
```tsx
<Skeleton variant="shimmer" className="h-12 w-full" />
```

**Wave** - Wave animation
```tsx
<Skeleton variant="wave" className="h-12 w-full" />
```

#### Custom Dimensions

```tsx
<Skeleton width={200} height={100} />
<Skeleton width="50%" height="2rem" />
```

#### Circle

```tsx
<Skeleton circle width={48} height={48} />
```

#### Preset Components

**Text Lines**
```tsx
<SkeletonText lines={3} />
```

**Card**
```tsx
<SkeletonCard />
```

**Avatar**
```tsx
<SkeletonAvatar size="md" />
```

**Table**
```tsx
<SkeletonTable rows={5} columns={4} />
```

#### Features

- ✅ 3 animation variants
- ✅ Custom dimensions
- ✅ Circle variant for avatars
- ✅ Preset components for common patterns
- ✅ ARIA attributes (aria-busy, aria-live)
- ✅ Dark mode support

---

## Design System

### Color System

All components use semantic color tokens that adapt to light/dark mode:

```tsx
// Background colors
bg-background
bg-card
bg-popover

// Text colors
text-foreground
text-muted-foreground
text-card-foreground

// Primary brand colors
bg-primary-500
bg-primary-600
bg-primary-700

// Semantic colors
bg-success
bg-warning
bg-destructive

// Accent colors
bg-accent-green
bg-accent-blue
bg-accent-amber
bg-accent-red
```

### Shadow Elevation

Components use the elevation system from design-system.css:

```tsx
shadow-elevation-low    // Subtle elevation
shadow-elevation-medium // Standard cards
shadow-elevation-high   // Modals, popovers
```

### Spacing

Consistent spacing using Tailwind's default scale:

```tsx
p-4   // 16px padding
gap-6 // 24px gap
space-y-4 // 16px vertical spacing
```

### Typography

Fluid typography scales from mobile to desktop:

```tsx
.fluid-text-xl   // Responsive extra large text
.fluid-heading   // Responsive heading
.fluid-body      // Responsive body text
```

### Animations

Smooth animations with reduced motion support:

```tsx
transition-all duration-200  // Standard transition
hover:scale-105             // Hover scale
active:scale-[0.98]         // Active press
```

---

## Usage Examples

### Login Form

```tsx
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, Lock } from 'lucide-react';

function LoginForm() {
  const [error, setError] = useState('');

  return (
    <Card elevation="medium">
      <CardHeader>
        <CardTitle>Sign In</CardTitle>
        <CardDescription>Enter your credentials</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="error" dismissible onDismiss={() => setError('')}>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Input
          leftIcon={<Mail />}
          placeholder="Email"
          type="email"
        />

        <Input
          leftIcon={<Lock />}
          placeholder="Password"
          type="password"
        />
      </CardContent>
      <CardFooter>
        <Button className="w-full">Sign In</Button>
      </CardFooter>
    </Card>
  );
}
```

### User Profile Card

```tsx
import { Avatar } from '@/components/ui/avatar';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

function UserProfile() {
  return (
    <Card elevation="medium" hover="lift">
      <CardHeader className="flex-row items-center gap-4">
        <Avatar
          src="/user.jpg"
          alt="John Doe"
          size="lg"
          status="online"
        />
        <div>
          <h3 className="font-semibold">John Doe</h3>
          <p className="text-sm text-muted-foreground">Product Designer</p>
        </div>
      </CardHeader>
      <CardContent>
        <Button variant="outline" className="w-full">View Profile</Button>
      </CardContent>
    </Card>
  );
}
```

### Loading State

```tsx
import { SkeletonCard, SkeletonText } from '@/components/ui/skeleton';

function LoadingState() {
  return (
    <div className="space-y-4">
      <SkeletonCard />
      <SkeletonText lines={3} />
    </div>
  );
}
```

### Notification System

```tsx
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

function Notifications() {
  return (
    <div className="space-y-4">
      <Alert variant="success" dismissible>
        <AlertTitle>Changes saved</AlertTitle>
        <AlertDescription>
          Your profile has been updated successfully.
        </AlertDescription>
      </Alert>

      <Alert variant="warning">
        <AlertTitle>Action required</AlertTitle>
        <AlertDescription>
          Please verify your email address.
        </AlertDescription>
      </Alert>
    </div>
  );
}
```

---

## Best Practices

### Accessibility

- Always provide `alt` text for Avatar components
- Use `aria-label` for icon-only buttons
- Provide error messages with `id` for proper ARIA linking
- Use semantic HTML (nav, article, section)

### Performance

- Use `loading` prop on buttons during async operations
- Show Skeleton components while data is loading
- Avoid nesting too many elevation layers

### Consistency

- Use the same button variant for primary actions
- Maintain consistent spacing (p-4, gap-6)
- Use semantic color tokens instead of hardcoded colors
- Follow the elevation hierarchy (low → medium → high)

### Dark Mode

- All components automatically support dark mode
- Use semantic tokens (bg-background, text-foreground)
- Test in both light and dark modes
- Avoid hardcoding colors

---

## Migration Guide

### From Old Button to New Button

**Before:**
```tsx
<button className="bg-gradient-to-r from-primary-500 to-primary-600">
  Submit
</button>
```

**After:**
```tsx
<Button>Submit</Button>
```

### From Old Input to New Input

**Before:**
```tsx
<input className="px-4 py-3 rounded-xl focus:ring-primary-500" />
```

**After:**
```tsx
<Input inputSize="lg" />
```

### From Old Card to New Card

**Before:**
```tsx
<div className="rounded-lg border border-gray-200 bg-white shadow-sm">
  ...
</div>
```

**After:**
```tsx
<Card elevation="low">
  ...
</Card>
```

---

## Support

For questions or issues:
- Check the [Design System Analysis](./DASHBOARD_POPULATION_FIX_COMPLETE.md)
- Review component source code in `src/components/ui/`
- Refer to Tailwind CSS documentation

**Last Updated:** 2025-10-25
**Component Library Version:** 2.0
