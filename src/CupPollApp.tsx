import { type FormEvent, useEffect, useRef, useState } from 'react';
import { createCupPollGuessSchema } from './cup-poll.schema';

type SubmitState =
	| { type: 'idle'; message: string }
	| { type: 'success'; message: string }
	| { type: 'error'; message: string };

type QueryState =
	| { type: 'idle'; message: string }
	| { type: 'success'; message: string }
	| { type: 'error'; message: string };

type PollTab = 'guess' | 'query' | 'results';

type CupPollGuess = {
	instagramHandle: string;
	score: string;
};

type CupPollResult = {
	match: string;
	result: string;
	'first-winner': string | null;
	'second-winner': string | null;
	participants: string[];
};

type RawCupPollResult = {
	firstWinner?: unknown;
	match?: unknown;
	participants?: unknown;
	result?: unknown;
	secondWinner?: unknown;
	'first-winner'?: unknown;
	'second-winner'?: unknown;
};

type ReplayState = {
	highlightedIndex: number;
	isRunning: boolean;
	match: string | null;
};

const initialSubmitState: SubmitState = {
	message: '',
	type: 'idle',
};

const initialQueryState: QueryState = {
	message: '',
	type: 'idle',
};

const productionAPIURL = 'https://backend-api-yynv.onrender.com';
const defaultAPIURL = import.meta.env.PROD ? productionAPIURL : '';
const pollClosesAt = new Date('2026-06-29T14:00:00-03:00').getTime();
const localGuessesStorageKey = 'cup-poll-guesses';

function hasPollClosed() {
	return Date.now() >= pollClosesAt;
}

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

function isValidInstagramHandle(value: string) {
	return /^@[A-Za-z0-9._-]{1,30}$/.test(value);
}

