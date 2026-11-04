import { createRoot } from 'react-dom/client';

import { App } from './app';
import './setup.css';

const root = document.getElementById('root');
if (root) createRoot(root).render(<App />);
