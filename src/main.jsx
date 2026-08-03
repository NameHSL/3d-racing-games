import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

// 不使用 StrictMode：避免 dev 下 effect 双调用导致 World 重复创建/双重事件绑定
createRoot(document.getElementById('root')).render(<App />);
