# AI Status Dashboard - Complete UI Specification

## OVERVIEW
This document captures EVERY UI element, interaction, state, and behavior using modern specification methods:
- **Component Trees** - Hierarchical structure
- **Interaction Maps** - User flows and triggers  
- **State Diagrams** - Component states and transitions
- **Accessibility Specs** - ARIA, keyboard, screen reader
- **Responsive Breakpoints** - Mobile/tablet/desktop behaviors

## 1. PAGE STRUCTURE

### Root Layout (`app/layout.tsx`)
```
<html>
├── <head> (metadata, analytics, fonts)
├── <body>
│   ├── <Navbar />
│   ├── <main>{children}</main>
│   └── <Footer />
```

### Main Page (`app/page.tsx`)
```
<ClientWrapper>
├── <DashboardTabs statuses={statusData} />
```

## 2. NAVBAR COMPONENT (`app/components/Navbar.tsx`)

### Component Tree
```
<header className="bg-slate-700 dark:bg-gray-800">
├── <div className="flex items-center justify-between w-full px-4 py-4">
│   ├── <div className="flex items-center gap-6">
│   │   ├── <div className="relative"> (logo container)
│   │   │   ├── <div className="absolute -inset-2 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full opacity-75 blur-md animate-pulse">
│   │   │   └── <div className="relative bg-white rounded-full p-2 shadow-xl">
│   │   │       └── <Image src="/logo.png" alt="AI Status Dashboard Logo" width={48} height={48} />
│   │   └── <h1 className="text-2xl font-bold">AI Status Dashboard</h1>
│   │   └── **[MISSING: <DarkModeToggle />]** 
│   └── <nav className="flex gap-6">
│       ├── <a href="/">Dashboard</a>
│       ├── <a href="/api/status">API</a>
│       └── <a href="/rss.xml">RSS Feed</a>
```

### Current Issues
- ❌ **Missing Dark Mode Toggle** - Should be between logo and navigation
- ❌ **No keyboard navigation** for nav links
- ❌ **No active state** indicators
- ❌ **No mobile hamburger menu**

### Required Interactions
1. **Logo Click**: Navigate to home page
2. **Dark Mode Toggle**: Switch between light/dark themes
3. **Navigation Links**: 
   - Dashboard → `/`
   - API → `/api/status` 
   - RSS Feed → `/rss.xml`
4. **Keyboard Navigation**: Tab through all interactive elements
5. **Mobile Responsive**: Collapse navigation on small screens

### States
- **Light Theme**: `bg-slate-700 text-white`
- **Dark Theme**: `dark:bg-gray-800 text-white`
- **Logo Animation**: Continuous pulsing glow effect
- **Link Hover**: `hover:opacity-80 transition-opacity`

## 3. DASHBOARD TABS COMPONENT (`app/components/DashboardTabs.tsx`)

### Component Tree
```
<div className="min-h-screen bg-gray-50 dark:bg-gray-900">
├── <div className="max-w-6xl mx-auto px-4 py-8">
│   ├── **HEADER SECTION**
│   │   ├── <div className="text-center mb-8">
│   │   │   ├── <h2>🚀 All Systems Operational</h2> (dynamic based on status)
│   │   │   └── <div className="flex items-center gap-4">
│   │   │       ├── <span>System Status: Operational</span>
│   │   │       └── <span>Last updated: {time}</span>
│   │   ├── **SEARCH & FILTERS SECTION**
│   │   │   ├── <div className="mb-6 flex flex-col md:flex-row gap-4">
│   │   │   │   ├── <input placeholder="🔍 Search providers (press / to focus)" />
│   │   │   │   ├── <select>Status: All</select>
│   │   │   │   ├── <select>Speed: All</select>
│   │   │   │   ├── <select>Uptime: All</select>
│   │   │   │   ├── <select>Sort: Name</select>
│   │   │   │   └── <button>Clear Filters</button>
│   │   ├── **TAB NAVIGATION**
│   │   │   └── <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
│   │   │       ├── <button className={activeTab === 'dashboard' ? 'active' : ''}>📊 Dashboard</button>
│   │   │       ├── <button className={activeTab === 'api' ? 'active' : ''}>🚀 API Demo</button>
│   │   │       ├── <button className={activeTab === 'notifications' ? 'active' : ''}>🔔 Notifications</button>
│   │   │       └── <button className={activeTab === 'comments' ? 'active' : ''}>💬 Comments</button>
│   │   ├── **TAB CONTENT**
│   │   │   ├── {activeTab === 'dashboard' && <DashboardContent />}
│   │   │   ├── {activeTab === 'api' && <APIDemo />}
│   │   │   ├── {activeTab === 'notifications' && <NotificationPanel />}
│   │   │   └── {activeTab === 'comments' && <CommentSection />}
```

