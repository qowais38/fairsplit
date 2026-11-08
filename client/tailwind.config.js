/** @type {import('tailwindcss').Config} */
export default { content: ['./index.html', './src/**/*.{js,jsx}'], theme: { extend: { colors: { ink: '#202b27', forest: '#24483b', lime: '#d9f06a', paper: '#f7f8f5', muted: '#78817b' }, fontFamily: { sans: ['Inter', 'ui-sans-serif', 'system-ui'] }, boxShadow: { soft: '0 12px 40px rgba(31,45,38,.07)' } } }, plugins: [] }
