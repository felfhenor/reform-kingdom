export const environment = {
  production: true,
  platform: 'demo',
  demo: true,
  modio: {
    url: 'https://g-14864.modapi.io/v1',
    gameId: 14864,
    apiKey: '901ec2e3536140fbcb6331b9f8d681d6',
  },
  gameanalytics: {
    game: '27cb0b261b9161eebf9022f5bf78b762',
    secret: '588d18b838a973db3ca996579b47f5d12266bf40',
  },
  rollbar: {
    accessToken:
      '6330079979a34716b98fea893a2e7c201030667728c8931ff12291e13808c46b46745d2500495192dc157174bab0bb3a',
    hostBlockList: ['netlify.app'],
    captureUncaught: true,
    captureUnhandledRejections: true,
    payload: {
      environment: 'demo',
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
