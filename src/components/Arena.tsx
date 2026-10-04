import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export default function Arena({ element, active }: { element: string; active: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const props = useRef({ element, active });
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => { props.current = { element, active }; }, [element, active]);
  useEffect(() => {
    const node = host.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { setUnavailable(true); return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    node.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 7.3, 8.5);
    camera.lookAt(0, 0, 0);
    scene.add(new THREE.AmbientLight(0xc1b6e9, 2));
    const light = new THREE.PointLight(0xa391ff, 35, 15);
    light.position.set(0, 2, 0);
    scene.add(light);
    const group = new THREE.Group();
    scene.add(group);
    const ringMaterials: THREE.MeshBasicMaterial[] = [];
    [2.1, 2.27, 2.65, 2.7, 3.15].forEach((radius, i) => {
      const mat = new THREE.MeshBasicMaterial({ color: i < 2 ? 0xa798e1 : 0x796658, transparent: true, opacity: i < 2 ? .28 : .22, side: THREE.DoubleSide });
      ringMaterials.push(mat);
      const ring = new THREE.Mesh(new THREE.RingGeometry(radius, radius + (i === 1 ? .03 : .014), 128), mat);
      ring.rotation.x = -Math.PI / 2;
      group.add(ring);
    });
    for (let i = 0; i < 36; i++) {
      const angle = i / 36 * Math.PI * 2;
      const tick = new THREE.Mesh(new THREE.BoxGeometry(.018, .018, i % 3 === 0 ? .16 : .06), new THREE.MeshBasicMaterial({ color: 0xaa9171, transparent: true, opacity: .32 }));
      tick.position.set(Math.sin(angle) * 2.9, 0, Math.cos(angle) * 2.9);
      tick.rotation.y = angle;
      group.add(tick);
    }
    const runeGroup = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      const angle = i / 8 * Math.PI * 2;
      const rune = new THREE.Mesh(new THREE.OctahedronGeometry(.055), new THREE.MeshBasicMaterial({ color: 0xdbc2a1, transparent: true, opacity: .6 }));
      rune.position.set(Math.sin(angle) * 2.45, .015, Math.cos(angle) * 2.45);
      rune.scale.set(1, .2, 2);
      runeGroup.add(rune);
    }
    group.add(runeGroup);
    const coreMaterial = new THREE.MeshStandardMaterial({ color: 0x9681cb, emissive: 0x6a47b5, emissiveIntensity: .8, metalness: .7, roughness: .25, transparent: true, opacity: .8 });
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(.4), coreMaterial);
    crystal.position.y = .7;
    scene.add(crystal);
    const wire = new THREE.Mesh(new THREE.OctahedronGeometry(.55), new THREE.MeshBasicMaterial({ color: 0xd8c8ff, wireframe: true, transparent: true, opacity: .2 }));
    crystal.add(wire);
    const particles = new Float32Array(90 * 3);
    for (let i = 0; i < 90; i++) {
      particles[i*3] = Math.sin(i * 23.43) * 4.6;
      particles[i*3+1] = Math.abs(Math.sin(i * 17.13)) * 2.5;
      particles[i*3+2] = Math.cos(i * 8.33) * 3.5;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particles, 3));
    const dust = new THREE.Points(particleGeometry, new THREE.PointsMaterial({ color: 0xd0bfa5, size: .023, transparent: true, opacity: .38 }));
    scene.add(dust);
    const resize = () => {
      const { width, height } = node.getBoundingClientRect();
      renderer.setSize(width, height);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(node);
    resize();
    let frame = 0;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const palette: Record<string, number> = { fire: 0xf28d54, water: 0x67cce8, psychic: 0xaa8ded, arcane: 0xd8bc88 };
    const color = new THREE.Color();
    const animate = (time: number) => {
      const t = time * .001;
      color.setHex(palette[props.current.element] ?? 0xa391ff);
      coreMaterial.color.lerp(color, .06);
      coreMaterial.emissive.lerp(color, .06);
      light.color.lerp(color, .06);
      if (!reducedMotion) {
        crystal.rotation.y = t * .3;
        crystal.position.y = .7 + Math.sin(t * 1.2) * .09;
        wire.rotation.y = -t * .5;
        runeGroup.rotation.y = t * .03;
        dust.rotation.y = t * .018;
      }
      coreMaterial.emissiveIntensity = props.current.active ? 1.4 : .65;
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      scene.traverse(object => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(m => m.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  return <div ref={host} className={`arena-canvas ${unavailable ? 'arena-fallback' : ''}`} aria-hidden="true">{unavailable && <div className="fallback-sigil">✧</div>}</div>;
}
