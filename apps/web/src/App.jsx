import React from 'react';
import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from './providers/AuthProvider';
import { AppRouter } from './router/AppRouter';

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRouter />
      </Router>
    </AuthProvider>
  );
}

export default App;
