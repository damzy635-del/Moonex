import type { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
type ButtonSize = 'default' | 'sm' | 'lg' | 'icon';

const variants: Record<ButtonVariant, string> = {
  default: 'bg-violet-300 text-violet-950 hover:bg-violet-200',
  destructive: 'bg-red-500 text-white hover:bg-red-600',
  outline: 'border border-white/15 bg-transparent hover:bg-white/5',
  secondary: 'bg-white/10 text-current hover:bg-white/15',
  ghost: 'hover:bg-white/10',
  link: 'text-violet-300 underline-offset-4 hover:underline',
};
const sizes: Record<ButtonSize, string> = {
  default: 'h-10 px-4 py-2',
  sm: 'h-9 rounded-md px-3',
  lg: 'h-11 rounded-xl px-8',
  icon: 'h-10 w-10',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function Button({ className = '', variant = 'default', size = 'default', type = 'button', ...props }: ButtonProps) {
  return <button type={type} className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`} {...props} />;
}
