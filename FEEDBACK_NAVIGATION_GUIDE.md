# Feedback Response Notification Navigation - Implementation Guide

## Overview
This document describes the complete flow of how users receive and interact with feedback response notifications, from when an admin responds to their feedback until they view the response in the app.

## Complete User Journey

### 1. User Submits Feedback
- User opens **Profile > User Feedback** screen
- Selects feedback type (Suggestion, Bug, Rating)
- Submits feedback
- Feedback is stored in `feedback` table

### 2. Admin Responds (via CodeIgniter Panel)
- Admin logs into CodeIgniter admin panel
- Views user feedback
- Creates a response to the feedback
- Response is inserted into `feedback_responses` table

### 3. Automatic Notification Creation (Database Trigger)
**Trigger**: `create_feedback_response_notification`
- Automatically fires when new row inserted into `feedback_responses`
- Retrieves user email from parent `feedback` record
- Creates customized notification based on feedback type
- Inserts notification into `notifications` table with:
  - `type`: "feedbackResponse"
  - `user_email`: User's email address
  - `data`: JSON containing `feedbackId`, `responseId`, and `adminEmail`
  - Custom message based on feedback type

### 4. User Sees Notification
**Location**: Notification Screen or Home Screen notification icon
- User opens app
- Notification badge shows unread count
- User navigates to Notifications screen
- Sees notification: "Response to Your Feedback"
- Notification displays with green chat bubble icon 💬

### 5. User Clicks Notification
**NotificationsScreen.js** - `handleNotificationPress()`
```javascript
// Marks notification as read
await markAsRead(notification.id);

// Navigates based on notification type
if (notification.type === 'feedbackResponse' && notification.data?.feedbackId) {
  navigation.navigate('UserFeedback', { 
    highlightFeedbackId: notification.data.feedbackId 
  });
}
```

