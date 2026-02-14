import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export const selectTriggerVariants = cva(
  [
    'inline-flex w-full items-center justify-between gap-2 rounded-md border',
    'bg-background text-left font-medium text-foreground shadow-sm',
    'transition-colors duration-150',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35',
    'data-[state=open]:border-border-emphasis',
    'disabled:cursor-not-allowed disabled:opacity-50',
  ].join(' '),
  {
    variants: {
      size: {
        xs: 'h-7 px-2 text-xs',
        sm: 'h-8 px-2.5 text-xs',
        md: 'h-9 px-3 text-sm',
      },
      tone: {
        default: 'border-border/70 hover:border-border-emphasis',
        subtle: 'border-border/60 bg-background/70 text-foreground-muted hover:text-foreground hover:border-border-emphasis',
      },
    },
    defaultVariants: {
      size: 'md',
      tone: 'default',
    },
  },
)

export const selectContentVariants = cva(
  [
    'z-50 min-w-[10rem] overflow-hidden rounded-md border shadow-lg',
    'animate-in fade-in-0 zoom-in-95',
    'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
    'data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1',
  ].join(' '),
  {
    variants: {
      tone: {
        default: 'border-border bg-popover text-popover-foreground',
        subtle: 'border-border/70 bg-background-overlay text-foreground',
      },
    },
    defaultVariants: {
      tone: 'default',
    },
  },
)

export const selectViewportVariants = cva('p-1', {
  variants: {
    size: {
      xs: 'text-xs',
      sm: 'text-xs',
      md: 'text-sm',
    },
  },
  defaultVariants: {
    size: 'md',
  },
})

export const selectItemVariants = cva(
  [
    'relative flex w-full cursor-default select-none items-center rounded-sm',
    'py-1.5 pl-2.5 pr-7 text-foreground outline-none',
    'transition-colors duration-100',
    'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground',
    'data-[disabled]:pointer-events-none data-[disabled]:opacity-45',
  ].join(' '),
  {
    variants: {
      size: {
        xs: 'text-xs py-1 pl-2 pr-6',
        sm: 'text-xs',
        md: 'text-sm',
      },
      tone: {
        default: '',
        subtle: '',
      },
    },
    defaultVariants: {
      size: 'md',
      tone: 'default',
    },
  },
)

export type SelectTriggerVariants = VariantProps<typeof selectTriggerVariants>
