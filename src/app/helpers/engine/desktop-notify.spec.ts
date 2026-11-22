import { afterEach, describe, expect, it, vi } from 'vitest';

import { desktopNotify } from '@helpers/engine/desktop-notify';
import { defaultOptions, setOption } from '@helpers/state-options';
import type {
  DesktopNotification,
  WindowWithElectronWindowBridge,
} from '@interfaces';

const bridgeWindow = window as WindowWithElectronWindowBridge;
const raid: DesktopNotification = {
  category: 'Raids',
  title: 'Raid incoming',
  body: 'Thornwick is about to be raided.',
};

function bridgeSpy() {
  const windowNotify = vi.fn();
  bridgeWindow.reformElectron = { windowNotify };
  return windowNotify;
}

afterEach(() => {
  delete bridgeWindow.reformElectron;
  setOption('desktopNotifications', true);
  setOption(
    'desktopNotificationKinds',
    defaultOptions().desktopNotificationKinds,
  );
});

describe('desktopNotify', () => {
  it('sends the notification through the bridge', () => {
    const windowNotify = bridgeSpy();
    desktopNotify(raid);
    expect(windowNotify).toHaveBeenCalledWith(
      'Raid incoming',
      'Thornwick is about to be raided.',
    );
  });

  it('sends nothing when notifications are off', () => {
    const windowNotify = bridgeSpy();
    setOption('desktopNotifications', false);
    desktopNotify(raid);
    expect(windowNotify).not.toHaveBeenCalled();
  });

  it('sends nothing when its category is off', () => {
    const windowNotify = bridgeSpy();
    setOption('desktopNotificationKinds', {
      ...defaultOptions().desktopNotificationKinds,
      Raids: false,
    });
    desktopNotify(raid);
    expect(windowNotify).not.toHaveBeenCalled();
  });

  it('does nothing without the bridge', () => {
    expect(() => desktopNotify(raid)).not.toThrow();
  });
});
