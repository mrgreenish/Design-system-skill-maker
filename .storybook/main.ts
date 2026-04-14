import type { StorybookConfig } from "@storybook/react-vite";

/**
 * Storybook config. The `storybook-design-token` addon parses the CSS vars
 * emitted by scripts/tokens-to-tailwind.ts (src/styles/tokens.css) and
 * renders swatch / typography / spacing galleries from a small amount of
 * metadata embedded as CSS comments in the stories below.
 *
 * Install deps (on first use, via the figma-to-code-design-system skill):
 *   npm i -D storybook @storybook/react-vite @storybook/addon-essentials \
 *            storybook-design-token react react-dom vite @vitejs/plugin-react
 */
const config: StorybookConfig = {
  stories: ["./stories/**/*.mdx", "./stories/**/*.stories.@(ts|tsx)"],
  addons: [
    "@storybook/addon-essentials",
    {
      name: "storybook-design-token",
      options: {
        glob: "src/styles/tokens.css",
      },
    },
  ],
  framework: { name: "@storybook/react-vite", options: {} },
};

export default config;
