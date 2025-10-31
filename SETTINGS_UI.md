# Settings UI Documentation

## Overview

Added a frontend settings panel that allows users to toggle CRAFT detection modes in real-time without editing environment variables or restarting the application.

## Features

### Settings Button
- **Location**: Fixed in top-right corner of the screen
- **Icon**: Gear/Settings icon
- **Appearance**: White card with shadow, visible at all times

### Settings Modal

When clicked, opens a modal dialog with:

#### 1. Hybrid Detection Toggle
- **Label**: "Hybrid Detection"
- **Description**: "Combine Claude AI with CRAFT for improved accuracy"
- **Default**: Enabled (true)
- **Effect**: Enables/disables the hybrid detection pipeline

#### 2. CRAFT-Primary Mode Toggle (nested)
- **Label**: "CRAFT-Primary Mode"
- **Description**: "Use CRAFT for placement, Claude for text"
- **Default**: Disabled (false)
- **Visibility**: Only shown when Hybrid Detection is enabled
- **Effect**: Switches to CRAFT-primary detection mode

### Current Mode Display

Shows a visual indicator of the active detection mode:

- 🤖 **Claude-Only Detection** - When Hybrid Detection is OFF
- 🔀 **Hybrid (Claude + CRAFT merge)** - When Hybrid ON, CRAFT-Primary OFF
- 🎯 **CRAFT-Primary (CRAFT placement + Claude text)** - When both ON

### Mode Descriptions

Built-in help text explains each mode:
- **Claude-Only**: Fast, uses only AI vision
- **Hybrid**: Merges Claude and CRAFT detections
- **CRAFT-Primary**: Best accuracy (requires CRAFT service)

### Warning Notice

When CRAFT-Primary is enabled, shows an informational notice:
> "CRAFT-Primary mode requires a running CRAFT service. If unavailable, the system will automatically fall back to Claude-based detection."

## Technical Implementation

### Settings Storage

Settings are persisted in browser localStorage:

```typescript
// Key: 'pptx-converter-settings'
{
  "useHybridDetection": true,
  "useCraftPrimary": false
}
```

### Settings Service (`settings-service.ts`)

Provides functions to manage detection settings:

```typescript
// Load settings from localStorage
getDetectionSettings(): DetectionSettings

// Save settings to localStorage
saveDetectionSettings(settings: DetectionSettings): void

// Get individual settings
getUseHybridDetection(): boolean
getUseCraftPrimary(): boolean
```

**Default Settings:**
```typescript
{
  useHybridDetection: true,
  useCraftPrimary: false
}
```

### Integration with Conversion Service

The conversion service now reads settings from localStorage instead of environment variables:

**Before:**
```typescript
const USE_HYBRID_DETECTION = import.meta.env.VITE_USE_HYBRID_DETECTION === 'true';
const USE_CRAFT_PRIMARY = import.meta.env.VITE_USE_CRAFT_PRIMARY === 'true';
```

**After:**
```typescript
const useHybridDetection = getUseHybridDetection();
const useCraftPrimary = getUseCraftPrimary();
```

This allows settings to be changed dynamically without page reload.

## User Flow

### Changing Settings

1. Click the settings icon in the top-right corner
2. Toggle "Hybrid Detection" on/off
3. If Hybrid is ON, optionally toggle "CRAFT-Primary Mode"
4. Click "Save Settings" to close the modal
5. Settings are immediately active for next conversion

### Auto-disabling Logic

When Hybrid Detection is turned OFF:
- CRAFT-Primary Mode is automatically disabled
- This ensures consistent configuration

## UI/UX Features

### Visual Elements

- **Toggle Switches**: Modern animated toggle switches with blue highlight when enabled
- **Nested Layout**: CRAFT-Primary indented under Hybrid Detection to show relationship
- **Modal Overlay**: Dark semi-transparent background, centered modal
- **Responsive Design**: Works on mobile and desktop screens

### Color Scheme

- **Primary**: Blue (#2563eb) for active states
- **Background**: White modal on slate background
- **Text**: Black for headings, slate-600 for descriptions
- **Accent**: Amber for warning notices

### Animations

- Smooth toggle switch transitions
- Modal fade-in/out effect
- Hover states on buttons

## Testing

### Test Case 1: Toggle Hybrid Detection

1. Open settings
2. Turn OFF "Hybrid Detection"
3. Save and upload a PowerPoint
4. Check console logs - should show "Claude-Only" mode

### Test Case 2: Enable CRAFT-Primary

1. Open settings
2. Ensure "Hybrid Detection" is ON
3. Turn ON "CRAFT-Primary Mode"
4. Save and upload a PowerPoint
5. Check console logs - should show "CRAFT-PRIMARY" mode
6. If CRAFT unavailable, should see fallback message

### Test Case 3: Settings Persistence

1. Open settings and change toggles
2. Refresh the browser page
3. Open settings again
4. Verify toggles are in the same state (persisted)

### Test Case 4: Auto-disable Logic

1. Open settings
2. Enable both Hybrid Detection and CRAFT-Primary
3. Turn OFF Hybrid Detection
4. Verify CRAFT-Primary is automatically disabled

## Configuration Priority

Settings are now loaded in this order:

1. **Runtime Settings** (localStorage) - Highest priority
2. Environment Variables (.env) - Only used as defaults on first load

Once a user changes settings via UI, localStorage takes precedence.

## Environment Variables (Still Supported)

The `.env` file still works as default values:

```bash
# These set the initial state on first load
VITE_USE_HYBRID_DETECTION=true
VITE_USE_CRAFT_PRIMARY=false
```

After first load, UI settings override these values.

## Benefits

✅ **User-Friendly**: No need to edit configuration files
✅ **Immediate Effect**: Changes apply to next conversion instantly
✅ **Persistent**: Settings saved across browser sessions
✅ **Visual Feedback**: Clear indication of current mode
✅ **Fail-Safe**: Automatic fallback if CRAFT unavailable
✅ **Help Text**: Built-in explanations for each mode
✅ **Professional UI**: Modern, polished design

## Files Modified/Created

### New Files:
- `src/components/Settings.tsx` - Settings modal component
- `src/lib/settings-service.ts` - Settings storage service
- `SETTINGS_UI.md` - This documentation

### Modified Files:
- `src/App.tsx` - Added Settings component and state management
- `src/lib/conversion-service.ts` - Read settings from service instead of env vars

## Future Enhancements

Potential additions:
- Export/import settings as JSON
- Detection quality metrics dashboard
- CRAFT service health indicator
- Advanced settings (IoU thresholds, confidence scores)
- A/B comparison mode (run both methods, compare results)
