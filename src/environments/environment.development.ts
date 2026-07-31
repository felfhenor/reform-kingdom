export const environment = {
  production: false,
  platform: 'web-dev',
  gameanalytics: {
    game: '',
    secret: '',
  },
  rollbar: {
    accessToken: 'c2e6762edfaa47d1ac28de92f66b0529',
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
