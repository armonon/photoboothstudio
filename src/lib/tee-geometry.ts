import * as THREE from "three";

// Ellipse cross-section profiles: [y, halfX (side-to-side), halfZ (front-to-back)]
// These define the shirt silhouette when lofted together.
const PROFILES: [number, number, number][] = [
  [-0.72, 0.52, 0.20], // hem
  [-0.50, 0.51, 0.20],
  [-0.20, 0.49, 0.19],
  [ 0.05, 0.48, 0.19], // waist
  [ 0.28, 0.49, 0.20],
  [ 0.48, 0.50, 0.22], // chest
  [ 0.60, 0.49, 0.22], // upper chest
  [ 0.66, 0.44, 0.20], // armhole
  [ 0.71, 0.33, 0.17], // shoulder
  [ 0.75, 0.17, 0.12], // neck base
];

export const TEE_PROFILES = PROFILES;

// Interpolate the profile half-radii at a given Y.
export function profileAt(y: number): { rx: number; rz: number } {
  const p = PROFILES;
  if (y <= p[0][0]) return { rx: p[0][1], rz: p[0][2] };
  if (y >= p[p.length - 1][0]) return { rx: p[p.length - 1][1], rz: p[p.length - 1][2] };
  for (let i = 0; i < p.length - 1; i++) {
    if (y >= p[i][0] && y <= p[i + 1][0]) {
      const t = (y - p[i][0]) / (p[i + 1][0] - p[i][0]);
      return {
        rx: p[i][1] + (p[i + 1][1] - p[i][1]) * t,
        rz: p[i][2] + (p[i + 1][2] - p[i][2]) * t,
      };
    }
  }
  return { rx: 0.3, rz: 0.15 };
}