function normalizeNullableText(value: unknown) {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizeCupPollResults(value: unknown) {
	if (!Array.isArray(value)) {
		return null;
	}

	return value.reduce<CupPollResult[]>((results, item) => {
		if (!item || typeof item !== 'object') {
			return results;
		}

		const rawResult = item as RawCupPollResult;
		const match = typeof rawResult.match === 'string' ? rawResult.match.trim() : '';
		const result = typeof rawResult.result === 'string' ? rawResult.result.trim() : '';

		if (!match || !result) {
			return results;
		}

		results.push({
			'first-winner': normalizeNullableText(
				rawResult['first-winner'] ?? rawResult.firstWinner,
			),
			match,
			participants: Array.isArray(rawResult.participants)
				? rawResult.participants.filter(
						participant => typeof participant === 'string' && participant.trim(),
					)
				: [],
			result,
			'second-winner': normalizeNullableText(
				rawResult['second-winner'] ?? rawResult.secondWinner,
			),
		});

		return results;
	}, []);
}

function getStoredGuesses() {
	try {
		const storedValue = window.localStorage.getItem(localGuessesStorageKey);
		const parsedValue = storedValue ? JSON.parse(storedValue) : {};

		return parsedValue && typeof parsedValue === 'object'
			? (parsedValue as Record<string, CupPollGuess>)
			: {};
	} catch {
		return {};
	}
}

function getStoredGuess(instagramHandle: string) {
	return getStoredGuesses()[instagramHandle] ?? null;
}

function storeGuess(guess: CupPollGuess) {
	try {
		window.localStorage.setItem(
			localGuessesStorageKey,
			JSON.stringify({
				...getStoredGuesses(),
				[guess.instagramHandle]: guess,
			}),
		);
	} catch {
		// Local storage is only a convenience for consultation fallback.
	}
}

export function CupPollApp() {
	const [activeTab, setActiveTab] = useState<PollTab>('guess');
	const [instagramHandle, setInstagramHandle] = useState('');
	const [brScore, setBrScore] = useState('');
	const [jpScore, setJpScore] = useState('');
	const [submitState, setSubmitState] = useState<SubmitState>(initialSubmitState);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [queryInstagramHandle, setQueryInstagramHandle] = useState('');
	const [queryState, setQueryState] = useState<QueryState>(initialQueryState);
	const [queriedGuess, setQueriedGuess] = useState<CupPollGuess | null>(null);
	const [isQuerying, setIsQuerying] = useState(false);
	const [isPollClosed, setIsPollClosed] = useState(() => hasPollClosed());
	const [pollResults, setPollResults] = useState<CupPollResult[]>([]);
	const [resultsError, setResultsError] = useState('');
	const [isLoadingResults, setIsLoadingResults] = useState(false);
	const [hasLoadedResults, setHasLoadedResults] = useState(false);
	const [expandedMatch, setExpandedMatch] = useState<string | null>(null);
	const [replayState, setReplayState] = useState<ReplayState>({
		highlightedIndex: 0,
		isRunning: false,
		match: null,
	});
	const replayTimerRef = useRef<number | null>(null);

	useEffect(() => {
		if (isPollClosed) {
			return;
		}

		const timeout = window.setTimeout(
			() => setIsPollClosed(true),
			Math.max(pollClosesAt - Date.now(), 0),
		);

		return () => window.clearTimeout(timeout);
	}, [isPollClosed]);

	useEffect(() => {
		if (activeTab !== 'results' || hasLoadedResults) {
			return;
		}

		const abortController = new AbortController();

		async function loadResults() {
			setIsLoadingResults(true);
			setResultsError('');

			try {
				const response = await fetch(buildAPIURL('/api/cup-poll/results'), {
					credentials: 'include',
					headers: {
						accept: 'application/json',
						'x-requested-with': 'XMLHttpRequest',
					},
					method: 'GET',
					signal: abortController.signal,
				});
				const responsePayload = (await response.json().catch(() => null)) as
					| { error?: string }
					| unknown;

				if (abortController.signal.aborted) {
					return;
				}

				const parsedResults = normalizeCupPollResults(responsePayload);

				if (!response.ok || !parsedResults) {
					setResultsError(
						parsedResults
							? 'Nao foi possivel carregar os resultados.'
							: (responsePayload as { error?: string } | null)?.error ??
									'Nao foi possivel carregar os resultados.',
					);
					setHasLoadedResults(true);
					return;
				}

				setPollResults(parsedResults);
				setHasLoadedResults(true);
			} catch {
				if (!abortController.signal.aborted) {
					setResultsError('Nao foi possivel conectar ao servidor.');
					setHasLoadedResults(true);
				}
			} finally {
				if (!abortController.signal.aborted) {
					setIsLoadingResults(false);
				}
			}
		}

		void loadResults();

		return () => {
			abortController.abort();
		};
	}, [activeTab, hasLoadedResults]);

	useEffect(() => {
		return () => {
			if (replayTimerRef.current !== null) {
				window.clearTimeout(replayTimerRef.current);
			}
		};
	}, []);

	function getMatchName(match: string) {
		const teamNames: Record<string, string> = {
			br: 'Brasil',
			jp: 'Japao',
			mr: 'Marrocos',
		};
		const [homeTeam, awayTeam] = match.split('-');

		return `${teamNames[homeTeam] ?? homeTeam.toUpperCase()} x ${
			teamNames[awayTeam] ?? awayTeam.toUpperCase()
		}`;
	}

	function handleExpandResult(match: string) {
		setExpandedMatch(currentMatch => (currentMatch === match ? null : match));
		setReplayState({
			highlightedIndex: 0,
			isRunning: false,
			match,
		});
		if (replayTimerRef.current !== null) {
			window.clearTimeout(replayTimerRef.current);
		}
	}

	function handleReplay(result: CupPollResult) {
		if (replayTimerRef.current !== null) {
			window.clearTimeout(replayTimerRef.current);
		}

		if (!result['second-winner'] || result.participants.length === 0) {
			setReplayState({
				highlightedIndex: 0,
				isRunning: false,
				match: result.match,
			});
			return;
		}

		const sortedWinnerIndex = result.participants.findIndex(
			participant => participant === result['second-winner'],
		);
		const targetIndex = sortedWinnerIndex >= 0 ? sortedWinnerIndex : 0;
		const totalSteps = result.participants.length + targetIndex;
		let currentStep = 0;

		setReplayState({
			highlightedIndex: 0,
			isRunning: totalSteps > 0,
			match: result.match,
		});

		if (totalSteps === 0) {
			return;
		}

		function tick() {
			currentStep += 1;
			const highlightedIndex = currentStep % result.participants.length;

			setReplayState({
				highlightedIndex,
				isRunning: currentStep < totalSteps,
				match: result.match,
			});

			if (currentStep < totalSteps) {
				replayTimerRef.current = window.setTimeout(tick, 180);
			}
		}

		replayTimerRef.current = window.setTimeout(tick, 320);
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		if (hasPollClosed()) {
			setIsPollClosed(true);
			return;
		}

		const payload = {
			brScore: parseScore(brScore),
			instagramHandle: normalizeInstagramHandle(instagramHandle).toLowerCase(),
			jpScore: parseScore(jpScore),
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
				guess?: CupPollGuess;
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
			if (responsePayload?.guess) {
				storeGuess(responsePayload.guess);
			}
			setInstagramHandle('');
			setBrScore('');
			setJpScore('');
		} catch {
			setSubmitState({
				message: 'Nao foi possivel conectar ao servidor.',
				type: 'error',
			});
		} finally {
			setIsSubmitting(false);
		}
	}

	async function handleQuerySubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		const normalizedHandle = normalizeInstagramHandle(queryInstagramHandle).toLowerCase();

		if (!isValidInstagramHandle(normalizedHandle)) {
			setQueriedGuess(null);
			setQueryState({
				message: 'Informe um Instagram valido.',
				type: 'error',
			});
			return;
		}

		setIsQuerying(true);
		setQueriedGuess(null);
		setQueryState(initialQueryState);

		try {
			const response = await fetch(
				`${buildAPIURL('/api/cup-poll/guesses')}?instagramHandle=${encodeURIComponent(
					normalizedHandle,
				)}`,
				{
					credentials: 'include',
					headers: {
						accept: 'application/json',
						'x-requested-with': 'XMLHttpRequest',
					},
					method: 'GET',
				},
			);
			const responsePayload = (await response.json().catch(() => null)) as {
				error?: string;
				guess?: CupPollGuess | null;
				message?: string;
			} | null;

			if (!response.ok || !responsePayload?.guess) {
				const storedGuess = getStoredGuess(normalizedHandle);

				if (storedGuess) {
					setQueriedGuess(storedGuess);
					setQueryState({
						message: 'Palpite encontrado.',
						type: 'success',
					});
					return;
				}

				setQueryState({
					message:
						responsePayload?.error ??
						responsePayload?.message ??
						'Nenhum palpite encontrado para esse Instagram.',
					type: 'error',
				});
				return;
			}

			setQueriedGuess(responsePayload.guess);
			setQueryState({
				message: responsePayload.message ?? 'Palpite encontrado.',
				type: 'success',
			});
		} catch {
			const storedGuess = getStoredGuess(normalizedHandle);

			if (storedGuess) {
				setQueriedGuess(storedGuess);
				setQueryState({
					message: 'Palpite encontrado.',
					type: 'success',
				});
				return;
			}

			setQueryState({
				message: 'Nao foi possivel consultar seu palpite agora.',
				type: 'error',
			});
		} finally {
			setIsQuerying(false);
		}
	}

	return (
		<main className="cup-poll-page">
			<div className="poll-shell">
				<div className="poll-tabs" role="tablist" aria-label="Opcoes do palpite">
					<button
						aria-controls="poll-guess-panel"
						aria-selected={activeTab === 'guess'}
						className="poll-tab"
						id="poll-guess-tab"
						onClick={() => setActiveTab('guess')}
						role="tab"
						type="button"
					>
						Palpitar
					</button>
					<button
						aria-controls="poll-query-panel"
						aria-selected={activeTab === 'query'}
						className="poll-tab"
						id="poll-query-tab"
						onClick={() => setActiveTab('query')}
						role="tab"
						type="button"
					>
						Consulta de palpites
					</button>
					<button
						aria-controls="poll-results-panel"
						aria-selected={activeTab === 'results'}
						className="poll-tab"
						id="poll-results-tab"
						onClick={() => setActiveTab('results')}
						role="tab"
						type="button"
					>
						Resultados dos boloes
					</button>
				</div>

				<section
					className={`poll-card${
						isPollClosed && activeTab === 'guess' ? ' poll-card--closed' : ''
					}`}
					aria-labelledby="poll-title"
				>
					{isPollClosed || activeTab !== 'guess' ? null : (
						<div className="poll-help" aria-label="Informacoes da promocao">
							<div className="poll-help__item">
								<span className="poll-help__label">Regras</span>
								<button className="poll-help__trigger" type="button" aria-label="Ver regras">
									?
								</button>
								<div className="poll-tooltip" role="tooltip">
									<strong>Regras:</strong>
									<span>1 - Seguir o @pasteldocruzeiro no instagram</span>
									<span>
										2 - O primeiro a palpitar o resultado corretamente ira ganhar o premio,
										em seguida sera feito um sorteio com os demais palpites corretos para
										definir outro ganhador
									</span>
								</div>
							</div>

							<div className="poll-help__item">
								<span className="poll-help__label">Premiacao</span>
								<button className="poll-help__trigger" type="button" aria-label="Ver premiacao">
									?
								</button>
								<div className="poll-tooltip poll-tooltip--right" role="tooltip">
									<span>3 - pasteis do cruzeiro grande</span>
									<span>1 - pastel baby duas metades</span>
									<span>1 - Guarana litro</span>
									<strong>
										Entre em contato com o instagram do pastel do cruzeiro para marcar o dia
										de reivindicar seu premio!
									</strong>
								</div>
							</div>
						</div>
					)}

					<div className="poll-card__header">
						<span className="poll-eyebrow">Palpite Certo</span>
						<h1 id="poll-title">Brasil x Japao</h1>
						{activeTab === 'query' ? (
							<p>Consulte o palpite cadastrado usando a tag do Instagram.</p>
						) : activeTab === 'results' ? (
							<p>Veja os jogos encerrados e acompanhe o replay dos sorteios.</p>
						) : isPollClosed ? (
							<p>Palpites encerrados, volte depois para o proximo jogo.</p>
						) : (
							<p>
								Informe seu palpite do jogo Brasil e Japao e concorra a um lanche gratuito
								do Pastel do Cruzeiro.
							</p>
						)}
					</div>

					{activeTab === 'guess' ? (
						isPollClosed ? null : (
						<form
							aria-labelledby="poll-guess-tab"
							className="poll-form"
							id="poll-guess-panel"
							onSubmit={handleSubmit}
							role="tabpanel"
						>
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
								<div className="score-team score-team--home">
									<label className="score-input">
										<span className="score-country" aria-hidden="true">
											<span className="score-flag">BR</span>
											<span className="score-code">BR</span>
										</span>
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
								</div>
								<strong className="score-separator">X</strong>
								<div className="score-team score-team--away">
									<label className="score-input">
										<input
											aria-label="Gols do Japao"
											inputMode="numeric"
											min="0"
											onChange={event => setJpScore(normalizeScoreInput(event.target.value))}
											pattern="[0-9]*"
											placeholder="0"
											type="text"
											value={jpScore}
										/>
										<span className="score-country" aria-hidden="true">
											<span className="score-code">JP</span>
											<span className="score-flag">JP</span>
										</span>
									</label>
								</div>
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
						)
					) : activeTab === 'query' ? (
						<form
							aria-labelledby="poll-query-tab"
							className="poll-form"
							id="poll-query-panel"
							onSubmit={handleQuerySubmit}
							role="tabpanel"
						>
							<label className="poll-field">
								<span>Instagram</span>
								<input
									autoComplete="off"
									inputMode="text"
									onChange={event => setQueryInstagramHandle(event.target.value)}
									placeholder="@nome-teste"
									type="text"
									value={queryInstagramHandle}
								/>
							</label>

							<button className="submit-button" disabled={isQuerying} type="submit">
								{isQuerying ? 'Consultando...' : 'Consultar palpite'}
							</button>

							{queriedGuess ? (
								<div className="guess-result" role="status">
									<span>{queriedGuess.instagramHandle}</span>
									<strong>{queriedGuess.score}</strong>
								</div>
							) : null}

							{queryState.message ? (
								<p className={`form-message form-message--${queryState.type}`} role="status">
									{queryState.message}
								</p>
							) : null}
						</form>
					) : (
						<div
							aria-labelledby="poll-results-tab"
							className="results-list"
							id="poll-results-panel"
							role="tabpanel"
						>
							{isLoadingResults ? (
								<p className="form-message form-message--success" role="status">
									Carregando resultados...
								</p>
							) : null}

							{resultsError ? (
								<p className="form-message form-message--error" role="status">
									{resultsError}
								</p>
							) : null}

							{!isLoadingResults && !resultsError && pollResults.length === 0 ? (
								<p className="form-message form-message--success" role="status">
									Nenhum resultado publicado ainda.
								</p>
							) : null}

							{pollResults.map(result => {
								const isExpanded = expandedMatch === result.match;
								const isReplayActive = replayState.match === result.match;
								const hasFirstWinner = Boolean(result['first-winner']);
								const hasSecondWinner = Boolean(result['second-winner']);

								return (
									<article className="result-card" key={result.match}>
										<button
											aria-expanded={isExpanded}
											className="result-card__summary"
											onClick={() => handleExpandResult(result.match)}
											type="button"
										>
											<span>{getMatchName(result.match)}</span>
											<strong>{result.result}</strong>
										</button>

										{isExpanded ? (
											<div className="result-card__details">
												{hasFirstWinner ? (
													<div className="winner-line">
														<span>Primeiro ganhador</span>
														<strong>{result['first-winner']}</strong>
													</div>
												) : null}

												{hasSecondWinner ? (
													<div className="winner-line">
														<span>Segundo ganhador</span>
														<strong>{result['second-winner']}</strong>
													</div>
												) : null}

												{hasSecondWinner ? (
													<button
														className="submit-button"
														disabled={replayState.isRunning}
														onClick={() => handleReplay(result)}
														type="button"
													>
														{replayState.isRunning && isReplayActive
															? 'Reproduzindo...'
															: 'Ver replay do sorteio'}
													</button>
												) : null}

												{hasSecondWinner ? (
													<div className="participants-list" aria-label="Participantes do sorteio">
														{result.participants.map((participant, index) => (
															<span
																className={`participant-chip${
																	isReplayActive && replayState.highlightedIndex === index
																		? ' participant-chip--active'
																		: ''
																}${
																	participant === result['second-winner']
																		? ' participant-chip--winner'
																		: ''
																}`}
																key={`${result.match}-${participant}-${index}`}
															>
																{participant}
															</span>
														))}
													</div>
												) : null}
											</div>
										) : null}
									</article>
								);
							})}
						</div>
					)}
				</section>
			</div>
		</main>
	);
}
