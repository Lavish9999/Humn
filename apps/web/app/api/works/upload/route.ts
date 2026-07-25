import { POST as finalizeUpload } from './finalize/route';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const POST = finalizeUpload;
