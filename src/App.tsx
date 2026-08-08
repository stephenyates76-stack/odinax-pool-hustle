import { useRef, useState, useEffect, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import {
  Ball,
  createBalls,
  stepPhysics,
  isMoving,
  computeAIShot,
  TABLE,
  STRIKE_FORCE,
  GameMode,
} from "./physics";
import { PoolTable } from "./PoolTable";
import { BallMesh } from "./BallMesh";
import { Character, CharState } from "./Character";

const ORBIT_R = 3.2;

type Turn = "player" | "ai";

export default function App() {
  const [mode, setMode] = useState<GameMode | null>(null);

  return (
    <div className="relative h-full w-full">
      {mode === null ? (
        <ModeSelect onSelect={setMode} />
      ) : (
        <Canvas
          shadows
          camera={{ position: [0, 2.8, ORBIT_R], fov: 50 }}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
          dpr={[1, 2]}
        >
          <color attach="background" args={["#05060a"]} />
          <fog attach="fog" args={["#05060a", 8, 18]} />
          <Scene mode={mode} />
        </Canvas>
      )}
      {mode !== null && <HUD />}
    </div>
  );
}

// ---- Mode Select ----

function ModeSelect({ onSelect }: { onSelect: (m: GameMode) => void }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#05060a]">
      <div className="flex flex-col items-center gap-10 px-6">
        <div className="text-center">
          <h1 className="font-display text-5xl font-bold tracking-[0.15em] text-white drop-shadow-[0_0_20px_rgba(0,229,255,0.4)] sm:text-6xl">
            NEON POOL
          </h1>
          <p className="mt-2 text-sm uppercase tracking-[0.3em] text-cyan-300/70">
            3D · vs AI
          </p>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row">
          <ModeCard
            title="8-Ball"
            subtitle="15 balls · classic"
            accent="#00e5ff"
            onClick={() => onSelect("8-ball")}
          />
          <ModeCard
            title="9-Ball"
            subtitle="9 balls · fast-paced"
            accent="#ff2d75"
            onClick={() => onSelect("9-ball")}
          />
        </div>
        <p className="max-w-md text-center text-xs leading-relaxed text-white/40">
          Choose a game mode to start. You play against an AI opponent — take
          turns aiming and shooting. Drag to orbit the table, hold Space to
          charge power, release to shoot.
        </p>
      </div>
    </div>
  );
}

function ModeCard({
  title,
  subtitle,
  accent,
  onClick,
}: {
  title: string;
  subtitle: string;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 px-10 py-8 text-left backdrop-blur-md transition hover:scale-105 hover:border-white/20 active:scale-100"
      style={{ boxShadow: `0 0 30px ${accent}22` }}
    >
      <div
        className="absolute inset-0 opacity-0 transition group-hover:opacity-100"
        style={{ background: `radial-gradient(circle at 50% 0%, ${accent}15, transparent 70%)` }}
      />
      <div className="relative">
        <div className="font-display text-3xl font-bold text-white">{title}</div>
        <div className="mt-1 text-xs uppercase tracking-[0.2em] text-white/50">
          {subtitle}
        </div>
        <div
          className="mt-4 h-1 w-16 rounded-full transition group-hover:w-24"
          style={{ background: accent, boxShadow: `0 0 12px ${accent}` }}
        />
      </div>
    </button>
  );
}

// ---- Scene ----

