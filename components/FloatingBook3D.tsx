"use client";

import { useRef, Suspense } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import { Group, SRGBColorSpace, Texture } from "three";

// Preload the fallback texture to avoid suspension issues
const FALLBACK_URL = "https://picsum.photos/seed/fallback/400/600";

function BookMesh({ coverUrl }: { coverUrl: string }) {
  const groupRef = useRef<Group>(null);
  const { pointer } = useThree();
  
  // useTexture handles caching, loading, and StrictMode lifecycle perfectly
  // We use an array so we can pass multiple, but here we just need one.
  let texture: Texture | null = null;
  try {
    texture = useTexture(coverUrl || FALLBACK_URL);
    texture.colorSpace = SRGBColorSpace;
  } catch (e) {
    console.warn("Failed to load texture, using fallback");
  }

  const imgAspect = texture?.image ? texture.image.width / texture.image.height : 1.5;

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const targetRotY = pointer.x * 0.5;
    const targetRotX = -pointer.y * 0.3;
    groupRef.current.rotation.y += (targetRotY - groupRef.current.rotation.y) * delta * 2;
    groupRef.current.rotation.x += (targetRotX - groupRef.current.rotation.x) * delta * 2;
    groupRef.current.position.y = Math.sin(Date.now() * 0.001) * 0.15;
  });

  const bookHeight = texture ? 2.7 : 2.4;
  const bookWidth = bookHeight * Math.min(imgAspect, 1.8);
  const bookDepth = 0.25;

  return (
    <group ref={groupRef}>
      {/* Lomo / Back / Pages */}
      <mesh position={[0, 0, -0.05]}>
        <boxGeometry args={[bookWidth + 0.04, bookHeight + 0.04, bookDepth + 0.02]} />
        <meshStandardMaterial color="#111" />
      </mesh>

      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[bookWidth, bookHeight, bookDepth]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.6} />
      </mesh>

      {/* Front Cover */}
      <mesh position={[0, 0, bookDepth / 2 + 0.001]}>
        <planeGeometry args={[bookWidth, bookHeight]} />
        {texture ? (
          <meshStandardMaterial map={texture} roughness={0.3} />
        ) : (
          <meshStandardMaterial color="#8B7355" roughness={0.8} />
        )}
      </mesh>

      {/* Back Cover */}
      <mesh position={[0, 0, -bookDepth / 2 - 0.001]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[bookWidth, bookHeight]} />
        <meshStandardMaterial color="#0d0d0d" />
      </mesh>

      {/* Spines and Edges */}
      <mesh position={[bookWidth / 2 + 0.001, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[bookDepth, bookHeight]} />
        <meshStandardMaterial color="#222" roughness={0.8} />
      </mesh>

      <mesh position={[-bookWidth / 2 - 0.001, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[bookDepth, bookHeight]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
      </mesh>

      <mesh position={[0, bookHeight / 2 + 0.001, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[bookWidth, bookDepth]} />
        <meshStandardMaterial color="#222" roughness={0.8} />
      </mesh>

      <mesh position={[0, -bookHeight / 2 - 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[bookWidth, bookDepth]} />
        <meshStandardMaterial color="#111" roughness={0.8} />
      </mesh>
    </group>
  );
}

function Scene({ coverUrl }: { coverUrl: string }) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 4, 5]} intensity={1.2} />
      <directionalLight position={[-2, -1, -3]} intensity={0.4} color="#a855f7" />
      <pointLight position={[0, 2, 3]} intensity={0.3} color="#d946ef" />
      <hemisphereLight args={["#ffffff", "#444466", 0.4]} />
      <Suspense fallback={null}>
        <BookMesh coverUrl={coverUrl} />
      </Suspense>
    </>
  );
}

export default function FloatingBook3D({ coverUrl, className = "" }: { coverUrl: string; className?: string }) {
  if (!coverUrl) return null;

  return (
    <div className={`w-full h-full min-h-[200px] ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 4.2], fov: 40 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <Scene coverUrl={coverUrl} />
      </Canvas>
    </div>
  );
}
