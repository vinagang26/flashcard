import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './styles/index.css';
import LoginPage from './pages/LoginPage';
import LibraryPage from './pages/LibraryPage';
import DeckPage from './pages/DeckPage';

export default function App() {
  // Mock auth state — replace with Supabase later
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // On mount, check if user is already logged in (from localStorage)
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <Router>
      <Routes>
        {!user ? (
          // Not logged in: show login page, redirect library/deck routes
          <>
            <Route path="/" element={<LoginPage onLogin={setUser} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </>
        ) : (
          // Logged in: show library/deck pages, redirect login to library
          <>
            <Route path="/library" element={<LibraryPage user={user} onLogout={() => {
              setUser(null);
              localStorage.removeItem('user');
              localStorage.removeItem('decks');
              localStorage.removeItem('cards');
            }} />} />
            <Route path="/deck/:deckId" element={<DeckPage user={user} />} />
            <Route path="*" element={<Navigate to="/library" />} />
          </>
        )}
      </Routes>
    </Router>
  );
}
