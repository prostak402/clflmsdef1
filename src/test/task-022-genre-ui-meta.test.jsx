import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import GenreSelectPage from '../pages/GenreSelectPage'

vi.mock('../services/content-service', () => ({
  contentService: {
    getGenres: vi.fn(() => [
      { id: 'action', name: 'Action' },
      { id: 'mystery', name: 'Mystery' },
    ]),
  },
}))

vi.mock('../context/useApp', () => ({
  useApp: () => ({
    selectedGenres: [],
    toggleGenre: vi.fn(),
    setHasCompletedOnboarding: vi.fn(),
  }),
}))

describe('TASK-022: genre page UI meta fallback', () => {
  beforeEach(() => {
    cleanup()
  })

  it('renders genres when payload has no icon/color and applies fallback style for unknown slug', () => {
    render(
      <MemoryRouter>
        <GenreSelectPage />
      </MemoryRouter>
    )

    const actionChip = screen.getByRole('button', { name: /Action/i })
    const mysteryChip = screen.getByRole('button', { name: /Mystery/i })

    expect(actionChip).toHaveStyle('--chip-color: #ef4444')
    expect(mysteryChip).toHaveStyle('--chip-color: #64748b')
  })
})
