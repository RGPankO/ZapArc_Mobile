# Requirements Document

## Introduction

This specification defines a minimal Firebase Cloud Functions service for sending instant push notifications when Lightning wallet transactions occur. The system enables User B to receive an immediate notification when User A sends them sats. Notifications are delivered using Expo Push Tokens and the Expo Push API for iOS and Android.

## Glossary

- **Cloud_Function**: A serverless function deployed to Firebase that handles notification requests
- **Expo_Push_Token**: A unique identifier for a user's device registered with Expo Push Notifications
- **Expo_Push_API**: Expo's HTTP API used to send push notifications to Expo push tokens
- **Expo_Notifications**: React Native library for handling push notifications in Expo apps
- **Transaction_Notification**: A push notification informing a user about a received Lightning payment
- **Breez_SDK**: Lightning Network SDK used by the wallet application

## Requirements

### Requirement 1: Project Structure

**User Story:** As a developer, I want a clear project structure for the notifications service, so that I can easily maintain and deploy the Cloud Functions.

#### Acceptance Criteria

1. THE System SHALL create a notifications/ folder at the project root level
2. THE System SHALL initialize the notifications/ folder as a Firebase Functions project with TypeScript
3. THE System SHALL configure the project to use Node.js 20 runtime
4. THE System SHALL include package.json with required dependencies (firebase-functions)

### Requirement 2: Expo Push API Configuration

**User Story:** As a developer, I want Expo Push API requests properly configured, so that the Cloud Function can send notifications to Expo push tokens.

#### Acceptance Criteria

1. THE Cloud_Function SHALL send HTTPS POST requests to the Expo Push API endpoint
2. THE Cloud_Function SHALL include proper JSON headers and payload formatting for Expo Push API
3. WHEN the Expo Push API returns an error THEN THE System SHALL log the error and return a failure response
4. THE System SHALL load configuration from a `.env` file using `dotenv/config`
5. THE System SHALL validate configuration with `zod` at startup and fail fast on invalid values
6. THE Expo Push API endpoint SHALL be configurable via `EXPO_PUSH_API_URL` with a default of `https://exp.host/--/api/v2/push/send`

### Requirement 3: Send Transaction Notification

**User Story:** As a wallet user, I want to receive an instant push notification when someone sends me sats, so that I'm immediately aware of incoming payments.

#### Acceptance Criteria

1. WHEN a valid notification request is received THEN THE Cloud_Function SHALL send an Expo push notification to the specified Expo_Push_Token
2. THE Cloud_Function SHALL accept requests with expoPushToken (string) and amount (number) parameters
3. THE Notification SHALL display the message "You received {amount} sats!"
4. THE Notification SHALL include a title "Payment Received"
5. WHEN the notification is sent successfully THEN THE Cloud_Function SHALL return a success response with status 200

### Requirement 4: Input Validation

**User Story:** As a developer, I want input validation on notification requests, so that invalid requests are rejected before attempting to send notifications.

#### Acceptance Criteria

1. WHEN a request is missing the expoPushToken parameter THEN THE Cloud_Function SHALL return an error response with status 400
2. WHEN a request is missing the amount parameter THEN THE Cloud_Function SHALL return an error response with status 400
3. WHEN the amount parameter is not a positive number THEN THE Cloud_Function SHALL return an error response with status 400
4. WHEN the expoPushToken parameter is not a non-empty string THEN THE Cloud_Function SHALL return an error response with status 400

### Requirement 5: Error Handling

**User Story:** As a developer, I want proper error handling, so that I can diagnose issues when notifications fail to send.

#### Acceptance Criteria

1. WHEN the Expo Push API returns an error THEN THE Cloud_Function SHALL log the error details
2. WHEN the Expo Push API returns an error THEN THE Cloud_Function SHALL return an error response with status 500
3. WHEN an unexpected error occurs THEN THE Cloud_Function SHALL log the error and return status 500
4. THE Error_Response SHALL include a descriptive error message

### Requirement 6: Expo Push API Compatibility

**User Story:** As a mobile app developer, I want the notification format to be compatible with Expo push notifications, so that the React Native app can properly display notifications on iOS and Android.

#### Acceptance Criteria

1. THE Notification SHALL use Expo Push API message format
2. THE Notification SHALL include both title and body fields
3. THE Notification SHALL be displayable by expo-notifications library version ~0.29.14

### Requirement 7: Unit Testing

**User Story:** As a developer, I want unit tests for the notification service, so that I can verify correctness and prevent regressions.

#### Acceptance Criteria

1. THE System SHALL include unit tests using vitest framework
2. THE Tests SHALL verify successful notification sending with valid inputs
3. THE Tests SHALL verify error handling for invalid inputs
4. THE Tests SHALL verify error handling for Expo Push API failures
