import * as THREE from "three";

export type BallKind = "cue" | "eight" | "solid" | "stripe";

export interface Ball {
  id: number;
  kind: BallKind;
  color: string;
  radius: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  pocketed: boolean;
}

// Table dimensions (felt play area)
export const TABLE = {
  width: 2.24, // X axis (half-width = 1.12)
  depth: 1.12, // Z axis (half-depth = 0.56)
  railH: 0.06,
  feltY: 0,
  ballR: 0.052,
  pocketR: 0.085,
  friction: 0.985,
  wallRestitution: 0.78,
  ballRestitution: 0.96,
};

export const POCKETS: THREE.Vector3[] = [
  new THREE.Vector3(-TABLE.width / 2, 0, -TABLE.depth / 2),
  new THREE.Vector3(0, 0, -TABLE.depth / 2),
  new THREE.Vector3(TABLE.width / 2, 0, -TABLE.depth / 2),
  new THREE.Vector3(-TABLE.width / 2, 0, TABLE.depth / 2),
  new THREE.Vector3(0, 0, TABLE.depth / 2),
  new THREE.Vector3(TABLE.width / 2, 0, TABLE.depth / 2),
];

const BALL_COLORS = [
  "#ffd400", // 1 yellow
  "#2b6cff", // 2 blue
  "#e62020", // 3 red
  "#7a1f8a", // 4 purple
  "#ff7a00", // 5 orange
  "#0a7d3a", // 6 green
  "#8a1a1a", // 7 maroon
];

export function createBalls(): Ball[] {
  const balls: Ball[] = [];
  const r = TABLE.ballR;

  // Cue ball at head spot
  balls.push({
    id: 0,
    kind: "cue",
    color: "#ffffff",
    radius: r,
    pos: new THREE.Vector3(-0.7, r, 0),
    vel: new THREE.Vector3(),
    pocketed: false,
  });

  // Rack the colored balls in a triangle at foot spot
  const footX = 0.55;
  const spacing = r * 2 + 0.002;
  const dx = spacing * Math.cos(Math.PI / 6);
  const dz = spacing * Math.sin(Math.PI / 6);
  let id = 1;
  // 8-ball in center of rack
  const rackPositions: [number, number][] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col <= row; col++) {
      const x = footX + row * dx;
      const z = (col - row / 2) * dz;
      rackPositions.push([x, z]);
    }
  }
  // Assign: position 4 (center) is 8-ball
  const eightIdx = 4;
  const colorOrder = [0, 1, 2, 3, 4, 5, 6];
  let colorPtr = 0;
  rackPositions.forEach((p, i) => {
    if (i === eightIdx) {
      balls.push({
        id: 8,
        kind: "eight",
        color: "#111111",
        radius: r,
        pos: new THREE.Vector3(p[0], r, p[1]),
        vel: new THREE.Vector3(),
        pocketed: false,
      });
    } else {
      const c = colorOrder[colorPtr++];
      balls.push({
        id: id++,
        kind: c < 4 ? "solid" : "stripe",
        color: BALL_COLORS[c],
        radius: r,
        pos: new THREE.Vector3(p[0], r, p[1]),
        vel: new THREE.Vector3(),
        pocketed: false,
      });
    }
  });

  return balls;
}

export interface PhysicsStep {
  pocketedThisStep: number[];
}

export function stepPhysics(balls: Ball[], dt: number): PhysicsStep {
  const result: PhysicsStep = { pocketedThisStep: [] };
  const r = TABLE.ballR;
  const halfW = TABLE.width / 2 - r;
  const halfD = TABLE.depth / 2 - r;

  // Sub-step for stability
  const subSteps = 4;
  const sdt = dt / subSteps;

  for (let s = 0; s < subSteps; s++) {
    // Integrate
    for (const b of balls) {
      if (b.pocketed) continue;
      b.pos.addScaledVector(b.vel, sdt);
      // Friction
      b.vel.multiplyScalar(TABLE.friction);
      if (b.vel.lengthSq() < 1e-6) b.vel.set(0, 0, 0);
      // Keep on felt
      b.pos.y = r;
    }

    // Wall collisions (skip near pockets)
    for (const b of balls) {
      if (b.pocketed) continue;
      const nearPocket = POCKETS.some(
        (p) => Math.hypot(b.pos.x - p.x, b.pos.z - p.z) < TABLE.pocketR + r
      );
      if (nearPocket) continue;

      if (b.pos.x > halfW) {
        b.pos.x = halfW;
        b.vel.x = -b.vel.x * TABLE.wallRestitution;
      } else if (b.pos.x < -halfW) {
        b.pos.x = -halfW;
        b.vel.x = -b.vel.x * TABLE.wallRestitution;
      }
      if (b.pos.z > halfD) {
        b.pos.z = halfD;
        b.vel.z = -b.vel.z * TABLE.wallRestitution;
      } else if (b.pos.z < -halfD) {
        b.pos.z = -halfD;
        b.vel.z = -b.vel.z * TABLE.wallRestitution;
      }
    }

    // Ball-ball collisions
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i];
      if (a.pocketed) continue;
      for (let j = i + 1; j < balls.length; j++) {
        const c = balls[j];
        if (c.pocketed) continue;
        const dx = c.pos.x - a.pos.x;
        const dz = c.pos.z - a.pos.z;
        const distSq = dx * dx + dz * dz;
        const minDist = a.radius + c.radius;
        if (distSq < minDist * minDist && distSq > 1e-9) {
          const dist = Math.sqrt(distSq);
          const nx = dx / dist;
          const nz = dz / dist;
          // Separate
          const overlap = minDist - dist;
          a.pos.x -= nx * overlap * 0.5;
          a.pos.z -= nz * overlap * 0.5;
          c.pos.x += nx * overlap * 0.5;
          c.pos.z += nz * overlap * 0.5;
          // Relative velocity along normal
          const rvx = c.vel.x - a.vel.x;
          const rvz = c.vel.z - a.vel.z;
          const velAlongNormal = rvx * nx + rvz * nz;
          if (velAlongNormal > 0) continue;
          const e = TABLE.ballRestitution;
          const impulse = -(1 + e) * velAlongNormal * 0.5;
          a.vel.x -= impulse * nx;
          a.vel.z -= impulse * nz;
          c.vel.x += impulse * nx;
          c.vel.z += impulse * nz;
        }
      }
    }

    // Pocket checks
    for (const b of balls) {
      if (b.pocketed) continue;
      for (const p of POCKETS) {
        const d = Math.hypot(b.pos.x - p.x, b.pos.z - p.z);
        if (d < TABLE.pocketR) {
          b.pocketed = true;
          b.vel.set(0, 0, 0);
          result.pocketedThisStep.push(b.id);
          break;
        }
      }
    }
  }

  return result;
}

export function isMoving(balls: Ball[]): boolean {
  return balls.some((b) => !b.pocketed && b.vel.lengthSq() > 1e-4);
}
