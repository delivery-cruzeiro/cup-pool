import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CupPollApp } from './CupPollApp';
import './styles.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
	throw new Error('Cup poll root element not found');
}

createRoot(rootElement).render(
	<StrictMode>
		<CupPollApp />
	</StrictMode>
);
