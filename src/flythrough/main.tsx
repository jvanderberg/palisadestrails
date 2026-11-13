import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Root from './Root';
import './flythrough.css';

const root = document.getElementById('fly-root');
if (!root) throw new Error('Missing fly-through root');

createRoot(root).render(
	<StrictMode>
		<Root />
	</StrictMode>,
);
