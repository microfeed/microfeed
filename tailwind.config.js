const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  content: [
    "./client-src/**/*.{js,jsx}",
    "./public/*.html",
    "./edge-src/**/*.jsx"
  ],
  darkMode: 'class', // or 'media' or 'class'
  theme: {
    screens: {
      xs: '375px',
      ...defaultTheme.screens,
    },
    lineHeight: {
      none: '1',
      tight: '1.25',
      snug: '1.5',
      normal: '1.625',
      relaxed: '2',
      loose: '.75rem',
      3: '1rem',
      4: '1.25rem',
      5: '1.5rem',
      6: '1.75rem',
      7: '2rem',
      8: '2.25rem',
      9: '2.5rem',
      10: '2.75rem',
    },
    fontFamily: {
      sans: [
        '-apple-system',
        'BlinkMacSystemFont',
        'Segoe UI',
        'Roboto',
        'Helvetica Neue',
        'Arial',
        'Noto Sans',
        'sans-serif',
        'Apple Color Emoji',
        'Segoe UI Emoji',
        'Segoe UI Symbol',
        'Noto Color Emoji',
      ],
    },
    extend: {
      colors: {
        brand: {
          light: '#19B7FA',
          dark: '#2C2B3D',
        },
        'muted-color': '#8E8E8E',
        'title-color': 'rgba(0, 0, 0, 0.95)',
        'body-color': 'rgba(0, 0, 0, 0.80)',
        'helper-color': 'rgba(0, 0, 0, 0.60)',
        'bggray-color': 'rgba(0, 0, 0, 0.03)',
        'bdgray-color': 'rgba(0, 0, 0, 0.10)',
        'bgsecondary-color': 'rgba(0, 0, 0, 0.05)',
        'fgsecondary-color': 'rgba(0, 0, 0, 0.95)',
        'white-overlap': 'rgba(255, 255, 255, 0.90)',
        'warning-color': '#a88c0b',
        'dark-deep': 'rgba(230,230,230)',
        'dark-light': 'rgba(240, 240, 240)',
      },

      width: {
        88: '22rem',
        'avatar-xs': '1.2rem',
        'avatar-sm': '1.8rem',
        'avatar-md': '3rem',
        'avatar-lg': '6rem',
        'pod-img-sm': '3rem',
        'pod-img-md': '4.8rem',
        'pod-img-lg': '6rem',
        'ad-image': '8rem',
      },

      height: {
        'avatar-xs': '1.2rem',
        'avatar-sm': '1.8rem',
        'avatar-lg': '6rem',
        'footer-share-bar': '3.15rem',
        'pod-img-sm': '3rem',
        'pod-img-md': '4.8rem',
        'pod-img-lg': '6rem',
      },

      maxHeight: {
        112: '28rem',
        128: '32rem',
      },

      minHeight: {
        16: '4rem',
        32: '8rem',
        64: '16rem',
        128: '32rem',
      },

      minWidth: {
        table: '48rem',
        24: '6rem',
      },

      maxWidth: {
        xxs: '12rem',
        '5/6': '83.3%',
        '4/5': '80%',
      },
      fontSize: {
        xxs: ['0.525rem', { lineHeight: '1rem' }],
        // xs: ['0.625rem', { lineHeight: '1rem' }],
        // sm: ['0.75rem', { lineHeight: '1rem' }],
        // base: ['0.875rem', { lineHeight: '1.25rem' }],
        // lg: ['1rem', { lineHeight: '1.5rem' }],
        // xl: ['1.125rem', { lineHeight: '1.75rem' }],
        // '2xl': ['1.25rem', { lineHeight: '1.75rem' }],
        // '3xl': ['1.5rem', { lineHeight: '2rem' }],
        // '4xl': ['1.875rem', { lineHeight: '2.25rem' }],
        // '5xl': ['2.25rem', { lineHeight: '2.5rem' }],
        // '6xl': ['3rem', { lineHeight: '1' }],
        // '7xl': ['3.75rem', { lineHeight: '1' }],
        // '8xl': ['4.5rem', { lineHeight: '1' }],
        // '9xl': ['6rem', { lineHeight: '1' }],
      },
      rotate: {
        30: '30deg',
      },
      zIndex: {
        45: '45',
      },
    },
  },
  plugins: [
    require('@tailwindcss/line-clamp'),
    require('@tailwindcss/forms'),
  ],
}
