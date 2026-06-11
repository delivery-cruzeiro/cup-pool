import { z } from 'zod';

export const createCupPollGuessSchema = z.object({
	brScore: z.number().int().min(0).max(99),
	instagramHandle: z
		.string()
		.trim()
		.regex(/^@[A-Za-z0-9._-]{1,30}$/, 'instagramHandle must start with @'),
	mrScore: z.number().int().min(0).max(99),
});
