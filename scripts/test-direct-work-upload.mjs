import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import sharp from 'sharp';

const baseUrl = process.env.TEST_BASE_URL ?? 'http://127.0.0.1:3000';
const supabaseUrl = requiredEnv('NEXT_PUBLIC_SUPABASE_URL');
const anonKey = requiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const serviceRoleKey = requiredEnv('SUPABASE_SERVICE_ROLE_KEY');
const maxUploadBytes = 15 * 1024 * 1024;
const targetSizes = [1, 5, 12].map(megabytes => megabytes * 1024 * 1024);
const password = `Humn-QA-${randomUUID()}!`;
const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const signedUploadClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const createdUserIds = [];
const createdWorkIds = [];
const originalPaths = [];
const displayPaths = [];

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function cookieHeader(cookieJar) {
  return [...cookieJar.entries()]
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

async function createConfirmedUser(label) {
  const email = `humn-upload-${label}-${suffix}@example.com`;
  const handle = `upload_${label}_${suffix.replaceAll('-', '').slice(-14)}`.toLowerCase();
  const displayName = `Upload QA ${label.toUpperCase()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      handle,
      username: handle,
      display_name: displayName,
      signup_source: 'upload-integration-test',
      requires_handle_choice: false,
      handle_adjusted: false,
    },
  });
  if (error || !data.user) throw new Error(`Could not create ${label} user: ${error?.message ?? 'missing user'}`);
  createdUserIds.push(data.user.id);

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const { data: profile } = await admin.from('users').select('id, handle').eq('id', data.user.id).maybeSingle();
    if (profile) break;
    await new Promise(resolve => setTimeout(resolve, 100));
    if (attempt === 29) throw new Error(`Profile trigger did not create a row for ${label}.`);
  }

  const cookies = new Map();
  const authClient = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => [...cookies.entries()].map(([name, value]) => ({ name, value })),
      setAll: items => {
        for (const item of items) cookies.set(item.name, item.value);
      },
    },
  });
  const signIn = await authClient.auth.signInWithPassword({ email, password });
  if (signIn.error || !signIn.data.session) {
    throw new Error(`Could not sign in ${label}: ${signIn.error?.message ?? 'missing session'}`);
  }

  const directClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const directSignIn = await directClient.auth.signInWithPassword({ email, password });
  if (directSignIn.error) throw new Error(`Could not create direct Storage session for ${label}: ${directSignIn.error.message}`);

  return {
    id: data.user.id,
    email,
    handle,
    cookies,
    directClient,
  };
}

async function requestJson(path, { cookies, method = 'POST', body }) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      cookie: cookieHeader(cookies),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let payload = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
  }
  return { response, payload };
}

async function createExifJpeg(targetSize, index) {
  const base = await sharp({
    create: {
      width: 1800,
      height: 1200,
      channels: 3,
      background: {
        r: 40 + index * 25,
        g: 90 + index * 15,
        b: 130 + index * 10,
      },
    },
  })
    .jpeg({ quality: 90, chromaSubsampling: '4:4:4' })
    .withExif({
      IFD0: {
        Make: 'Humn QA Camera',
        Model: 'Direct Upload Test',
      },
      IFD2: {
        DateTimeOriginal: '2026:07:25 15:00:00',
        LensModel: 'QA 35mm',
        ISOSpeedRatings: '100',
        ExposureTime: '1/125',
      },
    })
    .toBuffer();

  assert.ok(base.length < targetSize, `Base JPEG unexpectedly exceeds ${targetSize} bytes.`);
  return Buffer.concat([base, randomBytes(targetSize - base.length)]);
}

async function issueSignedUpload(user, fileName, fileSize) {
  const { response, payload } = await requestJson('/api/works/upload/sign', {
    cookies: user.cookies,
    body: { fileName, fileSize, mimeType: 'image/jpeg' },
  });
  assert.equal(response.status, 200, `Signing failed (${response.status}): ${JSON.stringify(payload)}`);
  assert.equal(payload.ok, true);
  assert.equal(payload.upload.bucket, 'work-originals');
  assert.ok(payload.upload.path.startsWith(`${user.id}/`), 'Signed path is not scoped to the authenticated user.');
  assert.ok(payload.upload.path.endsWith('/original.jpg'));
  return payload.upload;
}

async function uploadAndFinalize(user, fileBuffer, label) {
  const fileName = `${label}.jpg`;
  const upload = await issueSignedUpload(user, fileName, fileBuffer.length);
  const file = new Blob([fileBuffer], { type: 'image/jpeg' });
  const storage = await signedUploadClient.storage
    .from(upload.bucket)
    .uploadToSignedUrl(upload.path, upload.token, file, {
      contentType: 'image/jpeg',
      cacheControl: '31536000',
    });
  assert.equal(storage.error, null, `Signed Storage upload failed: ${storage.error?.message}`);

  originalPaths.push(upload.path);
  const finalize = await requestJson('/api/works/upload', {
    cookies: user.cookies,
    body: {
      workId: upload.workId,
      storagePath: upload.path,
      fileName,
      fileSize: fileBuffer.length,
      mimeType: 'image/jpeg',
      title: `Direct upload ${label}`,
      description: `A disposable integration-test image for the ${label} direct-upload path.`,
      category: 'photography',
    },
  });
  assert.equal(finalize.response.status, 201, `Finalization failed (${finalize.response.status}): ${JSON.stringify(finalize.payload)}`);
  assert.equal(finalize.payload.ok, true);
  assert.equal(finalize.payload.workId, upload.workId);
  createdWorkIds.push(upload.workId);
  displayPaths.push(`${user.id}/${upload.workId}/display.webp`, `${user.id}/${upload.workId}/thumbnail.webp`);

  const detailResult = await admin.rpc('get_work_detail', { p_work_id: upload.workId });
  if (detailResult.error) throw new Error(`Work detail RPC failed: ${detailResult.error.message}`);
  const detail = detailResult.data;
  assert.equal(detail.creator_id, user.id);
  assert.equal(detail.origin_input, 'uploaded');
  assert.notEqual(detail.status, 'verified', 'A new direct upload must not become verified automatically.');
  assert.match(detail.badge.badge_label, /UNVERIFIED|SELF-DECLARED/i);
  assert.match(detail.file_evidence.original_hash, /^[a-f0-9]{64}$/);
  assert.match(detail.file_evidence.capture_device, /Humn QA Camera|Direct Upload Test/i);
  assert.equal(detail.file_evidence.file_format, 'JPEG');
  assert.ok(Array.isArray(detail.provenance_signals) && detail.provenance_signals.length > 0);

  const storedOriginal = await admin.storage.from('work-originals').download(upload.path);
  if (storedOriginal.error || !storedOriginal.data) {
    throw new Error(`Stored original could not be read: ${storedOriginal.error?.message ?? 'missing blob'}`);
  }
  assert.equal(storedOriginal.data.size, fileBuffer.length);

  return upload;
}

async function cleanup() {
  if (createdWorkIds.length) {
    await admin.from('works').delete().in('id', createdWorkIds);
  }
  if (originalPaths.length) await admin.storage.from('work-originals').remove(originalPaths);
  if (displayPaths.length) await admin.storage.from('work-display').remove(displayPaths);
  for (const userId of createdUserIds.reverse()) {
    await admin.auth.admin.deleteUser(userId);
  }
}

try {
  const userA = await createConfirmedUser('a');
  const userB = await createConfirmedUser('b');

  const oversize = await requestJson('/api/works/upload/sign', {
    cookies: userA.cookies,
    body: {
      fileName: 'oversize.jpg',
      fileSize: maxUploadBytes + 1,
      mimeType: 'image/jpeg',
    },
  });
  assert.equal(oversize.response.status, 413);
  assert.equal(oversize.payload.errorCode, 'FILE_TOO_LARGE');
  assert.equal(oversize.payload.fieldErrors.file, 'Image exceeds the 15 MB limit.');

  const results = [];
  for (let index = 0; index < targetSizes.length; index += 1) {
    const megabytes = [1, 5, 12][index];
    const buffer = await createExifJpeg(targetSizes[index], index);
    const upload = await uploadAndFinalize(userA, buffer, `${megabytes}mb`);
    results.push({ megabytes, workId: upload.workId, path: upload.path });
  }

  const reservedByA = await issueSignedUpload(userA, 'authorization-check.jpg', 1024);
  const bFinalizeAttempt = await requestJson('/api/works/upload', {
    cookies: userB.cookies,
    body: {
      workId: reservedByA.workId,
      storagePath: reservedByA.path,
      fileName: 'authorization-check.jpg',
      fileSize: 1024,
      mimeType: 'image/jpeg',
      title: 'Unauthorized path attempt',
      description: 'This request must be denied before Storage is read.',
      category: 'photography',
    },
  });
  assert.equal(bFinalizeAttempt.response.status, 403);
  assert.equal(bFinalizeAttempt.payload.errorCode, 'STORAGE_PATH_DENIED');

  const normalCrossFolderWrite = await userB.directClient.storage
    .from('work-originals')
    .upload(reservedByA.path, new Blob([randomBytes(1024)], { type: 'image/jpeg' }), {
      contentType: 'image/jpeg',
      upsert: false,
    });
  assert.ok(normalCrossFolderWrite.error, 'A second account unexpectedly wrote into another creator folder.');

  const bReservation = await issueSignedUpload(userB, 'owner-check.jpg', 1024);
  assert.ok(bReservation.path.startsWith(`${userB.id}/`));
  assert.ok(!bReservation.path.startsWith(`${userA.id}/`));

  console.log(JSON.stringify({
    ok: true,
    uploads: results,
    originMetadata: 'EXIF camera and SHA-256 evidence retained',
    verificationStatus: 'new uploads remained unverified/self-declared',
    crossAccount: 'signed path generation and direct/finalize cross-folder writes denied',
  }, null, 2));
} finally {
  await cleanup();
}
