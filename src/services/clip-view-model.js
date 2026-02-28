import { toClipUiModel } from './mappers/clip-mapper'
import { createGenreLookup } from './mappers/genre-mapper'

export { createGenreLookup }

export function toClipViewModel(entity, genreLookup = {}) {
  return toClipUiModel(entity, genreLookup)
}

export function toCatalogItemViewModel(entity, genreLookup = {}) {
  const clip = toClipUiModel(entity, genreLookup)

  return {
    ...clip,
    subtitle: clip.durationLabel,
  }
}
