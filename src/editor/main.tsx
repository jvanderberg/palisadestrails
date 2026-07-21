import 'leaflet/dist/leaflet.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import EditorApp from './EditorApp';
import './editor.css';

const root = document.getElementById('editor-root');
if (!root) throw new Error('Missing editor root');

createRoot(root).render(
	<StrictMode>
		<EditorApp />
	</StrictMode>,
);