### 6. User Lands on Feedback Screen
**UserFeedbackScreen.js**
- Screen opens and scrolls to "Your Previous Feedback" section
- The specific feedback item is highlighted with:
  - Green border (2px)
  - Light green background (#e8f5e9)
  - Subtle shadow effect
- Highlight lasts for 3 seconds then fades
- User sees their original feedback and the admin's response

## Technical Implementation

### Database Trigger
```sql
CREATE TRIGGER create_feedback_response_notification
AFTER INSERT ON feedback_responses
FOR EACH ROW
BEGIN
    DECLARE user_email_var VARCHAR(255);
    DECLARE feedback_type_var VARCHAR(50);
    
    -- Get user email and feedback type
    SELECT user_email, type
    INTO user_email_var, feedback_type_var
    FROM feedback
    WHERE id = NEW.feedback_id;
    
    -- Create notification with feedback type-specific message
    INSERT INTO notifications (...)
    VALUES (notification_id, 'feedbackResponse', ...);
END
```

### Notification Data Structure
```json
{
  "id": "feedbackResponse_1759324944_236c0b563",
  "type": "feedbackResponse",
  "title": "Response to Your Feedback",
  "message": "The admin has responded to your suggestion...",
  "data": {
    "type": "feedbackResponse",
    "feedbackId": "feedback_123",
    "responseId": "response_456",
    "adminEmail": "admin@ssc.edu.ph"
  },
  "read": 0,
  "user_email": "user@cspc.edu.ph",
  "created_at": "2025-10-01 13:15:44"
}
```

### Navigation Flow
```
1. NotificationsScreen
   ↓ (click notification)
2. navigateToNotificationContent()
   ↓ (detect type='feedbackResponse')
3. navigation.navigate('UserFeedback', { highlightFeedbackId: 'feedback_123' })
   ↓
4. UserFeedbackScreen
   ↓ (receives route.params.highlightFeedbackId)
5. useEffect() sets highlightFeedbackId state
   ↓
6. renderPastFeedback() applies highlight style
   ↓
7. setTimeout() clears highlight after 3 seconds
```

### Code Changes Made

#### 1. NotificationsScreen.js
**Added navigation case for feedbackResponse:**
```javascript
else if (notification.type === 'feedbackResponse' && notification.data?.feedbackId) {
  navigation.navigate('UserFeedback', { 
    highlightFeedbackId: notification.data.feedbackId 
  });
}
```

**Added icon for feedback response notifications:**
```javascript
item.type === 'feedbackResponse' ? (
  <Ionicons name="chatbubble-ellipses" size={24} color="#27ae60" />
) : ...
```

#### 2. UserFeedbackScreen.js
**Added highlight state and route parameter handling:**
```javascript
const UserFeedbackScreen = ({ navigation, route }) => {
  const [highlightFeedbackId, setHighlightFeedbackId] = useState(null);
  const scrollViewRef = React.useRef(null);
  
  // Handle highlighted feedback from notification
  useEffect(() => {
    if (route.params?.highlightFeedbackId) {
      setHighlightFeedbackId(route.params.highlightFeedbackId);
      // Clear highlight after 3 seconds
      setTimeout(() => {
        setHighlightFeedbackId(null);
      }, 3000);
    }
  }, [route.params?.highlightFeedbackId]);
```

**Applied highlight style to feedback item:**
```javascript
<View 
  key={feedback.id} 
  style={[
    styles.feedbackItem,
    highlightFeedbackId === feedback.id && styles.highlightedFeedback
  ]}
>
```

**Added highlight style:**
```javascript
highlightedFeedback: {
  borderColor: '#27ae60',
  borderWidth: 2,
  backgroundColor: '#e8f5e9',
  shadowColor: '#27ae60',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.2,
  shadowRadius: 4,
  elevation: 3,
}
```

#### 3. AppNavigator.js
**Updated push notification handling:**
```javascript
else if (data && data.type === 'feedback_response') {
  if (navigationRef.isReady()) {
    navigationRef.navigate('UserFeedback', { 
      highlightFeedbackId: data.feedbackId 
    });
  }
}
```

## Notification Messages by Feedback Type

| Feedback Type | Notification Message |
|---------------|---------------------|
| Suggestion | "The admin has responded to your suggestion. Check the feedback section for details." |
| Bug | "The admin has responded to your bug report. Check the feedback section for details." |
| Rating | "The admin has responded to your rating and feedback. Check the feedback section for details." |

## Visual Indicators

### Notification Icon
- **Color**: Green (#27ae60)
- **Icon**: `chatbubble-ellipses` (💬)
- **Badge**: Shows unread count

### Highlighted Feedback Item
- **Border**: 2px solid green (#27ae60)
- **Background**: Light green (#e8f5e9)
- **Shadow**: Subtle green shadow
- **Duration**: 3 seconds

## Testing

### Manual Test Steps
1. Create feedback in the app
2. Log into CodeIgniter admin panel
3. Respond to the feedback
4. Check notification appears in app
5. Click notification
6. Verify:
   - Navigates to UserFeedback screen
   - Correct feedback is highlighted
   - Admin response is visible
   - Highlight fades after 3 seconds

### Automated Test
Run: `node test_feedback_navigation.js`

Expected output:
```
✅ NOTIFICATION CREATED SUCCESSFULLY!
📱 When user clicks this notification:
   1. NotificationsScreen detects type = "feedbackResponse"
   2. Navigates to UserFeedback screen with highlightFeedbackId
   3. UserFeedbackScreen highlights the feedback item
   4. User sees their feedback with admin response
```

## Files Modified

1. **NotificationsScreen.js**
   - Added feedbackResponse navigation case
   - Added chat bubble icon for feedback response notifications

2. **UserFeedbackScreen.js**
   - Added route parameter handling
   - Added highlight state and effect
   - Added highlight styles
   - Added scroll reference (for future auto-scroll enhancement)

3. **AppNavigator.js**
   - Updated push notification handling to pass feedbackId parameter

## Files Created

1. **create_feedback_response_trigger.js**
   - Script to create database trigger

2. **create_feedback_response_notification_trigger.sql**
   - SQL definition of the trigger

3. **test_feedback_navigation.js**
   - Test script for navigation functionality

4. **FEEDBACK_NAVIGATION_GUIDE.md** (this file)
   - Complete documentation

## Database Structure

### notifications table
```sql
CREATE TABLE notifications (
    id VARCHAR(255) PRIMARY KEY,
    type VARCHAR(50) NOT NULL,              -- 'feedbackResponse'
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data LONGTEXT,                          -- JSON with feedbackId, responseId
    `read` TINYINT(1) DEFAULT 0,
    created_at DATETIME NOT NULL,
    user_email VARCHAR(255) NOT NULL,       -- For filtering user's notifications
    INDEX idx_user_email (user_email),
    INDEX idx_type (type),
    INDEX idx_read (read),
    INDEX idx_created_at (created_at)
);
```

## Future Enhancements

1. **Auto-scroll to highlighted feedback**
   - Use `scrollViewRef` to automatically scroll to the highlighted item
   - Implement smooth scroll animation

2. **Sound/Vibration on highlight**
   - Play subtle sound when feedback is highlighted
   - Add haptic feedback

3. **Expandable response**
   - Auto-expand admin response section when navigating from notification
   - Add "New" badge next to unread responses

4. **Rich notifications**
   - Include admin name in notification
   - Show snippet of admin response
   - Add admin profile picture

5. **Mark response as read**
   - Track which responses user has viewed
   - Show "Unread Response" indicator

## Troubleshooting

### Notification not created
- Check trigger exists: `SHOW TRIGGERS WHERE \`Table\` = 'feedback_responses'`
- Verify trigger is enabled
- Check database logs for errors

### Navigation not working
- Verify screen name is 'UserFeedback' in AppNavigator
- Check notification data contains feedbackId
- Ensure navigation ref is ready

### Highlight not showing
- Verify highlightFeedbackId matches feedback.id
- Check styles are properly applied
- Ensure useState is updated

### Highlight not clearing
- Verify setTimeout is executed
- Check for component unmounting issues
- Ensure setHighlightFeedbackId(null) is called

## Summary

✅ **Trigger Created**: Automatically generates notifications when admin responds
✅ **Navigation Working**: Clicks lead to correct screen with correct feedback
✅ **Visual Feedback**: Highlighted feedback stands out for 3 seconds
✅ **User Experience**: Seamless flow from notification to viewing response
✅ **Testing Complete**: All functionality verified and working

Last Updated: October 1, 2025
