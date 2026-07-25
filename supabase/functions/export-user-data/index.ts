import { authenticatedClient, json } from '../_shared/http.ts';

Deno.serve(async (request) => {
  try {
    if (request.method !== 'POST') return json({ error: { code: 'METHOD_NOT_ALLOWED' } }, 405);
    const { client, user } = await authenticatedClient(request);

    const queries = await Promise.all([
      client.from('profiles').select('*').eq('id', user.id).single(),
      client.from('user_settings').select('*').eq('user_id', user.id).maybeSingle(),
      client.from('creator_profiles').select('*').eq('user_id', user.id).maybeSingle(),
      client.from('works').select('*,work_media(*),work_origin_declarations(*),proof_stories(*,proof_story_items(*))').eq('creator_id', user.id),
      client.from('collections').select('*,collection_sections(*),collection_items(*)').eq('owner_id', user.id),
      client.from('work_saves').select('*').eq('user_id', user.id),
      client.from('follows').select('*').eq('follower_id', user.id),
      client.from('reports').select('*').eq('reporter_id', user.id),
      client.from('subscriptions').select('*').eq('user_id', user.id),
      client.from('entitlements').select('*').eq('user_id', user.id),
      client.from('device_sessions').select('*').eq('user_id', user.id),
    ]);

    const firstError = queries.find((query) => query.error)?.error;
    if (firstError) throw firstError;

    return json({
      data: {
        exportedAt: new Date().toISOString(),
        accountId: user.id,
        profile: queries[0].data,
        settings: queries[1].data,
        creatorProfile: queries[2].data,
        works: queries[3].data,
        collections: queries[4].data,
        saves: queries[5].data,
        follows: queries[6].data,
        reports: queries[7].data,
        subscriptions: queries[8].data,
        entitlements: queries[9].data,
        deviceSessions: queries[10].data,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'UNAUTHORIZED' ? 401 : 400;
    return json({ error: { code: status === 401 ? 'UNAUTHORIZED' : 'EXPORT_FAILED', message } }, status);
  }
});
