import fs from 'fs-extra';

// Skipping identical writes keeps no-op rebuilds from triggering a dev-server reload.
export const writeJsonIfChanged = (file: string, data: unknown) => {
  const json = `${JSON.stringify(data)}\n`;
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf-8') === json) return;

  fs.writeFileSync(file, json);
};
