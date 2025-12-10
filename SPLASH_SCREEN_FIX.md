# Splash Screen Fix - Hide Default Splash Screen

## Problem
The default Expo splash screen was showing briefly before the custom `SplashScreen.js` component, creating a jarring double-splash experience.

## Solution
Implemented proper splash screen management using `expo-splash-screen` API to control when the native splash screen hides.

## Changes Made

### 1. App.js
- **Added import**: `import * as ExpoSplashScreen from 'expo-splash-screen';`
- **Prevented auto-hide**: Added `ExpoSplashScreen.preventAutoHideAsync();` at the top level
- **Manual hide control**: Added `await ExpoSplashScreen.hideAsync();` in the initialize function to hide the native splash only after Firebase and notifications are initialized

### 2. app.json
- **Added expo-splash-screen plugin** with configuration:
  ```json
  [
    "expo-splash-screen",
    {
      "backgroundColor": "#ffffff",
      "imageWidth": 200
    }
  ]
  ```

## How It Works

1. **App Launch**: Native splash screen shows immediately
2. **preventAutoHideAsync()**: Keeps native splash visible while app initializes
3. **Initialize**: Firebase and notifications load in background
4. **hideAsync()**: Native splash is hidden programmatically
5. **Custom Splash**: Your custom `SplashScreen.js` component takes over with beautiful animations
6. **App Ready**: After custom splash animation completes, the main app is shown

## Benefits
✅ No double splash screen
✅ Smooth transition from native to custom splash
✅ Professional user experience
✅ Custom splash screen has full control over animations
✅ Native splash hidden at exactly the right moment

## Testing
After rebuilding the app with EAS:
```bash
eas build --profile preview --platform android
```

The native splash should now hide immediately when the custom splash screen is ready to display.

## Notes
- The native splash screen is still configured in `app.json` under the `splash` property
- The background color matches your custom splash for seamless transition
- The `expo-splash-screen` plugin ensures proper behavior on both Android and iOS
