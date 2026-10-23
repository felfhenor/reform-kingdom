import { notifyError, notifySuccess } from '@helpers/engine/notify';

// Sandboxed embeds (e.g. galaxy.click) can't open Discord's invite page, so hand over the link instead.
export async function discordCopyInvite(url: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(url);
    notifySuccess('Discord invite copied! Paste it into a new tab to join.');
  } catch {
    notifyError(`Couldn't copy the Discord invite. Visit ${url} to join.`);
  }
}
