import { render } from 'preact';
import { App } from './app.jsx';
import './styles.css';
import { applyTheme, storedTheme } from './theme.js';

applyTheme(storedTheme());

render(<App />, document.getElementById('app'));
