import { z } from 'zod';

export const usernameSchema = z.preprocess(
  (value) => (typeof value === 'string' ? value.trim().toLowerCase() : value),
  z
    .string()
    .min(3, 'Username must be at least 3 characters.')
    .max(30, 'Username must be 30 characters or fewer.')
    .regex(
      /^[a-z0-9_]+$/,
      'Username must use lowercase letters, numbers, and underscores.',
    ),
);

export const signUpSchema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z
    .string()
    .min(10, 'Password must be at least 10 characters.')
    .max(128, 'Password must be 128 characters or fewer.'),
  displayName: z
    .string()
    .trim()
    .min(2, 'Display name must be at least 2 characters.')
    .max(80, 'Display name must be 80 characters or fewer.'),
  username: usernameSchema,
});

export const signInSchema = z.object({
  email: z.email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.'),
});

export const createCollectionSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).optional(),
  privacy: z.enum(['private', 'invite_only', 'public']).default('private'),
});

export const originDeclarationSchema = z.object({
  ownership: z.enum(['self', 'another_human_authorized']),
  generativeAiUsed: z.boolean(),
  ordinaryEditingUsed: z.boolean(),
  aiAssistedEditingUsed: z.boolean(),
  photographedRealSubject: z.boolean().nullable(),
  rightsConfirmed: z.literal(true),
  policyVersion: z.string().min(1),
});

export const createWorkSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(5000).optional(),
  primaryCategoryId: z.uuid(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
  origin: originDeclarationSchema,
});

export const reportSchema = z.object({
  workId: z.uuid(),
  reason: z.enum([
    'suspected_ai', 'undisclosed_ai', 'stolen_work', 'misleading_claim', 'copyright',
    'harassment', 'hate', 'sexual_content', 'violence', 'dangerous_activity',
    'spam', 'scam', 'impersonation', 'self_harm', 'other',
  ]),
  details: z.string().trim().min(10).max(4000),
  evidenceUrl: z.url().optional(),
});

export type SignUpInput = z.infer<typeof signUpSchema>;
export type CreateWorkInput = z.infer<typeof createWorkSchema>;
