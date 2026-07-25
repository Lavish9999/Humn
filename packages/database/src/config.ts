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
 * Vercel builds remain pinned to the verified Humn project so stale deployment
 * variables cannot route production elsewhere. Local development and CI may
 * explicitly point at the local Supabase stack.
 */
export function getPublicSupabaseConfig() {
  const localUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const localKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const isLocalDevelopment = process.env.NODE_ENV !== 'production'
    && Boolean(localUrl && localKey);

  if (isLocalDevelopment) {
    return {
      url: localUrl as string,
      publishableKey: localKey as string,
    };
  }

  return productionConfig;
}