### Dashboard Content Structure
```
<DashboardContent>
├── **PROVIDER CARDS GRID**
│   └── <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
│       └── {filteredProviders.map(provider => <ProviderCard />)}
├── **SYSTEM METRICS**
│   └── <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
│       ├── <MetricCard title="System Health" value="99%" />
│       ├── <MetricCard title="Response Time" value="120ms" />
│       └── <MetricCard title="Providers" value="15" />
```

## 4. PROVIDER CARD COMPONENT

### Component Tree
```
<div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border-l-4 {borderColor} p-6">
├── **HEADER ROW**
│   └── <div className="flex items-center justify-between mb-4">
│       ├── <div className="flex items-center gap-3">
│       │   ├── <div className="w-8 h-8">
│       │   │   └── <img src="/logos/{provider}.svg" alt="{provider} logo" />
│       │   └── <div>
│       │       ├── <h3>{provider.name}</h3>
│       │       └── <p>AI Provider</p>
│       └── <div className="text-right">
│           └── <div className={statusColor}>
│               ├── {statusIcon}
│               └── <span>{status}</span>
├── **METRICS ROW**
│   └── <div className="flex items-center justify-between text-sm">
│       ├── <div>
│       │   ├── <span>Response: {responseTime}ms</span>
│       │   └── <span>Last checked: {timeAgo}</span>
│       └── <div>
│           └── <a href={statusPageUrl}>View Status Page</a>
```

### Status States & Visual Indicators
- **Operational**: `border-green-500`, `text-green-600`, `✅` icon
- **Degraded**: `border-yellow-500`, `text-yellow-600`, `⚠️` icon  
- **Down**: `border-red-500`, `text-red-600`, `🔴` icon
- **Unknown**: `border-gray-500`, `text-gray-600`, `❓` icon

### Interactions
1. **Card Hover**: `hover:shadow-md transition-shadow`
2. **Logo Error Fallback**: SVG → PNG → Hide
3. **Status Page Link**: Opens in new tab
4. **Click Card**: No action (could add provider details modal)

## 5. SEARCH & FILTER INTERACTIONS

### Search Input Behavior
```
<input 
  placeholder="🔍 Search providers (press / to focus)"
  onKeyDown={handleKeyDown}
  onChange={handleSearch}
/>
```

**Interactions**:
1. **"/" Key**: Focus search input (global keyboard shortcut)
2. **Escape Key**: Clear search and blur input
3. **Type**: Filter providers by name (case-insensitive, partial match)
4. **Clear**: Reset to show all providers

### Filter Dropdowns
```
<select onChange={handleStatusFilter}>
  <option value="">Status: All</option>
  <option value="operational">Operational</option>
  <option value="degraded">Degraded</option>
  <option value="down">Down</option>
  <option value="unknown">Unknown</option>
</select>

<select onChange={handleSpeedFilter}>
  <option value="">Speed: All</option>
  <option value="fast">Fast (&lt;100ms)</option>
  <option value="medium">Medium (100-500ms)</option>
  <option value="slow">Slow (&gt;500ms)</option>
</select>

<select onChange={handleUptimeFilter}>
  <option value="">Uptime: All</option>
  <option value="excellent">Excellent (&gt;99%)</option>
  <option value="good">Good (95-99%)</option>
  <option value="poor">Poor (&lt;95%)</option>
</select>

<select onChange={handleSortChange}>
  <option value="name">Sort: Name</option>
  <option value="status">Status</option>
  <option value="responseTime">Response Time</option>
  <option value="lastChecked">Last Checked</option>
</select>
```

**Clear Filters Button**:
```
<button 
  onClick={clearAllFilters}
  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
>
  Clear Filters
</button>
```

## 6. TAB COMPONENTS

