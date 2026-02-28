import { getGenreUiMeta } from '../../constants/genre-ui-meta'

function safeString(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

export function createGenreLookup(genres = []) {
  return genres.reduce((acc, genre) => {
    const id = safeString(genre?.id || genre?.slug)

    if (!id) {
      return acc
    }

    const uiMeta = getGenreUiMeta(id)

    acc[id] = {
      id,
      name: safeString(genre?.name, 'Unknown'),
      icon: safeString(genre?.icon, uiMeta.icon),
      color: safeString(genre?.color, uiMeta.color),
    }

    return acc
  }, {})
}
