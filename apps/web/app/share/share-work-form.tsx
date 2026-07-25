'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabaseClient } from '@human/database/browser';
import { SelectChevron } from '../../components/select-chevron';
import {
  ACCEPTED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  ORIGINAL_BUCKET,
  type UploadFieldErrors,
} from '../../lib/uploads/constants';
import type { ClientOriginalEvidence } from '../../lib/uploads/exif-evidence';
import { inspectClientOriginal } from '../../lib/uploads/inspect-client-original';

type CategoryOption = { value: string; label: string };

type SignedUpload = {
  bucket: string;
  workId: string;
  path: string;
  token: string;
  signedUrl?: string;
  expiresInSeconds: number;
};

type UploadResponse = {
  ok: boolean;
  workId?: string;
  redirectTo?: string;
  fieldErrors?: UploadFieldErrors;
  formError?: string;
  errorCode?: string;
  upload?: SignedUpload;
};

type UploadPhase = 'idle' | 'authorizing' | 'uploading' | 'finalizing';
type ScanPhase = 'idle' | 'scanning' | 'complete' | 'failed';

function statusCodeFromStorageError(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const candidate = error as { statusCode?: unknown; status?: unknown };
  const value = candidate.statusCode ?? candidate.status;
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value);
  return null;
}

function messageFromStorageError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return 'Unknown storage error.';
}

function friendlyStorageError(error: unknown): string {
  const status = statusCodeFromStorageError(error);
  const message = messageFromStorageError(error);
  const normalized = message.toLowerCase();

  if (status === 413 || normalized.includes('too large') || normalized.includes('maximum allowed size')) {
    return 'Image exceeds the 15 MB limit.';
  }
  if (status === 401 || normalized.includes('jwt') || normalized.includes('not authenticated')) {
    return 'Your session expired. Sign in again before uploading.';
  }
  if (
    status === 403
    || normalized.includes('row-level security')
    || normalized.includes('policy')
    || normalized.includes('permission')
    || normalized.includes('not authorized')
  ) {
    return 'Supabase Storage denied this upload. Refresh the page and try again.';
  }
  if (status === 409 || normalized.includes('already exists') || normalized.includes('duplicate')) {
    return 'That upload reservation was already used. Select the image and publish again.';
  }
  return `Supabase Storage could not accept the image: ${message}`;
}

async function readUploadResponse(response: Response): Promise<UploadResponse> {
  const responseText = await response.text();
  if (responseText) {
    try {
      return JSON.parse(responseText) as UploadResponse;
    } catch {
      // Vercel platform errors such as FUNCTION_PAYLOAD_TOO_LARGE are HTML or plain text.
    }
  }

  if (response.status === 413) {
    return {
      ok: false,
      errorCode: 'FILE_TOO_LARGE',
      fieldErrors: { file: 'Image exceeds the 15 MB limit.' },
    };
  }
  if (response.status === 401) {
    return {
      ok: false,
      errorCode: 'AUTH_REQUIRED',
      formError: 'Your session expired. Sign in again before uploading.',
    };
  }
  if (response.status === 403) {
    return {
      ok: false,
      errorCode: 'POLICY_DENIED',
      formError: 'Upload permission was denied for this account or storage path.',
    };
  }

  return {
    ok: false,
    formError: `The upload service returned HTTP ${response.status}. Try again.`,
  };
}

function phaseLabel(phase: UploadPhase, scanPhase: ScanPhase): string {
  if (scanPhase === 'scanning') return 'Reading original metadata…';
  if (phase === 'authorizing') return 'Preparing secure upload…';
  if (phase === 'uploading') return 'Uploading directly to storage…';
  if (phase === 'finalizing') return 'Recording origin evidence…';
  return 'Publish unverified work';
}

