# Implementation Plan: Expo Push Notifications Handler

## Overview

This plan implements a minimal Firebase Cloud Functions service for sending instant transaction notifications using the Expo Push API. The implementation consists of a single HTTP-triggered Cloud Function with input validation and error handling.

## Tasks

- [x] 1. Initialize Firebase Functions project
  - Create notifications-handler/ folder at project root
  - Initialize with TypeScript and Node.js 20
  - Install dependencies: firebase-functions, dotenv, zod
  - Configure tsconfig.json for strict TypeScript
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Create TypeScript interfaces and types
  - Define TransactionNotificationRequest interface (expoPushToken, amount)
  - Define TransactionNotificationResponse interface (success, message, error)
  - Define ExpoPushMessage interface (to, title, body, data optional)
  - _Requirements: 3.2_

- [x] 3. Implement input validation module
  - Create src/validation.ts
  - Implement validateRequest function
  - Check expoPushToken is non-empty string
  - Check amount is positive number
  - Return validation result with error message if invalid
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [x] 3.2 Implement configuration module
  - Create src/config.ts
  - Load `.env` with `dotenv/config`
  - Validate `EXPO_PUSH_API_URL` with `zod` and provide default
  - Add `.env.example` with documented keys
  - _Requirements: 2.4, 2.5, 2.6_

- [x] 4. Implement sendTransactionNotification Cloud Function
  - Create src/index.ts
  - Export HTTP-triggered Cloud Function using onRequest
  - Parse request body to extract expoPushToken and amount
  - Call validation module
  - Return 400 error if validation fails
  - _Requirements: 2.1, 3.1, 3.2, 4.1, 4.2, 4.3, 4.4_

- [x] 5. Implement notification formatting and sending
  - Format Expo push message with title "Payment Received"
  - Format body as "You received {amount} sats!"
  - POST to Expo Push API with formatted message
  - Return 200 success response if Expo Push API succeeds
  - _Requirements: 3.1, 3.3, 3.4, 3.5, 6.1, 6.2_

- [x] 6. Implement error handling
  - Wrap Expo Push API request in try-catch block
  - Log Expo Push API errors with console.error()
  - Return 500 error response if Expo Push API fails
  - Catch unexpected errors and return 500
  - Include descriptive error messages in all error responses
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 7. Set up testing infrastructure
  - Install vitest and @vitest/ui as dev dependencies
  - Create vitest.config.ts
  - Configure test environment for Node.js
  - Set up fetch mocking for Expo Push API
  - _Requirements: 7.1_

- [x] 8. Write unit tests for happy path
  - Test successful notification with valid expoPushToken and amount
  - Mock fetch to return success
  - Verify 200 status and success response
  - _Requirements: 7.2_

- [x] 9. Write unit tests for edge cases
  - Test empty expoPushToken returns 400
  - Test missing amount returns 400
  - Test zero amount returns 400
  - Test negative amount returns 400
  - Test Expo Push API error returns 500
  - _Requirements: 7.3, 7.4_
- Unit tests validate specific examples and edge cases
- Fetch should be mocked in all tests to avoid actual Expo Push API calls
