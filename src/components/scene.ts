import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Device } from '../../shared/types';
import { deviceName } from '../lib';
export interface SceneHandle {
  reset: () => void;
  zoom: (direction: number) => void;
  dispose: () => void;
}
export function createScene(
  container: HTMLElement,
  devices: Device[],
  onSelect: (device: Device) => void,
  flat = false,
): SceneHandle {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#f1f4ef');
  scene.fog = new THREE.Fog('#f1f4ef', 25, 55);
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor('#f1f4ef');
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 80);
  const initial = flat ? new THREE.Vector3(0, 22, 0.01) : new THREE.Vector3(13, 13, 17);
  camera.position.copy(initial);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enableDamping = false;
  controls.enablePan = false;
  controls.enableRotate = !flat;
  controls.minDistance = 11;
  controls.maxDistance = 38;
  controls.maxPolarAngle = Math.PI / 2.12;
  controls.update();
  scene.add(new THREE.HemisphereLight('#ffffff', '#b7c3b4', 3));
  const light = new THREE.DirectionalLight('#ffffff', 4);
  light.position.set(3, 12, 5);
  scene.add(light);
  const accent = new THREE.DirectionalLight('#c3d4c4', 2);
  accent.position.set(-5, 3, -4);
  scene.add(accent);
  const resources: (THREE.BufferGeometry | THREE.Material)[] = [];
  function mesh(geometry: THREE.BufferGeometry, color: string, roughness = 0.55) {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.04 });
    resources.push(geometry, material);
    return new THREE.Mesh(geometry, material);
  }
  // Rings and paths represent membership in a scope, not measured physical links.
  function ring(radius: number, color: string, opacity: number) {
    const points = Array.from(
      { length: 161 },
      (_, i) =>
        new THREE.Vector3(
          Math.cos((i / 160) * Math.PI * 2) * radius,
          -0.28,
          Math.sin((i / 160) * Math.PI * 2) * radius,
        ),
    );
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity });
    resources.push(geometry, material);
    scene.add(new THREE.LineLoop(geometry, material));
  }
  ring(3.4, '#a5b6a2', 0.5);
  ring(6.2, '#b1c0ad', 0.5);
  ring(8.7, '#c2cdbf', 0.45);
  const grid = new THREE.GridHelper(70, 70, '#d6dfd1', '#e1e7dd');
  grid.position.y = -0.6;
  scene.add(grid);
  resources.push(
    grid.geometry,
    ...(Array.isArray(grid.material) ? grid.material : [grid.material]),
  );
  const core = mesh(new THREE.SphereGeometry(0.8, 48, 32), '#526e59');
  core.position.y = 0.35;
  scene.add(core);
  const halo = mesh(new THREE.TorusGeometry(1.24, 0.035, 12, 100), '#8ba779');
  halo.rotation.x = Math.PI / 2.5;
  halo.rotation.z = -0.4;
  halo.position.y = 0.35;
  scene.add(halo);
  const base = mesh(new THREE.CylinderGeometry(1.25, 1.4, 0.18, 64), '#d9e1d2');
  base.position.y = -0.42;
  scene.add(base);
  const labelRoot = document.createElement('div');
  labelRoot.className = 'scene-labels';
  container.appendChild(labelRoot);
  const labels: { element: HTMLElement; position: THREE.Vector3 }[] = [];
  const coreLabel = document.createElement('div');
  coreLabel.className = 'node-label core-label';
  coreLabel.textContent = 'Réseau local';
  labelRoot.appendChild(coreLabel);
  labels.push({ element: coreLabel, position: new THREE.Vector3(0, -0.6, 0) });
  const clickable: THREE.Object3D[] = [];
  const deviceByMesh = new Map<THREE.Object3D, Device>();
  const shown = devices.slice(0, 100);
  const sorted = [...shown].sort((a, b) => a.id.localeCompare(b.id));
  for (let i = 0; i < sorted.length; i++) {
    const device = sorted[i];
    let hash = 0;
    for (const c of device.id) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
    // Stable position per device; two rings spread dense inventories.
    const angle = ((hash % 3600) / 3600) * Math.PI * 2;
    const radius = 3.6 + (hash % 4) * 1.25;
    const position = new THREE.Vector3(
      Math.cos(angle) * radius,
      0.1 + (hash % 3) * 0.3,
      Math.sin(angle) * radius,
    );
    const color =
      device.status === 'unseen'
        ? '#c4cac0'
        : device.status === 'cached'
          ? '#d3b88e'
          : device.role === 'self'
            ? '#8eab7a'
            : '#c1d5c1';
    const object = mesh(
      device.role === 'self'
        ? new THREE.BoxGeometry(0.7, 0.85, 0.14)
        : new THREE.SphereGeometry(0.31, 28, 20),
      color,
    );
    object.position.copy(position);
    scene.add(object);
    clickable.push(object);
    deviceByMesh.set(object, device);
    const foot = mesh(new THREE.CylinderGeometry(0.57, 0.62, 0.09, 40), '#e3e9dd');
    foot.position.set(position.x, -0.45, position.z);
    scene.add(foot);
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -0.3, 0),
      new THREE.Vector3(position.x, -0.3, position.z),
    ]);
    const material = new THREE.LineDashedMaterial({
      color: '#9aad98',
      dashSize: 0.1,
      gapSize: 0.14,
      transparent: true,
      opacity: 0.45,
    });
    resources.push(geometry, material);
    const link = new THREE.Line(geometry, material);
    link.computeLineDistances();
    scene.add(link);
    const button = document.createElement('button');
    button.className = `node-label ${device.status}`;
    button.type = 'button';
    button.textContent = deviceName(device);
    button.title = `${deviceName(device)} · ${device.ip}`;
    button.setAttribute('aria-label', `Ouvrir ${deviceName(device)}`);
    button.onclick = () => onSelect(device);
    const ip = document.createElement('span');
    ip.textContent = device.ip;
    button.appendChild(ip);
    labelRoot.appendChild(button);
    labels.push({
      element: button,
      position: position.clone().add(new THREE.Vector3(0, -0.65, 0)),
    });
  }
  let frame = 0;
  let disposed = false;
  const projected = new THREE.Vector3();
  function render() {
    frame = 0;
    if (disposed) return;
    renderer.render(scene, camera);
    const width = container.clientWidth,
      height = container.clientHeight;
    for (const label of labels) {
      projected.copy(label.position).project(camera);
      label.element.style.transform = `translate(-50%, 0) translate(${(projected.x * 0.5 + 0.5) * width}px, ${(-projected.y * 0.5 + 0.5) * height}px)`;
      label.element.hidden = projected.z > 1 || projected.x < -1.1 || projected.x > 1.1;
    }
  }
  const schedule = () => {
    if (!frame && !disposed) frame = requestAnimationFrame(render);
  };
  controls.addEventListener('change', schedule);
  const resize = new ResizeObserver(() => {
    const width = container.clientWidth,
      height = container.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    schedule();
  });
  resize.observe(container);
  const raycaster = new THREE.Raycaster();
  let down = { x: 0, y: 0 };
  const pointerDown = (event: PointerEvent) => {
    down = { x: event.clientX, y: event.clientY };
  };
  const pointerUp = (event: PointerEvent) => {
    if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) return;
    const rect = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(
      new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    );
    const hit = raycaster.intersectObjects(clickable)[0];
    if (hit) {
      const device = deviceByMesh.get(hit.object);
      if (device) onSelect(device);
    }
  };
  renderer.domElement.addEventListener('pointerdown', pointerDown);
  renderer.domElement.addEventListener('pointerup', pointerUp);
  schedule();
  return {
    reset() {
      camera.position.copy(initial);
      controls.target.set(0, 0, 0);
      controls.update();
      schedule();
    },
    zoom(direction) {
      camera.position.multiplyScalar(direction > 0 ? 0.85 : 1.15);
      const length = THREE.MathUtils.clamp(
        camera.position.length(),
        controls.minDistance,
        controls.maxDistance,
      );
      camera.position.setLength(length);
      controls.update();
      schedule();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', pointerDown);
      renderer.domElement.removeEventListener('pointerup', pointerUp);
      resources.forEach((resource) => resource.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      labelRoot.remove();
    },
  };
}
