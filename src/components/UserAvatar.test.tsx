import { describe, it, expect } from 'vitest';
import { render, screen } from '@/test/renderWithProviders';
import UserAvatar from '@/components/UserAvatar';

// initials() is not exported, so the derivation is asserted through the rendered fallback.
describe('<UserAvatar> initials fallback', () => {
  it('uses first + last initial for a multi-part name', async () => {
    render(<UserAvatar name="Ada Lovelace" />);
    expect(await screen.findByText('AL')).toBeInTheDocument();
  });

  it('uses the first two letters for a single-word name', async () => {
    render(<UserAvatar name="Ada" />);
    expect(await screen.findByText('AD')).toBeInTheDocument();
  });

  it('collapses extra whitespace before computing initials', async () => {
    render(<UserAvatar name="   Ada    Lovelace  " />);
    expect(await screen.findByText('AL')).toBeInTheDocument();
  });

  it('falls back to "?" for an empty name', async () => {
    render(<UserAvatar name="" />);
    expect(await screen.findByText('?')).toBeInTheDocument();
  });
});
