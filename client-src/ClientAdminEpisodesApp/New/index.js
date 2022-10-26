import React from 'react';
import ReactDOM from 'react-dom/client';
import NewEpisodeApp from '../components/NewEpisodeApp';

document.addEventListener('DOMContentLoaded', () => {
  const $rootDom = document.getElementById('client-side-root');
  if ($rootDom) {
    const root = ReactDOM.createRoot($rootDom);
    root.render(
      <React.StrictMode>
        <NewEpisodeApp/>
      </React.StrictMode>
    );
  }
});
