import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetWind4,
  transformerDirectives,
} from 'unocss'
import presetAnimations from 'unocss-preset-animations'

export default defineConfig({
  content: {
    pipeline: {
      include: [
        /\.vue$/,
        /\.un.ts$/,
      ],
    },
  },

  presets: [
    presetWind4(),
    presetAttributify(),
    presetIcons({
      scale: 1.2,
      warn: true,
    }),
    presetAnimations(),
  ],

  transformers: [
    transformerDirectives(),
  ],

  theme: {
    fontFamily: {
      sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', 'Courier New', 'monospace'],
    },
    colors: {
      border: {
        DEFAULT: 'hsl(var(--border))',
        subtle: 'hsl(var(--border-subtle))',
        emphasis: 'hsl(var(--border-emphasis))',
      },
      input: {
        DEFAULT: 'hsl(var(--input))',
        focus: 'hsl(var(--input-focus))',
      },
      ring: 'hsl(var(--ring))',
      background: {
        DEFAULT: 'hsl(var(--background))',
        elevated: 'hsl(var(--background-elevated))',
        overlay: 'hsl(var(--background-overlay))',
      },
      foreground: {
        DEFAULT: 'hsl(var(--foreground))',
        muted: 'hsl(var(--foreground-muted))',
        subtle: 'hsl(var(--foreground-subtle))',
      },
      primary: {
        DEFAULT: 'hsl(var(--primary))',
        foreground: 'hsl(var(--primary-foreground))',
        hover: 'hsl(var(--primary-hover))',
        glow: 'hsl(var(--primary-glow))',
      },
      secondary: {
        DEFAULT: 'hsl(var(--secondary))',
        foreground: 'hsl(var(--secondary-foreground))',
        hover: 'hsl(var(--secondary-hover))',
      },
      destructive: {
        DEFAULT: 'hsl(var(--destructive))',
        foreground: 'hsl(var(--destructive-foreground))',
        hover: 'hsl(var(--destructive-hover))',
      },
      success: {
        DEFAULT: 'hsl(var(--success))',
        foreground: 'hsl(var(--success-foreground))',
      },
      warning: {
        DEFAULT: 'hsl(var(--warning))',
        foreground: 'hsl(var(--warning-foreground))',
      },
      muted: {
        DEFAULT: 'hsl(var(--muted))',
        foreground: 'hsl(var(--muted-foreground))',
      },
      accent: {
        DEFAULT: 'hsl(var(--accent))',
        foreground: 'hsl(var(--accent-foreground))',
        hover: 'hsl(var(--accent-hover))',
      },
      popover: {
        DEFAULT: 'hsl(var(--popover))',
        foreground: 'hsl(var(--popover-foreground))',
      },
      card: {
        DEFAULT: 'hsl(var(--card))',
        foreground: 'hsl(var(--card-foreground))',
      },
    },
    borderRadius: {
      'xs': 'var(--radius-xs)',
      'sm': 'var(--radius-sm)',
      'DEFAULT': 'var(--radius)',
      'md': 'var(--radius)',
      'lg': 'var(--radius-lg)',
      'xl': 'var(--radius-xl)',
      '2xl': 'var(--radius-2xl)',
    },
    boxShadow: {
      xs: 'var(--shadow-xs)',
      sm: 'var(--shadow-sm)',
      DEFAULT: 'var(--shadow-md)',
      md: 'var(--shadow-md)',
      lg: 'var(--shadow-lg)',
      xl: 'var(--shadow-xl)',
      glow: 'var(--shadow-glow)',
      inner: 'var(--shadow-inner)',
    },
    animation: {
      durations: {
        fast: 'var(--duration-fast)',
        normal: 'var(--duration-normal)',
        slow: 'var(--duration-slow)',
        slower: 'var(--duration-slower)',
      },
    },
  },

  shortcuts: [
    // 布局
    ['center', 'flex items-center justify-center'],
    ['between', 'flex items-center justify-between'],
    ['col-center', 'flex flex-col items-center justify-center'],

    // 面板与容器
    ['panel', 'bg-background-elevated border border-border-subtle rounded-lg'],
    ['panel-elevated', 'bg-background-overlay border border-border rounded-lg shadow-lg'],

    // 交互基础
    ['interactive', 'transition-all duration-150 ease-out cursor-pointer'],
    ['btn-base', 'interactive inline-flex items-center justify-center whitespace-nowrap font-medium select-none'],

    // 焦点环
    ['focus-ring', 'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'],

    // 文字层级
    ['text-muted', 'text-foreground-muted'],
    ['text-subtle', 'text-foreground-subtle'],

    // 编辑器布局
    ['editor-sider', 'bg-background-elevated border-border-subtle h-full overflow-hidden'],
    ['editor-header', 'h-14 bg-background-elevated border-b border-border-subtle flex items-center px-4 shadow-sm'],
    ['editor-toolbar', 'h-10 bg-background-elevated border-b border-border-subtle flex items-center px-3 gap-1'],

    // 图标按钮
    ['icon-btn', 'interactive center rounded-md text-foreground-muted hover:text-foreground hover:bg-accent'],
    ['icon-btn-sm', 'icon-btn w-8 h-8'],
    ['icon-btn-md', 'icon-btn w-10 h-10'],

    // 分隔线
    ['divider-h', 'h-px bg-border-subtle w-full'],
    ['divider-v', 'w-px bg-border-subtle h-full'],

    // 玻璃态
    ['glass', 'bg-background-elevated/80 backdrop-blur-xl'],
  ],
})
