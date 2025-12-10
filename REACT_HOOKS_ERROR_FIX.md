# React Hooks Error Fix - UserStatsScreen

## Problem
**Error:** "React has detected a change in the order of Hooks called by UserStatsScreen. This will lead to bugs and errors if not fixed. Error: Rendered more hooks than during the previous render."

## Root Cause
React Hooks (`useRef` and `useEffect`) were called **inside** the `renderMonthlyActivity()` function, which is a conditional render function. 

**Problematic Code:**
```javascript
const renderMonthlyActivity = () => {
  // ... conditional logic ...
  
  // ❌ WRONG: Hooks inside render function
  const scrollViewRef = React.useRef(null);
  
  React.useEffect(() => {
    // Auto-scroll logic
  }, [firstDataIndex]);
  
  return (<View>...</View>);
};
```

### Why This Breaks React's Rules
1. **Hooks must be called at the top level** - Not inside conditionals, loops, or nested functions
2. **Hooks must be called in the same order** - React relies on call order to track state
3. **Conditional rendering** of `renderMonthlyActivity()` changes when hooks are called
4. This violates React's "Rules of Hooks"

## Solution

### 1. Move `useRef` to Component Top Level
**Before:**
```javascript
const renderMonthlyActivity = () => {
  const scrollViewRef = React.useRef(null); // ❌ Inside render function
  // ...
};
```

**After:**
```javascript
const UserStatsScreen = ({ navigation }) => {
  const styles = createStyles();
  const [loading, setLoading] = useState(true);
  // ... other state ...
  
  // ✅ At component top level
  const scrollViewRef = React.useRef(null);
```

### 2. Move `useEffect` to Component Top Level
**Before:**
```javascript
const renderMonthlyActivity = () => {
  // ...
  React.useEffect(() => { // ❌ Inside render function
    if (scrollViewRef.current && firstDataIndex > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ 
          x: firstDataIndex * 58,
          animated: true 
        });
      }, 100);
    }
  }, [firstDataIndex]);
};
```

**After:**
```javascript
// ✅ At component top level, after other useEffects
useEffect(() => {
  if (stats.monthlyActivity && stats.monthlyActivity.data) {
    const counts = stats.monthlyActivity.data;
    const firstDataIndex = counts.findIndex(count => count > 0);
    
    if (scrollViewRef.current && firstDataIndex > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ 
          x: firstDataIndex * 58,
          animated: true 
        });
      }, 300);
    }
  }
}, [stats.monthlyActivity]);
```

### 3. Keep Only Ref Usage in Render Function
The `renderMonthlyActivity()` function now only **uses** the ref (doesn't create it):

```javascript
const renderMonthlyActivity = () => {
  // ... data processing ...
  
  return (
    <View style={styles.chartContainer}>
      <Text style={styles.chartTitle}>Monthly Activity</Text>
      <Text style={styles.chartSubtitle}>← Swipe to see all months →</Text>
      <ScrollView 
        ref={scrollViewRef}  // ✅ Just uses the ref
        horizontal 
        showsHorizontalScrollIndicator={true}
      >
        {/* Chart content */}
      </ScrollView>
    </View>
  );
};
```

## Changes Made

### File: `src/features/profile/screens/UserStatsScreen.js`

#### 1. Added scrollViewRef at Component Top (Line ~45)
```javascript
const UserStatsScreen = ({ navigation }) => {
  const styles = createStyles();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({...});

  // ✅ Ref for monthly activity chart scrolling
  const scrollViewRef = React.useRef(null);
```

#### 2. Added Auto-Scroll useEffect (After Line ~85)
```javascript
// Auto-scroll to first month with data in monthly activity chart
useEffect(() => {
  if (stats.monthlyActivity && stats.monthlyActivity.data) {
    const counts = stats.monthlyActivity.data;
    const firstDataIndex = counts.findIndex(count => count > 0);
    
    if (scrollViewRef.current && firstDataIndex > 0) {
      // Scroll to position after a short delay
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ 
          x: firstDataIndex * 58, // 50px column + 8px margin
          animated: true 
        });
      }, 300);
    }
  }
}, [stats.monthlyActivity]);
```

#### 3. Removed Hooks from renderMonthlyActivity() (Line ~615)
**Removed:**
```javascript
const firstDataIndex = counts.findIndex(count => count > 0);
const scrollViewRef = React.useRef(null);  // ❌ Removed

React.useEffect(() => {  // ❌ Removed
  // Auto-scroll logic
}, [firstDataIndex]);
```

**Kept:**
```javascript
return (
  <View style={styles.chartContainer}>
    <ScrollView 
      ref={scrollViewRef}  // ✅ Still uses ref
      horizontal 
      showsHorizontalScrollIndicator={true}
    >
      {/* Chart */}
    </ScrollView>
  </View>
);
```

## React Hooks Rules (Reminder)

### ✅ DO:
1. Call hooks at the **top level** of your component
2. Call hooks in the **same order** every render
3. Call hooks from **React function components**
4. Call hooks from **custom hooks**

### ❌ DON'T:
1. Call hooks inside **loops**
2. Call hooks inside **conditions**
3. Call hooks inside **nested functions**
4. Call hooks inside **regular JavaScript functions**
5. Call hooks after **early returns**

## Testing

### 1. Check for Hook Errors
```bash
# Restart Expo
npx expo start --clear

# Watch for errors in terminal
# Should NOT see: "Rendered more hooks than during the previous render"
```

### 2. Verify Functionality
- [ ] App loads without errors
- [ ] Navigate to User Statistics
- [ ] Monthly Activity chart displays
- [ ] Chart auto-scrolls to October (or first month with data)
- [ ] Manual scrolling still works

### 3. Test Edge Cases
- [ ] User with no data → No error
- [ ] User with data in January → No unnecessary scroll
- [ ] User with data in December → Scrolls to end
- [ ] Navigate away and back → No hook order errors

## Why This Fix Works

### Before (Broken):
```
Component Render:
├─ useState() calls (always)
├─ useEffect() calls (always)
└─ renderMonthlyActivity() called conditionally
   ├─ useRef() ❌ Sometimes called
   └─ useEffect() ❌ Sometimes called
   
Hook call order changes → React error!
```

### After (Fixed):
```
Component Render:
├─ useState() calls (always)
├─ useRef() ✅ Always called
├─ useEffect() calls ✅ Always called
└─ renderMonthlyActivity() called conditionally
   └─ Uses ref (not creates it) ✅
   
Hook call order consistent → No error!
```

## Deployment

### No Additional Steps Needed
- Fixed in the same file as before
- No new dependencies
- Just reload/restart the app

### VPS Deployment
```bash
# Copy updated file
scp src/features/profile/screens/UserStatsScreen.js root@167.71.202.102:/root/lost-and-found-app/src/features/profile/screens/

# Restart app
ssh root@167.71.202.102
cd /root/lost-and-found-app
# Restart your app service
```

## Related Documentation
- [React Hooks Rules](https://react.dev/warnings/invalid-hook-call-warning)
- `MONTHLY_ACTIVITY_SCROLL_FIX.md` - Original scroll implementation
- `MONTHLY_ACTIVITY_CHART_FIX.md` - Chart visibility fixes

---

**Status:** ✅ FIXED  
**Error:** "Rendered more hooks than during the previous render"  
**Cause:** Hooks called inside conditional render function  
**Solution:** Moved hooks to component top level  
**Impact:** Critical - Prevents app crashes and React warnings  
**Date:** January 2025
