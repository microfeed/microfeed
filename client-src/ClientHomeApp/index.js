import React from 'react';
import ReactDOM from 'react-dom/client';
import ClientHomeApp from './components/ClientHomeApp';

document.addEventListener('DOMContentLoaded', () => {
  const root = ReactDOM.createRoot(document.getElementById('client-side-root'));
  root.render(
    <React.StrictMode>
      <ClientHomeApp/>
    </React.StrictMode>
  );
});
