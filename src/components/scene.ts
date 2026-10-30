import { defaultPosition, type Position } from '../../shared/layout';
import { effectiveCategory } from '../../shared/identification';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { Device } from '../../shared/types';
import { deviceName, deviceTypeLabel } from '../lib';
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
  positions: Record<string, Position> = {},
): SceneHandle {
  const scene = new THREE.Scene();
  const theme = () => getComputedStyle(container).getPropertyValue('--map-bg').trim() || '#101a20';
  scene.background = new THREE.Color(theme());
  scene.fog = new THREE.Fog(theme(), 55, 150);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 250);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = true;
  controls.enableRotate = !flat;
  controls.minDistance = 10;
  controls.maxDistance = 150;
  controls.maxPolarAngle = Math.PI / 2.15;
  scene.add(new THREE.HemisphereLight('#ffffff', '#d3ddc4', 2.7));
  const light = new THREE.DirectionalLight('#ffffff', 3);
  light.position.set(-4, 12, 7);
  scene.add(light);
  const rim = new THREE.DirectionalLight('#d0e3c2', 1.2);
  rim.position.set(5, 3, -4);
  scene.add(rim);
  const resources: (THREE.BufferGeometry | THREE.Material)[] = [];
  function mesh(geometry: THREE.BufferGeometry, color: string) {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.02 });
    resources.push(geometry, material);
    return new THREE.Mesh(geometry, material);
  }
  function box(width: number, height: number, depth: number, color: string) {
    return mesh(
      new RoundedBoxGeometry(width, height, depth, 3, Math.min(width, height, depth) * 0.18),
      color,
    );
  }
  function shadow(x: number, z: number, radius: number) {
    const geometry = new THREE.CircleGeometry(radius, 48);
    const material = new THREE.MeshBasicMaterial({
      color: '#718b5e',
      transparent: true,
      opacity: 0.09,
      depthWrite: false,
    });
    resources.push(geometry, material);
    const disc = new THREE.Mesh(geometry, material);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(x, -0.42, z);
    scene.add(disc);
  }
  // These rings and paths express scope membership, never physical wiring or live traffic.
  function ring(radius: number, opacity: number) {
    const points = Array.from(
      { length: 129 },
      (_, i) =>
        new THREE.Vector3(
          Math.cos((i / 128) * Math.PI * 2) * radius,
          -0.38,
          Math.sin((i / 128) * Math.PI * 2) * radius,
        ),
    );
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: '#47656a', transparent: true, opacity });
    resources.push(geometry, material);
    scene.add(new THREE.LineLoop(geometry, material));
  }
  ring(3.2, 0.7);
  ring(5.6, 0.75);
  ring(8, 0.45);
  const core = new THREE.Group();
  const base = mesh(new THREE.CylinderGeometry(1.25, 1.4, 0.24, 64), '#25403e');
  base.position.y = -0.2;
  core.add(base);
  const sphere = mesh(new THREE.SphereGeometry(0.75, 48, 32), '#37af99');
  sphere.position.y = 0.6;
  core.add(sphere);
  const halo = mesh(new THREE.TorusGeometry(1.05, 0.035, 12, 100), '#9bb37f');
  halo.position.y = 0.6;
  halo.rotation.set(1.05, 0.3, -0.4);
  core.add(halo);
  scene.add(core);
  shadow(0, 0, 1.6);
  function deviceModel(device: Device) {
    const group = new THREE.Group();
    const tone =
      device.status === 'unseen' ? '#84949a' : device.status === 'cached' ? '#cfab69' : '#4fc6b2';
    const category = effectiveCategory(device);
    const pedestal = mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.16, 48), '#31484e');
    pedestal.position.y = -0.24;
    group.add(pedestal);
    if (category === 'computer' || category === 'media') {
      const screen = box(1.3, 0.86, 0.12, tone);
      screen.position.y = 0.55;
      group.add(screen);
      const glass = box(1.1, 0.65, 0.02, '#e3edd9');
      glass.position.set(0, 0.58, 0.075);
      group.add(glass);
      const bar = box(0.65, 0.045, 0.025, '#a8c18c');
      bar.position.set(-0.13, 0.66, 0.095);
      group.add(bar);
      const bar2 = box(0.42, 0.045, 0.025, '#bdcea9');
      bar2.position.set(-0.24, 0.51, 0.095);
      group.add(bar2);
      const stem = box(0.12, 0.25, 0.13, tone);
      stem.position.y = 0.01;
      group.add(stem);
      const foot = box(0.65, 0.06, 0.3, tone);
      foot.position.y = -0.12;
      group.add(foot);
    } else if (category === 'network') {
      const router = box(1.25, 0.28, 0.75, tone);
      router.position.y = 0.05;
      group.add(router);
      for (const x of [-0.43, 0.43]) {
        const antenna = box(0.045, 0.7, 0.045, '#657f54');
        antenna.position.set(x, 0.46, -0.23);
        antenna.rotation.z = x * 0.15;
        group.add(antenna);
      }
      for (let i = 0; i < 3; i++) {
        const led = mesh(new THREE.SphereGeometry(0.035, 12, 8), '#f2f8df');
        led.position.set(-0.3 + i * 0.15, 0.07, 0.385);
        group.add(led);
      }
    } else if (category === 'phone' || category === 'tablet') {
      const width = category === 'tablet' ? 0.88 : 0.58;
      const phone = box(width, 1.1, 0.12, tone);
      phone.position.y = 0.4;
      group.add(phone);
      const glass = box(width - 0.13, 0.83, 0.02, '#e1ecd4');
      glass.position.set(0, 0.43, 0.075);
      group.add(glass);
    } else if (category === 'printer') {
      const body = box(1.1, 0.55, 0.8, tone);
      body.position.y = 0.15;
      group.add(body);
      const paper = box(0.75, 0.6, 0.03, '#f5f8ee');
      paper.position.set(0, 0.65, -0.22);
      group.add(paper);
    } else if (category === 'storage') {
      const tower = box(0.85, 1, 0.6, tone);
      tower.position.y = 0.35;
      group.add(tower);
      for (const y of [0.15, 0.4, 0.65]) {
        const slot = box(0.6, 0.035, 0.025, '#e8f0dc');
        slot.position.set(0, y, 0.31);
        group.add(slot);
      }
    } else {
      const body = mesh(new THREE.SphereGeometry(0.43, 32, 24), tone);
      body.position.y = 0.35;
      group.add(body);
      const orbit = mesh(new THREE.TorusGeometry(0.52, 0.025, 8, 50), '#dce9cb');
      orbit.position.y = 0.35;
      orbit.rotation.x = 1.1;
      group.add(orbit);
    }
    group.rotation.y = 0.1;
    return group;
  }
  const labelsRoot = document.createElement('div');
  labelsRoot.className = 'scene-labels';
  container.appendChild(labelsRoot);
  const labels: { element: HTMLElement; position: THREE.Vector3 }[] = [];
  const coreLabel = document.createElement('div');
  coreLabel.className = 'node-label core-label';
  coreLabel.textContent = 'Mon réseau';
  labelsRoot.appendChild(coreLabel);
  labels.push({ element: coreLabel, position: new THREE.Vector3(0, -0.75, 0) });
  const clickable: THREE.Object3D[] = [];
  const deviceByMesh = new Map<THREE.Object3D, Device>();
  const sorted = [...devices].sort((a, b) => a.id.localeCompare(b.id)).slice(0, 100);
  const radius = Math.max(
    8,
    ...sorted.map((d) => {
      const p = positions[d.id] ?? defaultPosition(d.id);
      return Math.hypot(p.x, p.y);
    }),
  );
  sorted.forEach((device) => {
    const saved = positions[device.id] ?? defaultPosition(device.id);
    const position = new THREE.Vector3(saved.x, 0, saved.y);
    const model = deviceModel(device);
    model.position.copy(position);
    model.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        clickable.push(object);
        deviceByMesh.set(object, device);
      }
    });
    scene.add(model);
    shadow(position.x, position.z, 1.05);
    const controlPoint = position.clone().multiplyScalar(0.5);
    controlPoint.y = 0.25;
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, -0.35, 0),
      controlPoint,
      new THREE.Vector3(position.x, -0.35, position.z),
    );
    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(40));
    const material = new THREE.LineDashedMaterial({
      color: device.status === 'cached' ? '#bcab8a' : '#5c9e96',
      dashSize: 0.12,
      gapSize: 0.12,
      transparent: true,
      opacity: 0.65,
    });
    resources.push(geometry, material);
    const link = new THREE.Line(geometry, material);
    link.computeLineDistances();
    scene.add(link);
    const button = document.createElement('button');
    button.className = `node-label ${device.status}`;
    button.type = 'button';
    button.title = `${deviceName(device)} · ${deviceTypeLabel(device)} · ${device.ip}`;
    button.setAttribute('aria-label', `Ouvrir ${deviceName(device)}`);
    button.onclick = () => onSelect(device);
    const title = document.createElement('strong');
    title.textContent = deviceName(device);
    button.appendChild(title);
    const ip = document.createElement('span');
    ip.textContent = device.ip;
    button.appendChild(ip);
    labelsRoot.appendChild(button);
    labels.push({
      element: button,
      position: position.clone().add(new THREE.Vector3(0, -0.85, 0.2)),
    });
  });
  let frame = 0;
  let disposed = false;
  let cameraTouched = false;
  const initial = new THREE.Vector3();
  const projected = new THREE.Vector3();
  function render() {
    frame = 0;
    if (disposed) return;
    renderer.render(scene, camera);
    const width = container.clientWidth,
      height = container.clientHeight;
    const occupied: { x: number; y: number; width: number; height: number }[] = [];
    for (const label of labels) {
      projected.copy(label.position).project(camera);
      // Screen-space labels must not obscure one another, including on narrow viewports.
      label.element.hidden = false;
      const labelWidth = label.element.offsetWidth,
        labelHeight = label.element.offsetHeight;
      const baseX = THREE.MathUtils.clamp(
        (projected.x * 0.5 + 0.5) * width,
        labelWidth / 2 + 10,
        width - labelWidth / 2 - 10,
      );
      const baseY = THREE.MathUtils.clamp((-projected.y * 0.5 + 0.5) * height, 45, height - 110);
      let placed: { x: number; y: number; width: number; height: number } | null = null;
      for (const [dx, dy] of [
        [0, 0],
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
        [0, -2],
        [0, 2],
        [-1, -1],
        [1, -1],
        [-1, 1],
        [1, 1],
      ]) {
        const box = {
          x: baseX + dx * (labelWidth + 8) - labelWidth / 2,
          y: baseY + dy * (labelHeight + 8),
          width: labelWidth,
          height: labelHeight,
        };
        if (
          box.x < 8 ||
          box.x + box.width > width - 8 ||
          box.y < 40 ||
          box.y + box.height > height - 100
        )
          continue;
        if (
          occupied.some(
            (other) =>
              box.x < other.x + other.width + 6 &&
              box.x + box.width + 6 > other.x &&
              box.y < other.y + other.height + 6 &&
              box.y + box.height + 6 > other.y,
          )
        )
          continue;
        placed = box;
        break;
      }
      const visible =
        placed && projected.z <= 1 && Math.abs(projected.x) <= 1.4 && Math.abs(projected.y) <= 1.4;
      label.element.hidden = !visible;
      if (visible && placed) {
        occupied.push(placed);
        label.element.style.transform = `translate(${placed.x}px,${placed.y}px)`;
      }
    }
    labelsRoot.dataset.ready = 'true';
  }
  const schedule = () => {
    if (!frame && !disposed) frame = requestAnimationFrame(render);
  };
  const themeObserver = new MutationObserver(() => {
    scene.background = new THREE.Color(theme());
    scene.fog = new THREE.Fog(theme(), 55, 150);
    schedule();
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  controls.addEventListener('change', schedule);
  controls.addEventListener('start', () => {
    cameraTouched = true;
  });
  const resize = new ResizeObserver(() => {
    const width = container.clientWidth,
      height = container.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const distance = Math.max(18, radius * 2.6) * Math.max(1, 1.25 / camera.aspect);
    initial
      .copy(flat ? new THREE.Vector3(0, 1, 0.001) : new THREE.Vector3(0, 0.7, 1))
      .normalize()
      .multiplyScalar(distance);
    if (!cameraTouched) {
      camera.position.copy(initial);
      controls.target.set(0, 0, 0);
      controls.update();
    }
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
  return {
    reset() {
      cameraTouched = false;
      camera.position.copy(initial);
      controls.target.set(0, 0, 0);
      controls.update();
      schedule();
    },
    zoom(direction) {
      cameraTouched = true;
      camera.position.multiplyScalar(direction > 0 ? 0.85 : 1.15);
      camera.position.setLength(
        THREE.MathUtils.clamp(camera.position.length(), controls.minDistance, controls.maxDistance),
      );
      controls.update();
      schedule();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      themeObserver.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', pointerDown);
      renderer.domElement.removeEventListener('pointerup', pointerUp);
      resources.forEach((resource) => resource.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      labelsRoot.remove();
    },
  };
}
