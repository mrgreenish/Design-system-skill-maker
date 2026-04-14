import type { Preview } from "@storybook/react";
import "../src/styles/tokens.css";

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
    designToken: {
      defaultTab: "Colors",
    },
  },
};

export default preview;
