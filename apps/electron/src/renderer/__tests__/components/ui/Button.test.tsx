import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Button } from '../../../components/ui/Button';

describe('Button', () => {
  afterEach(() => {
    cleanup();
  });

  it('should render with default variant', () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole('button', { name: 'Click me' });
    expect(button).toBeDefined();
  });

  it('should render with destructive variant', () => {
    render(<Button variant="destructive">Delete</Button>);
    const button = screen.getByRole('button', { name: 'Delete' });
    expect(button.className).toContain('bg-destructive');
  });

  it('should render with outline variant', () => {
    render(<Button variant="outline">Cancel</Button>);
    const button = screen.getByRole('button', { name: 'Cancel' });
    expect(button.className).toContain('border');
  });

  it('should render with different sizes', () => {
    const { container } = render(<Button size="sm">Small</Button>);
    let button = container.querySelector('button');
    expect(button?.className).toContain('h-9');

    cleanup();
    const { container: container2 } = render(<Button size="lg">Large</Button>);
    button = container2.querySelector('button');
    expect(button?.className).toContain('h-11');

    cleanup();
    const { container: container3 } = render(<Button size="icon">Icon</Button>);
    button = container3.querySelector('button');
    expect(button?.className).toContain('w-10');
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByRole('button', { name: 'Disabled' });
    expect(button.disabled).toBe(true);
  });

  it('should forward ref correctly', () => {
    const ref = { current: null as HTMLButtonElement | null };
    render(
      <Button
        ref={(el) => {
          ref.current = el;
        }}
      >
        With Ref
      </Button>
    );
    expect(ref.current).not.toBeNull();
    expect(ref.current?.tagName).toBe('BUTTON');
  });
});
