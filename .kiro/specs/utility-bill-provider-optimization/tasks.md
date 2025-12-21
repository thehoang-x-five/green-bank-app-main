# Implementation Tasks

## Overview

This document breaks down the implementation of the utility bill provider optimization into discrete, actionable tasks. Tasks are organized by phase and can be completed incrementally.

## Task Status Legend

- ⬜ Not Started
- 🟦 In Progress
- ✅ Completed
- ⏸️ Blocked
- ❌ Cancelled

---

## Phase 1: Foundation Setup

### Task 1.1: Create Environment Configuration Module ⬜

**Priority:** High  
**Estimated Time:** 30 minutes  
**Dependencies:** None

**Description:**  
Create a centralized module for environment detection and configuration.

**Acceptance Criteria:**

- [ ] Create `src/config/environmentConfig.ts`
- [ ] Implement `getEnvironmentConfig()` function
- [ ] Implement `isDemoMode()` helper function
- [ ] Implement `isProduction()` helper function
- [ ] Add caching mechanism for environment detection
- [ ] Add TypeScript interfaces for config
- [ ] Add JSDoc comments explaining usage

**Implementation Notes:**

```typescript
// Check VITE_DEMO_MODE first, then MODE
// Default to production for safety
// Cache result to avoid repeated checks
```

**Testing:**

- Unit test with different env var combinations
- Test default behavior
- Test caching works correctly

---

### Task 1.2: Create Fallback Providers Module ⬜

**Priority:** High  
**Estimated Time:** 20 minutes  
**Dependencies:** None

**Description:**  
Extract hardcoded provider data into a separate module for demo mode.

**Acceptance Criteria:**

- [ ] Create `src/config/fallbackProviders.ts`
- [ ] Move electricity providers from utilityBillService.ts
- [ ] Move water providers from utilityBillService.ts
- [ ] Add TypeScript interfaces
- [ ] Add JSDoc warning that this is demo-only data
- [ ] Ensure data structure matches database schema

**Implementation Notes:**

```typescript
// Keep exact same data as current hardcoded values
// Add clear comments about demo-only usage
// Export as named constants
```

**Testing:**

- Verify data structure matches existing format
- Verify all required fields present

---

### Task 1.3: Add Environment Variables ⬜

**Priority:** High  
**Estimated Time:** 10 minutes  
**Dependencies:** None

**Description:**  
Add environment variable configuration for demo mode.

**Acceptance Criteria:**

- [ ] Add `VITE_DEMO_MODE=true` to `.env.development`
- [ ] Add `VITE_DEMO_MODE=false` to `.env.production`
- [ ] Create `.env.example` with documentation
- [ ] Update `.gitignore` if needed
- [ ] Document env vars in README

**Implementation Notes:**

```bash
# .env.development
VITE_DEMO_MODE=true

# .env.production
VITE_DEMO_MODE=false
```

**Testing:**

- Verify env vars loaded correctly in both modes
- Test with and without .env files

---

## Phase 2: Service Layer Updates

### Task 2.1: Update Utility Bill Service - Import Strategy ⬜

**Priority:** High  
**Estimated Time:** 30 minutes  
**Dependencies:** Task 1.1, Task 1.2

**Description:**  
Update utilityBillService.ts to conditionally import fallback data based on environment.

**Acceptance Criteria:**

- [ ] Import environmentConfig module
- [ ] Add conditional import for fallbackProviders
- [ ] Ensure tree-shaking works in production build
- [ ] Add logging for debugging
- [ ] Update existing imports

**Implementation Notes:**

```typescript
import { isDemoMode } from "@/config/environmentConfig";

// Conditional import
let fallbackProviders: any = null;
if (isDemoMode()) {
  fallbackProviders = await import("@/config/fallbackProviders");
}
```

**Testing:**

- Verify fallback module not in production bundle
- Verify fallback module loaded in demo mode

---

### Task 2.2: Update Provider Fetching Logic ⬜

**Priority:** High  
**Estimated Time:** 45 minutes  
**Dependencies:** Task 2.1

**Description:**  
Refactor provider fetching to use database-first approach with conditional fallback.

**Acceptance Criteria:**

- [ ] Always query database first
- [ ] Return database results if non-empty
- [ ] Use fallback only in demo mode when database empty
- [ ] Return empty array in production when database empty
- [ ] Add comprehensive logging
- [ ] Handle errors gracefully

**Implementation Notes:**

```typescript
async function fetchProviders(type: string) {
  // 1. Try database
  const dbProviders = await fetchFromDatabase(type);

  // 2. Return if found
  if (dbProviders.length > 0) return dbProviders;

  // 3. Fallback in demo mode only
  if (isDemoMode() && fallbackProviders) {
    return getFallbackProviders(type);
  }

  // 4. Empty in production
  return [];
}
```

**Testing:**

- Test with empty database in production mode
- Test with empty database in demo mode
- Test with populated database in both modes
- Test error handling

