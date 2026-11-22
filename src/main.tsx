import { createRoot } from 'react-dom/client';
import { game } from './engine/game';
import { App } from './ui/App';
import './styles.css';

(window as unknown as { __game: typeof game }).__game = game; // útil para depuração no console
createRoot(document.getElementById('root')!).render(<App />);
