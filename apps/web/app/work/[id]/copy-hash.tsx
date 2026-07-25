'use client';

import { useState } from 'react';

function truncateHash(value: string) {
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}…${value.slice(-8)}`;
}

export function CopyHash({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <span className="copy-hash-wrap">
      <button className="copy-hash" type="button" onClick={copy} aria-label="Copy original file hash">
        <span>{truncateHash(value)}</span>
        <span className="copy-hash-action">COPY</span>
      </button>
      <span className="copy-hash-confirmation" aria-live="polite">{copied ? 'HASH COPIED' : ''}</span>
    </span>
  );
}