---

### Task 2.3: Add Data Validation ⬜

**Priority:** Medium  
**Estimated Time:** 30 minutes  
**Dependencies:** Task 2.2

**Description:**  
Add validation for provider data from database to ensure data integrity.

**Acceptance Criteria:**

- [ ] Create `isValidProvider()` validation function
- [ ] Check required fields (id, name, type)
- [ ] Filter out invalid providers
- [ ] Log validation failures
- [ ] Add TypeScript type guards

**Implementation Notes:**

```typescript
function isValidProvider(provider: any): boolean {
  return (
    provider &&
    typeof provider.id === "string" &&
    typeof provider.name === "string" &&
    ["electricity", "water"].includes(provider.type)
  );
}
```

**Testing:**

- Test with valid provider data
- Test with missing fields
- Test with invalid types
- Test with malformed data

---

## Phase 3: UI Layer Updates

### Task 3.1: Add Empty State UI ⬜

**Priority:** High  
**Estimated Time:** 30 minutes  
**Dependencies:** Task 2.2

**Description:**  
Update UtilityBill.tsx to handle and display empty provider state.

**Acceptance Criteria:**

- [ ] Detect when provider list is empty
- [ ] Display user-friendly empty state message
- [ ] Disable provider select when empty
- [ ] Show appropriate Vietnamese message
- [ ] Style empty state consistently

**Implementation Notes:**

```typescript
const hasProviders = providers.length > 0;

{
  !hasProviders && !loading && (
    <div className="text-sm text-muted-foreground">
      Hiện tại không có nhà cung cấp nào khả dụng. Vui lòng thử lại sau.
    </div>
  );
}
```

**Testing:**

- Test empty state rendering
- Test with loading state
- Test with providers present
- Test responsive design

---

### Task 3.2: Add Form Validation ⬜

**Priority:** High  
**Estimated Time:** 20 minutes  
**Dependencies:** Task 3.1

**Description:**  
Prevent form submission when no provider is selected.

**Acceptance Criteria:**

- [ ] Check provider selected before submission
- [ ] Show error toast if no provider
- [ ] Disable submit button when no providers available
- [ ] Add visual feedback for disabled state

**Implementation Notes:**

```typescript
const handleSubmit = () => {
  if (!selectedProvider) {
    toast.error("Vui lòng chọn nhà cung cấp");
    return;
  }
  // ... existing logic
};
```

**Testing:**

- Test submission without provider
- Test submission with provider
- Test disabled button state
- Test error message display

---

### Task 3.3: Update Loading States ⬜

**Priority:** Medium  
**Estimated Time:** 15 minutes  
**Dependencies:** Task 3.1

**Description:**  
Improve loading state handling for better UX.

**Acceptance Criteria:**

- [ ] Show loading skeleton while fetching
- [ ] Disable interactions during loading
- [ ] Clear loading state on error
- [ ] Add timeout for loading state

**Implementation Notes:**

```typescript
{
  loading && (
    <div className="animate-pulse">
      <div className="h-10 bg-gray-200 rounded"></div>
    </div>
  );
}
```

**Testing:**

- Test loading state display
- Test loading timeout
- Test error during loading

---

## Phase 4: Testing & Documentation

### Task 4.1: Write Unit Tests ⬜

**Priority:** High  
**Estimated Time:** 1 hour  
**Dependencies:** All Phase 2 tasks

**Description:**  
Create comprehensive unit tests for new modules and updated logic.

**Acceptance Criteria:**

- [ ] Test environmentConfig.ts (all functions)
- [ ] Test utilityBillService.ts (provider fetching)
- [ ] Test validation functions
- [ ] Mock Firebase appropriately
- [ ] Achieve >80% code coverage

**Test Cases:**

- Environment detection with various env vars
- Provider fetching in production mode (empty DB)
- Provider fetching in demo mode (empty DB)
- Provider fetching with populated DB
- Data validation with valid/invalid data
- Error handling scenarios

**Testing:**

- Run tests with `npm test`
- Check coverage report
- Fix any failing tests

---

### Task 4.2: Write Integration Tests ⬜

**Priority:** Medium  
**Estimated Time:** 45 minutes  
**Dependencies:** All Phase 3 tasks

**Description:**  
Create integration tests for UI components with service layer.

**Acceptance Criteria:**

- [ ] Test UtilityBill component with empty providers
- [ ] Test UtilityBill component with providers
- [ ] Test form submission flow
- [ ] Test error states
- [ ] Use React Testing Library

**Test Cases:**

- Component renders with empty state
- Component renders with providers
- Form submission blocked without provider
- Form submission succeeds with provider
- Loading states work correctly

**Testing:**

- Run integration tests
- Verify all user flows work
- Check accessibility

---

### Task 4.3: Manual Testing ⬜

**Priority:** High  
**Estimated Time:** 30 minutes  
**Dependencies:** All implementation tasks

