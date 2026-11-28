import { t } from '@helpers/i18n/i18n';
import { notifyError, notifySuccess } from '@helpers/engine/notify';

// Sandboxed embeds (e.g. galaxy.click) can't open Discord's invite page, so hand over the link instead.
export async function discordCopyInvite(url: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(url);
    notifySuccess(t('discord.discordInviteCopiedPaste'));
  } catch {
    notifyError(t('discord.couldnTCopyThe', { url }));
  }
}
