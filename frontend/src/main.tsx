import { IconContext } from '@phosphor-icons/react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import App from './App';
import './styles.css';

if (location.hash.startsWith('#/')) history.replaceState(null, '', location.hash.slice(1)); // old #/ bookmarks

createRoot(document.getElementById('root')!).render(
  <IconContext.Provider value={{ size: '1em', className: 'ph', 'aria-hidden': true }}>
    <BrowserRouter><App /></BrowserRouter>
  </IconContext.Provider>,
);
