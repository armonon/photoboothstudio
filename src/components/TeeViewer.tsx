"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildShirtGroup } from "@/lib/tee-geometry";

interface TeeViewerProps {
  color?: string;
  designUrl?: string | null;
  className?: string;
}

interface SceneState {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  shirt: THREE.Group;
  animId: number;
  ro: ResizeObserver;
}

function loadDesignTexture(url: string): Promise<THREE.Texture> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const tex = new THREE.Texture(img);
      tex.needsUpdate = true;
      tex.colorSpace = THREE.SRGBColorSpace;
      resolve(tex);
    };
    img.onerror = () => {
      // Return an empty texture rather than failing the whole scene
      resolve(new THREE.Texture());
    };
    img.src = url;
  });
}

export default function TeeViewer({ color = "#f0f0ee", designUrl, className }: TeeViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<SceneState | null>(null);

  // Rebuild the shirt group whenever color or design changes without
  // tearing down the whole renderer — keeps the camera position intact.
  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;

    (async () => {
      const designTex = designUrl ? await loadDesignTexture(designUrl) : null;
      const newShirt = buildShirtGroup(color, designTex);
      state.scene.remove(state.shirt);
      // Dispose old shirt geometries/materials
      state.shirt.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
          else o.material.dispose();
        }
      });
      state.scene.add(newShirt);
      state.shirt = newShirt;
    })();
  }, [color, designUrl]);

  // Mount the renderer once.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let alive = true;

    (async () => {
      const W = host.clientWidth || 680;
      const H = Math.round(W * 0.68);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setSize(W, H);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.15;
      renderer.domElement.style.display = "block";
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "auto";
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();

      const camera = new THREE.PerspectiveCamera(36, W / H, 0.01, 50);
      camera.position.set(0, 0.08, 3.9);

      // Lighting — studio 3-point rig
      scene.add(new THREE.AmbientLight(0xfff8f2, 0.9));
      const key = new THREE.DirectionalLight(0xfff5e8, 3.2);
      key.position.set(1.5, 2.5, 2.5);
      key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.radius = 4;
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xe8f0ff, 1.3);
      fill.position.set(-2.5, 0.5, 1);
      scene.add(fill);
      const rim = new THREE.DirectionalLight(0xffffff, 0.55);
      rim.position.set(0, -1.5, -2);
      scene.add(rim);

      // Shadow catcher floor
      const floorMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 10),
        new THREE.ShadowMaterial({ opacity: 0.14 }),
      );
      floorMesh.rotation.x = -Math.PI / 2;
      floorMesh.position.y = -1.12;
      floorMesh.receiveShadow = true;
      scene.add(floorMesh);

      // Build initial shirt
      const designTex = designUrl ? await loadDesignTexture(designUrl) : null;
      if (!alive) { renderer.dispose(); return; }
      const shirt = buildShirtGroup(color, designTex);
      scene.add(shirt);

      // Orbit controls
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0, 0, 0);
      controls.enableDamping = true;
      controls.dampingFactor = 0.07;
      controls.minPolarAngle = 0.15;
      controls.maxPolarAngle = Math.PI * 0.88;
      controls.minDistance = 2;
      controls.maxDistance = 7;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 1.4;

      // Stop auto-rotate on manual drag
      renderer.domElement.addEventListener("pointerdown", () => {
        controls.autoRotate = false;
      });

      const state: SceneState = { renderer, scene, camera, controls, shirt, animId: 0, ro: null! };
      stateRef.current = state;

      function animate() {
        state.animId = requestAnimationFrame(animate);
        controls.update();
        renderer.render(scene, camera);
      }
      animate();

      const ro = new ResizeObserver(() => {
        const w = host.clientWidth;
        const h = Math.round(w * 0.68);
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      });
      ro.observe(host);
      state.ro = ro;
    })();

    return () => {
      alive = false;
      const state = stateRef.current;
      if (!state) return;
      cancelAnimationFrame(state.animId);
      state.ro?.disconnect();
      state.controls.dispose();
      state.scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
          else o.material.dispose();
        }
      });
      state.renderer.dispose();
      const canvas = host.querySelector("canvas");
      if (canvas) host.removeChild(canvas);
      stateRef.current = null;
    };
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={hostRef}
      className={className}
      style={{ borderRadius: 12, overflow: "hidden", border: "0.5px solid var(--border, #333)" }}
    />
  );
}
