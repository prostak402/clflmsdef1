import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import App from '../App';

async function loginAndOpenFeed(user) {
  render(<App />);

  await user.click(screen.getByRole('button', { name: /demo account/i }));

  const genreButtons = document.querySelectorAll('.genre-chip');
  await user.click(genreButtons[0]);
  await user.click(genreButtons[1]);
  await user.click(genreButtons[2]);
  await user.click(document.querySelector('.genre-continue'));

  expect((await screen.findAllByText(/Watch Full Movie/i)).length).toBeGreaterThan(0);
}

describe('TASK-013: key business flow integration', () => {
  beforeEach(() => {
    window.history.replaceState({}, '', '/');
  });

  it('covers happy path: login → genre pick → feed interactions → bookmarks', async () => {
    const user = userEvent.setup();
    await loginAndOpenFeed(user);

    const actionButtons = document.querySelectorAll('.clip-actions .clip-action-btn');
    const likeButton = actionButtons[0];
    const commentsButton = actionButtons[1];
    const bookmarkButton = actionButtons[2];

    await user.click(likeButton);
    expect(likeButton.className).toContain('liked');

    await user.click(commentsButton);
    const commentInput = await screen.findByPlaceholderText(/add a comment/i);
    await user.type(commentInput, 'Интеграционный happy path комментарий');
    await user.click(document.querySelector('.comments-send'));
    expect(await screen.findByText('Интеграционный happy path комментарий')).toBeInTheDocument();

    await user.click(bookmarkButton);
    expect(bookmarkButton.className).toContain('bookmarked');

    await user.click(screen.getAllByRole('button', { name: /saved/i })[0]);
    expect(await screen.findByRole('heading', { name: /^Saved Movies$/i })).toBeInTheDocument();
    expect(await screen.findByText(/1 movie saved/i)).toBeInTheDocument();
  });

  it('covers error path: invalid empty comment is rejected without leaving feed', async () => {
    const user = userEvent.setup();
    await loginAndOpenFeed(user);

    const actionButtons = document.querySelectorAll('.clip-actions .clip-action-btn');
    await user.click(actionButtons[1]);

    const commentInput = await screen.findByPlaceholderText(/add a comment/i);
    await user.type(commentInput, '     ');
    await user.click(document.querySelector('.comments-send'));

    expect(await screen.findByText(/comment cannot be empty/i)).toBeInTheDocument();
    expect(window.location.pathname).toBe('/feed');
  });
});
