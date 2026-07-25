import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import { authenticatedClient, json, serviceClient } from '../_shared/http.ts';

const schema = z.object({
  workId: z.string().uuid(),
  fileName: z.string().min(1).max(180),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'video/mp4']),
  sizeBytes: z.number().int().positive().max(209_715_200),
});

function safeExtension(fileName: string, mimeType: string) {
  const fromName = fileName.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '');
  const allowed: Record<string, string[]> = {
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/webp': ['webp'],
    'video/mp4': ['mp4'],
  };
  return fromName && allowed[mimeType]?.includes(fromName) ? fromName : allowed[mimeType][0];
}

Deno.serve(async (request) => {
  try {
    if (request.method !== 'POST') return json({ error: { code: 'METHOD_NOT_ALLOWED' } }, 405);
    const input = schema.parse(await request.json());
    const { client, user } = await authenticatedClient(request);
    const { data: work, error: workError } = await client.from('works').select('id,status').eq('id', input.workId).eq('creator_id', user.id).single();
    if (workError || !work) return json({ error: { code: 'WORK_NOT_FOUND' } }, 404);
    if (!['draft', 'needs_evidence'].includes(work.status)) return json({ error: { code: 'WORK_LOCKED' } }, 409);

    const extension = safeExtension(input.fileName, input.mimeType);
    const path = `${user.id}/${work.id}/${crypto.randomUUID()}.${extension}`;
    const admin = serviceClient();
    const { data, error } = await admin.storage.from('temporary-uploads').createSignedUploadUrl(path, { upsert: false });
    if (error) throw error;

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'upload.session_created',
      entity_type: 'work',
      entity_id: work.id,
      metadata: { path, mimeType: input.mimeType, sizeBytes: input.sizeBytes },
    });

    return json({ data: { bucket: 'temporary-uploads', path, token: data.token, expiresInSeconds: 7200 } }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'UNAUTHORIZED' ? 401 : 400;
    return json({ error: { code: status === 401 ? 'UNAUTHORIZED' : 'UPLOAD_SESSION_FAILED', message } }, status);
  }
});
