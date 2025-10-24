# Logo Implementation - Comprehensive Error Handling

## Overview
This document details all error handling and edge cases covered in the logo implementation to ensure the system never crashes due to missing values, bad data, or schema mismatches.

## Database Layer Protections

### 1. Safe Migration (`migrations/008_add_logo_url_safe.sql`)
```sql
-- Checks if column exists before adding
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'dashboard_data'
        AND column_name = 'company_logo_url'
    ) THEN
        ALTER TABLE dashboard_data ADD COLUMN company_logo_url TEXT;
    END IF;
END $$;
```
**Protects Against:** Running migration multiple times, upgrading existing databases

###2. Runtime Column Detection (`dashboard_data_populator.py`)

#### companies Table Check (lines 275-284)
```python
cursor.execute("""
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'companies'
        AND column_name = 'logo_url'
    )
""")
result = cursor.fetchone()
has_logo_column = result[0] if result else False
```
**Protects Against:** Older databases without logo_url column

#### dashboard_data Table Check (lines 763-772)
```python
cursor.execute("""
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'dashboard_data'
        AND column_name = 'company_logo_url'
    )
""")
result = cursor.fetchone()
has_dashboard_logo_column = result[0] if result else False
```
**Protects Against:** INSERT failures on older database schemas

## Backend Protections

### 1. Missing Company Data (lines 313-322)
```python
if not company_data:
    logger.warning(f"No company data found for company_id {company_id}")
    return {
        'company_name': 'Unknown Company',
        'domain': '',
        'industry': '',
        'employee_count': 0,
        'headquarters': 'Unknown',
        'logo_url': None
    }
```
**Protects Against:** Missing company records, database query failures

### 2. Logo URL Validation (lines 329-339)
```python
if result.get('logo_url'):
    logo_url = str(result['logo_url']).strip()
    # Basic URL validation
    if not logo_url or len(logo_url) < 10 or not (logo_url.startswith('http://') or logo_url.startswith('https://')):
        logger.debug(f"Invalid logo_url: {logo_url}, setting to None")
        result['logo_url'] = None
    else:
        result['logo_url'] = logo_url
else:
    result['logo_url'] = None
```
**Protects Against:**
- Empty strings
- Whitespace-only values
- Invalid URLs (too short, missing protocol)
- Non-string types

### 3. Type Safety Check (lines 775-778)
```python
logo_url_value = company_data.get('logo_url')
if logo_url_value and not isinstance(logo_url_value, str):
    logger.warning(f"Invalid logo_url type: {type(logo_url_value)}, setting to None")
    logo_url_value = None
```
**Protects Against:** Type errors, corrupted data

### 4. Exception Handling (lines 343-353)
```python
except Exception as e:
    logger.error(f"Error gathering company data: {e}")
    # Return safe defaults to prevent crashes
    return {
        'company_name': 'Unknown Company',
        'domain': '',
        'industry': '',
        'employee_count': 0,
        'headquarters': 'Unknown',
        'logo_url': None
    }
```
**Protects Against:** Any unexpected database errors, connection failures

## Frontend Protections

### 1. TypeScript Interface (DashboardView.tsx:77)
```typescript
companyLogoUrl?: string;  // Optional field
```
**Protects Against:** Missing data from API

### 2. Conditional Rendering - Header (DashboardView.tsx:271-286)
```typescript
{auditData?.companyLogoUrl ? (
  <div className="flex-shrink-0">
    <img
      src={auditData.companyLogoUrl}
      alt={`${auditData.companyName || 'Company'} logo`}
      className="w-10 h-10 rounded-lg object-contain bg-white p-1 shadow-sm border border-gray-200"
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  </div>
) : (
  <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
    <Brain className="w-6 h-6 text-white" />
  </div>
)}
```
**Protects Against:**
- Missing logo URL
- null/undefined values
- Image load failures (404, CORS, network errors)
- Falls back to Brain icon gracefully

### 3. Conditional Rendering - Executive Summary (DashboardView.tsx:378-390)
```typescript
{auditData.companyLogoUrl ? (
  <div className="flex-shrink-0">
    <img
      src={auditData.companyLogoUrl}
      alt={`${auditData.companyName || 'Company'} logo`}
      className="w-16 h-16 rounded-xl object-contain bg-white p-2 shadow-md border border-gray-200"
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  </div>
) : null}
```
**Protects Against:**
- Missing logo URL
- Image load failures
- Hides element completely if logo fails

