// Demo builds stage their content apart, so public/json (and the dev server) keep the full game.
export const CONTENT_OUT_DIR = process.argv.includes('--demo')
  ? './.demo/json'
  : './public/json';
