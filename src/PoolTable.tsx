import { TABLE, POCKETS } from "./physics";

export function PoolTable() {
  const railH = TABLE.railH;
  const railW = TABLE.railW;
  const W = TABLE.width;
  const D = TABLE.depth;

  return (
    <group>
      {/* Felt */}
      <mesh receiveShadow position={[0, TABLE.feltY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#0a6b46" roughness={0.85} metalness={0} />
      </mesh>

      {/* Felt subtle glow overlay */}
      <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W * 0.96, D * 0.96]} />
        <meshStandardMaterial
          color="#0d8a5c"
          emissive="#0a5c3e"
          emissiveIntensity={0.25}
          roughness={0.7}
          transparent
          opacity={0.5}
        />
      </mesh>

      {/* Rails - top & bottom (Z) */}
      {[-1, 1].map((s) => (
        <group key={`rz${s}`}>
          <mesh castShadow position={[-W / 4, railH / 2, s * (D / 2 + railW / 2)]}>
            <boxGeometry args={[W / 2 - TABLE.pocketR * 2, railH, railW]} />
            <meshStandardMaterial color="#2a1408" roughness={0.4} metalness={0.3} />
          </mesh>
          <mesh castShadow position={[W / 4, railH / 2, s * (D / 2 + railW / 2)]}>
            <boxGeometry args={[W / 2 - TABLE.pocketR * 2, railH, railW]} />
            <meshStandardMaterial color="#2a1408" roughness={0.4} metalness={0.3} />
          </mesh>
        </group>
      ))}

      {/* Rails - left & right (X) */}
      {[-1, 1].map((s) => (
        <mesh
          key={`rx${s}`}
          castShadow
          position={[s * (W / 2 + railW / 2), railH / 2, 0]}
        >
          <boxGeometry args={[railW, railH, D - TABLE.pocketR * 2]} />
          <meshStandardMaterial color="#2a1408" roughness={0.4} metalness={0.3} />
        </mesh>
      ))}

      {/* Rail top accent strips (neon) */}
      {[-1, 1].map((s) => (
        <mesh key={`nz${s}`} position={[0, railH + 0.001, s * (D / 2 + railW)]}>
          <boxGeometry args={[W - TABLE.pocketR * 4, 0.008, 0.02]} />
          <meshStandardMaterial color="#00e5ff" emissive="#00e5ff" emissiveIntensity={1.8} toneMapped={false} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`nx${s}`} position={[s * (W / 2 + railW), railH + 0.001, 0]}>
          <boxGeometry args={[0.02, 0.008, D - TABLE.pocketR * 4]} />
          <meshStandardMaterial color="#ff2d75" emissive="#ff2d75" emissiveIntensity={1.8} toneMapped={false} />
        </mesh>
      ))}

      {/* Pockets */}
      {POCKETS.map((p, i) => (
        <mesh key={i} position={[p.x, -0.01, p.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[TABLE.pocketR, 32]} />
          <meshStandardMaterial color="#000000" roughness={1} />
        </mesh>
      ))}
      {/* Pocket rim glow */}
      {POCKETS.map((p, i) => (
        <mesh key={`r${i}`} position={[p.x, 0.005, p.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[TABLE.pocketR, TABLE.pocketR + 0.015, 32]} />
          <meshStandardMaterial color="#ff2d75" emissive="#ff2d75" emissiveIntensity={1.2} transparent opacity={0.7} toneMapped={false} side={2} />
        </mesh>
      ))}

      {/* Apron/skirt below rails */}
      <mesh castShadow position={[0, -0.06, -(D / 2 + railW / 2)]}>
        <boxGeometry args={[W + railW * 2, 0.18, 0.04]} />
        <meshStandardMaterial color="#1a0d05" roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh castShadow position={[0, -0.06, D / 2 + railW / 2]}>
        <boxGeometry args={[W + railW * 2, 0.18, 0.04]} />
        <meshStandardMaterial color="#1a0d05" roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh castShadow position={[-(W / 2 + railW / 2), -0.06, 0]}>
        <boxGeometry args={[0.04, 0.18, D + railW * 2]} />
        <meshStandardMaterial color="#1a0d05" roughness={0.5} metalness={0.4} />
      </mesh>
      <mesh castShadow position={[W / 2 + railW / 2, -0.06, 0]}>
        <boxGeometry args={[0.04, 0.18, D + railW * 2]} />
        <meshStandardMaterial color="#1a0d05" roughness={0.5} metalness={0.4} />
      </mesh>

      {/* Table base slab */}
      <mesh castShadow position={[0, -0.17, 0]}>
        <boxGeometry args={[W + railW * 2, 0.08, D + railW * 2]} />
        <meshStandardMaterial color="#1a0d05" roughness={0.5} metalness={0.4} />
      </mesh>

      {/* Modern tapered legs */}
      {[
        [-(W / 2 + railW * 0.3), -(D / 2 + railW * 0.3)],
        [W / 2 + railW * 0.3, -(D / 2 + railW * 0.3)],
        [-(W / 2 + railW * 0.3), D / 2 + railW * 0.3],
        [W / 2 + railW * 0.3, D / 2 + railW * 0.3],
      ].map((pos, i) => (
        <group key={i} position={[pos[0], -0.21, pos[1]]}>
          {/* Upper leg - wider */}
          <mesh castShadow position={[0, -0.2, 0]}>
            <cylinderGeometry args={[0.07, 0.05, 0.4, 12]} />
            <meshStandardMaterial color="#0d0703" roughness={0.35} metalness={0.6} />
          </mesh>
          {/* Lower leg - narrower */}
          <mesh castShadow position={[0, -0.55, 0]}>
            <cylinderGeometry args={[0.045, 0.035, 0.3, 12]} />
            <meshStandardMaterial color="#0d0703" roughness={0.35} metalness={0.6} />
          </mesh>
          {/* Foot pad */}
          <mesh castShadow position={[0, -0.72, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.04, 12]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.7} />
          </mesh>
        </group>
      ))}

      {/* Floor */}
      <mesh receiveShadow position={[0, -0.94, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#08090f" roughness={0.9} metalness={0.1} />
      </mesh>
    </group>
  );
}
