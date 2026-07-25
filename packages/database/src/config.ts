const productionFallback = {
  url: 'https://bondfumehickzmmbfwoe.supabase.co',
  publishableKey: 'sb_publishable_PRuJO2R0zZscKl5vHaWdSA_Z-IwUFDl',
} as const;

/**
 * Resolve the browser-safe Supabase configuration.
 *
 * Supabase publishable keys are intentionally safe to ship in client bundles;
 * database access remains protected by Row Level Security. Private secret and
 * service-role keys must never be added here.
 */
export function getPublicSupabaseConfig() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? productionFallback.url,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ?? productionFallback.publishableKey,
  };
}