// Loft ellipse profiles into a single open-ended body mesh.
export function buildBodyGeometry(radialSegs = 64): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const yMin = PROFILES[0][0];
  const yMax = PROFILES[PROFILES.length - 1][0];
  const yRange = yMax - yMin;

  for (let r = 0; r < PROFILES.length - 1; r++) {
    const [yA, rxA, rzA] = PROFILES[r];
    const [yB, rxB, rzB] = PROFILES[r + 1];
    const vA = (yA - yMin) / yRange;
    const vB = (yB - yMin) / yRange;
    const vBase = positions.length / 3;

    for (let i = 0; i <= radialSegs; i++) {
      const u = i / radialSegs;
      const theta = u * Math.PI * 2;
      const sin = Math.sin(theta);
      const cos = Math.cos(theta);
      positions.push(sin * rxA, yA, cos * rzA);
      uvs.push(u, vA);
      positions.push(sin * rxB, yB, cos * rzB);
      uvs.push(u, vB);
    }

    for (let i = 0; i < radialSegs; i++) {
      const b = vBase + i * 2;
      indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// A curved front panel that follows the shirt surface exactly.
// UV (0,0)→(1,1) maps cleanly to this patch — perfect for design projection.
export function buildFrontPanelGeometry(
  yStart = 0.05,
  panelHeight = 0.54,
  panelWidth = 0.44,
  gridSegs = 24,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const xHalf = panelWidth / 2;

  for (let iy = 0; iy <= gridSegs; iy++) {
    for (let ix = 0; ix <= gridSegs; ix++) {
      const u = ix / gridSegs;
      const v = iy / gridSegs;
      const x = (u - 0.5) * panelWidth;
      const y = yStart + v * panelHeight;
      const { rx, rz } = profileAt(Math.min(y, PROFILES[PROFILES.length - 1][0]));
      // Follow the ellipse surface for this x: cos(theta)*rz where sin(theta)*rx = x
      const sinT = Math.max(-0.98, Math.min(0.98, x / rx));
      const cosT = Math.sqrt(1 - sinT * sinT);
      const z = cosT * rz + 0.004; // sit 4 mm in front of body surface
      positions.push(x, y, z);
      uvs.push(u, 1 - v); // flip V so image is right-way up
    }
  }

  for (let iy = 0; iy < gridSegs; iy++) {
    for (let ix = 0; ix < gridSegs; ix++) {
      const b = iy * (gridSegs + 1) + ix;
      indices.push(b, b + 1, b + gridSegs + 1, b + 1, b + gridSegs + 2, b + gridSegs + 1);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Disc to close the hem.
export function buildHemDisc(): THREE.BufferGeometry {
  const [, rxA, rzA] = PROFILES[0];
  const y = PROFILES[0][0];
  const segs = 64;
  const positions: number[] = [0, y, 0];
  const uvs: number[] = [0.5, 0.5];
  const indices: number[] = [];

  for (let i = 0; i <= segs; i++) {
    const theta = (i / segs) * Math.PI * 2;
    positions.push(Math.sin(theta) * rxA, y, Math.cos(theta) * rzA);
    uvs.push(0.5 + Math.sin(theta) * 0.5, 0.5 + Math.cos(theta) * 0.5);
  }
  for (let i = 1; i <= segs; i++) {
    indices.push(0, i, i + 1);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// Build the complete shirt group.
export function buildShirtGroup(
  color: string,
  designTexture: THREE.Texture | null,
): THREE.Group {
  const group = new THREE.Group();
  const c = new THREE.Color(color);

  const mat = new THREE.MeshStandardMaterial({
    color: c,
    roughness: 0.88,
    metalness: 0,
    side: THREE.DoubleSide,
  });

  // Body
  const body = new THREE.Mesh(buildBodyGeometry(), mat);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Hem disc
  const hem = new THREE.Mesh(buildHemDisc(), mat);
  hem.castShadow = true;
  group.add(hem);

  // Collar rib
  const collarGeo = new THREE.TorusGeometry(0.165, 0.022, 16, 64);
  const collar = new THREE.Mesh(collarGeo, mat);
  collar.position.set(0, 0.75, 0);
  collar.rotation.x = 0.12;
  group.add(collar);

  // Sleeves
  ([-1, 1] as const).forEach((side) => {
    const slGeo = new THREE.CylinderGeometry(0.082, 0.155, 0.50, 32, 6, true);
    // Flatten Z slightly (shirts aren't circular in cross-section)
    const sp = slGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < sp.count; i++) sp.setZ(i, sp.getZ(i) * 0.72);
    slGeo.computeVertexNormals();

    const sl = new THREE.Mesh(slGeo, mat);
    sl.position.set(side * 0.61, 0.50, 0.005);
    sl.rotation.z = side * -0.52; // ~30° out and down
    sl.castShadow = true;
    group.add(sl);

    // Cuff ring
    const cuffGeo = new THREE.TorusGeometry(0.083, 0.017, 12, 32);
    const cuff = new THREE.Mesh(cuffGeo, mat);
    const tipDY = -Math.cos(0.52) * 0.25;
    const tipDX = side * Math.sin(0.52) * 0.25;
    cuff.position.set(sl.position.x + tipDX, sl.position.y + tipDY, 0.005);
    cuff.rotation.z = sl.rotation.z;
    group.add(cuff);
  });

  // Shoulder seams
  ([-1, 1] as const).forEach((side) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      pts.push(new THREE.Vector3(side * (0.28 + t * 0.30), 0.66 - t * 0.14, 0.025));
    }
    const seamGeo = new THREE.BufferGeometry().setFromPoints(pts);
    group.add(
      new THREE.Line(
        seamGeo,
        new THREE.LineBasicMaterial({
          color: c.clone().multiplyScalar(0.65),
          transparent: true,
          opacity: 0.55,
        }),
      ),
    );
  });

  // Design overlay
  if (designTexture) {
    const panelGeo = buildFrontPanelGeometry();
    const panelMat = new THREE.MeshStandardMaterial({
      map: designTexture,
      roughness: 0.88,
      metalness: 0,
      transparent: true,
      alphaTest: 0.02,
    });
    const panel = new THREE.Mesh(panelGeo, panelMat);
    panel.castShadow = false;
    group.add(panel);
  }

  return group;
}
