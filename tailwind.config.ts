import type { Config } from "tailwindcss";

// BEGIN GENERATED — do not edit, managed by scripts/tokens-to-tailwind.ts
export const generatedTheme = {
  "colors": {
    "brand": {
      "primary": {
        "500": "var(--color-brand-primary-500)",
        "600": "var(--color-brand-primary-600)"
      }
    },
    "neutral": {
      "0": "var(--color-neutral-0)",
      "50": "var(--color-neutral-50)",
      "900": "var(--color-neutral-900)"
    },
    "semantic": {
      "bg": {
        "default": "var(--color-semantic-bg-default)"
      },
      "fg": {
        "default": "var(--color-semantic-fg-default)"
      },
      "accent": {
        "default": "var(--color-semantic-accent-default)"
      }
    }
  },
  "spacing": {
    "0": "var(--space-0)",
    "1": "var(--space-1)",
    "2": "var(--space-2)",
    "3": "var(--space-3)",
    "4": "var(--space-4)",
    "6": "var(--space-6)",
    "8": "var(--space-8)"
  },
  "borderRadius": {
    "sm": "var(--radius-sm)",
    "md": "var(--radius-md)",
    "lg": "var(--radius-lg)",
    "full": "var(--radius-full)"
  },
  "fontFamily": {
    "sans": [
      "var(--font-family-sans)"
    ]
  },
  "fontSize": {
    "sm": "var(--font-size-sm)",
    "md": "var(--font-size-md)",
    "lg": "var(--font-size-lg)",
    "xl": "var(--font-size-xl)"
  },
  "fontWeight": {
    "regular": "var(--font-weight-regular)",
    "medium": "var(--font-weight-medium)",
    "bold": "var(--font-weight-bold)"
  },
  "lineHeight": {
    "tight": "var(--font-lineHeight-tight)",
    "normal": "var(--font-lineHeight-normal)"
  },
  "boxShadow": {
    "sm": "var(--shadow-sm)",
    "md": "var(--shadow-md)"
  },
  "transitionDuration": {
    "fast": "var(--motion-duration-fast)",
    "normal": "var(--motion-duration-normal)"
  },
  "transitionTimingFunction": {
    "standard": "var(--motion-easing-standard)"
  }
};
// END GENERATED

const config: Config = {
  content: ["./src/**/*.{ts,tsx,html,mdx}", "./.storybook/**/*.{ts,tsx,mdx}"],
  theme: { extend: generatedTheme },
  plugins: [],
};

export default config;
