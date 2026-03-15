import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/useApp'
import { getGenreUiMeta } from '../constants/genre-ui-meta'
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
  CheckCheck,
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
  const {
    genres = [],
    selectedGenres,
    toggleGenre,
    selectAllGenres = () => {},
    setHasCompletedOnboarding,
  } = useApp()
  const navigate = useNavigate()

  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const selectionCount = selectedGenres.length
  const totalGenres = genres.length
  const allGenresSelected = totalGenres > 0 && selectionCount === totalGenres
  const canContinue = true

  const helperText = useMemo(() => {
    if (selectionCount === 0) {
      return 'No genres selected. Feed will show all clips.'
    }

    if (allGenresSelected) {
      return 'All genres selected'
    }

    return `${selectionCount} genre${selectionCount === 1 ? '' : 's'} selected`
  }, [allGenresSelected, selectionCount])

  const handleContinue = async () => {
    if (isSubmitting) {
      return
    }

    setSubmitError('')
    setIsSubmitting(true)

    try {
      await setHasCompletedOnboarding(true)
      navigate('/feed')
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to complete onboarding.')
    } finally {
      setIsSubmitting(false)
    }
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
          {genres.map((genre, index) => {
            const { icon, color } = getGenreUiMeta(genre.id)
            const Icon = ICON_MAP[icon] || Film
            const isSelected = selectedGenres.includes(genre.id)
            return (
              <button
                key={genre.id}
                className={`genre-chip ${isSelected ? 'selected' : ''}`}
                onClick={() => toggleGenre(genre.id)}
                style={{
                  '--chip-color': color,
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
          <div className="genre-footer-actions">
            <button
              type="button"
              className="genre-select-all"
              onClick={selectAllGenres}
              disabled={totalGenres === 0 || allGenresSelected}
            >
              <CheckCheck size={18} />
              <span>{allGenresSelected ? 'All selected' : 'Select all genres'}</span>
            </button>
          </div>
          <p className="genre-count">{helperText}</p>
          {submitError && <p className="genre-error">{submitError}</p>}
          <button
            className={`genre-continue ${canContinue ? 'active' : ''}`}
            onClick={handleContinue}
            disabled={!canContinue || isSubmitting}
          >
            <span>Explore clips</span>
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}
