# Design Document

## Introduction

Tài liệu này mô tả thiết kế chi tiết cho việc tối ưu hóa cách hệ thống xử lý danh sách nhà cung cấp dịch vụ tiện ích. Thiết kế tập trung vào việc tách biệt logic giữa môi trường production và demo, đồng thời đảm bảo tính tương thích ngược.

## Architecture Overview

### Current Architecture

```
UtilityBill.tsx
  └─> utilityBillService.ts
       ├─> Firebase RTDB (fetch providers)
       └─> Hardcoded fallback data (if empty)
```

### Proposed Architecture

```
UtilityBill.tsx
  └─> utilityBillService.ts
       ├─> environmentConfig.ts (detect mode)
       ├─> Firebase RTDB (fetch providers)
       └─> fallbackProviders.ts (only in demo mode)
```

## Component Design

### 1. Environment Configuration Module

**File:** `src/config/environmentConfig.ts`

**Purpose:** Centralized environment detection and configuration

**Interface:**

```typescript
export interface EnvironmentConfig {
  isDemoMode: boolean;
  isProduction: boolean;
  environment: "production" | "development" | "demo";
}

export const getEnvironmentConfig: () => EnvironmentConfig;
export const isDemoMode: () => boolean;
export const isProduction: () => boolean;
```

**Logic:**

- Check `import.meta.env.VITE_DEMO_MODE` environment variable
- Check `import.meta.env.MODE` for 'production' vs 'development'
- Default to production mode if not explicitly set to demo
- Cache the result to avoid repeated checks

### 2. Fallback Providers Module

**File:** `src/config/fallbackProviders.ts`

**Purpose:** Store hardcoded provider data for demo/development

**Interface:**

```typescript
export interface FallbackProvider {
  id: string;
  name: string;
  type: "electricity" | "water";
  logo: string;
}

export const FALLBACK_ELECTRICITY_PROVIDERS: FallbackProvider[];
export const FALLBACK_WATER_PROVIDERS: FallbackProvider[];
```

**Data:**

- Move existing hardcoded providers from utilityBillService.ts
- Keep the same structure and data
- Add JSDoc comments explaining this is for demo only

### 3. Utility Bill Service Updates

**File:** `src/services/utilityBillService.ts`

**Changes:**

#### Import Strategy

```typescript
// Always import environment config
import { isDemoMode } from "@/config/environmentConfig";

// Conditionally import fallback data
let fallbackProviders: any = null;
if (isDemoMode()) {
  fallbackProviders = await import("@/config/fallbackProviders");
}
```

#### Provider Fetching Logic

```typescript
async function fetchProviders(type: string) {
  // 1. Always try database first
  const dbProviders = await fetchFromDatabase(type);

  // 2. If database has data, return it (regardless of mode)
  if (dbProviders.length > 0) {
    return dbProviders;
  }

  // 3. If database is empty and in demo mode, use fallback
  if (isDemoMode() && fallbackProviders) {
    return getFallbackProviders(type);
  }

  // 4. Otherwise return empty array
  return [];
}
```

### 4. UI Component Updates

**File:** `src/pages/utilities/UtilityBill.tsx`

**Changes:**

#### Empty State Handling

```typescript
// Add empty state detection
const hasProviders = providers.length > 0;

// Disable provider select when empty
<Select disabled={!hasProviders || loading}>
  {!hasProviders && (
    <SelectItem value="" disabled>
      Không có nhà cung cấp nào
    </SelectItem>
  )}
  {/* ... existing provider items ... */}
</Select>;

// Show empty state message
{
  !hasProviders && !loading && (
    <div className="text-sm text-muted-foreground">
      Hiện tại không có nhà cung cấp nào khả dụng. Vui lòng thử lại sau.
    </div>
  );
}
```

#### Form Validation

```typescript
// Prevent submission when no provider selected
const handleSubmit = () => {
  if (!selectedProvider) {
    toast.error("Vui lòng chọn nhà cung cấp");
    return;
  }
  // ... existing logic
};
```

## Data Flow

### Production Mode Flow

```
User opens UtilityBill
  └─> Component mounts
       └─> fetchProviders('electricity')
            ├─> Check environment: isProduction = true
            ├─> Query Firebase RTDB
            ├─> Database returns []
            └─> Return [] (no fallback)
                 └─> UI shows empty state
```

### Demo Mode Flow

