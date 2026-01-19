/**
 * Configuration module with environment validation
 */

import 'dotenv/config';
import { z } from 'zod';

/**
 * Configuration schema with validation and defaults
 */
const configSchema = z.object({
  /** Expo Push API endpoint URL */
  EXPO_PUSH_API_URL: z
    .string()
    .url()
    .default('https://exp.host/--/api/v2/push/send'),
});

/**
 * Parsed and validated configuration
 * Fails fast at startup if configuration is invalid
 */
export const config = configSchema.parse({
  EXPO_PUSH_API_URL: process.env.EXPO_PUSH_API_URL,
});

export type Config = z.infer<typeof configSchema>;
