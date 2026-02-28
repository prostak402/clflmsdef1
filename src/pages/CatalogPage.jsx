import { useState, useMemo } from 'react'
import { contentService } from '../services/content-service'
import { createGenreLookup, toCatalogItemViewModel } from '../services/clip-view-model'
import { useApp } from '../context/useApp'
import { Search, ExternalLink, Filter, X } from 'lucide-react'
import './CatalogPage.css'

const GENRES = contentService.getGenres()
const GENRE_LOOKUP = createGenreLookup(GENRES)

export default function CatalogPage() {
  const { getCatalog } = useApp()
  const [search, setSearch] = useState('')
  const [activeGenre, setActiveGenre] = useState('all')
  const [showFilter, setShowFilter] = useState(false)

  const filtered = useMemo(() => {
    return getCatalog()
      .map((movie) => toCatalogItemViewModel(movie, GENRE_LOOKUP))
      .filter((movie) => {
        const matchesSearch = movie.title.toLowerCase().includes(search.toLowerCase())
        const matchesGenre = activeGenre === 'all' || movie.genreId === activeGenre
        return matchesSearch && matchesGenre
      })
  }, [search, activeGenre, getCatalog])

  return (
    <div className="catalog-page">
      <div className="catalog-header">
        <h1 className="catalog-title">Catalog</h1>
        <p className="catalog-subtitle">Browse the full movie collection</p>
      </div>

      <div className="catalog-search-bar glass">
        <Search size={18} className="catalog-search-icon" />
        <input
          type="text"
          placeholder="Search movies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="catalog-search-input"
        />
        {search && (
          <button className="catalog-search-clear" onClick={() => setSearch('')}>
            <X size={16} />
          </button>
        )}
        <button
          className={`catalog-filter-btn ${showFilter ? 'active' : ''}`}
          onClick={() => setShowFilter(!showFilter)}
        >
          <Filter size={18} />
        </button>
      </div>

      {showFilter && (
        <div className="catalog-genres">
          <button
            className={`catalog-genre-btn ${activeGenre === 'all' ? 'active' : ''}`}
            onClick={() => setActiveGenre('all')}
          >
            All
          </button>
          {GENRES.map((genre) => (
            <button
              key={genre.id}
              className={`catalog-genre-btn ${activeGenre === genre.id ? 'active' : ''}`}
              onClick={() => setActiveGenre(genre.id)}
              style={{ '--g-color': genre.color }}
            >
              {genre.name}
            </button>
          ))}
        </div>
      )}

      <div className="catalog-grid">
        {filtered.map((movie, index) => (
          <div
            key={movie.id}
            className="catalog-card"
            style={{ '--card-delay': `${index * 60}ms` }}
          >
            <div className="catalog-poster">
              <img src={movie.thumbnailUrl} alt={movie.title} loading="lazy" />
              <div className="catalog-poster-overlay">
                <button
                  className="catalog-watch-btn"
                  onClick={() => window.open(movie.externalUrl, '_blank')}
                >
                  <ExternalLink size={18} />
                  Watch
                </button>
              </div>
              <div className="catalog-rating-badge">{movie.genreName}</div>
            </div>
            <div className="catalog-card-info">
              <h3 className="catalog-card-title">{movie.title}</h3>
              <span className="catalog-card-year">{movie.subtitle}</span>
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="catalog-empty">
          <p>No movies found</p>
          <p className="catalog-empty-sub">Try a different search or genre</p>
        </div>
      )}
    </div>
  )
}
