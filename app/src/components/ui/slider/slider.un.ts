import type { VariantProps } from 'class-variance-authority'
import { cva } from 'class-variance-authority'

export const sliderVariants = cva(
  [
    'w-full appearance-none bg-transparent',
    'cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
    'focus-visible:outline-none',
  ].join(' '),
  {
    variants: {
      size: {
        sm: 'h-4',
        md: 'h-5',
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

export type SliderVariants = VariantProps<typeof sliderVariants>
