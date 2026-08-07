import { useRef, useState, useEffect, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import {
  Ball,
  createBalls,
  stepPhysics,
  isMoving,
  TABLE,
} from "./physics";
import { PoolTable } from "./PoolTable";
import { BallMesh } from "./BallMesh";
import { Character, CharState } from "./Character";

const ORBIT_R = 2.6;

export default function App() {
  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows
        camera={{ position: [0, 2.2, ORBIT_R], fov: 50 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
        dpr={[1, 2]}
      >
        <color attach="background" args={["#05060a"]} />
        <fog attach="fog" args={["#05060a", 6, 14]} />
        <Scene />
      </Canvas>
      <HUD />
    </div>
  );
}

// ---- Scene ----

function Scene() {
  const ballsRef = useRef<Ball[]>(createBalls());
  const [, forceRender] = useState(0);
  const [score, setScore] = useState(0);
  const [pocketedIds, setPocketedIds] = useState<number[]>([]);
  const [power, setPower] = useState(0);
  const powerRef = useRef(0);
  const chargingRef = useRef(false);
  const charState = useRef<CharState>("idle");
  const shootAnim = useRef(0);
  const charPos = useRef(new THREE.Vector3(ORBIT_R, 0, 0));
  const charFacing = useRef(new THREE.Vector3(-1, 0, 0));
  const camDir = useRef(new THREE.Vector3(0, 0, 1));
  const orbitingRef = useRef(false);
  const lastCamAzimuth = useRef(0);
  const cueBall = () => ballsRef.current.find((b) => b.id === 0)!;
  const [guideVisible, setGuideVisible] = useState(true);

  // Reset
  const restart = useCallback(() => {
    ballsRef.current = createBalls();
    setScore(0);
    setPocketedIds([]);
    setPower(0);
    powerRef.current = 0;
    charState.current = "idle";
    shootAnim.current = 0;
    forceRender((n) => n + 1);
  }, []);

  // Expose restart + state to HUD via window
  useEffect(() => {
    (window as any).__poolRestart = restart;
    (window as any).__poolGetState = () => ({ score, pocketedIds, power });
    (window as any).__poolSetGuide = (v: boolean) => setGuideVisible(v);
  }, [restart, score, pocketedIds, power]);

  // Keyboard: spacebar charge & release
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Space" && !chargingRef.current && !isMoving(ballsRef.current)) {
        chargingRef.current = true;
        charState.current = "aiming";
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space" && chargingRef.current) {
        chargingRef.current = false;
        // Shoot
        const p = powerRef.current;
        if (p > 0.02) {
          const cb = cueBall();
          const dir = new THREE.Vector3(camDir.current.x, 0, camDir.current.z).normalize();
          const force = p * 4.5;
          cb.vel.addScaledVector(dir, force);
          charState.current = "shooting";
          shootAnim.current = 0;
        } else {
          charState.current = "idle";
        }
        powerRef.current = 0;
        setPower(0);
      }
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  return (
    <>
      <Lights />
      <PoolTable />

      {ballsRef.current.map((b) => (
        <BallMesh key={b.id} ball={b} />
      ))}

      <Character
        stateRef={charState}
        shootAnimRef={shootAnim}
        positionRef={charPos}
        facingRef={charFacing}
      />

      <GuideLine
        cueBallRef={ballsRef}
        camDirRef={camDir}
        visible={guideVisible}
      />

      <CameraRig
        ballsRef={ballsRef}
        camDirRef={camDir}
        orbitingRef={orbitingRef}
        lastAzimuth={lastCamAzimuth}
        charPosRef={charPos}
        charFacingRef={charFacing}
        charStateRef={charState}
        chargingRef={chargingRef}
        powerRef={powerRef}
        setPower={setPower}
        setScore={setScore}
        setPocketedIds={setPocketedIds}
        shootAnimRef={shootAnim}
      />
    </>
  );
}

// ---- Lights ----

function Lights() {
  return (
    <>
      <ambientLight intensity={0.25} color="#335588" />
      <hemisphereLight args={["#4466aa", "#0a1a08", 0.4]} />
      {/* Key light above table */}
      <spotLight
        position={[0, 4, 0]}
        angle={0.7}
        penumbra={0.8}
        intensity={3.2}
        color="#ffffff"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
      />
      {/* Accent neon lights */}
      <pointLight position={[-1.5, 1.2, -1]} intensity={2} color="#00e5ff" distance={6} />
      <pointLight position={[1.5, 1.2, 1]} intensity={2} color="#ff2d75" distance={6} />
      <pointLight position={[0, 1.5, -1.5]} intensity={1.5} color="#a855ff" distance={5} />
    </>
  );
}

// ---- Camera + game loop ----

interface RigProps {
  ballsRef: React.MutableRefObject<Ball[]>;
  camDirRef: React.MutableRefObject<THREE.Vector3>;
  orbitingRef: React.MutableRefObject<boolean>;
  lastAzimuth: React.MutableRefObject<number>;
  charPosRef: React.MutableRefObject<THREE.Vector3>;
  charFacingRef: React.MutableRefObject<THREE.Vector3>;
  charStateRef: React.MutableRefObject<CharState>;
  chargingRef: React.MutableRefObject<boolean>;
  powerRef: React.MutableRefObject<number>;
  setPower: (n: number) => void;
  setScore: (n: number | ((n: number) => number)) => void;
  setPocketedIds: (ids: number[]) => void;
  shootAnimRef: React.MutableRefObject<number>;
}

function CameraRig(props: RigProps) {
  const { camera, controls } = useThree() as any;
  const {
    ballsRef,
    camDirRef,
    orbitingRef,
    lastAzimuth,
    charPosRef,
    charFacingRef,
    charStateRef,
    chargingRef,
    powerRef,
    setPower,
    setScore,
    setPocketedIds,
    shootAnimRef,
  } = props;

  useFrame((_, dt) => {
    const c = controls as any;
    if (c) {
      c.update();
      // Read azimuth
      const az = c.getAzimuthalAngle();
      // Determine if orbiting (azimuth changing while not charging)
      const azDelta = Math.abs(az - lastAzimuth.current);
      const moving = isMoving(ballsRef.current);
      if (azDelta > 0.001 && !chargingRef.current && !moving) {
        orbitingRef.current = true;
        if (charStateRef.current !== "shooting") charStateRef.current = "walking";
      } else {
        orbitingRef.current = false;
        if (charStateRef.current === "walking") charStateRef.current = "idle";
      }
      lastAzimuth.current = az;

      // Camera direction (horizontal)
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      dir.y = 0;
      dir.normalize();
      camDirRef.current.copy(dir);

      // Character position: opposite side of table from camera, at ORBIT_R
      const camPos = camera.position;
      const fromCenter = new THREE.Vector3(camPos.x, 0, camPos.z).normalize();
      const charTarget = fromCenter.multiplyScalar(ORBIT_R * 0.78);
      charTarget.y = 0;
      charPosRef.current.lerp(charTarget, 0.3);

      // Character faces toward cue ball
      const cb = ballsRef.current.find((b) => b.id === 0);
      if (cb && !cb.pocketed) {
        const face = new THREE.Vector3().subVectors(cb.pos, charPosRef.current);
        face.y = 0;
        face.normalize();
        charFacingRef.current.lerp(face, 0.3);
      }
    }

    // Charge power
    if (chargingRef.current) {
      powerRef.current = Math.min(1, powerRef.current + dt * 0.9);
      setPower(powerRef.current);
    }

    // Shooting animation progress
    if (charStateRef.current === "shooting") {
      shootAnimRef.current += dt * 3;
      if (shootAnimRef.current >= 1) {
        shootAnimRef.current = 0;
        charStateRef.current = "idle";
      }
    }

    // Physics step
    const res = stepPhysics(ballsRef.current, Math.min(dt, 0.033));
    if (res.pocketedThisStep.length > 0) {
      // Update score
      let add = 0;
      for (const id of res.pocketedThisStep) {
        if (id === 0) add -= 5; // scratching cue
        else if (id === 8) add += 20;
        else add += 10;
      }
      setScore((s: number) => s + add);
      const after = ballsRef.current.filter((b) => b.pocketed).map((b) => b.id);
      setPocketedIds(after);

      // If cue ball pocketed, respawn it
      const cue = ballsRef.current.find((b) => b.id === 0);
      if (cue && cue.pocketed) {
        cue.pocketed = false;
        cue.pos.set(-0.7, TABLE.ballR, 0);
        cue.vel.set(0, 0, 0);
        // Remove from pocketed list display
        const filtered = ballsRef.current.filter((b) => b.pocketed && b.id !== 0).map((b) => b.id);
        setPocketedIds(filtered);
      }
    }
  });

  return (
    <OrbitControls
      ref={(c) => {
        (controls as any).current = c;
      }}
      enablePan={false}
      enableZoom
      minDistance={1.8}
      maxDistance={4.5}
      minPolarAngle={0.25}
      maxPolarAngle={Math.PI / 2 - 0.08}
      target={[0, 0, 0]}
      rotateSpeed={0.6}
      makeDefault
    />
  );
}

// ---- Guide line ----

function GuideLine({
  cueBallRef,
  camDirRef,
  visible,
}: {
  cueBallRef: React.MutableRefObject<Ball[]>;
  camDirRef: React.MutableRefObject<THREE.Vector3>;
  visible: boolean;
}) {
  const ref = useRef<THREE.Line>(null);

  useFrame(() => {
    if (!ref.current || !visible) return;
    const cb = cueBallRef.current.find((b) => b.id === 0);
    if (!cb || cb.pocketed || isMoving(cueBallRef.current)) {
      ref.current.visible = false;
      return;
    }
    ref.current.visible = true;
    const dir = new THREE.Vector3(camDirRef.current.x, 0, camDirRef.current.z).normalize();
    const start = cb.pos.clone();
    // Clip to table bounds
    const halfW = TABLE.width / 2 - TABLE.ballR;
    const halfD = TABLE.depth / 2 - TABLE.ballR;
    let t = 3;
    if (dir.x > 0.001) t = Math.min(t, (halfW - start.x) / dir.x);
    else if (dir.x < -0.001) t = Math.min(t, (-halfW - start.x) / dir.x);
    if (dir.z > 0.001) t = Math.min(t, (halfD - start.z) / dir.z);
    else if (dir.z < -0.001) t = Math.min(t, (-halfD - start.z) / dir.z);
    t = Math.max(0.1, t);
    const finalEnd = start.clone().addScaledVector(dir, t);

    const geo = ref.current.geometry as THREE.BufferGeometry;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    pos.setXYZ(0, start.x, TABLE.ballR, start.z);
    pos.setXYZ(1, finalEnd.x, TABLE.ballR, finalEnd.z);
    pos.needsUpdate = true;
  });

  if (!visible) return null;
  return (
    <line ref={ref as any}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[new Float32Array(6), 3]}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#00e5ff" transparent opacity={0.7} toneMapped={false} />
    </line>
  );
}

