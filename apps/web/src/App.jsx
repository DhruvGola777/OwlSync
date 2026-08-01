import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from './providers/AuthProvider';
import { ThemeProvider } from './providers/ThemeProvider';
import { AppRouter } from './router/AppRouter';

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
