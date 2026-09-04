import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import CreateDeckModal from '../components/CreateDeckModal';

export default function LibraryPage({ user, onLogout }) {
  const [decks, setDecks] = useState([]);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Load mock decks from localStorage
    const savedDecks = localStorage.getItem('decks');
    if (savedDecks) {
      setDecks(JSON.parse(savedDecks));
    }
  }, []);

  const handleCreateDeck = (newDeck) => {
    // Add new deck to list and save to localStorage
    const updatedDecks = [...decks, newDeck];
    setDecks(updatedDecks);
    localStorage.setItem('decks', JSON.stringify(updatedDecks));
    setShowModal(false);
  };

  const handleDeleteDeck = (deckId) => {
    const updatedDecks = decks.filter((d) => d.id !== deckId);
    setDecks(updatedDecks);
    localStorage.setItem('decks', JSON.stringify(updatedDecks));
  };

  return (
    <div className="library-container">
      <header className="library-header">
        <h1>Your Decks</h1>
        <div className="header-actions">
          <span className="user-email">{user.email}</span>
          <button onClick={onLogout} className="logout-btn">
            Log Out
          </button>
        </div>
      </header>

      {decks.length === 0 ? (
        <div className="empty-state">
          <p>No decks yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="deck-grid">
          {decks.map((deck) => (
            <div key={deck.id} className="deck-card">
              <Link to={`/deck/${deck.id}`} className="deck-link">
                <h3>{deck.name}</h3>
                <p className="deck-language">{deck.language}</p>
                <p className="card-count">{deck.cardIds?.length || 0} cards</p>
              </Link>
              <button
                className="delete-btn"
                onClick={() => handleDeleteDeck(deck.id)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      <button onClick={() => setShowModal(true)} className="create-deck-btn">
        + Create New Deck
      </button>

      {showModal && (
        <CreateDeckModal
          onClose={() => setShowModal(false)}
          onCreate={handleCreateDeck}
        />
      )}
    </div>
  );
}
