import "server-only";
import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  AZURE_TRANSLATOR_KEY: z.string().min(1),
  AZURE_TRANSLATOR_ENDPOINT: z.url(),
  AZURE_TRANSLATOR_REGION: z.string().min(1),
  // Vercel sets this automatically for every project (Settings > Cron
  // Jobs) and sends it as "Authorization: Bearer <value>" on every cron
  // invocation - app/api/cron/signup-reminders checks it to make sure the
  // route can't be triggered by anyone who just finds the URL.
  CRON_SECRET: z.string().min(1),
});

export const env = envSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  AZURE_TRANSLATOR_KEY: process.env.AZURE_TRANSLATOR_KEY,
  AZURE_TRANSLATOR_ENDPOINT: process.env.AZURE_TRANSLATOR_ENDPOINT,
  AZURE_TRANSLATOR_REGION: process.env.AZURE_TRANSLATOR_REGION,
  CRON_SECRET: process.env.CRON_SECRET,
});
