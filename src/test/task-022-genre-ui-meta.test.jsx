import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import GenreSelectPage from '../pages/GenreSelectPage'

const mockUseAppState = {
  genres: [
    { id: 'action', name: 'Action' },
    { id: 'mystery', name: 'Mystery' },
  ],
  selectedGenres: [],
  toggleGenre: vi.fn(),
  setHasCompletedOnboarding: vi.fn(),
}

vi.mock('../context/useApp', () => ({
  useApp: () => mockUseAppState,
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
