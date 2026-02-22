import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';

const STORAGE_KEY = 'app_state_v1';
const LEGACY_STORAGE_KEY = 'clipflow.app-state';

async function completeAuthAndOnboarding(user) {
  await user.click(screen.getByRole('button', { name: /demo account/i }));

  const genreButtons = document.querySelectorAll('.genre-chip');
  await user.click(genreButtons[0]);
  await user.click(genreButtons[1]);
  await user.click(genreButtons[2]);

  await user.click(document.querySelector('.genre-continue'));
  expect((await screen.findAllByText(/Watch Full Movie/i)).length).toBeGreaterThan(0);
}

describe('TASK-007: localStorage state persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('persists and restores session, genres, likes and bookmarks after reload', async () => {
    const user = userEvent.setup();
    const firstRender = render(<App />);

    await completeAuthAndOnboarding(user);

    const actionButtons = document.querySelectorAll('.clip-actions .clip-action-btn');
    await user.click(actionButtons[0]);
    await user.click(actionButtons[2]);

    const persisted = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    expect(persisted.version).toBe(1);
    expect(persisted.state.user?.email).toBe('demo@clipflow.com');
    expect(persisted.state.hasCompletedOnboarding).toBe(true);
    expect(persisted.state.selectedGenres.length).toBeGreaterThanOrEqual(3);
    expect(persisted.state.likes['1']).toBe(true);
    expect(persisted.state.bookmarks).toContain('1');
    expect(persisted.state.draftPreferences).toEqual(expect.objectContaining({ preferredLanguage: 'en' }));

    firstRender.unmount();

    render(<App />);

    expect((await screen.findAllByText(/Watch Full Movie/i)).length).toBeGreaterThan(0);

    const reloadedActionButtons = document.querySelectorAll('.clip-actions .clip-action-btn');
    expect(reloadedActionButtons[0].className).toContain('liked');
    expect(reloadedActionButtons[2].className).toContain('bookmarked');
  });


  it('migrates legacy unversioned state and rewrites it under versioned key', async () => {
    window.localStorage.setItem(
      LEGACY_STORAGE_KEY,
      JSON.stringify({
        user: { name: 'Demo User', email: 'demo@clipflow.com' },
        hasCompletedOnboarding: true,
        selectedGenres: ['action', 'drama', 'comedy'],
        bookmarks: ['1'],
        likes: { '1': true },
        draftPreferences: { preferredLanguage: 'ru' },
      })
    );

    render(<App />);

    expect((await screen.findAllByText(/Watch Full Movie/i)).length).toBeGreaterThan(0);

    const persisted = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    expect(persisted.version).toBe(1);
    expect(persisted.state.likes['1']).toBe(true);
    expect(persisted.state.bookmarks).toContain('1');
    expect(window.localStorage.getItem(LEGACY_STORAGE_KEY)).toBeNull();
  });

  it('hydrates draft preferences from localStorage payload', async () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 1,
        state: {
          user: { name: 'Demo User', email: 'demo@clipflow.com' },
          hasCompletedOnboarding: true,
          selectedGenres: ['action', 'drama', 'comedy'],
          bookmarks: [],
          likes: {},
          draftPreferences: {
            notificationsEnabled: false,
            autoplayEnabled: false,
            preferredLanguage: 'ru',
          },
        },
      })
    );

    render(<App />);

    expect((await screen.findAllByText(/Watch Full Movie/i)).length).toBeGreaterThan(0);

    const persisted = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    expect(persisted.state.draftPreferences).toEqual({
      notificationsEnabled: false,
      autoplayEnabled: false,
      preferredLanguage: 'ru',
    });
  });
});
