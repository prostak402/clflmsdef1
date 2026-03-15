import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixtureVideoPath = path.join(__dirname, 'fixtures', 'sample-video.mp4')
const fixturePosterPath = path.join(__dirname, 'fixtures', 'sample-poster.jpg')
const runId = Date.now().toString(36)
const createdClipTitle = `Playwright local clip ${runId}`
const updatedClipTitle = `Playwright local clip updated ${runId}`
const userCommentText = `Playwright comment ${runId}`

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function openNav(page, label) {
  const pattern = new RegExp(`^${escapeRegExp(label)}$`, 'i')
  const sideNav = page.locator('.sidenav')

  if (await sideNav.isVisible().catch(() => false)) {
    await sideNav.getByRole('button', { name: pattern }).click()
    return
  }

  await page.getByRole('button', { name: pattern }).first().click()
}

async function signInAs(page, role) {
  await page.goto('/')

  if (role === 'admin') {
    await page.getByRole('button', { name: /Admin Demo/i }).click()
  } else {
    await page.getByRole('button', { name: /Demo Account/i }).click()
  }
}

async function completeOnboarding(page, genres = []) {
  await expect(page).toHaveURL(/\/genres$/)

  for (const genre of genres) {
    await page.getByRole('button', { name: new RegExp(`^${escapeRegExp(genre)}$`, 'i') }).click()
  }

  await page.getByRole('button', { name: /Explore clips/i }).click()
  await expect(page).toHaveURL(/\/feed$/)
  await expect(page.getByRole('button', { name: /Watch /i }).first()).toBeVisible()
}

async function logout(page) {
  await openNav(page, 'Profile')
  await expect(page).toHaveURL(/\/profile$/)
  await page.getByRole('button', { name: /Sign Out/i }).click()
  await expect(page).toHaveURL(/\/$/)
}

test.beforeEach(async ({ page }) => {
  page.on('dialog', async (dialog) => {
    await dialog.accept()
  })
})

test('supports onboarding without required genres, explicit logout, and session-expired redirect', async ({
  page,
}) => {
  await signInAs(page, 'user')
  await completeOnboarding(page)

  await logout(page)
  await expect(page.getByText('Session expired. Please sign in again.')).toHaveCount(0)

  await signInAs(page, 'user')
  await completeOnboarding(page)

  await page.evaluate(() => {
    const raw = window.localStorage.getItem('auth_session_v1')
    if (!raw) {
      throw new Error('Missing auth session in localStorage')
    }

    const session = JSON.parse(raw)
    session.expiresAt = new Date(Date.now() - 60_000).toISOString()
    session.refreshToken = 'expired-refresh-token'
    window.localStorage.setItem('auth_session_v1', JSON.stringify(session))
  })

  await page.reload()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByText('Session expired. Please sign in again.')).toBeVisible()
})

