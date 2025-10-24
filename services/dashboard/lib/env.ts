/**
 * Environment Variable Schema Validation (Admin Dashboard)
 * Validates and provides type-safe access to environment variables
 */

import { z } from 'zod';

const envSchema = z.object({
  // Dashboard URLs
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3003'),
  NEXT_PUBLIC_ADMIN_DASHBOARD_URL: z.string().url().default('http://localhost:3003'),
  NEXT_PUBLIC_DASHBOARD_BASE_URL: z.string().url().default('http://localhost:3000'),

  // Service URLs
  NEXT_PUBLIC_API_GATEWAY: z.string().url().default('http://localhost:4000'),
  NEXT_PUBLIC_INTELLIGENCE_ENGINE: z.string().url().default('http://localhost:8002'),
  NEXT_PUBLIC_GEO_CALCULATOR: z.string().url().default('http://localhost:8002'),
  NEXT_PUBLIC_WEB_CRAWLER: z.string().url().default('http://localhost:3002'),

  // WebSocket URL - must start with ws:// or wss://
  NEXT_PUBLIC_WS_URL: z.string()
    .refine(url => url.startsWith('ws://') || url.startsWith('wss://'), {
      message: 'WebSocket URL must start with ws:// or wss://'
    })
    .default('ws://localhost:4000'),

  // Authentication
  NEXTAUTH_URL: z.string().url().default('http://localhost:3003'),
  NEXTAUTH_SECRET: z.string().optional(),

  // Feature Flags (optional)
  NEXT_PUBLIC_DEMO_MODE: z.string().optional().default('false'),
  NEXT_PUBLIC_ANALYTICS_ENABLED: z.string().optional().default('true'),
  NEXT_PUBLIC_REAL_TIME_ENABLED: z.string().optional().default('true'),
  NEXT_PUBLIC_AI_CHAT_ENABLED: z.string().optional().default('true'),
});

// Parse and validate environment variables
export const env = envSchema.parse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_ADMIN_DASHBOARD_URL: process.env.NEXT_PUBLIC_ADMIN_DASHBOARD_URL,
  NEXT_PUBLIC_DASHBOARD_BASE_URL: process.env.NEXT_PUBLIC_DASHBOARD_BASE_URL,
  NEXT_PUBLIC_API_GATEWAY: process.env.NEXT_PUBLIC_API_GATEWAY,
  NEXT_PUBLIC_INTELLIGENCE_ENGINE: process.env.NEXT_PUBLIC_INTELLIGENCE_ENGINE,
  NEXT_PUBLIC_GEO_CALCULATOR: process.env.NEXT_PUBLIC_GEO_CALCULATOR,
  NEXT_PUBLIC_WEB_CRAWLER: process.env.NEXT_PUBLIC_WEB_CRAWLER,
  NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  NEXT_PUBLIC_DEMO_MODE: process.env.NEXT_PUBLIC_DEMO_MODE,
  NEXT_PUBLIC_ANALYTICS_ENABLED: process.env.NEXT_PUBLIC_ANALYTICS_ENABLED,
  NEXT_PUBLIC_REAL_TIME_ENABLED: process.env.NEXT_PUBLIC_REAL_TIME_ENABLED,
  NEXT_PUBLIC_AI_CHAT_ENABLED: process.env.NEXT_PUBLIC_AI_CHAT_ENABLED,
});

// Export typed environment variables
export type Env = z.infer<typeof envSchema>;
