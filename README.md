# CSPC Lost & Found

A campus lost-and-found application for the CSPC community. Users can report lost or found belongings, review suggested matches, submit claims, and follow recovery updates.

## Features

- Report and manage items with photos, categories, dates, and locations.
- Review AI-assisted suggestions for matching lost and found reports.
- Submit claims and track approval and collection status.
- Receive match, claim, and support notifications.
- Manage profiles, settings, activity statistics, and achievements.
- Contact support, submit feedback, and use email verification.

## Technology

The mobile app uses Expo SDK 53, React 19, React Native 0.79, and React Navigation. It integrates Firebase authentication, Google sign-in, Expo notifications, maps, location, EmailJS, and Gemini image analysis. The included API uses Node.js, Express, MySQL, and Multer.

## Project structure

```text
assets/                     App icons, splash screens, and images
src/
  components/common/        Shared layouts and modals
  config/                   API endpoints and email configuration
  contexts/                 Connectivity, notification, and suspension providers
  features/                 Auth, home, items, matching, notifications, and profile
  navigation/               App navigation
  shared/
    api/                    Express API and matching services
      database/             SQL migrations, triggers, and maintenance SQL
      scripts/              Database administration utilities
    components/             Connectivity and offline UI
    hooks/                  Shared React hooks
    services/               App service integrations
    storage/                Local storage helpers
    utils/                  Shared utilities
App.js                      App providers and startup logic
app.json                    Expo configuration
eas.json                    EAS build profiles
index.js                    Application entry point
```

## Mobile setup

Install a Node.js LTS version supported by Expo SDK 53 and npm. Android builds require Android Studio and its SDK; iOS builds require macOS and Xcode.

```sh
npm ci
cp .env.example .env
```

Fill in the EmailJS values in `.env`. These `EXPO_PUBLIC_` values are included in the app bundle and must be client-safe configuration.

Provide your own `google-services.json` at the project root for Android. For iOS, provide `GoogleService-Info.plist` matching the path in `app.json`. These files are intentionally excluded from Git.

Before building, configure your Firebase project, Google sign-in, Google Maps key, Gemini access, Expo owner, and EAS project in the app configuration. Review the Firebase initialization in `App.js` as well. Use your own service accounts and project identifiers.

The API URL is configured in `src/config/apiConfig.js`. For local development on a physical device, use an address the device can reach on your network.

```sh
npm start          # Start the Expo development server
npm run android   # Build and run the Android app
npm run ios       # Build and run the iOS app
npm run web       # Start the web development target
```

Firebase and Google sign-in use native modules, so use a development build for those features. Platform support depends on the native integrations used by each screen.

## Included API

The mobile app can connect to an existing API. To work on the included Express server separately:

```sh
npm ci --prefix src/shared/api
cp src/shared/api/.env.example src/shared/api/.env
```

Configure `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and `GEMINI_API_KEY` in the backend `.env`. The API and maintenance scripts load that file independently of the shell's working directory.

The current backend also imports `node-fetch`; its CommonJS modules require version 2. This dependency must be supplied before running the server. Review the deployment-specific `UPLOADS_DIR`, `BASE_URL`, and port in `src/shared/api/server.js`, and ensure the uploads directory is writable.

```sh
node src/shared/api/server.js
```

A compatible MySQL database is required. Files in `src/shared/api/database/` are incremental migrations and triggers, rather than a complete database bootstrap. Review them against your existing schema. The utilities in `src/shared/api/scripts/` modify database records or schema; run only the operations needed for your deployment.

## Private configuration

Git excludes local `.env` files, Firebase service configuration, signing keys, local databases, and user uploads. The committed `.env.example` files contain configuration names without credentials.

Keep server credentials on the server. Values bundled into a mobile app, including Expo `extra` and `EXPO_PUBLIC_` configuration, are accessible to app users. Restrict client API keys at the provider and route privileged operations through a backend.

Removing a credential from the current files does not remove it from earlier Git commits. Rotate any credentials that were previously committed.
