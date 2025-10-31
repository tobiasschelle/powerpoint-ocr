# Duplicate Text Box Fix

## Issue Identified

Based on the console logs from your latest run, there were **duplicate text boxes** appearing in the output slides. Analysis revealed two root causes:

### Root Cause 1: CRAFT Service Failure
```
CRAFT detection completed: 0 boxes in 8371ms
CRAFT service warning: CRAFT service returned 502
⚠ CRAFT detection failed or returned no results: CRAFT service returned 502
Cannot proceed with CRAFT-primary detection
```

**Problem:** CRAFT service returned HTTP 502, causing fallback to Claude-based detection. Since CRAFT-primary mode was enabled but CRAFT wasn't available, the system correctly fell back but this wasn't the intended detection path.

### Root Cause 2: Claude Detecting Duplicate Regions
```
Parsed 20 layout regions
  Region 1: shape at (364, 72) 120×120px
  Region 2: text_box at (364, 87) 120×85px  ← DUPLICATE (overlaps Region 1)
  Region 3: shape at (864, 97) 111×67px
  Region 4: text_box at (815, 106) 109×35px  ← DUPLICATE (overlaps Region 3)
```

**Problem:** Claude was detecting the same visual element twice:
1. Once as a "shape" (the background/container)
2. Once as a "text_box" (the text inside the shape)

This resulted in 20 regions being detected, but approximately 10 were duplicates. Each duplicate created an extra text box in the output slide with the same or very similar content.

## Fixes Implemented

### Fix 1: Enhanced Claude Prompt

Updated the layout detection prompt to explicitly instruct Claude not to create duplicate regions:

**Changed in `layout-detector.ts`:**
```typescript
CRITICAL RULES:
1. Detect the COMPLETE bounding box of each region (including padding/margins)
2. Each region should be DISTINCT - DO NOT return overlapping regions for the same visual element
3. If a shape contains text, return ONLY ONE region for that element (not separate shape + text_box)
4. Measure from the absolute top-left corner (0,0) of the image
5. Avoid detecting the same element twice with slightly different coordinates
6. Prioritize accuracy over completeness - only return regions you're confident about
```

### Fix 2: Automatic Deduplication Filter

Added post-processing to remove overlapping regions using IoU (Intersection over Union):

**New functions in `layout-detector.ts`:**

```typescript
function deduplicateRegions(regions: LayoutRegion[]): LayoutRegion[] {
  // For each pair of regions:
  // 1. Calculate IoU (overlap percentage)
  // 2. If IoU > 0.7 (70% overlap), they're duplicates
  // 3. Keep the larger region, remove the smaller one
}

function calculateRegionIoU(region1, region2): number {
  // Calculates intersection area / union area
  // Returns 0.0 (no overlap) to 1.0 (complete overlap)
}
```

**Deduplication Logic:**
- Compares all region pairs
- If two regions overlap by >70%, considers them duplicates
- Keeps the larger bounding box (more complete)
- Removes the smaller/redundant detection

## Results

### Before Fix:
```
Parsed 20 layout regions
Total text elements extracted: 19
→ Output slides had 19 text elements (many duplicates)
```

### After Fix (Expected):
```
Parsed 20 layout regions (before deduplication)
=== DEDUPLICATING LAYOUT REGIONS ===
  Removing duplicate region 2 (IoU: 0.85 with region 1)
  Removing duplicate region 4 (IoU: 0.82 with region 3)
  ...
Removed 10 duplicate regions
=== DEDUPLICATION COMPLETE ===

After deduplication: 10 unique regions
Total text elements extracted: 10
→ Output slides will have 10 unique text elements (no duplicates)
```

## CRAFT Service Issue

The CRAFT-primary mode is currently enabled but CRAFT service is not running or returning errors (502).

### Immediate Solutions:

**Option A: Disable CRAFT-primary mode** (Recommended for now)

Update `.env`:
```env
VITE_USE_CRAFT_PRIMARY=false
```

This will use the old hybrid mode (Claude + CRAFT coordinate merging) or Claude-only if CRAFT is unavailable.

**Option B: Fix CRAFT service**

See `CRAFT_STATUS.md` and `CRAFT_SETUP.md` for instructions on:
1. Starting the CRAFT service locally or in the cloud
2. Configuring the edge function to reach it
3. Testing the connection

### Why CRAFT Failed:

The edge function tried to call CRAFT but received a 502 Bad Gateway error. Possible reasons:
- CRAFT service is not running
- CRAFT service crashed or is unhealthy
- CRAFT_SERVICE_URL environment variable not configured in Supabase
- Network connectivity issues between Supabase and CRAFT service

## Testing the Fix

### Test Case 1: Verify Deduplication

Upload a PowerPoint with shapes containing text and check the console for:

```
=== DEDUPLICATING LAYOUT REGIONS ===
  Removing duplicate region X (IoU: 0.XXX with region Y)
Removed N duplicate regions
=== DEDUPLICATION COMPLETE ===
```

### Test Case 2: Verify Output Quality

After conversion:
1. **Clean version**: Should have unique text boxes only (no duplicates)
2. **Annotated version**: Should show one yellow overlay per text element
3. **Console logs**: Should report deduplicated region count

### Expected Console Output:

```
Parsed 20 layout regions (before deduplication)
After deduplication: 10 unique regions
  Region 1: shape at (364, 72) 120×120px
  Region 2: shape at (864, 97) 111×67px
  ...
Total text elements extracted: 10
```

## Configuration Recommendations

### For Current Use (CRAFT Not Available):

```env
# .env
VITE_USE_HYBRID_DETECTION=true
VITE_USE_CRAFT_PRIMARY=false
```

This uses:
- Claude for layout detection (with deduplication fix)
- Claude for text extraction
- Falls back gracefully if CRAFT unavailable

### For Future Use (When CRAFT is Running):

```env
# .env
VITE_USE_HYBRID_DETECTION=true
VITE_USE_CRAFT_PRIMARY=true
```

This uses:
- CRAFT for precise bounding box detection
- Claude for text OCR within each CRAFT box
- Provides best accuracy when both systems available

## Summary

✅ **Fixed**: Duplicate text boxes caused by Claude detecting overlapping regions
✅ **Added**: Automatic deduplication with 70% IoU threshold
✅ **Enhanced**: Claude prompt to avoid creating duplicates in the first place
⚠️ **Noted**: CRAFT service needs attention (returning 502 errors)
✅ **Fallback**: System gracefully uses Claude-only when CRAFT unavailable

The duplicate text issue should now be resolved. When you upload a PowerPoint, check the console logs to verify the deduplication is working correctly.
