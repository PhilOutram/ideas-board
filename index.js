import React from 'react';
import ReactDOM from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import IdeasBoard from './IdeasBoard';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <IdeasBoard />
    <Analytics />
  </React.StrictMode>
);
