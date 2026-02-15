import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/useApp';
import { GENRES } from '../data/mock';
import {
  Sword, Laugh, Drama, Ghost, Rocket, Heart,
  Zap, Palette, Film, Wand2, Shield, Compass, ArrowRight, Sparkles
} from 'lucide-react';
import './GenreSelectPage.css';

const ICON_MAP = {
  Sword, Laugh, Drama, Ghost, Rocket, Heart,
  Zap, Palette, Film, Wand: Wand2, Shield, Compass,
};

export default function GenreSelectPage() {
  const { selectedGenres, toggleGenre, setHasCompletedOnboarding } = useApp();
  const navigate = useNavigate();

  const handleContinue = () => {
    setHasCompletedOnboarding(true);
    navigate('/feed');
  };

  return (
    <div className="genre-page">
      <div className="genre-bg-grid" />

      <div className="genre-container">
        <div className="genre-header">
          <div className="genre-icon-badge">
            <Sparkles size={28} />
          </div>
          <h1 className="genre-title">What do you like?</h1>
          <p className="genre-desc">
            Choose genres that interest you. We'll show you the best movie clips matching your taste.
          </p>
        </div>

        <div className="genre-grid">
          {GENRES.map((genre, index) => {
            const Icon = ICON_MAP[genre.icon] || Film;
            const isSelected = selectedGenres.includes(genre.id);
            return (
              <button
                key={genre.id}
                className={`genre-chip ${isSelected ? 'selected' : ''}`}
                onClick={() => toggleGenre(genre.id)}
                style={{
                  '--chip-color': genre.color,
                  '--chip-delay': `${index * 50}ms`,
                }}
              >
                <div className="genre-chip-icon">
                  <Icon size={22} />
                </div>
                <span className="genre-chip-name">{genre.name}</span>
                {isSelected && (
                  <div className="genre-chip-check">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M2 7L5.5 10.5L12 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="genre-footer">
          <p className="genre-count">
            {selectedGenres.length === 0
              ? 'Select at least one genre to continue'
              : `${selectedGenres.length} genre${selectedGenres.length > 1 ? 's' : ''} selected`}
          </p>
          <button
            className={`genre-continue ${selectedGenres.length > 0 ? 'active' : ''}`}
            onClick={handleContinue}
            disabled={selectedGenres.length === 0}
          >
            <span>Explore clips</span>
            <ArrowRight size={20} />
          </button>
          {selectedGenres.length === 0 && (
            <button className="genre-skip" onClick={() => {
              setHasCompletedOnboarding(true);
              navigate('/feed');
            }}>
              Skip and see everything
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