function Scene({ mode }: { mode: GameMode }) {
  const ballsRef = useRef<Ball[]>(createBalls(mode));
  const [, forceRender] = useState(0);
  const [score, setScore] = useState(0);
  const [aiScore, setAiScore] = useState(0);
  const [pocketedIds, setPocketedIds] = useState<number[]>([]);
  const [power, setPower] = useState(0);
  const powerRef = useRef(0);
  const chargingRef = useRef(false);
  const charState = useRef<CharState>("idle");
  const aiCharState = useRef<CharState>("idle");
  const shootAnim = useRef(0);
  const aiShootAnim = useRef(0);
  const charPos = useRef(new THREE.Vector3(ORBIT_R, 0, 0));
  const charFacing = useRef(new THREE.Vector3(-1, 0, 0));
  const aiCharPos = useRef(new THREE.Vector3(-ORBIT_R, 0, 0));
  const aiCharFacing = useRef(new THREE.Vector3(1, 0, 0));
  const camDir = useRef(new THREE.Vector3(0, 0, 1));
  const orbitingRef = useRef(false);
  const lastCamAzimuth = useRef(0);
  const cueBall = () => ballsRef.current.find((b) => b.id === 0)!;
  const [guideVisible, setGuideVisible] = useState(true);
  const turnRef = useRef<Turn>("player");
  const [turn, setTurn] = useState<Turn>("player");
  const aiThinkRef = useRef(0);
  const shotStartedRef = useRef(false);
  const playerScoredRef = useRef(false);
  const aiScoredRef = useRef(false);

  const restart = useCallback(() => {
    ballsRef.current = createBalls(mode);
    setScore(0);
    setAiScore(0);
    setPocketedIds([]);
    setPower(0);
    powerRef.current = 0;
    charState.current = "idle";
    aiCharState.current = "idle";
    turnRef.current = "player";
    setTurn("player");
    shotStartedRef.current = false;
    playerScoredRef.current = false;
    aiScoredRef.current = false;
    forceRender((n) => n + 1);
  }, [mode]);

  useEffect(() => {
    (window as any).__poolRestart = restart;
    (window as any).__poolGetState = () => ({
      score,
      aiScore,
      pocketedIds,
      power,
      turn,
    });
    (window as any).__poolSetGuide = (v: boolean) => setGuideVisible(v);
  }, [restart, score, aiScore, pocketedIds, power, turn]);

  // Keyboard: spacebar charge & release (player turn only)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (
        e.code === "Space" &&
        !chargingRef.current &&
        !isMoving(ballsRef.current) &&
        turnRef.current === "player"
      ) {
        chargingRef.current = true;
        charState.current = "aiming";
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space" && chargingRef.current) {
        chargingRef.current = false;
        const p = powerRef.current;
        if (p > 0.02) {
          const cb = cueBall();
          const dir = new THREE.Vector3(
            camDir.current.x,
            0,
            camDir.current.z
          ).normalize();
          const force = p * STRIKE_FORCE;
          cb.vel.addScaledVector(dir, force);
          charState.current = "shooting";
          shootAnim.current = 0;
          shotStartedRef.current = true;
          playerScoredRef.current = false;
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
        variant="player"
      />
      <Character
        stateRef={aiCharState}
        shootAnimRef={aiShootAnim}
        positionRef={aiCharPos}
        facingRef={aiCharFacing}
        variant="ai"
      />

      <GuideLine
        cueBallRef={ballsRef}
        camDirRef={camDir}
        visible={guideVisible && turn === "player"}
      />

      <CameraRig
        ballsRef={ballsRef}
        camDirRef={camDir}
        orbitingRef={orbitingRef}
        lastAzimuth={lastCamAzimuth}
        charPosRef={charPos}
        charFacingRef={charFacing}
        charStateRef={charState}
        aiCharPosRef={aiCharPos}
        aiCharFacingRef={aiCharFacing}
        aiCharStateRef={aiCharState}
        chargingRef={chargingRef}
        powerRef={powerRef}
        setPower={setPower}
        setScore={setScore}
        setAiScore={setAiScore}
        setPocketedIds={setPocketedIds}
        shootAnimRef={shootAnim}
        aiShootAnimRef={aiShootAnim}
        mode={mode}
        turnRef={turnRef}
        setTurn={setTurn}
        aiThinkRef={aiThinkRef}
        shotStartedRef={shotStartedRef}
        playerScoredRef={playerScoredRef}
        aiScoredRef={aiScoredRef}
      />
    </>
  );
}

// ---- Lights ----

