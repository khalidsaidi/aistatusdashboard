# AI Status Dashboard - Master Implementation Plan

## CURRENT STATUS
- ✅ **Working**: Dashboard filters, provider monitoring, Firebase hosting
- ❌ **Broken**: Dark mode toggle, notification system, comment system, API endpoints
- 📊 **Tests**: 161 existing tests, but missing coverage for broken features

## IMMEDIATE ISSUES TO FIX (TDD ORDER)

### 1. DARK MODE TOGGLE (Priority 1)
**Problem**: Toggle component exists but not integrated into navbar
**TDD Steps**:
1. Write test for dark mode toggle in navbar
2. Watch test fail
3. Integrate toggle into navbar
4. Make test pass

### 2. NOTIFICATION SYSTEM (Priority 2) 
**Problem**: "Network error. Please try again." when subscribing
**TDD Steps**:
1. Write test for notification subscription
2. Watch test fail  
3. Fix Firebase Cloud Functions
4. Make test pass

### 3. API ENDPOINTS (Priority 3)
**Problem**: "HTTP 503: Service Unavailable" errors
**TDD Steps**:
1. Write test for API endpoints
2. Watch test fail
3. Fix endpoint routing to Cloud Functions
4. Make test pass

### 4. COMMENT SYSTEM (Priority 4)
**Problem**: "Failed to load comments" and posting failures
**TDD Steps**:
1. Write test for comment functionality
2. Watch test fail
3. Implement comment Cloud Functions
4. Make test pass

### 5. BUTTON STYLING (Priority 5)
**Problem**: Inconsistent button appearance across components
**TDD Steps**:
1. Write test for button consistency
2. Watch test fail
3. Create unified button component
4. Make test pass

## STEP-BY-STEP EXECUTION PLAN

### STEP 1: Dark Mode Tests & Implementation
```bash
# 1. Create test file
touch __tests__/unit/dark-mode-toggle.test.tsx

# 2. Write failing tests for:
# - Toggle renders in navbar
# - Click switches theme
# - Theme persists in localStorage
# - All components update

# 3. Run test (should fail)
npm test dark-mode-toggle

# 4. Integrate DarkModeToggle into Navbar.tsx
# 5. Run test again (should pass)
```

### STEP 2: Notification Tests & Implementation  
```bash
# 1. Create test file
touch __tests__/unit/notification-panel.test.tsx

# 2. Write failing tests for:
# - Email subscription form
# - Form validation
# - API call success/error

# 3. Run test (should fail)
npm test notification-panel

# 4. Fix Firebase Cloud Functions:
# - subscribeEmail
# - unsubscribeEmail  
# - sendTestNotification

# 5. Run test again (should pass)
```

### STEP 3: API Endpoint Tests & Implementation
```bash
# 1. Create test file
touch __tests__/api/endpoints.test.ts

# 2. Write failing tests for:
# - /api/status works
# - /api/health works
# - Proper error handling

# 3. Run test (should fail)
npm test endpoints

# 4. Fix API routing to Cloud Functions
# 5. Run test again (should pass)
```

### STEP 4: Comment System Tests & Implementation
```bash
# 1. Create test file  
touch __tests__/unit/comment-section.test.tsx

# 2. Write failing tests for:
# - Comment form submission
# - Comment display
# - Comment moderation

# 3. Run test (should fail)
npm test comment-section

# 4. Implement comment Cloud Functions
# 5. Run test again (should pass)
```

### STEP 5: Button Styling Tests & Implementation
```bash
# 1. Create test file
touch __tests__/unit/button-component.test.tsx

# 2. Write failing tests for:
# - Consistent button appearance
# - Theme-aware styling
# - Proper hover/focus states

# 3. Run test (should fail)
npm test button-component

# 4. Create unified Button component
# 5. Update all components to use it
# 6. Run test again (should pass)
```

## FIREBASE CLOUD FUNCTIONS TO IMPLEMENT

### Required Functions (functions/src/index.ts)
```typescript
export const subscribeEmail = functions.https.onRequest(subscribeEmailHandler);
export const unsubscribeEmail = functions.https.onRequest(unsubscribeEmailHandler);  
export const sendTestNotification = functions.https.onRequest(sendTestNotificationHandler);
export const getComments = functions.https.onRequest(getCommentsHandler);
export const postComment = functions.https.onRequest(postCommentHandler);
```

### Firestore Collections (Existing Schema)
```javascript
// Current Collections
status_results/
  ├── {provider_id}-{timestamp}/
  │   ├── provider_id: string
  │   ├── status: string
  │   ├── response_time: number
  │   └── checked_at: timestamp

comments/
  ├── {comment_id}/
  │   ├── content: string
  │   ├── author: string
  │   ├── type: string
  │   └── created_at: timestamp

email_subscriptions/
  ├── {email}/
  │   ├── providers: array
  │   └── active: boolean

incidents/
  ├── {incident_id}/
  │   ├── provider_id: string
  │   ├── title: string
  │   └── status: string
```

## CURRENT TEST STATUS
- ✅ **161 tests passing** (100% pass rate)
- ✅ **Unit tests**: 65 tests (provider logic, API routes, Firebase)
- ✅ **E2E tests**: 96 tests (accessibility, mobile, performance)
- ❌ **Missing**: Tests for broken features (dark mode, notifications, comments)

## PRODUCTION ENVIRONMENT
- **Live URL**: https://ai-status-dashboard-dev.web.app
- **API Base**: https://us-central1-ai-status-dashboard-dev.cloudfunctions.net
- **Firebase Project**: ai-status-dashboard-dev
- **Monitoring**: 15 AI providers tracked
- **Architecture**: Next.js 14 + Firebase + Firestore

## SUCCESS CRITERIA

### Must Have (Non-negotiable)
- [ ] Dark mode toggle works in navbar
- [ ] Email notifications can be subscribed to
- [ ] API demo buttons return proper responses  
- [ ] Comments can be posted and displayed
- [ ] All buttons look consistent
- [ ] **ZERO failing tests**

### Quality Gates
- [ ] All tests pass (100% success rate)
- [ ] No console errors in browser
- [ ] Response times under 200ms
- [ ] Works on mobile devices

## NEXT ACTION

**Start with Step 1**: Write the dark mode toggle test that will fail, then implement the fix.

Do you want me to begin with Step 1 and write the failing dark mode test? 