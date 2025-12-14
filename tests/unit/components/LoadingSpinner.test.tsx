import { render, screen } from '@testing-library/react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

describe('LoadingSpinner', () => {
  it('should render a spinner', () => {
    render(<LoadingSpinner />);
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('should render with different sizes', () => {
    const { rerender } = render(<LoadingSpinner size="sm" />);
    let spinner = document.querySelector('.animate-spin');
    expect(spinner).toHaveClass('h-4', 'w-4');

    rerender(<LoadingSpinner size="md" />);
    spinner = document.querySelector('.animate-spin');
    expect(spinner).toHaveClass('h-8', 'w-8');

    rerender(<LoadingSpinner size="lg" />);
    spinner = document.querySelector('.animate-spin');
    expect(spinner).toHaveClass('h-12', 'w-12');
  });

  it('should render fullscreen when specified', () => {
    render(<LoadingSpinner fullScreen />);
    const loadingText = screen.getByText('Loading...');
    expect(loadingText).toBeInTheDocument();

    const fullscreenContainer = document.querySelector('.fixed.inset-0');
    expect(fullscreenContainer).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(<LoadingSpinner className="custom-class" />);
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toHaveClass('custom-class');
  });
});