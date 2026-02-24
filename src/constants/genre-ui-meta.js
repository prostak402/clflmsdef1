const DEFAULT_GENRE_UI_META = Object.freeze({
  icon: 'Film',
  color: '#64748b',
})

const GENRE_UI_META = Object.freeze({
  action: Object.freeze({ icon: 'Sword', color: '#ef4444' }),
  comedy: Object.freeze({ icon: 'Laugh', color: '#f59e0b' }),
  drama: Object.freeze({ icon: 'Drama', color: '#8b5cf6' }),
  horror: Object.freeze({ icon: 'Ghost', color: '#1e293b' }),
  scifi: Object.freeze({ icon: 'Rocket', color: '#06b6d4' }),
  romance: Object.freeze({ icon: 'Heart', color: '#ec4899' }),
  thriller: Object.freeze({ icon: 'Zap', color: '#f97316' }),
  animation: Object.freeze({ icon: 'Palette', color: '#10b981' }),
  documentary: Object.freeze({ icon: 'Film', color: '#6366f1' }),
  fantasy: Object.freeze({ icon: 'Wand', color: '#d946ef' }),
  crime: Object.freeze({ icon: 'Shield', color: '#64748b' }),
  adventure: Object.freeze({ icon: 'Compass', color: '#14b8a6' }),
})

function getGenreUiMeta(genreSlug) {
  return GENRE_UI_META[genreSlug] || DEFAULT_GENRE_UI_META
}

export { DEFAULT_GENRE_UI_META, GENRE_UI_META, getGenreUiMeta }
