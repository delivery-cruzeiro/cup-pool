import { type FormEvent, useState } from 'react';
import { createCupPollGuessSchema } from './cup-poll.schema';

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
	const [htScore, setHtScore] = useState('');
	const [submitState, setSubmitState] = useState<SubmitState>(initialSubmitState);
	const [isSubmitting, setIsSubmitting] = useState(false);

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const payload = {
			brScore: parseScore(brScore),
			instagramHandle: normalizeInstagramHandle(instagramHandle).toLowerCase(),
			mrScore: parseScore(htScore),
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
			setHtScore('');
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
				<div className="poll-help" aria-label="Informações da promoção">
					<div className="poll-help__item">
						<span className="poll-help__label">Regras</span>
						<button className="poll-help__trigger" type="button" aria-label="Ver regras">
							?
						</button>
						<div className="poll-tooltip" role="tooltip">
							<strong>Regras:</strong>
							<span>1 - Seguir o @pasteldocruzeiro no instagram</span>
							<span>
								2 - O primeiro a palpitar o resultado corretamente irá ganhar o prêmio,
								em seguida será feito um sorteio com os demais palpites corretos para
								definir outro ganhador
							</span>
						</div>
					</div>

					<div className="poll-help__item">
						<span className="poll-help__label">Premiação</span>
						<button className="poll-help__trigger" type="button" aria-label="Ver premiação">
							?
						</button>
						<div className="poll-tooltip poll-tooltip--right" role="tooltip">
							<span>3 - pastéis do cruzeiro grande</span>
							<span>1 - pastel baby duas metades</span>
							<span>1 - Guaraná litro</span>
							<strong>
								Entre em contato com o instagram do pastel do cruzeiro para marcar o dia
								de reivindicar seu prêmio!
							</strong>
						</div>
					</div>
				</div>

				<div className="poll-card__header">
					<span className="poll-eyebrow">Palpite Certo</span>
					<h1 id="poll-title">Brasil x Haiti</h1>
					<p>
						Informe seu palpite do jogo Brasil e Haiti e concorra a um lanche gratuito
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
							<span aria-hidden="true">BR</span>
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
								aria-label="Gols do Haiti"
								inputMode="numeric"
								min="0"
								onChange={event => setHtScore(normalizeScoreInput(event.target.value))}
								pattern="[0-9]*"
								placeholder="0"
								type="text"
								value={htScore}
							/>
							<span aria-hidden="true">HT</span>
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