function Lights() {
  return (
    <>
      <ambientLight intensity={0.3} color="#335588" />
      <hemisphereLight args={["#4466aa", "#0a1a08", 0.4]} />
      <spotLight
        position={[0, 5, 0]}
        angle={0.8}
        penumbra={0.8}
        intensity={4}
        color="#ffffff"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
      />
      <pointLight position={[-2, 1.5, -1.5]} intensity={2.5} color="#00e5ff" distance={8} />
      <pointLight position={[2, 1.5, 1.5]} intensity={2.5} color="#ff2d75" distance={8} />
      <pointLight position={[0, 2, -2]} intensity={2} color="#a855ff" distance={7} />
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
  aiCharPosRef: React.MutableRefObject<THREE.Vector3>;
  aiCharFacingRef: React.MutableRefObject<THREE.Vector3>;
  aiCharStateRef: React.MutableRefObject<CharState>;
  chargingRef: React.MutableRefObject<boolean>;
  powerRef: React.MutableRefObject<number>;
  setPower: (n: number) => void;
  setScore: (n: number | ((n: number) => number)) => void;
  setAiScore: (n: number | ((n: number) => number)) => void;
  setPocketedIds: (ids: number[]) => void;
  shootAnimRef: React.MutableRefObject<number>;
  aiShootAnimRef: React.MutableRefObject<number>;
  mode: GameMode;
  turnRef: React.MutableRefObject<Turn>;
  setTurn: (t: Turn) => void;
  aiThinkRef: React.MutableRefObject<number>;
  shotStartedRef: React.MutableRefObject<boolean>;
  playerScoredRef: React.MutableRefObject<boolean>;
  aiScoredRef: React.MutableRefObject<boolean>;
}

function CameraRig(props: RigProps) {
  const { camera } = useThree() as any;
  const controlsRef = useRef<any>(null);
  const {
    ballsRef,
    camDirRef,
    orbitingRef,
    lastAzimuth,
    charPosRef,
    charFacingRef,
    charStateRef,
    aiCharPosRef,
    aiCharFacingRef,
    aiCharStateRef,
    chargingRef,
    powerRef,
    setPower,
    setScore,
    setAiScore,
    setPocketedIds,
    shootAnimRef,
    aiShootAnimRef,
    mode,
    turnRef,
    setTurn,
    aiThinkRef,
    shotStartedRef,
    playerScoredRef,
    aiScoredRef,
  } = props;

  const wasMovingRef = useRef(false);

  useFrame((_, dt) => {
    const c = controlsRef.current;
    if (c) {
      c.update();
      const az = c.getAzimuthalAngle();
      const azDelta = Math.abs(az - lastAzimuth.current);
      const moving = isMoving(ballsRef.current);
      if (azDelta > 0.001 && !chargingRef.current && !moving && turnRef.current === "player") {
        orbitingRef.current = true;
        if (charStateRef.current !== "shooting") charStateRef.current = "walking";
      } else {
        orbitingRef.current = false;
        if (charStateRef.current === "walking") charStateRef.current = "idle";
      }
      lastAzimuth.current = az;

      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      dir.y = 0;
      dir.normalize();
      camDirRef.current.copy(dir);

      // Player character: opposite side of table from camera
      const camPos = camera.position;
      const fromCenter = new THREE.Vector3(camPos.x, 0, camPos.z).normalize();
      const charTarget = fromCenter.multiplyScalar(ORBIT_R * 0.82);
      charTarget.y = 0;
      charPosRef.current.lerp(charTarget, 0.3);

      const cb = ballsRef.current.find((b) => b.id === 0);
      if (cb && !cb.pocketed) {
        const face = new THREE.Vector3().subVectors(cb.pos, charPosRef.current);
        face.y = 0;
        face.normalize();
        charFacingRef.current.lerp(face, 0.3);
      }

      // AI character: on the opposite side from player
      const aiTarget = fromCenter.clone().multiplyScalar(-ORBIT_R * 0.82);
      aiTarget.y = 0;
      aiCharPosRef.current.lerp(aiTarget, 0.2);
      if (cb && !cb.pocketed) {
        const aiFace = new THREE.Vector3().subVectors(cb.pos, aiCharPosRef.current);
        aiFace.y = 0;
        aiFace.normalize();
        aiCharFacingRef.current.lerp(aiFace, 0.2);
      }
    }

    // Charge power (player)
    if (chargingRef.current) {
      powerRef.current = Math.min(1, powerRef.current + dt * 0.9);
      setPower(powerRef.current);
    }

    // Shooting animation progress (player)
    if (charStateRef.current === "shooting") {
      shootAnimRef.current += dt * 3;
      if (shootAnimRef.current >= 1) {
        shootAnimRef.current = 0;
        charStateRef.current = "idle";
      }
    }

    // AI shooting animation progress
    if (aiCharStateRef.current === "shooting") {
      aiShootAnimRef.current += dt * 3;
      if (aiShootAnimRef.current >= 1) {
        aiShootAnimRef.current = 0;
        aiCharStateRef.current = "idle";
      }
    }

    // Physics step
    const res = stepPhysics(ballsRef.current, Math.min(dt, 0.033));
    if (res.pocketedThisStep.length > 0) {
      let add = 0;
      for (const id of res.pocketedThisStep) {
        if (id === 0) add -= 5;
        else if (id === 8) add += 20;
        else add += 10;
      }
      if (turnRef.current === "player") {
        setScore((s: number) => s + add);
        if (res.pocketedThisStep.some((id) => id !== 0)) playerScoredRef.current = true;
      } else {
        setAiScore((s: number) => s + add);
        if (res.pocketedThisStep.some((id) => id !== 0)) aiScoredRef.current = true;
      }
      const after = ballsRef.current.filter((b) => b.pocketed).map((b) => b.id);
      setPocketedIds(after);

      const cue = ballsRef.current.find((b) => b.id === 0);
      if (cue && cue.pocketed) {
        cue.pocketed = false;
        cue.pos.set(-1.6, TABLE.ballR, 0);
        cue.vel.set(0, 0, 0);
        const filtered = ballsRef.current
          .filter((b) => b.pocketed && b.id !== 0)
          .map((b) => b.id);
        setPocketedIds(filtered);
      }
    }

    // Turn management: detect when balls stop moving
    const moving = isMoving(ballsRef.current);
    if (wasMovingRef.current && !moving && shotStartedRef.current) {
      shotStartedRef.current = false;
      // Switch turns unless the shooter pocketed a ball (no scratch)
      const shooterScored =
        turnRef.current === "player" ? playerScoredRef.current : aiScoredRef.current;
      if (!shooterScored) {
        turnRef.current = turnRef.current === "player" ? "ai" : "player";
        setTurn(turnRef.current);
      }
      playerScoredRef.current = false;
      aiScoredRef.current = false;
    }
    wasMovingRef.current = moving;

    // AI turn logic
    if (turnRef.current === "ai" && !moving && !shotStartedRef.current) {
      aiThinkRef.current += dt;
      aiCharStateRef.current = "aiming";
      if (aiThinkRef.current > 1.5) {
        aiThinkRef.current = 0;
        const shot = computeAIShot(ballsRef.current, mode);
        const cb = ballsRef.current.find((b) => b.id === 0);
        if (cb && !cb.pocketed) {
          const force = shot.power * STRIKE_FORCE;
          cb.vel.addScaledVector(shot.dir, force);
          aiCharStateRef.current = "shooting";
          aiShootAnimRef.current = 0;
          shotStartedRef.current = true;
          aiScoredRef.current = false;
        }
      }
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      enableZoom
      minDistance={2.2}
      maxDistance={5.5}
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
    const halfW = TABLE.width / 2 - TABLE.ballR;
    const halfD = TABLE.depth / 2 - TABLE.ballR;
    let t = 4;
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
  const [aiScore, setAiScore] = useState(0);
  const [pocketed, setPocketed] = useState<number[]>([]);
  const [power, setPower] = useState(0);
  const [guideOn, setGuideOn] = useState(true);
  const [turn, setTurn] = useState<Turn>("player");

  useEffect(() => {
    const interval = setInterval(() => {
      const s = (window as any).__poolGetState?.();
      if (s) {
        setScore(s.score);
        setAiScore(s.aiScore);
        setPocketed(s.pocketedIds);
        setPower(s.power);
        setTurn(s.turn);
      }
    }, 80);
    return () => clearInterval(interval);
  }, []);

  const restart = () => {
    (window as any).__poolRestart?.();
    setScore(0);
    setAiScore(0);
    setPocketed([]);
    setPower(0);
    setTurn("player");
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
    9: "#ffd400",
    10: "#2b6cff",
    11: "#e62020",
    12: "#7a1f8a",
    13: "#ff7a00",
    14: "#0a7d3a",
    15: "#8a1a1a",
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4 sm:p-6">
      {/* Top bar */}
      <div className="flex items-start justify-between">
        {/* Player score */}
        <div
          className={`pointer-events-auto rounded-2xl border px-5 py-3 backdrop-blur-md transition ${
            turn === "player"
              ? "border-cyan-400/40 bg-cyan-400/10"
              : "border-white/10 bg-black/40"
          }`}
        >
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-cyan-300/80">
            You
          </div>
          <div className="font-display text-3xl font-bold text-white tabular-nums">
            {score}
          </div>
        </div>

        {/* Title */}
        <div className="text-center">
          <div className="font-display text-2xl font-bold tracking-[0.3em] text-white/90 drop-shadow-[0_0_10px_rgba(0,229,255,0.5)]">
            NEON POOL
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.25em] text-white/40">
            {turn === "player" ? "Your turn" : "AI thinking..."}
          </div>
        </div>

        {/* AI score */}
        <div
          className={`pointer-events-auto rounded-2xl border px-5 py-3 backdrop-blur-md transition ${
            turn === "ai"
              ? "border-red-400/40 bg-red-400/10"
              : "border-white/10 bg-black/40"
          }`}
        >
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-red-300/80">
            AI
          </div>
          <div className="font-display text-3xl font-bold text-white tabular-nums">
            {aiScore}
          </div>
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

        <div className="pointer-events-auto flex gap-2">
          <button
            onClick={restart}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/90 backdrop-blur-md transition hover:bg-white/15 active:scale-95"
          >
            Restart
          </button>
          <button
            onClick={toggleGuide}
            className={`rounded-xl border px-3 py-2 text-sm font-medium backdrop-blur-md transition active:scale-95 ${
              guideOn
                ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-300"
                : "border-white/10 bg-white/5 text-white/60"
            }`}
          >
            Guide {guideOn ? "ON" : "OFF"}
          </button>
        </div>
      </div>
    </div>
  );
}