```
User opens UtilityBill
  └─> Component mounts
       └─> fetchProviders('electricity')
            ├─> Check environment: isDemoMode = true
            ├─> Query Firebase RTDB
            ├─> Database returns []
            └─> Return fallbackProviders.ELECTRICITY
                 └─> UI shows providers
```

## Environment Variables

### Configuration

Add to `.env` files:

```bash
# .env.development
VITE_DEMO_MODE=true

# .env.production
VITE_DEMO_MODE=false
```

### Usage in Code

```typescript
// Vite automatically provides import.meta.env
const isDemoMode = import.meta.env.VITE_DEMO_MODE === "true";
const isProduction = import.meta.env.MODE === "production";
```

## Error Handling

### Database Connection Errors

```typescript
try {
  const providers = await fetchFromDatabase(type);
  return providers;
} catch (error) {
  console.error("[UtilityBillService] Database error:", error);

  // In demo mode, fallback to hardcoded data
  if (isDemoMode()) {
    console.log("[UtilityBillService] Using fallback data due to error");
    return getFallbackProviders(type);
  }

  // In production, return empty and let UI handle it
  return [];
}
```

### Invalid Provider Data

```typescript
// Validate provider structure
function isValidProvider(provider: any): boolean {
  return (
    provider &&
    typeof provider.id === "string" &&
    typeof provider.name === "string" &&
    ["electricity", "water"].includes(provider.type)
  );
}

// Filter out invalid providers
const validProviders = providers.filter(isValidProvider);
```

## Testing Strategy

### Unit Tests

1. **environmentConfig.ts**

   - Test environment detection with different env vars
   - Test default behavior when env vars not set
   - Test caching mechanism

2. **utilityBillService.ts**
   - Mock Firebase to return empty array
   - Test production mode returns empty
   - Test demo mode returns fallback
   - Test database data takes precedence

### Integration Tests

1. **UtilityBill.tsx**
   - Test empty state UI rendering
   - Test provider selection disabled when empty
   - Test form submission blocked when no provider
   - Test normal flow when providers available

### Manual Testing Checklist

- [ ] Set VITE_DEMO_MODE=false, verify no fallback data used
- [ ] Set VITE_DEMO_MODE=true, verify fallback data used when DB empty
- [ ] Add providers to Firebase, verify they appear in both modes
- [ ] Remove providers from Firebase, verify empty state in production
- [ ] Test form submission with and without providers

## Migration Plan

### Phase 1: Create New Modules (No Breaking Changes)

1. Create `src/config/environmentConfig.ts`
2. Create `src/config/fallbackProviders.ts`
3. Add environment variables to `.env` files

### Phase 2: Update Service Layer

1. Update `utilityBillService.ts` to use new modules
2. Keep existing behavior in demo mode
3. Add logging for debugging

### Phase 3: Update UI Layer

1. Update `UtilityBill.tsx` with empty state handling
2. Add form validation
3. Test thoroughly in both modes

### Phase 4: Cleanup

1. Remove old hardcoded data from service file
2. Update documentation
3. Add comments explaining the architecture

## Rollback Plan

If issues are discovered:

1. Revert `utilityBillService.ts` to use hardcoded fallback always
2. Keep new modules for future use
3. Document issues and plan fixes
4. Re-deploy after fixes

## Performance Considerations

### Bundle Size

- Fallback data (~2KB) only loaded in demo mode
- Tree-shaking will remove unused imports in production build
- No performance impact on production bundle

### Runtime Performance

- Environment check cached on first call
- No additional database queries
- Minimal overhead (<1ms) for mode detection

## Security Considerations

### Environment Variables

- VITE_DEMO_MODE is public (embedded in client bundle)
- No sensitive data in fallback providers
- Production mode is the safe default

### Data Validation

- Always validate provider data from database
- Filter out malformed entries
- Sanitize provider names before display

## Documentation Updates

### Code Comments

Add JSDoc comments to:

- `environmentConfig.ts` - Explain mode detection
- `fallbackProviders.ts` - Explain demo-only usage
- `utilityBillService.ts` - Explain provider fetching logic

### README Updates

Add section explaining:

- How to run in demo mode
- How to add providers to Firebase
- How to test different modes locally

## Success Metrics

- ✅ Zero fallback data usage in production
- ✅ Backward compatible with existing demo setup
- ✅ Clear empty state messaging for users
- ✅ No increase in production bundle size
- ✅ All existing tests pass
- ✅ New tests cover edge cases
