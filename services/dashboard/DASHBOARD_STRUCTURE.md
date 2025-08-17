# RankMyBrand Dashboard - Complete File Structure Map

## Overview
The dashboard is a Next.js 14 application that serves as the main user interface after onboarding. It displays GEO scores, competitor analysis, AI visibility metrics, and actionable recommendations.

## Directory Structure

```
services/dashboard/
├── app/                      # Next.js App Router pages
├── components/               # Reusable React components
├── hooks/                    # Custom React hooks
├── lib/                      # Utility functions and clients
└── public/                   # Static assets
```

## File-by-File Breakdown

### 📁 **app/** - Application Pages & Routing

#### **app/page.tsx** (Main Dashboard)
- **Purpose**: Main authenticated dashboard page
- **Features**:
  - Hero metrics display (GEO Score, Visibility, Share of Voice, Actions)
  - AI Visibility Heatmap showing scores across platforms
  - 3D Competitor Landscape visualization
  - Activity Feed with real-time updates
  - Smart Recommendations panel
  - Welcome modal for first-time users
- **Data Sources**: Fetches from API Gateway endpoints
- **Key Components Used**: HeroMetrics, AIVisibilityHeatmap, CompetitorLandscape3D, ActivityFeed, SmartRecommendations

#### **app/admin/page.tsx** (Admin Panel)
- **Purpose**: Admin dashboard for viewing all tracked users
- **Features**:
  - User tracking overview with stats cards
  - Search and filter functionality
  - Export to CSV capability
  - Detailed user activity modal
  - Status indicators with color coding
- **Data**: Queries PostgreSQL via `/api/admin/users` endpoint
- **Status Tracking**:
  - Gray: email_entered
  - Blue: email_validated
  - Purple: company_enriched
  - Cyan: description_generated
  - Indigo: competitors_selected
  - Green: completed

#### **app/demo/page.tsx** (Demo Dashboard)
- **Purpose**: Standalone demo version with mock data
- **Features**: Same as main dashboard but with hardcoded demo data
- **Use Case**: Product demonstrations without backend

#### **app/login/page.tsx** (Login Page)
- **Purpose**: Authentication page (currently redirects to onboarding)
- **Features**: Basic login form structure
- **Note**: Not fully implemented - users go through onboarding flow

#### **app/layout.tsx** (Root Layout)
- **Purpose**: Application shell and global providers
- **Features**:
  - Font configuration (Inter)
  - Global metadata
  - Theme provider wrapper
  - Toast notifications setup

#### **app/providers.tsx** (Context Providers)
- **Purpose**: Wraps app with necessary providers
- **Includes**:
  - React Query provider
  - Theme provider
  - Future: Auth context

#### **app/globals.css** (Global Styles)
- **Purpose**: Tailwind CSS configuration and custom styles
- **Features**:
  - CSS variables for theming
  - Glassmorphism effects
  - Animation utilities
  - Custom scrollbar styles

### 📁 **components/** - Reusable Components

#### **components/hero-metrics.tsx**
- **Purpose**: Top dashboard metrics cards
- **Displays**: GEO Score, Visibility %, Share of Voice, Action Count
- **Features**: Animated counters, loading states, error handling

#### **components/ai-visibility-heatmap.tsx**
- **Purpose**: Platform-specific AI visibility scores
- **Platforms**: ChatGPT, Claude, Perplexity, Gemini, Bing, You.com, Poe, HuggingChat
- **Visualization**: Color-coded heatmap with hover effects

#### **components/competitor-landscape-3d.tsx**
- **Purpose**: 3D scatter plot of competitor positions
- **Libraries**: Recharts for visualization
- **Axes**: GEO Score (Y) vs Share of Voice (X)
- **Features**: Interactive tooltips, animated transitions

#### **components/activity-feed.tsx**
- **Purpose**: Real-time activity stream
- **Features**: Auto-refresh, status indicators, timestamps
- **WebSocket**: Subscribes to real-time updates

#### **components/smart-recommendations.tsx**
- **Purpose**: AI-generated action items
- **Features**: Priority levels, impact predictions, actionable insights
- **Categories**: High/Medium/Low priority

#### **components/streaming-text.tsx**
- **Purpose**: Animated text reveal effect
- **Use**: Dashboard welcome messages and notifications

