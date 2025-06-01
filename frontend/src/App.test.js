import { render, screen } from '@testing-library/react';
import App from './App';

test('renders input field', () => {
  render(<App />);
  expect(screen.getByLabelText('AI prompt input')).toBeInTheDocument();
});

test('renders login button when not authenticated', () => {
  render(<App />);
  expect(screen.getByLabelText('Login with Microsoft')).toBeInTheDocument();
});

test('renders AI agent graphic', () => {
  render(<App />);
  expect(screen.getByLabelText(/AI status: waiting/i)).toBeInTheDocument();
});