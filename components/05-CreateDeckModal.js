import React, { useState } from 'react';

export default function CreateDeckModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('chinese');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Deck name is required');
      return;
    }

    // Create new deck with mock data
    const newDeck = {
      id: Math.random().toString(),
      name: name.trim(),
      language,
      cardIds: [],
      createdAt: new Date().toISOString(),
    };

    onCreate(newDeck);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Create New Deck</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Deck Name</label>
            <input
              type="text"
              placeholder="e.g., HSK1 Chinese, Spanish Basics"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="chinese">Chinese</option>
              <option value="spanish">Spanish</option>
              <option value="english">English</option>
              <option value="japanese">Japanese</option>
            </select>
          </div>

          {error && <div className="error">{error}</div>}

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="cancel-btn">
              Cancel
            </button>
            <button type="submit" className="submit-btn">
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
