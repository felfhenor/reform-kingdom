export const environment = {
  production: true,
  platform: 'web',
  gameanalytics: {
    game: '',
    secret: '',
  },
  rollbar: {
    accessToken: 'c43dd56f173f48c4837648a054f32749b9a40619068e3ffa646b9abaf329f21e593c91c2f7f9a3db33550457717b9b08',
    hostBlockList: ['netlify.app'],
    captureUncaught: true,
    captureUnhandledRejections: true,
    payload: {
      environment: 'production',
      client: {
        javascript: {
          code_version: '1.0',
          source_map_enabled: true,
          guess_uncaught_frames: true,
        },
      },
    },
    recorder: {
      enabled: true,
    },
  },
};
