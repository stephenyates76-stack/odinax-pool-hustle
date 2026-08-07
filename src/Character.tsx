import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export type CharState = "idle" | "walking" | "aiming" | "shooting";

interface Props {
  stateRef: React.MutableRefObject<CharState>;
  shootAnimRef: React.MutableRefObject<number>; // 0..1 progress
  // The character stands opposite the camera direction, around the table.
  positionRef: React.MutableRefObject<THREE.Vector3>;
  facingRef: React.MutableRefObject<THREE.Vector3>; // unit vector the character faces (toward cue ball)
}

export function Character({ stateRef, shootAnimRef, positionRef, facingRef }: Props) {
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

    // Position & facing
    root.current.position.lerp(positionRef.current, 0.25);
    const face = facingRef.current;
    const targetYaw = Math.atan2(face.x, face.z);
    root.current.rotation.y = THREE.MathUtils.lerp(
      root.current.rotation.y,
      targetYaw,
      0.2
    );

    // Walk cycle
    const walking = state === "walking";
    const walkSpeed = 8;
    const swing = walking ? Math.sin(t * walkSpeed) * 0.6 : 0;
    const bob = walking ? Math.abs(Math.sin(t * walkSpeed)) * 0.04 : 0;

    if (leftLeg.current) leftLeg.current.rotation.x = swing;
    if (rightLeg.current) rightLeg.current.rotation.x = -swing;
    if (body.current) body.current.position.y = bob;

    // Idle breathing
    if (state === "idle" && body.current) {
      body.current.position.y = Math.sin(t * 2) * 0.01;
    }

    // Arms hold cue: forward toward shot direction
    const aimLift = state === "aiming" || state === "shooting" ? -0.6 : -0.15;
    if (leftArm.current) leftArm.current.rotation.x = aimLift;
    if (rightArm.current) rightArm.current.rotation.x = aimLift;

    // Shooting swing: thrust forward then back
    if (state === "shooting") {
      const p = shootAnimRef.current;
      const thrust = Math.sin(p * Math.PI) * 0.5;
      if (leftArm.current) leftArm.current.rotation.x = aimLift - thrust;
      if (rightArm.current) rightArm.current.rotation.x = aimLift - thrust;
      if (body.current) body.current.position.y = -thrust * 0.05;
    }
  });

  const skin = "#e8a878";
  const shirt = "#1b6dff";
  const pants = "#1a1a2e";
  const hair = "#2a1505";

  return (
    <group ref={root}>
      {/* Legs */}
      <group ref={leftLeg} position={[-0.07, 0.22, 0]}>
        <mesh castShadow position={[0, -0.11, 0]}>
          <boxGeometry args={[0.08, 0.22, 0.1]} />
          <meshStandardMaterial color={pants} roughness={0.7} />
        </mesh>
        <mesh castShadow position={[0, -0.23, 0.02]}>
          <boxGeometry args={[0.09, 0.04, 0.14]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.6} />
        </mesh>
      </group>
      <group ref={rightLeg} position={[0.07, 0.22, 0]}>
        <mesh castShadow position={[0, -0.11, 0]}>
          <boxGeometry args={[0.08, 0.22, 0.1]} />
          <meshStandardMaterial color={pants} roughness={0.7} />
        </mesh>
        <mesh castShadow position={[0, -0.23, 0.02]}>
          <boxGeometry args={[0.09, 0.04, 0.14]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.6} />
        </mesh>
      </group>

      <group ref={body}>
        {/* Torso */}
        <mesh castShadow position={[0, 0.42, 0]}>
          <boxGeometry args={[0.22, 0.26, 0.16]} />
          <meshStandardMaterial color={shirt} roughness={0.6} />
        </mesh>
        {/* Vest accent */}
        <mesh position={[0, 0.42, 0.085]}>
          <boxGeometry args={[0.14, 0.24, 0.01]} />
          <meshStandardMaterial color="#ffd400" emissive="#ffaa00" emissiveIntensity={0.3} roughness={0.5} />
        </mesh>

        {/* Head */}
        <mesh castShadow position={[0, 0.66, 0]}>
          <boxGeometry args={[0.16, 0.16, 0.16]} />
          <meshStandardMaterial color={skin} roughness={0.5} />
        </mesh>
        {/* Hair */}
        <mesh castShadow position={[0, 0.74, -0.01]}>
          <boxGeometry args={[0.18, 0.06, 0.18]} />
          <meshStandardMaterial color={hair} roughness={0.8} />
        </mesh>
        {/* Eyes */}
        <mesh position={[-0.035, 0.67, 0.081]}>
          <boxGeometry args={[0.025, 0.02, 0.005]} />
          <meshStandardMaterial color="#000000" />
        </mesh>
        <mesh position={[0.035, 0.67, 0.081]}>
          <boxGeometry args={[0.025, 0.02, 0.005]} />
          <meshStandardMaterial color="#000000" />
        </mesh>

        {/* Arms */}
        <group ref={leftArm} position={[-0.14, 0.52, 0]}>
          <mesh castShadow position={[0, -0.12, 0]}>
            <boxGeometry args={[0.06, 0.24, 0.07]} />
            <meshStandardMaterial color={shirt} roughness={0.6} />
          </mesh>
          <mesh castShadow position={[0, -0.26, 0]}>
            <boxGeometry args={[0.055, 0.06, 0.06]} />
            <meshStandardMaterial color={skin} roughness={0.5} />
          </mesh>
        </group>
        <group ref={rightArm} position={[0.14, 0.52, 0]}>
          <mesh castShadow position={[0, -0.12, 0]}>
            <boxGeometry args={[0.06, 0.24, 0.07]} />
            <meshStandardMaterial color={shirt} roughness={0.6} />
          </mesh>
          <mesh castShadow position={[0, -0.26, 0]}>
            <boxGeometry args={[0.055, 0.06, 0.06]} />
            <meshStandardMaterial color={skin} roughness={0.5} />
          </mesh>
        </group>

        {/* Cue stick held in front */}
        <group position={[0, 0.3, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh castShadow position={[0, 0.5, 0]}>
            <cylinderGeometry args={[0.012, 0.018, 1.0, 12]} />
            <meshStandardMaterial color="#c8a050" roughness={0.4} metalness={0.2} />
          </mesh>
          <mesh position={[0, 1.0, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.06, 12]} />
            <meshStandardMaterial color="#1a1a2e" roughness={0.3} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
