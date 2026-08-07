import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Ball } from "./physics";

export function BallMesh({ ball }: { ball: Ball }) {
  const ref = useRef<THREE.Group>(null);

  useFrame(() => {
    if (ref.current && !ball.pocketed) {
      ref.current.position.copy(ball.pos);
      // Roll rotation based on velocity
      const v = ball.vel;
      if (v.lengthSq() > 1e-5) {
        const axis = new THREE.Vector3(-v.z, 0, v.x).normalize();
        const angle = (v.length() * 0.016) / ball.radius;
        ref.current.rotateOnWorldAxis(axis, angle);
      }
    }
    if (ref.current && ball.pocketed) {
      ref.current.visible = false;
    }
  });

  const isStripe = ball.kind === "stripe";
  const isEight = ball.kind === "eight";
  const isCue = ball.kind === "cue";

  return (
    <group ref={ref} position={ball.pos.toArray()}>
      <mesh castShadow>
        <sphereGeometry args={[ball.radius, 32, 32]} />
        {isCue ? (
          <meshStandardMaterial color="#ffffff" roughness={0.15} metalness={0.05} />
        ) : isEight ? (
          <meshStandardMaterial color="#0a0a0a" roughness={0.2} metalness={0.1} />
        ) : (
          <meshStandardMaterial color={ball.color} roughness={0.18} metalness={0.08} />
        )}
      </mesh>

      {/* Stripe band */}
      {isStripe && (
        <mesh>
          <cylinderGeometry args={[ball.radius * 1.005, ball.radius * 1.005, ball.radius * 0.7, 32, 1, true]} />
          <meshStandardMaterial color="#ffffff" roughness={0.15} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Number circle */}
      {!isCue && (
        <mesh position={[0, ball.radius * 0.96, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[ball.radius * 0.42, 24]} />
          <meshStandardMaterial color="#ffffff" roughness={0.2} />
        </mesh>
      )}
    </group>
  );
}
