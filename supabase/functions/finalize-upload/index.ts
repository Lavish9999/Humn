import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts';
import { authenticatedClient, json, serviceClient } from '../_shared/http.ts';

const schema = z.object({
  workId: z.string().uuid(),
  path: z.string().min(1).max(600),
  mediaType: z.enum(['image', 'video']),
  mimeType: z.string().min(1).max(100),
  width: z.number().int().positive().max(30000),
  height: z.number().int().positive().max(30000),
  durationMs: z.number().int().nonnegative().optional(),
  sourceType: z.enum(['live_capture', 'camera_library', 'desktop_upload', 'connected_service', 'project_file']),
});

Deno.serve(async (request) => {
  try {
    if (request.method !== 'POST') return json({ error: { code: 'METHOD_NOT_ALLOWED' } }, 405);
    const input = schema.parse(await request.json());
    const { client, user } = await authenticatedClient(request);
    if (!input.path.startsWith(`${user.id}/${input.workId}/`)) return json({ error: { code: 'PATH_OWNERSHIP_MISMATCH' } }, 403);

    const { data: work, error: workError } = await client.from('works').select('id,status').eq('id', input.workId).eq('creator_id', user.id).single();
    if (workError || !work) return json({ error: { code: 'WORK_NOT_FOUND' } }, 404);
    if (!['draft', 'needs_evidence'].includes(work.status)) return json({ error: { code: 'WORK_LOCKED' } }, 409);

    const admin = serviceClient();
    const parts = input.path.split('/');
    const fileName = parts.pop()!;
    const directory = parts.join('/');
    const { data: objects, error: listError } = await admin.storage.from('temporary-uploads').list(directory, { search: fileName, limit: 5 });
    if (listError) throw listError;
    const object = objects?.find((entry) => entry.name === fileName);
    if (!object) return json({ error: { code: 'UPLOAD_NOT_FOUND' } }, 404);

    const { data: existing } = await admin.from('work_media').select('sort_order').eq('work_id', work.id).order('sort_order', { ascending: false }).limit(1).maybeSingle();
    const sortOrder = (existing?.sort_order ?? -1) + 1;
    const { data: media, error: mediaError } = await admin.from('work_media').insert({
      work_id: work.id,
      media_type: input.mediaType,
      storage_path: input.path,
      width: input.width,
      height: input.height,
      duration_ms: input.durationMs,
      source_type: input.sourceType,
      sort_order: sortOrder,
    }).select().single();
    if (mediaError) throw mediaError;

    await admin.from('audit_logs').insert({
      actor_id: user.id,
      action: 'upload.finalized',
      entity_type: 'work_media',
      entity_id: media.id,
      metadata: { bucket: 'temporary-uploads', path: input.path, mimeType: input.mimeType, size: object.metadata?.size ?? null },
    });

    return json({ data: media }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'UNAUTHORIZED' ? 401 : 400;
    return json({ error: { code: status === 401 ? 'UNAUTHORIZED' : 'FINALIZE_UPLOAD_FAILED', message } }, status);
  }
});
