import { MOD_MAX_UNPACKED_BYTES } from '@helpers/config';
import type { ModFile } from '@interfaces';

// Lazy so the zip library only downloads for players who use mods.
export async function modZipFiles(data: Blob): Promise<ModFile[]> {
  const { BlobReader, Uint8ArrayWriter, ZipReader } =
    await import('@zip.js/zip.js');

  // Counts real inflated bytes, since a zip's declared sizes can lie.
  let remaining = MOD_MAX_UNPACKED_BYTES;
  class CappedWriter extends Uint8ArrayWriter {
    override async writeUint8Array(array: Uint8Array): Promise<void> {
      remaining -= array.length;
      if (remaining < 0) throw new Error('Mod is too large once unpacked.');
      return super.writeUint8Array(array);
    }
  }

  const reader = new ZipReader(new BlobReader(data));
  try {
    const files: ModFile[] = [];
    for (const entry of await reader.getEntries()) {
      if (entry.directory) continue;
      const bytes = await entry.getData(new CappedWriter());
      files.push({ path: entry.filename, data: bytes });
    }
    return files;
  } finally {
    await reader.close();
  }
}
