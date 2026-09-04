import React, { useState } from 'react';

export default function CreateCardModal({ deckId, onClose, onCreate }) {
  const [front, setFront] = useState('');
  const [subBack, setSubBack] = useState('');
  const [back, setBack] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!front.trim() || !back.trim()) {
      setError('Front and back are required');
      return;
    }

    // Create new card with mock data
    const newCard = {
      id: Math.random().toString(),
      deckId,
      language: 'chinese', // Will come from deck language later
      fields: {
        front: front.trim(),
        subBack: subBack.trim() || null,
        back: back.trim(),
      },
      mastery: {
        interval: 1,
        factor: 2.5,
        lastReview: null,
        reviewCount: 0,
      },
      createdAt: new Date().toISOString(),
    };

    onCreate(newCard);
    
    // Reset form
    setFront('');
    setSubBack('');
    setBack('');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Add Card</h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Front (e.g., Hanzi)</label>
            <input
              type="text"
              placeholder="你好"
              value={front}
              onChange={(e) => setFront(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Sub-Back (optional, e.g., Pinyin)</label>
            <input
              type="text"
              placeholder="nǐ hǎo"
              value={subBack}
              onChange={(e) => setSubBack(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Back (meaning)</label>
            <input
              type="text"
              placeholder="hello"
              value={back}
              onChange={(e) => setBack(e.target.value)}
            />
          </div>

          {error && <div className="error">{error}</div>}

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="cancel-btn">
              Cancel
            </button>
            <button type="submit" className="submit-btn">
              Add Card
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
