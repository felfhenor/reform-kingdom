/* eslint-disable @typescript-eslint/no-explicit-any */

// A MessageChannel message isn't a timer, so hidden tabs don't throttle it the way they clamp setTimeout to 1s (or 1 min).
let channel: MessageChannel | undefined;
const pendingResolves: (() => void)[] = [];

function messageChannelYield(): Promise<void> | undefined {
  if (typeof MessageChannel === 'undefined') return undefined;

  if (!channel) {
    channel = new MessageChannel();
    channel.port1.onmessage = () => pendingResolves.shift()?.();
    // Node (headless scripts) would otherwise keep the process alive on the open port.
    (channel.port1 as any).unref?.();
  }

  const port = channel.port2;
  return new Promise((resolve) => {
    pendingResolves.push(resolve);
    port.postMessage(undefined);
  });
}

export async function schedulerYield() {
  if ((window as any).scheduler?.yield) {
    return (window as any).scheduler.yield();
  }

  const yielded = messageChannelYield();
  if (yielded) return yielded;

  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}
