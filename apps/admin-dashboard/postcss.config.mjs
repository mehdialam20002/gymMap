/**
 * PostCSS — A-03. Tailwind and autoprefixer, nothing else.
 *
 * `tailwindcss/nesting` is deliberately absent: nesting in application CSS is how a token-driven
 * system grows a second, invisible cascade. The only hand-written CSS in this app is
 * `globals.css`, and it is flat.
 */
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
