import { useNavigate } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { useApp } from '../context/useApp'
import { contentService } from '../services/content-service'
import { GENRE_SELECTION_MIN, GENRE_SELECTION_MAX } from '../constants/onboarding'
import {
  Sword,
  Laugh,
  Drama,
  Ghost,
  Rocket,
  Heart,
  Zap,
  Palette,
  Film,
  Wand2,
  Shield,
  Compass,
  ArrowRight,
  Sparkles,
} from 'lucide-react'
import './GenreSelectPage.css'

const ICON_MAP = {
  Sword,
  Laugh,
  Drama,
  Ghost,
  Rocket,
  Heart,
  Zap,
  Palette,
  Film,
  Wand: Wand2,
  Shield,
  Compass,
}

export default function GenreSelectPage() {
  const { selectedGenres, toggleGenre, setHasCompletedOnboarding } = useApp()
  const navigate = useNavigate()
  const [error, setError] = useState('')

  const selectionCount = selectedGenres.length
  const canContinue = selectionCount >= GENRE_SELECTION_MIN && selectionCount <= GENRE_SELECTION_MAX

  const helperText = useMemo(() => {
    if (selectionCount < GENRE_SELECTION_MIN) {
      return `Choose at least ${GENRE_SELECTION_MIN} genres to continue`
    }

    return `${selectionCount} genres selected`
  }, [selectionCount])

  const handleToggleGenre = (genreId) => {
    const isSelected = selectedGenres.includes(genreId)

    if (!isSelected && selectionCount >= GENRE_SELECTION_MAX) {
      setError(`You can choose up to ${GENRE_SELECTION_MAX} genres`)
      return
    }

    setError('')
    toggleGenre(genreId)
  }

  const handleContinue = () => {
    if (selectionCount < GENRE_SELECTION_MIN) {
      setError(`Please choose at least ${GENRE_SELECTION_MIN} genres`)
      return
    }

    setHasCompletedOnboarding(true)
    navigate('/feed')
  }

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
            Choose genres that interest you. We'll show you the best movie clips matching your
            taste.
          </p>
        </div>

        <div className="genre-grid">
          {contentService.getGenres().map((genre, index) => {
            const Icon = ICON_MAP[genre.icon] || Film
            const isSelected = selectedGenres.includes(genre.id)
            return (
              <button
                key={genre.id}
                className={`genre-chip ${isSelected ? 'selected' : ''}`}
                onClick={() => handleToggleGenre(genre.id)}
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
                      <path
                        d="M2 7L5.5 10.5L12 3.5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                )}
              </button>
            )
          })}
        </div>

        <div className="genre-footer">
          <p className="genre-count">{helperText}</p>
          {error && (
            <p className="genre-error" role="alert">
              {error}
            </p>
          )}
          <button
            className={`genre-continue ${canContinue ? 'active' : ''}`}
            onClick={handleContinue}
            disabled={!canContinue}
          >
            <span>Explore clips</span>
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}
