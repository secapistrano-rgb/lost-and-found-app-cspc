# App Icon Update - Changed to logo-app.jpg

## Change Summary

Updated the app icon from the default `icon.png` to use `logo-app.jpg`.

---

## Files Modified

### `app.json`

**Changed:**

1. **Main App Icon (iOS & Android)**
   ```json
   "icon": "./assets/logo-app.jpg"
   ```
   - **Before:** `"./assets/icon.png"`
   - **After:** `"./assets/logo-app.jpg"`

2. **Android Adaptive Icon**
   ```json
   "adaptiveIcon": {
     "foregroundImage": "./assets/logo-app.jpg",
     "backgroundColor": "#ffffff"
   }
   ```
   - **Before:** `"./assets/adaptive-icon.png"`
   - **After:** `"./assets/logo-app.jpg"`

---

## What This Does

### iOS
- App icon on home screen will use `logo-app.jpg`
- App Store icon will use `logo-app.jpg`

### Android
- Launcher icon will use `logo-app.jpg` as foreground
- Adaptive icon with white background
- Works on all Android versions

---

## To See Changes

### Development Mode
The icon change will appear:
1. **On next build** of the app
2. **Not immediately** in Expo Go (uses Expo's icon)

### Production Build

**For Android APK:**
```bash
eas build --platform android --profile preview
```

**For iOS:**
```bash
eas build --platform ios --profile preview
```

---

## Icon Specifications

### Recommended Sizes

**iOS:**
- App Store: 1024x1024 pixels
- Home Screen: Various sizes (from 40x40 to 180x180)

**Android:**
- Launcher Icon: 512x512 pixels minimum
- Adaptive Icon: 432x432 pixels (safe zone: 288x288)

### Current Icon
- **File:** `assets/logo-app.jpg`
- **Format:** JPEG
- **Location:** `./assets/logo-app.jpg`

---

## If Icon Doesn't Appear

### Expo Go (Development)
Expo Go uses Expo's default icon. Your custom icon only appears in standalone builds.

### Solution: Create Development Build
```bash
npx expo prebuild
npx expo run:android
# or
npx expo run:ios
```

---

## Reverting Changes

To revert back to the original icon:

```json
{
  "expo": {
    "icon": "./assets/icon.png",
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png"
      }
    }
  }
}
```

---

## Best Practices

### Icon Design Tips
1. **Use PNG for transparency** (if needed)
2. **Square format** (1024x1024 recommended)
3. **Simple design** - visible at small sizes
4. **No text** - hard to read when small
5. **Padding** - avoid edges being cut off

### Converting JPG to PNG (if needed)
If you need a PNG version with transparency:

**Using online tools:**
- convertio.com
- online-convert.com

**Using command line (with ImageMagick):**
```bash
convert logo-app.jpg logo-app.png
```

---

## Testing the Icon

### Steps to Test

1. **Build the app:**
   ```bash
   eas build --platform android --profile preview
   ```

2. **Install on device**

3. **Check home screen** for new icon

4. **Verify in App Drawer** (Android)

---

## File Locations

```
lost-and-found/
├── app.json (✅ Modified - points to logo-app.jpg)
└── assets/
    ├── icon.png (original)
    ├── logo-app.jpg (✅ Now used as app icon)
    ├── adaptive-icon.png (original)
    ├── splash-icon.png (still used for splash)
    └── ...other assets
```

---

## Notes

- ✅ Icon changed to `logo-app.jpg`
- ✅ Applied to both iOS and Android
- ✅ Adaptive icon for Android updated
- ⚠️ Changes require rebuild to see on device
- ℹ️ Expo Go won't show custom icon in development

---

## Next Steps

To apply the icon changes:

1. **Option A: Build for testing**
   ```bash
   eas build --platform android --profile preview
   ```

2. **Option B: Development build**
   ```bash
   npx expo run:android
   ```

3. **Option C: Production build**
   ```bash
   eas build --platform all --profile production
   ```

---

## Summary

✅ **Changed app icon** from `icon.png` to `logo-app.jpg`  
✅ **Updated Android adaptive icon** to use `logo-app.jpg`  
✅ **Maintains white background** for adaptive icon  
⚠️ **Rebuild required** to see changes on device  

**Your app will now use the logo-app.jpg image as its icon!** 📱✨
