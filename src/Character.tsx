import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export type CharState = "idle" | "walking" | "aiming" | "shooting";
export type CharVariant = "player" | "ai";

interface Props {
  stateRef: React.MutableRefObject<CharState>;
  shootAnimRef: React.MutableRefObject<number>;
  positionRef: React.MutableRefObject<THREE.Vector3>;
  facingRef: React.MutableRefObject<THREE.Vector3>;
  variant?: CharVariant;
}

export function Character({
  stateRef,
  shootAnimRef,
  positionRef,
  facingRef,
  variant = "player",
}: Props) {
  const root = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Group>(null);
  const rightArm = useRef<THREE.Group>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const tRef = useRef(0);

  useFrame((_, dt) => {
    if (!root.current) return;
    tRef.current += dt;
    const t = tRef.current;
    const state = stateRef.current;

    root.current.position.lerp(positionRef.current, 0.25);
    const face = facingRef.current;
    const targetYaw = Math.atan2(face.x, face.z);
    root.current.rotation.y = THREE.MathUtils.lerp(
      root.current.rotation.y,
      targetYaw,
      0.2
    );

    const walking = state === "walking";
    const walkSpeed = 8;
    const swing = walking ? Math.sin(t * walkSpeed) * 0.5 : 0;
    const bob = walking ? Math.abs(Math.sin(t * walkSpeed)) * 0.03 : 0;

    if (leftLeg.current) leftLeg.current.rotation.x = swing;
    if (rightLeg.current) rightLeg.current.rotation.x = -swing;
    if (body.current) body.current.position.y = bob;

    if (state === "idle" && body.current) {
      body.current.position.y = Math.sin(t * 2) * 0.008;
    }

    const aimLift = state === "aiming" || state === "shooting" ? -0.5 : -0.1;
    if (leftArm.current) leftArm.current.rotation.x = aimLift;
    if (rightArm.current) rightArm.current.rotation.x = aimLift;

    if (state === "shooting") {
      const p = shootAnimRef.current;
      const thrust = Math.sin(p * Math.PI) * 0.4;
      if (leftArm.current) leftArm.current.rotation.x = aimLift - thrust;
      if (rightArm.current) rightArm.current.rotation.x = aimLift - thrust;
      if (body.current) body.current.position.y = -thrust * 0.04;
    }
  });

  const palette =
    variant === "player"
      ? {
          skin: "#e8a878",
          shirt: "#1b6dff",
          pants: "#1a1a2e",
          hair: "#2a1505",
          accent: "#ffd400",
        }
      : {
          skin: "#d4956a",
          shirt: "#cc3322",
          pants: "#2a1a1a",
          hair: "#1a0a02",
          accent: "#ff7a00",
        };

  return (
    <group ref={root}>
      {/* Legs - rounded capsules */}
      <group ref={leftLeg} position={[-0.08, 0.24, 0]}>
        <mesh castShadow position={[0, -0.12, 0]}>
          <capsuleGeometry args={[0.045, 0.16, 8, 16]} />
          <meshStandardMaterial color={palette.pants} roughness={0.6} />
        </mesh>
        <mesh castShadow position={[0, -0.24, 0.03]}>
          <boxGeometry args={[0.09, 0.05, 0.16]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.5} />
        </mesh>
      </group>
      <group ref={rightLeg} position={[0.08, 0.24, 0]}>
        <mesh castShadow position={[0, -0.12, 0]}>
          <capsuleGeometry args={[0.045, 0.16, 8, 16]} />
          <meshStandardMaterial color={palette.pants} roughness={0.6} />
        </mesh>
        <mesh castShadow position={[0, -0.24, 0.03]}>
          <boxGeometry args={[0.09, 0.05, 0.16]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.5} />
        </mesh>
      </group>

      <group ref={body}>
        {/* Torso - rounded box */}
        <mesh castShadow position={[0, 0.44, 0]}>
          <boxGeometry args={[0.24, 0.28, 0.18]} />
          <meshStandardMaterial color={palette.shirt} roughness={0.5} />
        </mesh>
        {/* Chest accent stripe */}
        <mesh position={[0, 0.44, 0.092]}>
          <boxGeometry args={[0.16, 0.22, 0.008]} />
          <meshStandardMaterial
            color={palette.accent}
            emissive={palette.accent}
            emissiveIntensity={0.25}
            roughness={0.4}
          />
        </mesh>

        {/* Head - sphere */}
        <mesh castShadow position={[0, 0.68, 0]}>
          <sphereGeometry args={[0.1, 24, 24]} />
          <meshStandardMaterial color={palette.skin} roughness={0.4} />
        </mesh>
        {/* Hair - cap on top */}
        <mesh castShadow position={[0, 0.75, -0.01]} rotation={[0.1, 0, 0]}>
          <sphereGeometry args={[0.105, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <meshStandardMaterial color={palette.hair} roughness={0.8} />
        </mesh>
        {/* Eyes */}
        <mesh position={[-0.035, 0.69, 0.085]}>
          <sphereGeometry args={[0.014, 12, 12]} />
          <meshStandardMaterial color="#000000" roughness={0.2} />
        </mesh>
        <mesh position={[0.035, 0.69, 0.085]}>
          <sphereGeometry args={[0.014, 12, 12]} />
          <meshStandardMaterial color="#000000" roughness={0.2} />
        </mesh>
        {/* Smile */}
        <mesh position={[0, 0.655, 0.092]} rotation={[0, 0, 0]}>
          <torusGeometry args={[0.025, 0.006, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#5a3020" roughness={0.5} />
        </mesh>

        {/* Arms - capsules */}
        <group ref={leftArm} position={[-0.15, 0.54, 0]}>
          <mesh castShadow position={[0, -0.13, 0]}>
            <capsuleGeometry args={[0.035, 0.18, 8, 16]} />
            <meshStandardMaterial color={palette.shirt} roughness={0.5} />
          </mesh>
          <mesh castShadow position={[0, -0.26, 0]}>
            <sphereGeometry args={[0.035, 16, 16]} />
            <meshStandardMaterial color={palette.skin} roughness={0.4} />
          </mesh>
        </group>
        <group ref={rightArm} position={[0.15, 0.54, 0]}>
          <mesh castShadow position={[0, -0.13, 0]}>
            <capsuleGeometry args={[0.035, 0.18, 8, 16]} />
            <meshStandardMaterial color={palette.shirt} roughness={0.5} />
          </mesh>
          <mesh castShadow position={[0, -0.26, 0]}>
            <sphereGeometry args={[0.035, 16, 16]} />
            <meshStandardMaterial color={palette.skin} roughness={0.4} />
          </mesh>
        </group>

        {/* Cue stick held in front */}
        <group position={[0, 0.32, 0.28]} rotation={[Math.PI / 2 - 0.2, 0, 0]}>
          <mesh castShadow position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.01, 0.016, 1.1, 12]} />
            <meshStandardMaterial color="#c8a050" roughness={0.35} metalness={0.2} />
          </mesh>
          <mesh position={[0, 1.08, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.05, 12]} />
            <meshStandardMaterial color="#1a1a2e" roughness={0.3} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
