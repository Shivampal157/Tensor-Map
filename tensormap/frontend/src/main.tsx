import React from 'react';
import ReactDOM from 'react-dom/client';

import App from './App';
import './index.css';

import axios from 'axios';

const base = import.meta.env.VITE_API_BASE ?? '';
axios.defaults.baseURL = base;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