**Description:**  
Perform manual testing in both production and demo modes.

**Acceptance Criteria:**

- [ ] Test in production mode with empty database
- [ ] Test in demo mode with empty database
- [ ] Test in both modes with populated database
- [ ] Test form submission in all scenarios
- [ ] Test error handling
- [ ] Test on different browsers

**Testing Checklist:**

- [ ] Set VITE_DEMO_MODE=false, verify no fallback
- [ ] Set VITE_DEMO_MODE=true, verify fallback works
- [ ] Add providers to Firebase, verify they appear
- [ ] Remove providers, verify empty state
- [ ] Test form validation
- [ ] Test error messages
- [ ] Test loading states

**Testing:**

- Document any issues found
- Create bug tickets if needed
- Verify fixes

---

### Task 4.4: Update Documentation ⬜

**Priority:** Medium  
**Estimated Time:** 30 minutes  
**Dependencies:** All implementation tasks

**Description:**  
Update project documentation to reflect new architecture.

**Acceptance Criteria:**

- [ ] Add JSDoc comments to all new functions
- [ ] Update README with environment setup
- [ ] Document demo mode usage
- [ ] Add architecture diagram
- [ ] Update deployment guide if needed

**Documentation Updates:**

- How to run in demo mode
- How to add providers to Firebase
- How to test different modes locally
- Architecture overview
- Troubleshooting guide

**Testing:**

- Review documentation for clarity
- Have another developer review
- Test instructions work

---

## Phase 5: Deployment & Cleanup

### Task 5.1: Remove Old Hardcoded Data ⬜

**Priority:** Low  
**Estimated Time:** 15 minutes  
**Dependencies:** All Phase 4 tasks

**Description:**  
Clean up old hardcoded provider data from service file.

**Acceptance Criteria:**

- [ ] Remove hardcoded arrays from utilityBillService.ts
- [ ] Verify no references remain
- [ ] Update imports
- [ ] Run linter
- [ ] Verify tests still pass

**Implementation Notes:**

```typescript
// Remove these old constants:
// const ELECTRICITY_PROVIDERS = [...]
// const WATER_PROVIDERS = [...]
```

**Testing:**

- Verify app still works
- Run all tests
- Check for unused imports

---

### Task 5.2: Build Verification ⬜

**Priority:** High  
**Estimated Time:** 20 minutes  
**Dependencies:** Task 5.1

**Description:**  
Verify production build works correctly and bundle size is acceptable.

**Acceptance Criteria:**

- [ ] Run production build
- [ ] Verify no build errors
- [ ] Check bundle size (should not increase)
- [ ] Verify fallback data not in production bundle
- [ ] Test production build locally

**Implementation Notes:**

```bash
npm run build
npm run preview
# Check bundle analyzer if available
```

**Testing:**

- Build succeeds without errors
- Bundle size acceptable
- App works in production mode
- No console errors

---

### Task 5.3: Deploy to Staging ⬜

**Priority:** High  
**Estimated Time:** 30 minutes  
**Dependencies:** Task 5.2

**Description:**  
Deploy changes to staging environment for final testing.

**Acceptance Criteria:**

- [ ] Deploy to staging environment
- [ ] Verify environment variables set correctly
- [ ] Test all functionality in staging
- [ ] Check Firebase integration
- [ ] Monitor for errors

**Deployment Steps:**

1. Set VITE_DEMO_MODE=false in staging
2. Deploy using standard process
3. Smoke test all features
4. Check logs for errors
5. Get stakeholder approval

**Testing:**

- All features work in staging
- No console errors
- Performance acceptable
- Ready for production

---

### Task 5.4: Production Deployment ⬜

**Priority:** High  
**Estimated Time:** 30 minutes  
**Dependencies:** Task 5.3

**Description:**  
Deploy changes to production environment.

**Acceptance Criteria:**

- [ ] Deploy to production
- [ ] Verify environment variables
- [ ] Monitor for errors
- [ ] Test critical paths
- [ ] Document deployment

**Deployment Steps:**

1. Create deployment checklist
2. Deploy during low-traffic window
3. Monitor logs and metrics
4. Test critical functionality
5. Have rollback plan ready

**Testing:**

- Production deployment successful
- No errors in logs
- All features working
- Performance metrics normal

---

## Summary

**Total Tasks:** 19  
**Estimated Total Time:** 8-10 hours

**Critical Path:**

1. Phase 1: Foundation (1 hour)
2. Phase 2: Service Layer (2 hours)
3. Phase 3: UI Layer (1.5 hours)
4. Phase 4: Testing (2.5 hours)
5. Phase 5: Deployment (2 hours)

**Risk Areas:**

- Environment variable configuration
- Tree-shaking verification
- Backward compatibility
- Production deployment

**Success Criteria:**

- ✅ All tests passing
- ✅ Zero fallback data in production bundle
- ✅ Demo mode works as before
- ✅ Empty state handled gracefully
- ✅ Documentation complete
