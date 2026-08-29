import { warn } from '@helpers/engine/logging';
import type { PixiAppConfig } from '@interfaces';
import { Application, Container } from 'pixi.js';

export async function pixiAppInitialize(
  container: HTMLElement,
  config: PixiAppConfig,
): Promise<Application> {
  const app = new Application();

  await app.init({
    width: config.width,
    height: config.height,
    backgroundAlpha: config.backgroundAlpha ?? 0,
    antialias: config.antialias ?? false,
    powerPreference: 'high-performance',
    sharedTicker: true,
    resolution: 1,
    autoDensity: false,
    preference: 'webgpu',
  });

  app.ticker.maxFPS = 30;

  const canvas = app.canvas as HTMLCanvasElement;
  canvas.addEventListener('webglcontextlost', (event) => {
    warn('PixiWorld', 'WebGL context lost, preventing default behavior');
    event.preventDefault();
  });

  container.appendChild(app.canvas);

  return app;
}

export function pixiResponsiveCanvasSetup(
  app: Application,
  container: HTMLElement,
  onResize?: () => void,
): ResizeObserver {
  const resizeObserver = new ResizeObserver(() => {
    app.renderer.resize(container.clientWidth, container.clientHeight);
    onResize?.();
  });

  resizeObserver.observe(container);

  return resizeObserver;
}

export function pixiWorldContainersCreate(app: Application): {
  mapContainer: Container;
  playerIndicatorContainer: Container;
  workerIndicatorContainer: Container;
  gatherProgressContainer: Container;
  encounterProgressContainer: Container;
  nodeSelectionContainer: Container;
  floatingTextContainer: Container;
} {
  const mapContainer = new Container();
  const playerIndicatorContainer = new Container();
  const workerIndicatorContainer = new Container();
  const gatherProgressContainer = new Container();
  const encounterProgressContainer = new Container();
  const nodeSelectionContainer = new Container();
  const floatingTextContainer = new Container();

  app.stage.addChild(mapContainer);
  app.stage.addChild(playerIndicatorContainer);
  app.stage.addChild(workerIndicatorContainer);
  app.stage.addChild(gatherProgressContainer);
  app.stage.addChild(encounterProgressContainer);
  app.stage.addChild(nodeSelectionContainer);
  // Added last so gather/reward popups render above every other map overlay.
  app.stage.addChild(floatingTextContainer);

  mapContainer.cullable = true;
  playerIndicatorContainer.cullable = false;
  // Stays at (0,0), unlike playerIndicatorContainer - holds N worker tokens, each positioned individually.
  workerIndicatorContainer.cullable = false;
  gatherProgressContainer.cullable = false;
  encounterProgressContainer.cullable = false;
  nodeSelectionContainer.cullable = false;
  // Same (0,0)-anchored, individually-positioned scheme as workerIndicatorContainer.
  floatingTextContainer.cullable = false;

  return {
    mapContainer,
    playerIndicatorContainer,
    workerIndicatorContainer,
    gatherProgressContainer,
    encounterProgressContainer,
    nodeSelectionContainer,
    floatingTextContainer,
  };
}
