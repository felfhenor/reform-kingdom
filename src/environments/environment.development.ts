export const environment = {
  production: false,
  platform: 'web-dev',
  gameanalytics: {
    game: '19e144753faa9242f86e5a4c29b4c7b2',
    secret: '670bf61dfb6fe55dd1c21b3232e5d668bf332f7c',
  },
  rollbar: {
    accessToken:
      '6330079979a34716b98fea893a2e7c201030667728c8931ff12291e13808c46b46745d2500495192dc157174bab0bb3a',
    captureUncaught: true,
    captureUnhandledRejections: true,
    payload: {
      environment: 'test',
      client: {
        javascript: {
          code_version: '1.0',
          source_map_enabled: true,
          guess_uncaught_frames: true,
        },
      },
    },
  },
};
