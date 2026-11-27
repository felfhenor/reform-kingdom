import type { ModFile } from '@interfaces';
import { Uint8ArrayReader, Uint8ArrayWriter, ZipWriter } from '@zip.js/zip.js';
import fs from 'fs-extra';
import path from 'path';
import rec from 'recursive-readdir';

export const MODS_DIR = path.resolve('mods');

export function modDirs(only?: string): string[] {
  return fs
    .readdirSync(MODS_DIR)
    .filter((name) => fs.statSync(path.join(MODS_DIR, name)).isDirectory())
    .filter((name) => !only || name === only);
}

export async function modDirFiles(name: string): Promise<ModFile[]> {
  const dir = path.join(MODS_DIR, name);
  const files = await rec(dir);
  return files.map((file: string) => ({
    path: path.relative(dir, file).split(path.sep).join('/'),
    data: new Uint8Array(fs.readFileSync(file)),
  }));
}

export async function zipModFiles(files: ModFile[]): Promise<Uint8Array> {
  const writer = new ZipWriter(new Uint8ArrayWriter());
  for (const file of files) {
    await writer.add(file.path, new Uint8ArrayReader(file.data));
  }
  return writer.close();
}
