
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import htm from 'htm';
import App from './App.js';

const html = htm.bind(createElement);
const rootElement = document.getElementById('root');
const root = createRoot(rootElement);

root.render(html`<${App} />`);
