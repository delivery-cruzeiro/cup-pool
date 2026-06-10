import { describe, expect, it } from 'vitest';
import { createCupPollGuessSchema } from '@delivery-cruzeiro/types';

describe('createCupPollGuessSchema', () => {
	it('accepts a valid cup poll guess', () => {
		const result = createCupPollGuessSchema.safeParse({
			brScore: 2,
			instagramHandle: '@nome-teste',
			mrScore: 1,
		});

		expect(result.success).toBe(true);
	});

	it('rejects handles without @', () => {
		const result = createCupPollGuessSchema.safeParse({
			brScore: 2,
			instagramHandle: 'nome-teste',
			mrScore: 1,
		});

		expect(result.success).toBe(false);
	});
});