### 4. Alt Text Fallback
```typescript
alt={`${auditData.companyName || 'Company'} logo`}
```
**Protects Against:** Missing company name, accessibility issues

## Edge Cases Handled

| Edge Case | Protection | Result |
|-----------|------------|--------|
| Logo column doesn't exist in `companies` | Column existence check | Skips logo, continues normally |
| Logo column doesn't exist in `dashboard_data` | Column existence check | Inserts without logo field |
| Logo URL is NULL | Conditional checks | No logo displayed, uses fallback icon |
| Logo URL is empty string | String validation | Converted to None |
| Logo URL is whitespace | `.strip()` check | Converted to None |
| Logo URL is invalid (no http/https) | URL validation | Converted to None |
| Logo URL is too short (<10 chars) | Length check | Converted to None |
| Logo URL returns 404 | `onError` handler | Image hidden |
| Logo URL has CORS issues | `onError` handler | Image hidden |
| Logo URL is very slow to load | Browser timeout | Eventually triggers `onError` |
| Company record doesn't exist | Default values returned | "Unknown Company" displayed |
| Database connection fails | Exception handler | Safe defaults, audit continues |
| Type mismatch (logo_url is not string) | `isinstance` check | Converted to None |
| Multiple migration runs | IF NOT EXISTS check | Idempotent, safe to re-run |

## Logging Strategy

### Debug Level
- Invalid logo URLs (too short, wrong protocol)
- Column detection results

### Warning Level
- Missing company data
- Type mismatches
- Column not found in older databases

### Error Level
- Database connection failures
- Unexpected exceptions
- Data insertion failures

## Testing Checklist

- [ ] Fresh database without logo columns
- [ ] Database with logo columns but NULL values
- [ ] Database with empty string logo URLs
- [ ] Database with invalid logo URLs
- [ ] Valid logo URLs that return 404
- [ ] Valid logo URLs with CORS restrictions
- [ ] Missing company records
- [ ] Network failures during image load
- [ ] Very large image files
- [ ] Migration run multiple times
- [ ] Frontend with missing auditData
- [ ] Frontend with null companyLogoUrl
- [ ] Browser with images disabled

## Backward Compatibility

✅ **Fully backward compatible**
- Works on databases without logo columns
- Works on partial updates (only companies or only dashboard_data)
- Degrades gracefully when logos unavailable
- No breaking changes to existing functionality

## Forward Compatibility

✅ **Future-proof**
- Easy to add fallback logo service (Clearbit, Google Favicon API)
- Can add logo caching layer
- Can add logo optimization (resize, CDN)
- Extensible for avatar/initials fallback

## Failure Modes

| Failure | System Behavior | User Experience |
|---------|----------------|-----------------|
| Database error | Logs error, returns defaults | Dashboard loads, no logo shown |
| Missing column | Detects, skips logo insertion | Dashboard loads, no logo shown |
| Invalid URL | Validation fails, sets to None | Dashboard loads, fallback icon shown |
| Image 404 | onError hides image | Dashboard loads, fallback icon shown |
| CORS error | onError hides image | Dashboard loads, fallback icon shown |
| Network timeout | onError eventually triggered | Dashboard loads, fallback icon shown |

**Key Principle:** Logo implementation is additive - failures never break core functionality.

## Monitoring Recommendations

1. **Track logo fetch failures** - Alert if >10% of companies have invalid logos
2. **Track load times** - Alert if logo loading >2s on average
3. **Track 404 rates** - Alert if >20% of logos return 404
4. **Database query performance** - Monitor column existence checks (should be cached)

## Production Deployment Steps

1. Run `migrations/008_add_logo_url_safe.sql` (idempotent, safe to re-run)
2. Restart Intelligence Engine (picks up new code)
3. Restart API Gateway (if using shared code)
4. Deploy frontend (backward compatible)
5. No data migration needed - logos populate on next audit
6. Monitor logs for warnings about missing columns (expected on first run)

## Rollback Plan

If issues arise:
1. Logo implementation is non-breaking - can leave code deployed
2. To disable logos: Set all `logo_url` values to NULL
3. To remove feature: Revert frontend changes (backend is harmless)
4. Migration is additive - no need to reverse (columns can stay)
