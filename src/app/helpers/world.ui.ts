import { worldNodeAtCurrentLocation } from '@helpers/world';

export function isPlayerAtLocation(): boolean {
  return !!worldNodeAtCurrentLocation();
}
