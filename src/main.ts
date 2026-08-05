import './styles.css';

import { bootstrap, renderBootstrapError } from './app/bootstrap';

const root = document.querySelector<HTMLElement>('#app');

if (!root) {
  throw new Error('Missing #app root element.');
}

try {
  const dispose = bootstrap(root);
  window.addEventListener('beforeunload', dispose, { once: true });
} catch (error: unknown) {
  renderBootstrapError(root, error);
}
