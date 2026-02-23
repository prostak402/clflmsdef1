import { describe, it, beforeEach, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from '../App'
import { COMMENT_MAX_LENGTH } from '../services/comment-validation'

async function openFeed(user) {
  render(<App />)

  await user.click(screen.getByRole('button', { name: /demo account/i }))

  const genreButtons = document.querySelectorAll('.genre-chip')
  await user.click(genreButtons[0])
  await user.click(genreButtons[1])
  await user.click(genreButtons[2])

  await user.click(document.querySelector('.genre-continue'))
  expect((await screen.findAllByText(/Watch Full Movie/i)).length).toBeGreaterThan(0)
}

describe('TASK-003: feed, reactions, comments and navigation', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/')
  })

  it('opens feed after auth + onboarding flow', async () => {
    const user = userEvent.setup()
    await openFeed(user)

    expect(screen.getAllByRole('button', { name: /Feed/i })[0]).toHaveAttribute(
      'aria-current',
      'page'
    )
  })

  it('toggles like and bookmark on active clip', async () => {
    const user = userEvent.setup()
    await openFeed(user)

    const actionButtons = document.querySelectorAll('.clip-actions .clip-action-btn')
    const likeButton = actionButtons[0]
    const bookmarkButton = actionButtons[2]

    expect(likeButton.className).not.toContain('liked')
    await user.click(likeButton)
    expect(likeButton.className).toContain('liked')

    expect(bookmarkButton.className).not.toContain('bookmarked')
    await user.click(bookmarkButton)
    expect(bookmarkButton.className).toContain('bookmarked')
  })

  it('adds a comment and shows it in UI', async () => {
    const user = userEvent.setup()
    await openFeed(user)

    const actionButtons = document.querySelectorAll('.clip-actions .clip-action-btn')
    await user.click(actionButtons[1])

    await user.type(
      await screen.findByPlaceholderText(/add a comment/i),
      'Новый комментарий из теста'
    )
    await user.click(document.querySelector('.comments-send'))

    expect(await screen.findByText('Новый комментарий из теста')).toBeInTheDocument()
  })

  it('blocks empty comment and shows validation message', async () => {
    const user = userEvent.setup()
    await openFeed(user)

    const actionButtons = document.querySelectorAll('.clip-actions .clip-action-btn')
    await user.click(actionButtons[1])

    await user.type(await screen.findByPlaceholderText(/add a comment/i), '     ')
    await user.click(document.querySelector('.comments-send'))

    expect(await screen.findByText(/comment cannot be empty/i)).toBeInTheDocument()
  })

  it('blocks too long comment and shows validation message', async () => {
    const user = userEvent.setup()
    await openFeed(user)

    const actionButtons = document.querySelectorAll('.clip-actions .clip-action-btn')
    await user.click(actionButtons[1])

    const tooLongComment = 'а'.repeat(COMMENT_MAX_LENGTH + 1)
    const commentInput = await screen.findByPlaceholderText(/add a comment/i)

    fireEvent.change(commentInput, { target: { value: tooLongComment } })
    await user.click(document.querySelector('.comments-send'))

    expect(
      await screen.findByText(new RegExp(`maximum length is ${COMMENT_MAX_LENGTH}`, 'i'))
    ).toBeInTheDocument()
  }, 10000)

  it('navigates to Bookmarks and Profile via bottom nav', async () => {
    const user = userEvent.setup()
    await openFeed(user)

    const actionButtons = document.querySelectorAll('.clip-actions .clip-action-btn')
    await user.click(actionButtons[2])

    await user.click(screen.getAllByRole('button', { name: /Saved/i })[0])
    expect(await screen.findByRole('heading', { name: /^Saved Movies$/i })).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: /Profile/i })[0])
    expect(await screen.findByRole('heading', { name: /^Demo User$/i })).toBeInTheDocument()
  }, 30000)
})
