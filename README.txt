================================================================================
                    CSPC Lost & Found System
                 Web Application & Mobile App
================================================================================

PROJECT OVERVIEW
================================================================================
A comprehensive Lost & Found management system designed for CSPC (Camarines 
Sur Polytechnic Colleges) featuring both a web-based admin panel and a mobile 
application for students and staff.

The system uses AI-powered matching to automatically connect lost items with 
found item reports, includes real-time notifications, claim management, 
support ticket system, and comprehensive admin controls.


TECHNOLOGY STACK
================================================================================
Mobile App:
  - React Native (Expo)
  - Expo Notifications (Push Notifications)
  - AsyncStorage (Local Data)
  - React Navigation

Backend:
  - CodeIgniter 4 (PHP Framework)
  - MySQL Database
  - RESTful API Architecture

AI/ML:
  - AI-powered item matching system
  - Category normalization
  - Automatic re-matching after deletions


PROJECT STRUCTURE
================================================================================
/src                    - React Native mobile app source code
  /screens              - All application screens
  /components           - Reusable UI components
  /services             - API and service integrations
  /utils                - Helper functions and utilities

/assets                 - Images, icons, and static resources

/backend                - CodeIgniter 4 backend (if included)

/*.sql                  - Database migration files
/*.js                   - Database utility and migration scripts
/*.md                   - Feature documentation files


KEY FEATURES
================================================================================

User Features:
  - Report lost items with photos and descriptions
  - Report found items
  - AI-powered automatic matching between lost/found items
  - Real-time push notifications
  - Claim management with deadlines
  - Appeal and unsuspension system
  - Feedback system with attachments
  - Support ticket system
  - Offline status detection
  - Auto-refresh for real-time updates

Admin Features:
  - User account management (suspend/unsuspend)
  - Item verification and management
  - Claim approval/rejection
  - Support ticket management
  - Feedback review and responses
  - System-wide notifications
  - Fake report detection and handling
  - Item expiration automation

Notification System:
  - Claim status updates
  - Match notifications
  - Response notifications
  - Admin action notifications
  - Support ticket updates
  - Deadline reminders


SETUP INSTRUCTIONS
================================================================================

Prerequisites:
  - Node.js (v14 or higher)
  - npm or yarn
  - Expo CLI
  - MySQL Database
  - PHP 7.4+ with CodeIgniter 4
  - Android Studio / Xcode (for mobile development)

Mobile App Setup:
  1. Install dependencies:
     npm install

  2. Configure API endpoint:
     - Copy app.json.example to app.json
     - Update API_URL in configuration files

  3. Run the app:
     npx expo start

  4. For production builds:
     - See EAS_BUILD_FINAL_STATUS.md
     - See BUILD_NOW.md

Backend Setup:
  1. Set up MySQL database
  2. Run migration scripts in order:
     - Execute *.sql files in database
     - Run node *.js migration files as needed
  
  3. Configure CodeIgniter:
     - See CODEIGNITER_INTEGRATION_GUIDE.md
     - Set up database credentials
     - Configure API keys (see API_KEY_CONFIGURATION.md)

  4. Deploy backend:
     - See DEPLOYMENT_GUIDE_VPS.md


DATABASE MIGRATIONS
================================================================================
The following SQL files should be executed in your MySQL database:

Core Tables:
  - create_support_notification_triggers.sql
  - create_claim_notification_triggers.sql
  - add_last_activity_column.sql
  - expire_found_items_automation.sql

Feature Additions:
  - add_claim_deadline_fields.sql
  - add_turnin_fields.sql
  - add_feedback_attachment.sql

Run the corresponding .js migration files after SQL setup to populate 
initial data or configure triggers.


IMPORTANT DOCUMENTATION
================================================================================

Getting Started:
  - CODEIGNITER_INTEGRATION_GUIDE.md - Backend integration guide
  - API_KEY_CONFIGURATION.md - API setup instructions
  - DEPLOYMENT_GUIDE_VPS.md - Production deployment guide

Feature Documentation:
  - AI_MATCHING_SYSTEM.md - AI matching implementation
  - CLAIM_DEADLINE_SYSTEM.md - Claim deadline feature
  - FEEDBACK_RESPONSE_NOTIFICATION_COMPLETE.md - Feedback system
  - DATE_LOCATION_REMINDER_FEATURE.md - Reminder system
  - APPEAL_UNSUSPENSION_FEATURE.md - User appeals
  - FAKE_REPORT_FEATURE.md - Fake report detection

Screen Protection:
  - ALL_SCREENS_PROTECTED_FINAL.md - Authentication status
  - ADDITIONAL_SCREENS_PROTECTED.md - Security implementation

Build & Deployment:
  - EAS_BUILD_FINAL_STATUS.md - Build configuration
  - APP_ICON_EAS_BUILD_FIX.md - Icon setup
  - BUILD_NOW.md - Quick build guide

Bug Fixes & Updates:
  - CLEAR_DATA_BUG_FIX.md - Data clearing fixes
  - DATE_FORMAT_COMPLETE_FIX_SUMMARY.md - Date formatting
  - BADGE_COUNT_ERROR_FIX.md - Notification badges
  - CATEGORY_NORMALIZATION_FIX.md - Category handling


CONFIGURATION FILES
================================================================================
- app.json - Expo configuration (copy from app.json.example)
- eas.json - EAS Build configuration
- package.json - Node dependencies
- *.ps1, *.py - Icon generation scripts


QUICK START GUIDES
================================================================================
- AI_MATCHING_QUICK_START.md - Get AI matching running quickly
- AUTO_REMATCH_QUICK_GUIDE.md - Configure auto-rematching
- FEEDBACK_NAVIGATION_GUIDE.md - Understand feedback flow


UTILITY SCRIPTS
================================================================================
Database Checks:
  - check_categories.js - Verify category setup
  - check_database_categories.js - Database category validation
  - check_expired_claims.js - Test expiration system
  - check_support_tables.js - Support system validation

Notification Testing:
  - check_all_support_notifications.js - Test support notifications
  - debug_support_notifications.js - Debug notification issues
  - diagnose_notification_display.js - Troubleshoot display problems

Demo & Testing:
  - demo_admin_actions.js - Test admin features
  - create_new_response_test.js - Test response system
  - create_test_response_notification.js - Test notifications


SYSTEM DIAGRAMS
================================================================================
- CLEAR_DATA_FLOW_DIAGRAM.txt - Data clearing workflow
- FEEDBACK_FLOW_DIAGRAM.txt - Feedback system flow


TROUBLESHOOTING
================================================================================

Build Issues:
  - See EAS_BUILD_VALIDATION_FIX.md
  - See APP_ICON_EAS_BUILD_FIX.md
  - Check DUPLICATE_IMPORTS_FIXED.md for import errors

Notification Issues:
  - Review ENABLE_BACKGROUND_PUSH.md
  - Check debug_support_notifications.js output
  - Verify triggers with check_support_tables.js

Data Issues:
  - See CLEAR_DATA_FIXES_SUMMARY.md
  - Review AUTO_REMATCH_AFTER_DELETION.md
  - Check category normalization with check_categories.js


CONTACT & SUPPORT
================================================================================
For questions, issues, or contributions related to the CSPC Lost & Found 
System, please refer to the project documentation or contact the development 
team.


VERSION HISTORY
================================================================================
Current Version: [1.0]
Last Updated: February 4, 2026

See individual .md files for detailed changelog and feature additions.


================================================================================
                        End of README
================================================================================
