import { type FormEvent, useState } from 'react';
import { createCupPollGuessSchema } from '@delivery-cruzeiro/types';

type SubmitState =
	| { type: 'idle'; message: string }
	| { type: 'success'; message: string }
	| { type: 'error'; message: string };

const initialSubmitState: SubmitState = {
	message: '',
	type: 'idle',
};

const productionAPIURL = 'https://backend-api-yynv.onrender.com';
const defaultAPIURL = import.meta.env.PROD ? productionAPIURL : '';

function buildAPIURL(path: `/api/${string}`) {
	const configuredAPIURL = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
	const baseURL = (configuredAPIURL || defaultAPIURL).replace(/\/$/, '');

	if (!baseURL) {
		return path;
	}

	if (baseURL.endsWith('/api')) {
		return `${baseURL}${path.replace('/api', '')}`;
	}

	return `${baseURL}${path}`;
}

function parseScore(value: string) {
	return Number.parseInt(value || '0', 10);
}

function normalizeScoreInput(value: string) {
	return value.replace(/\D/g, '').slice(0, 2);
}

function normalizeInstagramHandle(value: string) {
	const trimmedValue = value.trim();

	if (!trimmedValue) {
		return '';
	}

	return trimmedValue.startsWith('@') ? trimmedValue : `@${trimmedValue}`;
}

export function CupPollApp() {
	const [instagramHandle, setInstagramHandle] = useState('');
	const [brScore, setBrScore] = useState('');
	const [mrScore, setMrScore] = useState('');
	const [submitState, setSubmitState] = useState<SubmitState>(initialSubmitState);
	const [isSubmitting, setIsSubmitting] = useState(false);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const payload = {
			brScore: parseScore(brScore),
			instagramHandle: normalizeInstagramHandle(instagramHandle).toLowerCase(),
			mrScore: parseScore(mrScore),
		};
		const parsedPayload = createCupPollGuessSchema.safeParse(payload);

		if (!parsedPayload.success) {
			setSubmitState({
				message: 'Informe um Instagram valido e os dois placares.',
				type: 'error',
			});
			return;
		}

		setIsSubmitting(true);
		setSubmitState(initialSubmitState);

		try {
			const response = await fetch(buildAPIURL('/api/cup-poll/guesses'), {
				body: JSON.stringify(parsedPayload.data),
				credentials: 'include',
				headers: {
					accept: 'application/json',
					'content-type': 'application/json',
					'x-requested-with': 'XMLHttpRequest',
				},
				method: 'POST',
			});
			const responsePayload = (await response.json().catch(() => null)) as {
				error?: string;
				message?: string;
			} | null;

			if (!response.ok) {
				setSubmitState({
					message: responsePayload?.error ?? 'Nao foi possivel enviar seu palpite.',
					type: 'error',
				});
				return;
			}

			setSubmitState({
				message: responsePayload?.message ?? 'Palpite enviado com sucesso.',
				type: 'success',
			});
			setInstagramHandle('');
			setBrScore('');
			setMrScore('');
		} catch {
			setSubmitState({
				message: 'Nao foi possivel conectar ao servidor.',
				type: 'error',
			});
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<main className="cup-poll-page">
			<section className="poll-card" aria-labelledby="poll-title">
				<div className="poll-card__header">
					<span className="poll-eyebrow">Palpite Certo</span>
					<h1 id="poll-title">Brasil x Marrocos</h1>
					<p>
						Informe seu palpite do jogo Brasil e Marrocos e concorra a um lanche gratuito
						do Pastel do Cruzeiro.
					</p>
				</div>

				<form className="poll-form" onSubmit={handleSubmit}>
					<label className="poll-field">
						<span>Instagram</span>
						<input
							autoComplete="off"
							inputMode="text"
							onChange={event => setInstagramHandle(event.target.value)}
							placeholder="@nome-teste"
							type="text"
							value={instagramHandle}
						/>
					</label>

					<div className="score-field" aria-label="Placar do jogo">
						<label className="score-input">
							<span aria-hidden="true">🇧🇷</span>
							<input
								aria-label="Gols do Brasil"
								inputMode="numeric"
								min="0"
								onChange={event => setBrScore(normalizeScoreInput(event.target.value))}
								pattern="[0-9]*"
								placeholder="0"
								type="text"
								value={brScore}
							/>
						</label>
						<strong className="score-separator">X</strong>
						<label className="score-input">
							<input
								aria-label="Gols do Marrocos"
								inputMode="numeric"
								min="0"
								onChange={event => setMrScore(normalizeScoreInput(event.target.value))}
								pattern="[0-9]*"
								placeholder="0"
								type="text"
								value={mrScore}
							/>
							<span aria-hidden="true">🇲🇦</span>
						</label>
					</div>

					<button className="submit-button" disabled={isSubmitting} type="submit">
						{isSubmitting ? 'Enviando...' : 'Enviar palpite'}
					</button>

					{submitState.message ? (
						<p className={`form-message form-message--${submitState.type}`} role="status">
							{submitState.message}
						</p>
					) : null}
				</form>
			</section>
		</main>
	);
}
