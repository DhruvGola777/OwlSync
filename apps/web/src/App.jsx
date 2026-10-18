import React from 'react';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { AuthProvider } from './providers/AuthProvider';
import { ThemeProvider } from './providers/ThemeProvider';
import { AppRouter } from './router/AppRouter';

const isElectron = typeof window !== 'undefined' && (!!window.electronAPI || window.navigator.userAgent.includes('Electron'));
const Router = isElectron ? HashRouter : BrowserRouter;

function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <AuthProvider>
        <Router>
          <AppRouter />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