test.describe('admin and user browser flow', () => {
  test.describe.configure({ mode: 'serial' })

  test('admin can upload and edit a multi-genre clip, and user can engage with it in the feed', async ({
    page,
  }) => {
    await signInAs(page, 'admin')
    await completeOnboarding(page)

    await openNav(page, 'Admin')
    await expect(page).toHaveURL(/\/admin$/)

    await page.getByTestId('admin-add-clip').click()
    await expect(page.getByTestId('admin-clip-form')).toBeVisible()

    await page.getByPlaceholder('Enter movie title').fill(createdClipTitle)
    await page.getByPlaceholder('2h 30m').fill('1h 42m')
    await page.getByPlaceholder('8.5').fill('9.1')
    await page
      .getByPlaceholder('Full movie description...')
      .fill('Created by Playwright hardening flow.')
    await page
      .getByPlaceholder('Short clip description...')
      .fill('Browser-tested upload flow clip.')
    await page
      .getByPlaceholder('https://example.com/watch')
      .fill(`https://example.com/watch/${runId}`)
    await page.getByRole('button', { name: /^Drama$/i }).click()
    await page.getByRole('button', { name: /^Thriller$/i }).click()
    await page.getByTestId('admin-video-file').setInputFiles(fixtureVideoPath)
    await page.getByTestId('admin-poster-file').setInputFiles(fixturePosterPath)
    await page.getByTestId('admin-submit-clip').click()

    await expect(page.getByText('Clip uploaded successfully!')).toBeVisible()
    const createdRow = page.locator('.admin-upload-item', { hasText: createdClipTitle })
    await expect(createdRow).toBeVisible()

    await createdRow.getByRole('button', { name: /Edit/i }).click()
    await expect(page.getByTestId('admin-clip-form')).toBeVisible()
    await expect(page.getByRole('button', { name: /^Drama$/i })).toHaveClass(/active/)
    await expect(page.getByRole('button', { name: /^Thriller$/i })).toHaveClass(/active/)

    await page.getByPlaceholder('Enter movie title').fill(updatedClipTitle)
    await page.getByPlaceholder('8.5').fill('9.4')
    await page.getByRole('button', { name: /^Comedy$/i }).click()
    await page.getByTestId('admin-submit-clip').click()

    await expect(page.getByText('Clip updated successfully!')).toBeVisible()
    await expect(page.locator('.admin-upload-item', { hasText: updatedClipTitle })).toBeVisible()

    await logout(page)

    await signInAs(page, 'user')
    await completeOnboarding(page, ['Thriller'])

    await expect(page.getByText(updatedClipTitle)).toBeVisible()
    await expect(page.locator('.clip-top-bar .clip-badge').getByText('9.4')).toBeVisible()

    const likeButton = page.getByRole('button', {
      name: new RegExp(`Like ${escapeRegExp(updatedClipTitle)}`, 'i'),
    })
    await likeButton.click()
    await expect(likeButton).toHaveClass(/liked/)

    const bookmarkButton = page.getByRole('button', {
      name: new RegExp(`Save ${escapeRegExp(updatedClipTitle)}`, 'i'),
    })
    await bookmarkButton.click()
    await expect(
      page.getByRole('button', {
        name: new RegExp(`Remove ${escapeRegExp(updatedClipTitle)} from saved`, 'i'),
      })
    ).toBeVisible()

    await page
      .getByRole('button', {
        name: new RegExp(`Comments for ${escapeRegExp(updatedClipTitle)}`, 'i'),
      })
      .click()

    await expect(page.getByTestId('comments-panel')).toBeVisible()
    await page.getByTestId('comment-input').fill(userCommentText)
    await page.getByTestId('comments-send').click()

    const commentRow = page.locator('.comment-item', { hasText: userCommentText }).first()
    await expect(commentRow).toBeVisible()

    const commentLikeButton = commentRow.getByRole('button', { name: /Like comment by Demo User/i })
    await commentLikeButton.click()
    await expect(commentRow.locator('.comment-like span')).toHaveText('1')
    await commentRow.getByRole('button', { name: /Unlike comment by Demo User/i }).click()
    await expect(commentRow.locator('.comment-like span')).toHaveText('0')

    await page.getByTestId('comments-close').click()
    await openNav(page, 'Saved')
    await expect(page.getByRole('heading', { name: /^Saved Movies$/i })).toBeVisible()
    await expect(page.getByText(updatedClipTitle)).toBeVisible()

    await openNav(page, 'Profile')
    await expect(page).toHaveURL(/\/profile$/)
    await page.getByRole('checkbox', { name: /^Notifications$/i }).uncheck()
    await page.getByRole('checkbox', { name: /^Autoplay$/i }).uncheck()
    await page.getByRole('textbox', { name: /^Preferred language$/i }).fill('ru')
    await page.getByRole('button', { name: /Save preferences/i }).click()
    await expect(page.getByText('Preferences saved.')).toBeVisible()

    await logout(page)
    await signInAs(page, 'user')
    await completeOnboarding(page, ['Thriller'])
    await openNav(page, 'Profile')
    await expect(page.getByRole('checkbox', { name: /^Notifications$/i })).not.toBeChecked()
    await expect(page.getByRole('checkbox', { name: /^Autoplay$/i })).not.toBeChecked()
    await expect(page.getByRole('textbox', { name: /^Preferred language$/i })).toHaveValue('ru')
  })

  test('admin can moderate the new comment and blocked user can no longer comment', async ({
    page,
  }) => {
    await signInAs(page, 'admin')
    await completeOnboarding(page)

    await openNav(page, 'Comments Mod')
    await expect(page).toHaveURL(/\/admin\/comments$/)

    const moderationRow = page.locator('tr', { hasText: userCommentText }).first()
    await expect(moderationRow).toBeVisible()
    await expect(moderationRow).toContainText(updatedClipTitle)

    await moderationRow.getByRole('button', { name: /^Block author$/i }).click()
    await expect(page.getByText('Author has been blocked.')).toBeVisible()
    await expect(moderationRow.getByText('Blocked')).toBeVisible()

    await moderationRow.getByRole('button', { name: /^Delete all$/i }).click()
    await expect(page.getByText('All author comments deleted.')).toBeVisible()

    await logout(page)

    await signInAs(page, 'user')
    await completeOnboarding(page, ['Thriller'])

    await expect(page.getByText(updatedClipTitle)).toBeVisible()
    await page
      .getByRole('button', {
        name: new RegExp(`Comments for ${escapeRegExp(updatedClipTitle)}`, 'i'),
      })
      .click()

    await expect(page.getByTestId('comments-panel')).toBeVisible()
    await expect(page.getByTestId('comment-input')).toBeDisabled()
    await expect(page.getByTestId('comments-send')).toBeDisabled()
    await expect(page.getByText('Commenting is disabled for this account.')).toBeVisible()
  })
})
