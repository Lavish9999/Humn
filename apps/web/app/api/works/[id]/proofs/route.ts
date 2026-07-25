import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getServerSupabase } from '../../../../../lib/supabase/server';
import { processUploadedImage } from '../../../../../lib/uploads/process-image';

export const runtime = 'nodejs';
export const maxDuration = 60;

function text(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: workId } = await params;
  const supabase = await getServerSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ redirectTo: '/signin' }, { status: 401 });

  const { data: work } = await supabase.from('works').select('id, creator_id, ai_declared').eq('id', workId).maybeSingle();
  if (!work || work.creator_id !== auth.user.id) return NextResponse.json({ error: 'Work not found.' }, { status: 404 });

  const form = await request.formData();
  const title = text(form, 'title');
  const body = text(form, 'body');
  const capturedAt = text(form, 'captured_at');
  const requestVerification = text(form, 'request_verification') === 'true';
  const file = form.get('file');

  if (!title || title.length > 120) return NextResponse.json({ fieldErrors: { title: 'Enter a title of 120 characters or fewer.' } }, { status: 400 });
  if (!body || body.length > 1000) return NextResponse.json({ fieldErrors: { body: 'Describe this stage in 1,000 characters or fewer.' } }, { status: 400 });
  const captured = capturedAt ? new Date(capturedAt) : new Date();
  if (Number.isNaN(captured.getTime())) return NextResponse.json({ fieldErrors: { captured_at: 'Enter a valid date and time.' } }, { status: 400 });

  const { data: last } = await supabase.from('proof_entries').select('seq').eq('work_id', workId).order('seq', { ascending: false }).limit(1).maybeSingle();
  const proofId = randomUUID();
  let thumbUrl: string | null = null;
  let uploadedPath: string | null = null;

  if (file instanceof File && file.size > 0) {
    try {
      const processed = await processUploadedImage(file);
      uploadedPath = `${auth.user.id}/${workId}/${proofId}/stage.webp`;
      const upload = await supabase.storage.from('proof-display').upload(uploadedPath, processed.display, {
        contentType: 'image/webp', cacheControl: '31536000', upsert: false,
      });
      if (upload.error) throw new Error(upload.error.message);
      thumbUrl = supabase.storage.from('proof-display').getPublicUrl(uploadedPath).data.publicUrl;
    } catch (error) {
      return NextResponse.json({ fieldErrors: { file: error instanceof Error ? error.message : 'Stage image could not be processed.' } }, { status: 400 });
    }
  }

  const insert = await supabase.from('proof_entries').insert({
    id: proofId,
    work_id: workId,
    seq: (last?.seq ?? 0) + 1,
    captured_at: captured.toISOString(),
    title,
    body,
    thumb_url: thumbUrl,
  });
  if (insert.error) {
    if (uploadedPath) await supabase.storage.from('proof-display').remove([uploadedPath]);
    return NextResponse.json({ error: insert.error.message }, { status: 400 });
  }

  if (requestVerification) {
    const review = await supabase.rpc('request_work_verification', { p_work_id: workId });
    if (review.error) return NextResponse.json({ error: review.error.message, proofAdded: true }, { status: 400 });
  }

  return NextResponse.json({ ok: true, proofId, verificationRequested: requestVerification });
}
