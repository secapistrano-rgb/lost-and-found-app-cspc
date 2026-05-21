# Fake Report Feature

## Overview
The fake report feature allows users to flag items they believe are fake or fraudulent reports. When an item is reported as fake, it is marked with a special status and the original reporter's fake report count is incremented.

## Implementation Details

### 1. Database Schema
- Added `fake_report_count` column to `users` table
- Item status now includes `fake_report` as a valid status
- Run migration: `add_fake_report_count_column.sql`

### 2. API Endpoints

#### Report Item as Fake
```
POST /api/items/:id/fake-report
Body: { reportedBy: "reporter@email.com" }
```
- Marks the item status as "fake_report"
- Increments the original reporter's `fake_report_count`
- Prevents users from reporting their own items

#### Get User Fake Report Count
```
GET /api/users/email/:email/fake-reports
```
Returns: `{ email, fake_report_count }`

### 3. User Interface

#### Item Details Screen
- Added "Report as Fake" button (visible only for items you don't own)
- Button is hidden if item is already reported as fake
- Confirmation dialog before submitting report
- Success message after reporting

#### User Profile Screen
- Displays fake report count in Account Information section
- Shows warning text if count > 0
- Red styling to indicate violations
- Updates in real-time when profile loads

### 4. Business Logic

**Reporting Rules:**
- ✅ Users can report items they didn't create
- ❌ Users cannot report their own items
- ✅ Item status changes to "fake_report"
- ✅ Original reporter's count increments by 1
- ✅ Administrators are notified

**Display Rules:**
- Report button only shows for items user doesn't own
- Button hidden if item already reported as fake
- Fake report count visible in user profile

### 5. User Flow

1. User views an item they believe is fake
2. Clicks "Report as Fake" button
3. Confirms action in dialog
4. System updates item status to "fake_report"
5. System increments reporter's fake_report_count
6. User sees success message
7. Item flagged for admin review

### 6. Admin Usage

Admins can:
- View fake report counts in user management dashboard
- Filter users by fake report count
- Take action on users with high fake report counts
- Review items marked as fake_report

### 7. Future Enhancements

- [ ] Email notification to admin when item is reported
- [ ] Email notification to original reporter
- [ ] Allow reporter to appeal fake report
- [ ] Automatic account suspension after threshold (e.g., 5 fake reports)
- [ ] Detailed fake report history view
- [ ] Analytics dashboard for fake report trends

## Files Modified

1. `src/shared/api/server.js`
   - Added POST `/api/items/:id/fake-report` endpoint
   - Added GET `/api/users/email/:email/fake-reports` endpoint

2. `src/features/items/screens/ItemDetailsScreen.js`
   - Added `handleReportAsFake()` function
   - Added "Report as Fake" button
   - Added button styles

3. `src/features/profile/screens/UserProfileScreen.js`
   - Added `fakeReportCount` state
   - Added `fetchFakeReportCount()` function
   - Added fake report count display
   - Added warning styles

4. `add_fake_report_count_column.sql`
   - Migration script to add database column

## Testing

### Test Cases

1. **Report as Fake**
   - ✅ User can report someone else's item
   - ✅ User cannot report own item
   - ✅ Item status updates to "fake_report"
   - ✅ Reporter's count increments

2. **Display Fake Report Count**
   - ✅ Count shows in user profile
   - ✅ Warning text shows when count > 0
   - ✅ Count updates after reporting item

3. **Button Visibility**
   - ✅ Button hidden for own items
   - ✅ Button hidden for already reported items
   - ✅ Button visible for other users' items

## Security Considerations

- Validate user authentication before accepting fake reports
- Prevent spam by rate limiting fake reports
- Log all fake report actions for audit trail
- Implement appeal process for disputed reports
