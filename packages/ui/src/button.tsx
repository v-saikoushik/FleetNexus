import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

export type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'ghost';
  }
>;

/**
 * Minimal shared button primitive.
 * Expand into a full design system in a later phase.
 */
export function Button({ children, variant = 'primary', type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} data-variant={variant} {...rest}>
      {children}
    </button>
  );
}