function metadataNotice(evidence: ClientOriginalEvidence | null, scanPhase: ScanPhase): string | null {
  if (scanPhase === 'scanning') {
    return 'Humn is hashing and reading metadata from the untouched browser file before anything is uploaded.';
  }
  if (scanPhase === 'failed') {
    return 'Humn could not inspect this file in the browser. The server will still inspect the stored original before publishing.';
  }
  if (!evidence?.exif) return null;
  if (evidence.exif.usableFieldCount > 0) {
    return `Original-file scan found ${evidence.exif.usableFieldCount} usable camera metadata field${evidence.exif.usableFieldCount === 1 ? '' : 's'}. Humn will verify they survive the direct upload.`;
  }
  return 'This selected copy already contains no usable camera EXIF before upload. On iPhone, choose the unmodified original from Files or export “Unmodified Original” to preserve camera metadata. Missing EXIF remains neutral.';
}

export function ShareWorkForm({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const fileInput = useRef<HTMLInputElement>(null);
  const selectionSequence = useRef(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(categories[0]?.value ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewRatio, setPreviewRatio] = useState('4 / 5');
  const [fieldErrors, setFieldErrors] = useState<UploadFieldErrors>({});
  const [formError, setFormError] = useState('');
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [scanPhase, setScanPhase] = useState<ScanPhase>('idle');
  const [clientOriginalEvidence, setClientOriginalEvidence] = useState<ClientOriginalEvidence | null>(null);
  const busy = phase !== 'idle' || scanPhase === 'scanning';

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function chooseFile(next: File | null) {
    const sequence = selectionSequence.current + 1;
    selectionSequence.current = sequence;
    setFieldErrors(current => {
      const { file: _fileError, ...remaining } = current;
      return remaining;
    });
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFile(null);
    setClientOriginalEvidence(null);
    setScanPhase('idle');

    if (!next) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(next.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
      setFieldErrors(current => ({ ...current, file: 'Choose a JPEG, PNG, or WebP image.' }));
      if (fileInput.current) fileInput.current.value = '';
      return;
    }
    if (next.size > MAX_UPLOAD_BYTES) {
      setFieldErrors(current => ({ ...current, file: 'Image exceeds the 15 MB limit.' }));
      if (fileInput.current) fileInput.current.value = '';
      return;
    }
    if (next.size <= 0) {
      setFieldErrors(current => ({ ...current, file: 'The selected file is empty.' }));
      if (fileInput.current) fileInput.current.value = '';
      return;
    }

    const url = URL.createObjectURL(next);
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) {
        setPreviewRatio(`${image.naturalWidth} / ${image.naturalHeight}`);
      }
    };
    image.src = url;
    setFile(next);
    setPreviewUrl(url);
    setScanPhase('scanning');

    try {
      const evidence = await inspectClientOriginal(next);
      if (selectionSequence.current !== sequence) return;
      setClientOriginalEvidence(evidence);
      setScanPhase(evidence.scanStatus === 'complete' ? 'complete' : 'failed');
    } catch (error) {
      if (selectionSequence.current !== sequence) return;
      setClientOriginalEvidence({
        scanStatus: 'failed',
        sha256: null,
        byteLength: next.size,
        mimeType: next.type,
        exif: null,
        errorClass: error instanceof Error ? error.name : 'UnknownExifScanError',
      });
      setScanPhase('failed');
    }
  }

  function applyFailure(result: UploadResponse, fallback: string) {
    if (result.redirectTo) {
      router.push(result.redirectTo);
      return;
    }
    setFieldErrors(result.fieldErrors ?? {});
    setFormError(result.formError ?? fallback);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setFieldErrors({});
    setFormError('');

    if (!file) {
      setFieldErrors({ file: 'Choose one image to upload.' });
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setFieldErrors({ file: 'Image exceeds the 15 MB limit.' });
      return;
    }
    if (!clientOriginalEvidence?.sha256) {
      setFormError('Humn could not hash the untouched original. Select the image again before publishing.');
      return;
    }

    try {
      setPhase('authorizing');
      const signResponse = await fetch('/api/works/upload/sign', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
        }),
      });
      const signResult = await readUploadResponse(signResponse);
      if (!signResponse.ok || !signResult.ok || !signResult.upload) {
        applyFailure(signResult, 'Secure upload permission could not be created.');
        return;
      }

      const upload = signResult.upload;
      if (upload.bucket !== ORIGINAL_BUCKET) {
        setFormError('The upload service returned an unexpected storage bucket.');
        return;
      }

      setPhase('uploading');
      const { error: storageError } = await supabase.storage
        .from(upload.bucket)
        .uploadToSignedUrl(upload.path, upload.token, file, {
          cacheControl: '31536000',
          contentType: file.type,
        });
      if (storageError) {
        const message = friendlyStorageError(storageError);
        if (message === 'Image exceeds the 15 MB limit.') {
          setFieldErrors({ file: message });
        } else {
          setFormError(message);
        }
        return;
      }

      setPhase('finalizing');
      const finalizeResponse = await fetch('/api/works/upload', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workId: upload.workId,
          storagePath: upload.path,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          title,
          description,
          category,
          clientOriginalEvidence,
        }),
      });
      const result = await readUploadResponse(finalizeResponse);

      if (!finalizeResponse.ok || !result.ok || !result.workId) {
        applyFailure(result, 'The image reached storage, but the Work could not be published.');
        return;
      }

      router.push(`/work/${result.workId}`);
      router.refresh();
    } catch (error) {
      if (error instanceof TypeError) {
        setFormError('A network failure interrupted the upload. Check your connection and try again.');
      } else {
        setFormError(error instanceof Error ? error.message : 'The upload failed for an unknown reason.');
      }
    } finally {
      setPhase('idle');
    }
  }

  const originalMetadataNotice = metadataNotice(clientOriginalEvidence, scanPhase);

  return (
    <form className="form" onSubmit={submit} noValidate>
      <label className="field">
        <span className="field-label">Image</span>
        <input
          ref={fileInput}
          type="file"
          name="file"
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          onChange={event => void chooseFile(event.target.files?.[0] ?? null)}
          aria-invalid={Boolean(fieldErrors.file)}
          aria-describedby="share-file-help share-file-error share-file-metadata"
          required
        />
        <span id="share-file-help" className="field-help">One JPEG, PNG, or WebP image · maximum 15 MB.</span>
        {originalMetadataNotice ? <span id="share-file-metadata" className="field-help">{originalMetadataNotice}</span> : null}
        {fieldErrors.file ? <span id="share-file-error" className="field-error">{fieldErrors.file}</span> : null}
      </label>

      <div className="share-preview" style={{ aspectRatio: previewRatio }} aria-label="Selected image preview">
        <span className="media-skeleton" aria-hidden="true" />
        {previewUrl ? <img src={previewUrl} alt="Preview of the selected Work" /> : <span className="meta share-preview-empty">Preview</span>}
      </div>

      <label className="field">
        <span className="field-label">Title</span>
        <input
          name="title"
          value={title}
          onChange={event => setTitle(event.target.value)}
          maxLength={160}
          aria-invalid={Boolean(fieldErrors.title)}
          required
        />
        {fieldErrors.title ? <span className="field-error">{fieldErrors.title}</span> : null}
      </label>

      <label className="field">
        <span className="field-label">Description</span>
        <textarea
          name="description"
          rows={6}
          value={description}
          onChange={event => setDescription(event.target.value)}
          maxLength={5000}
          aria-invalid={Boolean(fieldErrors.description)}
          required
        />
        <span className="field-help">Describe the specific work shown, not a general category or template.</span>
        {fieldErrors.description ? <span className="field-error">{fieldErrors.description}</span> : null}
      </label>

      <label className="field">
        <span className="field-label">Category</span>
        <span className="select-wrap">
          <select
            name="category"
            value={category}
            onChange={event => setCategory(event.target.value)}
            aria-invalid={Boolean(fieldErrors.category)}
            required
          >
            {categories.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <SelectChevron />
        </span>
        {fieldErrors.category ? <span className="field-error">{fieldErrors.category}</span> : null}
      </label>

      <p className="field-help">
        The original uploads directly to private Supabase Storage. Humn hashes and reads EXIF from the untouched browser file, verifies the same bytes after upload, and creates separate metadata-free display derivatives.
      </p>
      <button className="button primary" type="submit" disabled={busy}>
        {phaseLabel(phase, scanPhase)}
      </button>
      {formError ? <p className="notice" role="alert">{formError}</p> : null}
    </form>
  );
}
