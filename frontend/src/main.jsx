import { render } from 'preact';
import { App } from './app.jsx';
import './styles.css';
import { applyFontSize, applyTheme, storedFontSize, storedTheme } from './theme.js';

applyTheme(storedTheme());
applyFontSize(storedFontSize());

render(<App />, document.getElementById('app'));
