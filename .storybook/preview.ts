import type { Preview } from '@storybook/react-vite'
import { withThemeByClassName } from '@storybook/addon-themes'
import { initialize, mswLoader } from 'msw-storybook-addon'
import '../src/styles/index.css'

// Initialize MSW
initialize()

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
       color: /(background|color)$/i,
       date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo',
      config: {
        rules: [
          {
            // Disable color-contrast checks for now as we use custom theme colors
            id: 'color-contrast',
            enabled: false,
          },
        ],
      },
    },

    backgrounds: {
      default: 'light',
      values: [
        {
          name: 'light',
          value: '#FAF5EE',
        },
        {
          name: 'dark',
          value: '#1a1a1a',
        },
        {
          name: 'white',
          value: '#ffffff',
        },
      ],
    },

    viewport: {
      viewports: {
        mobile: {
          name: 'Mobile (375px)',
          styles: { width: '375px', height: '812px' },
        },
        tablet: {
          name: 'Tablet (768px)',
          styles: { width: '768px', height: '1024px' },
        },
        desktop: {
          name: 'Desktop (1440px)',
          styles: { width: '1440px', height: '900px' },
        },
      },
    },

    layout: 'centered',
  },

  loaders: [mswLoader],

  decorators: [
    withThemeByClassName({
      themes: {
        light: '',
        dark: 'dark',
      },
      defaultTheme: 'light',
    }),
  ],
};

export default preview;
