import { GENRES, MOCK_CATALOG } from '../data/mock';

export const contentService = {
  getGenres() {
    return GENRES;
  },
  getCatalog() {
    return MOCK_CATALOG;
  },
};
