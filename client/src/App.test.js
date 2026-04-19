import { render, screen } from '@testing-library/react';
import App from './App';

test('renders primary navigation headings', () => {
  render(<App />);
  expect(screen.getByText(/dashboard/i)).toBeInTheDocument();
  expect(screen.getByText(/transaction history/i)).toBeInTheDocument();
  expect(screen.getByText(/budget/i)).toBeInTheDocument();
  expect(screen.getByText(/goals/i)).toBeInTheDocument();
});