// ---- HUD overlay ----

function HUD() {
  const [score, setScore] = useState(0);
  const [pocketed, setPocketed] = useState<number[]>([]);
  const [power, setPower] = useState(0);
  const [guideOn, setGuideOn] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      const s = (window as any).__poolGetState?.();
      if (s) {
        setScore(s.score);
        setPocketed(s.pocketedIds);
        setPower(s.power);
      }
    }, 80);
    return () => clearInterval(interval);
  }, []);

  const restart = () => {
    (window as any).__poolRestart?.();
    setScore(0);
    setPocketed([]);
    setPower(0);
  };

  const toggleGuide = () => {
    const v = !guideOn;
    setGuideOn(v);
    (window as any).__poolSetGuide?.(v);
  };

  const pocketedColors: Record<number, string> = {
    1: "#ffd400",
    2: "#2b6cff",
    3: "#e62020",
    4: "#7a1f8a",
    5: "#ff7a00",
    6: "#0a7d3a",
    7: "#8a1a1a",
    8: "#111111",
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4 sm:p-6">
      {/* Top bar */}
      <div className="flex items-start justify-between">
        <div className="pointer-events-auto rounded-2xl border border-white/10 bg-black/40 px-5 py-3 backdrop-blur-md">
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-cyan-300/80">
            Score
          </div>
          <div className="font-display text-3xl font-bold text-white tabular-nums">
            {score}
          </div>
        </div>

        <div className="text-center">
          <div className="font-display text-2xl font-bold tracking-[0.3em] text-white/90 drop-shadow-[0_0_10px_rgba(0,229,255,0.5)]">
            NEON POOL
          </div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-white/40">
            3D · 360°
          </div>
        </div>

        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <button
            onClick={restart}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-md transition hover:bg-white/15 active:scale-95"
          >
            Restart
          </button>
          <button
            onClick={toggleGuide}
            className={`rounded-xl border px-3 py-1.5 text-xs font-medium backdrop-blur-md transition active:scale-95 ${
              guideOn
                ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-300"
                : "border-white/10 bg-white/5 text-white/60"
            }`}
          >
            Guide {guideOn ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      {/* Pocketed balls */}
      <div className="flex justify-center">
        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-4 py-2.5 backdrop-blur-md">
          <span className="mr-1 text-[10px] font-medium uppercase tracking-[0.15em] text-white/50">
            Pocketed
          </span>
          {pocketed.length === 0 ? (
            <span className="text-sm text-white/30">—</span>
          ) : (
            pocketed.map((id) => (
              <div
                key={id}
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white/20 text-[10px] font-bold text-white shadow-lg"
                style={{
                  background: pocketedColors[id] ?? "#fff",
                  color: id === 8 ? "#fff" : "#000",
                }}
              >
                {id}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bottom: power meter + instructions */}
      <div className="flex flex-col items-center gap-3">
        {/* Power meter */}
        <div className="w-full max-w-xs">
          <div className="mb-1 flex justify-between text-[10px] font-medium uppercase tracking-[0.15em] text-white/50">
            <span>Power</span>
            <span>{Math.round(power * 100)}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full border border-white/10 bg-black/50">
            <div
              className="h-full rounded-full transition-[width] duration-75"
              style={{
                width: `${power * 100}%`,
                background:
                  power < 0.4
                    ? "linear-gradient(90deg,#00e5ff,#00b3cc)"
                    : power < 0.75
                    ? "linear-gradient(90deg,#00e5ff,#ffd400)"
                    : "linear-gradient(90deg,#ffd400,#ff2d75)",
                boxShadow: `0 0 ${power * 20}px ${
                  power < 0.75 ? "rgba(0,229,255,0.6)" : "rgba(255,45,117,0.7)"
                }`,
              }}
            />
          </div>
        </div>

        {/* Instructions */}
        <div className="pointer-events-none flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-white/50">
          <span>
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-white/80">Drag</kbd>{" "}
            Orbit 360°
          </span>
          <span>
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-white/80">Scroll</kbd>{" "}
            Zoom
          </span>
          <span>
            <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-white/80">Hold Space</kbd>{" "}
            Charge → Release to Shoot
          </span>
        </div>
      </div>
    </div>
  );
}