#### **components/welcome-modal.tsx**
- **Purpose**: First-time user onboarding
- **Features**: Interactive tutorial, feature highlights
- **Trigger**: Shows on first dashboard visit

#### **components/command-palette.tsx**
- **Purpose**: Global keyboard shortcuts (Cmd+K)
- **Features**: Quick navigation, search, actions
- **Commands**: Navigate pages, trigger analyses, view help

#### **components/api-status-indicator.tsx**
- **Purpose**: Shows backend service health
- **Services**: GEO Calculator, Intelligence Engine, API Gateway
- **Display**: Green/yellow/red status dots

### 📁 **components/ui/** - UI Primitives

- **command.tsx**: Command palette UI component
- **dialog.tsx**: Modal dialog component
- **toast.tsx**: Toast notification component
- **toaster.tsx**: Toast container and manager
- **use-toast.ts**: Toast hook for triggering notifications

### 📁 **hooks/** - Custom React Hooks

#### **hooks/use-realtime-data.ts**
- **Purpose**: WebSocket connection management
- **Features**:
  - Auto-reconnection logic
  - Message parsing
  - Error handling
  - Subscription management

### 📁 **lib/** - Utilities & Clients

#### **lib/api-client.ts**
- **Purpose**: Centralized API communication
- **Features**:
  - JWT token management
  - Request/response interceptors
  - Error handling
  - Base URL configuration

#### **lib/websocket-client.ts**
- **Purpose**: WebSocket client singleton
- **Features**:
  - Connection pooling
  - Event emitter pattern
  - Reconnection strategy

#### **lib/query-client.ts**
- **Purpose**: React Query configuration
- **Settings**:
  - Cache time: 5 minutes
  - Stale time: 1 minute
  - Retry logic: 3 attempts

#### **lib/utils.ts**
- **Purpose**: Utility functions
- **Includes**:
  - Class name merger (cn)
  - Date formatting
  - Number formatting
  - String helpers

### 📁 **Configuration Files**

#### **next.config.mjs**
- Next.js configuration
- API proxy settings
- Environment variables

#### **tailwind.config.ts**
- Tailwind CSS configuration
- Custom color palette
- Animation definitions

#### **tsconfig.json**
- TypeScript configuration
- Path aliases (@/*)
- Strict mode settings

#### **package.json**
- Dependencies:
  - Next.js 14
  - React 18
  - Recharts (charts)
  - Framer Motion (animations)
  - React Query (data fetching)
  - Radix UI (components)

## Data Flow

```
User Login/Onboarding
        ↓
   API Gateway
        ↓
  Dashboard Page
        ↓
   Components
   ├── API Calls (api-client.ts)
   ├── WebSocket (websocket-client.ts)
   └── React Query (caching)
```

## Key API Endpoints Used

- `/api/metrics/current` - Current GEO metrics
- `/api/ai/visibility` - Platform visibility scores
- `/api/competitors` - Competitor analysis
- `/api/recommendations` - AI recommendations
- `/api/activities` - Activity feed
- `/api/admin/users` - Admin user list
- `/ws` - WebSocket connection

## Environment Variables

```env
NEXT_PUBLIC_API_GATEWAY - API Gateway URL (default: http://localhost:4000)
NEXT_PUBLIC_WS_URL - WebSocket URL (default: ws://localhost:4000/ws)
```

## Getting Started

1. **Install dependencies**: `npm install`
2. **Set environment variables**: Copy `.env.example` to `.env.local`
3. **Run development server**: `npm run dev`
4. **Build for production**: `npm run build`

## Authentication Flow

1. User enters email on onboarding
2. Completes onboarding steps
3. Receives JWT token
4. Token stored in localStorage
5. Dashboard uses token for API calls

## Real-time Updates

The dashboard subscribes to WebSocket channels for:
- GEO score updates
- Competitor changes
- New recommendations
- Activity notifications

## Component Hierarchy

```
Layout
└── Providers
    └── Dashboard Page
        ├── HeroMetrics
        ├── AIVisibilityHeatmap
        ├── CompetitorLandscape3D
        ├── ActivityFeed
        ├── SmartRecommendations
        └── WelcomeModal (first visit)
```

## Styling Approach

- **Tailwind CSS** for utility classes
- **CSS Modules** for component-specific styles
- **Glassmorphism** for modern UI effects
- **Dark mode** as default theme
- **Responsive design** for all screen sizes