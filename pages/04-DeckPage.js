import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import CreateCardModal from '../components/CreateCardModal';

export default function DeckPage({ user }) {
  const { deckId } = useParams();
  const [deck, setDeck] = useState(null);
  const [cards, setCards] = useState([]);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Load deck and its cards from localStorage
    const savedDecks = localStorage.getItem('decks');
    const savedCards = localStorage.getItem('cards');

    if (savedDecks) {
      const decksList = JSON.parse(savedDecks);
      const foundDeck = decksList.find((d) => d.id === deckId);
      setDeck(foundDeck);
    }

    if (savedCards) {
      const cardsList = JSON.parse(savedCards);
      const deckCards = cardsList.filter((c) => c.deckId === deckId);
      setCards(deckCards);
    }
  }, [deckId]);

  const handleCreateCard = (newCard) => {
    // Add new card to list, update deck's cardIds, save to localStorage
    const updatedCards = [...cards, newCard];
    setCards(updatedCards);
    localStorage.setItem('cards', JSON.stringify(updatedCards));

    // Update deck's cardIds
    const savedDecks = JSON.parse(localStorage.getItem('decks'));
    const updatedDecks = savedDecks.map((d) =>
      d.id === deckId
        ? { ...d, cardIds: [...(d.cardIds || []), newCard.id] }
        : d
    );
    localStorage.setItem('decks', JSON.stringify(updatedDecks));
    setDeck(updatedDecks.find((d) => d.id === deckId));

    setShowModal(false);
  };

  const handleDeleteCard = (cardId) => {
    const updatedCards = cards.filter((c) => c.id !== cardId);
    setCards(updatedCards);
    localStorage.setItem('cards', JSON.stringify(updatedCards));

    // Update deck's cardIds
    const savedDecks = JSON.parse(localStorage.getItem('decks'));
    const updatedDecks = savedDecks.map((d) =>
      d.id === deckId
        ? { ...d, cardIds: d.cardIds.filter((id) => id !== cardId) }
        : d
    );
    localStorage.setItem('decks', JSON.stringify(updatedDecks));
    setDeck(updatedDecks.find((d) => d.id === deckId));
  };

  if (!deck) {
    return <div className="loading">Loading deck...</div>;
  }

  return (
    <div className="deck-container">
      <header className="deck-header">
        <Link to="/library" className="back-link">
          ← Back to Library
        </Link>
        <h1>{deck.name}</h1>
        <p className="deck-meta">{deck.language} • {cards.length} cards</p>
      </header>

      {cards.length === 0 ? (
        <div className="empty-state">
          <p>No cards yet. Add your first card to get started.</p>
        </div>
      ) : (
        <div className="cards-list">
          {cards.map((card) => (
            <div key={card.id} className="card-item">
              <div className="card-content">
                <div className="card-front">
                  <strong>{card.fields.front}</strong>
                </div>
                {card.fields.subBack && (
                  <div className="card-subback">
                    <em>{card.fields.subBack}</em>
                  </div>
                )}
                <div className="card-back">{card.fields.back}</div>
              </div>
              <button
                className="delete-btn"
                onClick={() => handleDeleteCard(card.id)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      <button onClick={() => setShowModal(true)} className="create-card-btn">
        + Add Card
      </button>

      {showModal && (
        <CreateCardModal
          deckId={deckId}
          onClose={() => setShowModal(false)}
          onCreate={handleCreateCard}
        />
      )}
    </div>
  );
}
