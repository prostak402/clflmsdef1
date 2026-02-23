import { act, render, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import { describe, expect, it } from 'vitest'

import { AppProvider } from '../context/AppContext'
import { useApp } from '../context/useApp'

function ContextProbe({ onUpdate }) {
  const app = useApp()

  useEffect(() => {
    onUpdate(app)
  }, [app, onUpdate])

  return null
}

async function renderAppContext() {
  let current

  render(
    <AppProvider>
      <ContextProbe
        onUpdate={(value) => {
          current = value
        }}
      />
    </AppProvider>
  )

  await waitFor(() => {
    expect(current).toBeTruthy()
  })

  return {
    getCurrent: () => current,
  }
}

describe('TASK-012: AppContext state transitions', () => {
  it('blocks content actions for unauthenticated user', async () => {
    const { getCurrent } = await renderAppContext()

    const likesSnapshot = { ...getCurrent().likes }
    const bookmarksSnapshot = [...getCurrent().bookmarks]
    const commentsSnapshot = { ...getCurrent().comments }

    await expect(getCurrent().toggleLike('1')).resolves.toBe(false)
    await expect(getCurrent().toggleBookmark('1')).resolves.toBe(false)
    expect(getCurrent().addComment('1', 'Комментарий без логина')).toEqual({
      ok: false,
      error: 'auth_required',
    })

    expect(getCurrent().likes).toEqual(likesSnapshot)
    expect(getCurrent().bookmarks).toEqual(bookmarksSnapshot)
    expect(getCurrent().comments).toEqual(commentsSnapshot)
  })

  it('applies like and bookmark transitions and supports repeated toggles', async () => {
    const { getCurrent } = await renderAppContext()

    await act(async () => {
      getCurrent().login({ name: 'State User', email: 'state@example.com' })
    })

    await act(async () => {
      await getCurrent().toggleLike('1')
      await getCurrent().toggleBookmark('1')
    })

    expect(getCurrent().likes['1']).toBe(true)
    expect(getCurrent().bookmarks).toContain('1')

    await act(async () => {
      await getCurrent().toggleLike('1')
      await getCurrent().toggleBookmark('1')
    })

    expect(getCurrent().likes['1']).toBe(false)
    expect(getCurrent().bookmarks).not.toContain('1')
  })

  it('updates comments and rejects invalid comment payload', async () => {
    const { getCurrent } = await renderAppContext()

    await act(async () => {
      getCurrent().login({ name: 'Test User', email: 'test@example.com' })
    })

    const beforeCommentsCount = getCurrent().comments['1']?.length ?? 0

    let result
    await act(async () => {
      result = getCurrent().addComment('1', '  Great pick!  ')
    })

    expect(result).toEqual({ ok: true, error: '' })
    expect(getCurrent().comments['1']).toHaveLength(beforeCommentsCount + 1)
    expect(getCurrent().comments['1'][0].text).toBe('Great pick!')
    expect(getCurrent().comments['1'][0].user).toBe('Test User')

    let invalidResult
    await act(async () => {
      invalidResult = getCurrent().addComment('1', '   ')
    })

    expect(invalidResult.ok).toBe(false)
    expect(getCurrent().comments['1']).toHaveLength(beforeCommentsCount + 1)
  })

  it('toggles genres and keeps state stable on repeated toggle and limit overflow', async () => {
    const { getCurrent } = await renderAppContext()

    await act(async () => {
      getCurrent().toggleGenre('action')
    })
    expect(getCurrent().selectedGenres).toContain('action')

    await act(async () => {
      getCurrent().toggleGenre('action')
    })
    expect(getCurrent().selectedGenres).not.toContain('action')

    await act(async () => {
      getCurrent().toggleGenre('action')
      getCurrent().toggleGenre('drama')
      getCurrent().toggleGenre('comedy')
      getCurrent().toggleGenre('romance')
      getCurrent().toggleGenre('thriller')
      getCurrent().toggleGenre('sci-fi')
    })

    expect(getCurrent().selectedGenres).toHaveLength(5)
    expect(getCurrent().selectedGenres).not.toContain('sci-fi')
  })

  it('rejects invalid like/bookmark payload and preserves previous state', async () => {
    const { getCurrent } = await renderAppContext()

    await act(async () => {
      await getCurrent().toggleLike('1')
      await getCurrent().toggleBookmark('1')
    })

    const likesSnapshot = { ...getCurrent().likes }
    const bookmarksSnapshot = [...getCurrent().bookmarks]

    await expect(getCurrent().toggleLike('')).resolves.toBe(false)
    await expect(getCurrent().toggleBookmark('')).resolves.toBe(false)

    expect(getCurrent().likes).toEqual(likesSnapshot)
    expect(getCurrent().bookmarks).toEqual(bookmarksSnapshot)
  })
})
