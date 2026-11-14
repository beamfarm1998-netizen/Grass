import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
         // ✅ เพิ่มบรรทัดนี้


createRoot(document.getElementById('root')!).render(<App />);