### API Demo Tab (`app/components/APIDemo.tsx`)
```
<div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border">
├── **HEADER**
│   ├── <h2>🚀 AI Status Dashboard API</h2>
│   └── <p>Real-time API access to monitor 15+ AI providers...</p>
├── **PROVIDER SELECTION**
│   └── <select value={selectedProvider} onChange={setSelectedProvider}>
│       └── {providers.map(provider => <option>{provider}</option>)}
├── **API EXAMPLES**
│   └── <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
│       ├── **STATUS ENDPOINT**
│       │   ├── <h3>Get All Providers Status</h3>
│       │   ├── <button onClick={testAllStatus}>Test API</button>
│       │   └── <pre>{response}</pre>
│       ├── **HEALTH ENDPOINT**
│       │   ├── <h3>System Health Check</h3>
│       │   ├── <button onClick={testHealth}>Test API</button>
│       │   └── <pre>{response}</pre>
│       ├── **PROVIDER ENDPOINT**
│       │   ├── <h3>Single Provider Status</h3>
│       │   ├── <button onClick={testProvider}>Test API</button>
│       │   └── <pre>{response}</pre>
│       └── **WEBHOOK ENDPOINT**
│           ├── <h3>Webhook Registration</h3>
│           ├── <button onClick={testWebhook}>Test API</button>
│           └── <pre>{response}</pre>
```

**Current Issues**:
- ❌ **503 Service Unavailable** errors on all endpoints
- ❌ **Poor button styling** - inconsistent with theme
- ❌ **No loading states** during API calls
- ❌ **No error handling** for network failures

### Notification Panel Tab
```
<div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border">
├── **HEADER**
│   ├── <h2>🔔 AI Status Dashboard Notifications</h2>
│   └── <p>Stay informed about AI provider status changes...</p>
├── **EMAIL SUBSCRIPTION FORM**
│   ├── <div className="mb-4">
│   │   ├── <label>Email Address</label>
│   │   └── <input type="email" placeholder="your@email.com" />
│   ├── <div className="mb-4">
│   │   ├── <label>Select Providers</label>
│   │   └── <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
│   │       └── {providers.map(provider => 
│   │           <label>
│   │             <input type="checkbox" value={provider.id} />
│   │             {provider.name}
│   │           </label>
│   │         )}
│   ├── <div className="mb-6">
│   │   ├── <label>Notification Types</label>
│   │   └── <div className="space-y-2">
│   │       ├── <label><input type="checkbox" />Incidents</label>
│   │       ├── <label><input type="checkbox" />Recoveries</label>
│   │       └── <label><input type="checkbox" />Maintenance</label>
│   └── <div className="flex gap-4">
│       ├── <button onClick={subscribe}>Subscribe</button>
│       └── <button onClick={sendTest}>Send Test</button>
├── **WEBHOOK SUBSCRIPTION**
│   ├── <h3>Webhook Notifications</h3>
│   ├── <input placeholder="https://your-app.com/webhook" />
│   └── <button onClick={subscribeWebhook}>Subscribe Webhook</button>
```

**Current Issues**:
- ❌ **"Network error. Please try again."** on subscription
- ❌ **Missing form validation**
- ❌ **No success/error states**
- ❌ **Missing unsubscribe functionality**

### Comment Section Tab
```
<div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border">
├── **HEADER**
│   ├── <h2>💬 AI Status Dashboard Community</h2>
│   └── <p>Share feedback and discuss AI provider status...</p>
├── **COMMENT FORM**
│   ├── <div className="mb-4">
│   │   ├── <label>Name</label>
│   │   └── <input type="text" placeholder="Your name" />
│   ├── <div className="mb-4">
│   │   ├── <label>Email</label>
│   │   └── <input type="email" placeholder="your@email.com" />
│   ├── <div className="mb-4">
│   │   ├── <label>Comment</label>
│   │   └── <textarea placeholder="Share your thoughts..." />
│   ├── <div className="mb-4">
│   │   ├── <label>Provider (Optional)</label>
│   │   └── <select>
│   │       ├── <option value="">General Discussion</option>
│   │       └── {providers.map(provider => <option>{provider.name}</option>)}
│   └── <button onClick={submitComment}>Post Comment</button>
├── **COMMENTS LIST**
│   └── <div className="space-y-4">
│       └── {comments.map(comment => 
│           <div className="border-b pb-4">
│             ├── <div className="flex justify-between items-start">
│             │   ├── <strong>{comment.author}</strong>
│             │   └── <span>{comment.timeAgo}</span>
│             ├── <p>{comment.message}</p>
│             └── <div className="flex gap-2">
│                 ├── <button>👍 {comment.likes}</button>
│                 └── <button>Reply</button>
│           </div>
│         )}
```

**Current Issues**:
- ❌ **"Failed to load comments"** error
- ❌ **Comment posting failures**
- ❌ **No moderation system**
- ❌ **Missing pagination**

## 7. FOOTER COMPONENT (`app/components/Footer.tsx`)

