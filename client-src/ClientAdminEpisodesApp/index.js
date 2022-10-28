import React from 'react';
import ReactDOM from 'react-dom/client';
import EpisodeListApp from './components/EpisodeListApp';

document.addEventListener('DOMContentLoaded', () => {
  const $rootDom = document.getElementById('client-side-root');
  if ($rootDom) {
    const root = ReactDOM.createRoot($rootDom);
    root.render(
      <React.StrictMode>
        <EpisodeListApp/>
      </React.StrictMode>
    );
  }
});
