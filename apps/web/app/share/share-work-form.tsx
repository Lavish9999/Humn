'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SelectChevron } from '../../components/select-chevron';
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES, type UploadFieldErrors } from '../../lib/uploads/constants';

type CategoryOption = { value: string; label: string };

type UploadResponse = {
  ok: boolean;
  workId?: string;
  redirectTo?: string;
  fieldErrors?: UploadFieldErrors;
  formError?: string;
};

export function ShareWorkForm({ categories }: { categories: CategoryOption[] }) {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(categories[0]?.value ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewRatio, setPreviewRatio] = useState('4 / 5');
  const [fieldErrors, setFieldErrors] = useState<UploadFieldErrors>({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function chooseFile(next: File | null) {
    setFieldErrors(current => {
      const { file: _fileError, ...remaining } = current;
      return remaining;
    });
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFile(null);

    if (!next) return;
    if (!ACCEPTED_IMAGE_TYPES.includes(next.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
      setFieldErrors(current => ({ ...current, file: 'Choose a JPEG, PNG, or WebP image.' }));
      if (fileInput.current) fileInput.current.value = '';
      return;
    }
    if (next.size > MAX_UPLOAD_BYTES) {
      setFieldErrors(current => ({ ...current, file: 'The image must be 15 MB or smaller.' }));
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
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFieldErrors({});
    setFormError('');

    const body = new FormData();
    if (file) body.set('file', file);
    body.set('title', title);
    body.set('description', description);
    body.set('category', category);

    try {
      const response = await fetch('/api/works/upload', { method: 'POST', body });
      const result = await response.json() as UploadResponse;

      if (result.redirectTo) {
        router.push(result.redirectTo);
        return;
      }
      if (!response.ok || !result.ok || !result.workId) {
        setFieldErrors(result.fieldErrors ?? {});
        setFormError(result.formError ?? 'The Work could not be uploaded.');
        return;
      }

      router.push(`/work/${result.workId}`);
      router.refresh();
    } catch {
      setFormError('The upload was interrupted. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit} noValidate>
      <label className="field">
        <span className="field-label">Image</span>
        <input
          ref={fileInput}
          type="file"
          name="file"
          accept={ACCEPTED_IMAGE_TYPES.join(',')}
          onChange={event => chooseFile(event.target.files?.[0] ?? null)}
          aria-invalid={Boolean(fieldErrors.file)}
          aria-describedby="share-file-help share-file-error"
          required
        />
        <span id="share-file-help" className="field-help">One JPEG, PNG, or WebP image · maximum 15 MB.</span>
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
        Bare uploads are published as UNVERIFIED · SELF-DECLARED and do not enter
        default Discover until process evidence or review is added.
      </p>
      <button className="button primary" type="submit" disabled={busy}>
        {busy ? 'Processing upload…' : 'Publish unverified work'}
      </button>
      {formError ? <p className="notice" role="alert">{formError}</p> : null}
    </form>
  );
}
