import { authenticatedClient, json, serviceClient } from '../_shared/http.ts';


function requireRecentAuthentication(request: Request) {
  const authorization = request.headers.get('authorization') ?? '';
  const token = authorization.replace(/^Bearer\s+/i, '');
  const payloadPart = token.split('.')[1];
  if (!payloadPart) throw new Error('REAUTH_REQUIRED');
  const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payloadPart.length / 4) * 4, '=');
  const payload = JSON.parse(atob(normalized)) as { iat?: number };
  if (!payload.iat || Math.floor(Date.now() / 1000) - payload.iat > 600) throw new Error('REAUTH_REQUIRED');
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value.toLowerCase().trim());
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function listFilesRecursively(
  client: ReturnType<typeof serviceClient>,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const files: string[] = [];
  const { data, error } = await client.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) throw error;
  for (const entry of data ?? []) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id) files.push(path);
    else files.push(...await listFilesRecursively(client, bucket, path));
  }
  return files;
}

Deno.serve(async (request) => {
  try {
    if (request.method !== 'POST') return json({ error: { code: 'METHOD_NOT_ALLOWED' } }, 405);
    requireRecentAuthentication(request);
    const { user } = await authenticatedClient(request);
    const admin = serviceClient();

    const emailHash = user.email ? await sha256(user.email) : null;
    const { data: deletion, error: deletionError } = await admin
      .from('deletion_requests')
      .insert({ user_id: user.id, user_email_hash: emailHash, status: 'processing', scheduled_for: new Date().toISOString() })
      .select('id')
      .single();
    if (deletionError) throw deletionError;

    const buckets = [
      'profile-media',
      'collection-covers',
      'temporary-uploads',
      'private-original-files',
      'private-proof-evidence',
      'public-work-media',
    ];
    for (const bucket of buckets) {
      const paths = await listFilesRecursively(admin, bucket, user.id);
      for (let offset = 0; offset < paths.length; offset += 100) {
        const { error } = await admin.storage.from(bucket).remove(paths.slice(offset, offset + 100));
        if (error) throw error;
      }
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    await admin
      .from('deletion_requests')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', deletion.id);

    return json({ data: { deleted: true } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'UNAUTHORIZED' ? 401 : message === 'REAUTH_REQUIRED' ? 403 : 400;
    const code = message === 'UNAUTHORIZED' ? 'UNAUTHORIZED' : message === 'REAUTH_REQUIRED' ? 'REAUTH_REQUIRED' : 'DELETE_FAILED';
    return json({ error: { code, message } }, status);
  }
});
