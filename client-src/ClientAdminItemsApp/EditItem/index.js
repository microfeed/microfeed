import React from 'react';
import ReactDOM from 'react-dom/client';
import EditItemApp from "../components/EditItemApp";

document.addEventListener('DOMContentLoaded', () => {
  const $rootDom = document.getElementById('client-side-root');
  if ($rootDom) {
    const root = ReactDOM.createRoot($rootDom);
    root.render(
      <React.StrictMode>
        <EditItemApp/>
      </React.StrictMode>
    );
  }
});