### Component Tree
```
<footer className="bg-gray-100 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
├── **LEGAL DISCLAIMER**
│   └── <div className="text-center p-6 mb-4">
│       ├── <h3>⚖️ Legal Disclaimer</h3>
│       ├── <p>This dashboard is for reference only...</p>
│       └── <p>All company names, logos, and trademarks...</p>
├── **COPYRIGHT & LINKS**
│   └── <div className="text-center border-t pt-6 mb-4">
│       ├── <p>© 2025 AI Status Dashboard. Real-time AI Provider Monitoring since 2025</p>
│       └── <p>
│           ├── <a href="/api/health">System Health</a>
│           └── <a href="/api/status">JSON API</a>
├── **TECHNICAL INFO**
│   └── <div className="text-center">
│       ├── <p>Built with Next.js • Respects robots.txt and rate limits • Open source</p>
│       └── <p>Status checks are performed using official APIs and public status pages</p>
```

## 8. ACCESSIBILITY SPECIFICATIONS

### Keyboard Navigation
1. **Tab Order**: Logo → Dark Mode Toggle → Nav Links → Search → Filters → Provider Cards → Footer Links
2. **Focus Indicators**: Visible focus rings on all interactive elements
3. **Skip Links**: "Skip to main content" for screen readers
4. **Escape Key**: Close modals, clear search
5. **Enter/Space**: Activate buttons and links

### ARIA Labels & Roles
```html
<!-- Search Input -->
<input 
  aria-label="Search AI providers"
  aria-describedby="search-help"
  role="searchbox"
/>

<!-- Filter Dropdowns -->
<select aria-label="Filter by status">
<select aria-label="Filter by response speed">
<select aria-label="Filter by uptime">
<select aria-label="Sort providers">

<!-- Provider Cards -->
<div 
  role="article"
  aria-labelledby="provider-{id}-name"
  aria-describedby="provider-{id}-status"
>

<!-- Tab Navigation -->
<div role="tablist">
  <button role="tab" aria-selected="true">Dashboard</button>
  <button role="tab" aria-selected="false">API Demo</button>
</div>
```

### Screen Reader Support
- **Status Announcements**: "OpenAI is operational with 85ms response time"
- **Filter Updates**: "Showing 5 of 15 providers"
- **Loading States**: "Loading provider status..."
- **Error States**: "Failed to load provider data"

## 9. RESPONSIVE BREAKPOINTS

### Mobile (< 768px)
- **Grid**: Single column provider cards
- **Filters**: Stack vertically
- **Navigation**: Hamburger menu (missing - needs implementation)
- **Search**: Full width
- **Tabs**: Horizontal scroll if needed

### Tablet (768px - 1024px)
- **Grid**: 2 column provider cards
- **Filters**: 2 columns
- **Navigation**: Full horizontal layout

### Desktop (> 1024px)
- **Grid**: 3 column provider cards
- **Filters**: Single row
- **Navigation**: Full horizontal layout with spacing

## 10. STATE MANAGEMENT & DATA FLOW

### Component State
```typescript
// DashboardTabs.tsx
const [activeTab, setActiveTab] = useState('dashboard');
const [searchTerm, setSearchTerm] = useState('');
const [statusFilter, setStatusFilter] = useState('');
const [speedFilter, setSpeedFilter] = useState('');
const [uptimeFilter, setUptimeFilter] = useState('');
const [sortBy, setSortBy] = useState('name');

// Theme State (missing - needs implementation)
const [theme, setTheme] = useState('light');
```

### Data Updates
1. **Auto-refresh**: Every 60 seconds
2. **Manual refresh**: Button click
3. **Real-time**: WebSocket connections (future enhancement)
4. **Error handling**: Retry logic with exponential backoff

## 11. MISSING CRITICAL INTERACTIONS

### Dark Mode Toggle (Priority 1)
- **Location**: Navbar, between logo and navigation
- **Behavior**: Toggle between light/dark themes
- **Persistence**: localStorage
- **Icon**: Sun (light) / Moon (dark)

### Mobile Navigation (Priority 2)
- **Hamburger Menu**: 3-line icon for mobile
- **Slide-out Menu**: Navigation links in mobile drawer
- **Overlay**: Dark overlay when menu open

### Error States (Priority 3)
- **Network Errors**: "Unable to connect" with retry button
- **API Errors**: Specific error messages
- **Loading States**: Skeleton loaders for cards
- **Empty States**: "No providers match your filters"

### Success Feedback (Priority 4)
- **Notifications**: Toast messages for actions
- **Form Success**: "Subscription successful" messages
- **Visual Feedback**: Loading spinners, success checkmarks