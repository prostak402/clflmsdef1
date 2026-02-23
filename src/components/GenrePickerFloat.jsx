import { useState, useRef, useEffect } from 'react'
import { useApp } from '../context/useApp'
import { contentService } from '../services/content-service'
import { SlidersHorizontal, X, Check } from 'lucide-react'
import './GenrePickerFloat.css'

export default function GenrePickerFloat() {
  const { selectedGenres, toggleGenre } = useApp()
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const activeGenreNames = contentService
    .getGenres()
    .filter((g) => selectedGenres.includes(g.id))
    .map((g) => g.name)

  return (
    <div className="gpf-wrap" ref={panelRef}>
      <button
        className={`gpf-trigger glass ${open ? 'active' : ''}`}
        onClick={() => setOpen(!open)}
      >
        <SlidersHorizontal size={16} />
        <span className="gpf-trigger-label">
          {selectedGenres.length === 0
            ? 'All genres'
            : selectedGenres.length <= 2
              ? activeGenreNames.join(', ')
              : `${selectedGenres.length} genres`}
        </span>
      </button>

      {open && (
        <div className="gpf-dropdown glass-strong">
          <div className="gpf-header">
            <span className="gpf-title">Filter by genre</span>
            <button className="gpf-close" onClick={() => setOpen(false)}>
              <X size={16} />
            </button>
          </div>
          <div className="gpf-list">
            {contentService.getGenres().map((genre) => {
              const isActive = selectedGenres.includes(genre.id)
              return (
                <button
                  key={genre.id}
                  className={`gpf-item ${isActive ? 'active' : ''}`}
                  onClick={() => toggleGenre(genre.id)}
                  style={{ '--gc': genre.color }}
                >
                  <span className="gpf-dot" style={{ background: genre.color }} />
                  <span className="gpf-name">{genre.name}</span>
                  {isActive && <Check size={14} className="gpf-check" />}
                </button>
              )
            })}
          </div>
          {selectedGenres.length > 0 && (
            <button
              className="gpf-clear"
              onClick={() => selectedGenres.forEach((g) => toggleGenre(g))}
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  )
}
