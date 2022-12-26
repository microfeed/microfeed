import React from 'react';
import ReactDOM from 'react-dom/client';
import CustomCodeEditorApp from "./components/CustomCodeEditorApp";

document.addEventListener('DOMContentLoaded', () => {
  const $rootDom = document.getElementById('client-side-root');
  if ($rootDom) {
    const root = ReactDOM.createRoot($rootDom);
    root.render(
      <React.StrictMode>
        <CustomCodeEditorApp/>
      </React.StrictMode>
    );
  }
});
