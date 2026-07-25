import 'server-only';

const AI_SOURCE_TYPES = new Set([
  'trainedAlgorithmicMedia',
  'compositeWithTrainedAlgorithmicMedia',
  'compositeSynthetic',
]);

const CAMERA_SOURCE_TYPES = new Set([
  'digitalCapture',
  'computationalCapture',
  'compositeCapture',
]);

type C2paReader = {
  json(): unknown;
  getActive(): unknown;
  isEmbedded(): boolean;
  free?: () => void;
};

type C2paReaderApi = {
  fromAsset(input: { buffer: Buffer; mimeType: string }): Promise<C2paReader | null>;
};

export type C2paSummary = {
  state: 'none' | 'present' | 'parse_error' | 'unavailable';
  issuer: string | null;
  cameraCapture: boolean;
  aiGenerated: boolean;
  digitalSourceTypes: string[];
  validationStatus: string[];
  embedded: boolean;
};

function collectStrings(value: unknown, output: string[], keyHint = ''): void {
  if (typeof value === 'string') {
    if (
      keyHint.toLowerCase().includes('digitalsourcetype')
      || value.toLowerCase().includes('digitalsourcetype')
    ) output.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, output, keyHint);
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    collectStrings(nested, output, key);
  }
}

function sourceTypeName(value: string): string {
  const withoutQuery = value.split(/[?#]/, 1)[0] ?? value;
  const parts = withoutQuery.split('/');
  return parts.at(-1) ?? value;
}

function firstStringByKey(value: unknown, keys: Set<string>): string | null {
  if (!value || typeof value !== 'object') return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = firstStringByKey(item, keys);
      if (found) return found;
    }
    return null;
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (keys.has(key.toLowerCase()) && typeof nested === 'string' && nested.trim()) {
      return nested.trim();
    }
    const found = firstStringByKey(nested, keys);
    if (found) return found;
  }
  return null;
}

function collectValidationStatus(value: unknown): string[] {
  const output: string[] = [];
  const visit = (node: unknown, key = '') => {
    if (typeof node === 'string') {
      if (key.includes('validation') || key.includes('status')) output.push(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) visit(item, key);
      return;
    }
    if (!node || typeof node !== 'object') return;
    for (const [nestedKey, nested] of Object.entries(node as Record<string, unknown>)) {
      visit(nested, nestedKey.toLowerCase());
    }
  };
  visit(value);
  return [...new Set(output)].slice(0, 20);
}

function looksLikeNoManifest(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes('no c2pa')
    || message.includes('manifest not found')
    || message.includes('no manifest')
    || message.includes('jumbf not found')
    || message.includes('not a c2pa');
}

export async function readC2paSummary(buffer: Buffer, mimeType: string): Promise<C2paSummary> {
  let Reader: C2paReaderApi;

  try {
    const module = await import('@contentauth/c2pa-node');
    Reader = module.Reader as unknown as C2paReaderApi;
  } catch {
    return {
      state: 'unavailable',
      issuer: null,
      cameraCapture: false,
      aiGenerated: false,
      digitalSourceTypes: [],
      validationStatus: [],
      embedded: false,
    };
  }

  try {
    const reader = await Reader.fromAsset({ buffer, mimeType });
    if (!reader) {
      return {
        state: 'none', issuer: null, cameraCapture: false, aiGenerated: false,
        digitalSourceTypes: [], validationStatus: [], embedded: false,
      };
    }

    try {
      const store = reader.json();
      const active = reader.getActive();
      if (!active) {
        return {
          state: 'none', issuer: null, cameraCapture: false, aiGenerated: false,
          digitalSourceTypes: [], validationStatus: [], embedded: false,
        };
      }

      const rawTypes: string[] = [];
      collectStrings(active ?? store, rawTypes);
      const digitalSourceTypes = [...new Set(rawTypes.map(sourceTypeName))];
      const aiGenerated = digitalSourceTypes.some(type => AI_SOURCE_TYPES.has(type));
      const cameraCapture = digitalSourceTypes.some(type => CAMERA_SOURCE_TYPES.has(type));
      const issuer = firstStringByKey(active ?? store, new Set([
        'issuer', 'claim_generator', 'claimgenerator', 'claim_generator_info', 'signer',
      ]));

      return {
        state: 'present',
        issuer,
        cameraCapture,
        aiGenerated,
        digitalSourceTypes,
        validationStatus: collectValidationStatus(store),
        embedded: reader.isEmbedded(),
      };
    } finally {
      reader.free?.();
    }
  } catch (error) {
    if (looksLikeNoManifest(error)) {
      return {
        state: 'none', issuer: null, cameraCapture: false, aiGenerated: false,
        digitalSourceTypes: [], validationStatus: [], embedded: false,
      };
    }
    return {
      state: 'parse_error',
      issuer: null,
      cameraCapture: false,
      aiGenerated: false,
      digitalSourceTypes: [],
      validationStatus: [],
      embedded: false,
    };
  }
}
