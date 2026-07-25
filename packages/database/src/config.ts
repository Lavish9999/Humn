const productionConfig = {
  url: 'https://bondfumehickzmmbfwoe.supabase.co',
  publishableKey: 'sb_publishable_PRuJO2R0zZscKl5vHaWdSA_Z-IwUFDl',
} as const;

/**
 * Return Humn's verified browser-safe Supabase configuration.
 *
 * Supabase publishable keys are intentionally safe to ship in client bundles;
 * database access remains protected by Row Level Security. Private secret and
 * service-role keys must never be added here.
 *
 * These values are authoritative until the Vercel project environment is
 * corrected. This prevents stale or unrelated deployment variables from
 * silently routing Humn to the wrong Supabase project.
 */
export function getPublicSupabaseConfig() {
  return productionConfig;
}
