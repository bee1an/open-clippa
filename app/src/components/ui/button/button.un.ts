import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export const buttonVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 whitespace-nowrap',
    'rounded-md text-sm font-medium select-none',
    'ring-offset-background',
    'transition-all duration-150 ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    'active:scale-[0.98]',
  ].join(' '),
  {
    variants: {
      variant: {
        default: [
          'bg-primary text-primary-foreground',
          'hover:bg-primary-hover hover:shadow-md',
          'active:bg-primary',
        ].join(' '),
        destructive: [
          'bg-destructive text-destructive-foreground',
          'hover:bg-destructive-hover hover:shadow-md',
          'active:bg-destructive',
        ].join(' '),
        outline: [
          'border border-border bg-transparent text-foreground',
          'hover:bg-accent hover:border-border-emphasis hover:text-accent-foreground',
          'active:bg-accent/80',
        ].join(' '),
        secondary: [
          'bg-secondary text-secondary-foreground',
          'hover:bg-secondary-hover hover:shadow-sm',
          'active:bg-secondary',
        ].join(' '),
        ghost: [
          'text-foreground-muted',
          'hover:bg-accent hover:text-foreground',
          'active:bg-accent/80',
        ].join(' '),
        link: [
          'text-primary underline-offset-4',
          'hover:underline hover:text-primary-hover',
        ].join(' '),
        glow: [
          'bg-primary text-primary-foreground',
          'hover:bg-primary-hover hover:shadow-glow',
          'active:bg-primary',
        ].join(' '),
      },
      size: {
        'default': 'h-10 px-4 py-2',
        'xs': 'h-7 rounded px-2 text-xs',
        'sm': 'h-8 rounded-md px-3 text-xs',
        'lg': 'h-11 rounded-md px-6 text-base',
        'xl': 'h-12 rounded-lg px-8 text-base',
        'icon': 'h-10 w-10 rounded-lg',
        'icon-sm': 'h-8 w-8 rounded-md',
        'icon-xs': 'h-7 w-7 rounded-md',
        'icon-lg': 'h-12 w-12 rounded-lg',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export type ButtonVariants = VariantProps<typeof buttonVariants>
