import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, ExternalLink, Filter, X } from 'lucide-react'
import { useApp } from '../context/useApp'
import { createGenreLookup, toCatalogItemViewModel } from '../services/clip-view-model'
import DataState from '../components/DataState'
import './CatalogPage.css'

export default function CatalogPage() {
  const { getCatalog, genres = [] } = useApp()
  const genreLookup = useMemo(() => createGenreLookup(genres), [genres])
  const [catalogItems, setCatalogItems] = useState([])
  const [loadState, setLoadState] = useState({ status: 'loading', error: '' })
  const [search, setSearch] = useState('')
  const [activeGenre, setActiveGenre] = useState('all')
  const [showFilter, setShowFilter] = useState(false)

  const loadCatalog = useCallback(async () => {
    setLoadState({ status: 'loading', error: '' })

    try {
      const nextCatalog = await getCatalog()
      const normalizedCatalog = Array.isArray(nextCatalog)
        ? nextCatalog.map((movie) => toCatalogItemViewModel(movie, genreLookup))
        : []

      setCatalogItems(normalizedCatalog)
      setLoadState({ status: 'ready', error: '' })
    } catch {
      setCatalogItems([])
      setLoadState({ status: 'error', error: 'Failed to load catalog. Please try again.' })
    }
  }, [genreLookup, getCatalog])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadCatalog()
    }, 0)

    return () => window.clearTimeout(timer)
  }, [loadCatalog])

  const filtered = useMemo(() => {
    return catalogItems.filter((movie) => {
      const matchesSearch = movie.title.toLowerCase().includes(search.toLowerCase())
      const matchesGenre =
        activeGenre === 'all' ||
        (Array.isArray(movie.genreIds)
          ? movie.genreIds.includes(activeGenre)
          : movie.genreId === activeGenre)
      return matchesSearch && matchesGenre
    })
  }, [activeGenre, catalogItems, search])

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
          onChange={(event) => setSearch(event.target.value)}
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
          {genres.map((genre) => (
            <button
              key={genre.id}
              className={`catalog-genre-btn ${activeGenre === genre.id ? 'active' : ''}`}
              onClick={() => setActiveGenre(genre.id)}
            >
              {genre.name}
            </button>
          ))}
        </div>
      )}

      {loadState.status === 'loading' && (
        <DataState
          variant="loading"
          title="Loading catalog"
          description="Preparing the full movie collection..."
        />
      )}

      {loadState.status === 'error' && (
        <DataState
          variant="error"
          title="Catalog is unavailable"
          description={loadState.error}
          actionLabel="Retry"
          onAction={loadCatalog}
        />
      )}

      {loadState.status === 'ready' && (
        <>
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
                      onClick={() => window.open(movie.watchUrl, '_blank')}
                    >
                      <ExternalLink size={18} />
                      Watch
                    </button>
                  </div>
                  <div className="catalog-rating-badge">{movie.genreLabel || movie.genreName}</div>
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
        </>
      )}
    </div>
  )
}
