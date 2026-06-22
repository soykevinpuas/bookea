"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { TextureLoader, Group, type Mesh } from "three";

function BookMesh({ coverUrl }: { coverUrl: string }) {
  const meshRef = useRef<Mesh>(null);
  const { pointer } = useThree();
  const texture = useMemo(() => {
    const loader = new TextureLoader();
    return loader.load(coverUrl);
  }, [coverUrl]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const targetRotY = pointer.x * 0.5;
    const targetRotX = -pointer.y * 0.3;
    meshRef.current.rotation.y += (targetRotY - meshRef.current.rotation.y) * delta * 2;
    meshRef.current.rotation.x += (targetRotX - meshRef.current.rotation.x) * delta * 2;
    meshRef.current.position.y = Math.sin(Date.now() * 0.001) * 0.15;
  });

  const bookWidth = 1.8;
  const bookHeight = 2.7;
  const bookDepth = 0.25;

  return (
    <group ref={meshRef}>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[bookWidth, bookHeight, bookDepth]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      <mesh position={[0, 0, bookDepth / 2 + 0.001]}>
        <planeGeometry args={[bookWidth, bookHeight]} />
        <meshStandardMaterial map={texture} />
      </mesh>

      <mesh position={[0, 0, -bookDepth / 2 - 0.001]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[bookWidth, bookHeight]} />
        <meshStandardMaterial color="#0d0d0d" />
      </mesh>

      <mesh position={[bookWidth / 2 + 0.001, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[bookDepth, bookHeight]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>

      <mesh position={[-bookWidth / 2 - 0.001, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[bookDepth, bookHeight]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      <mesh position={[0, bookHeight / 2 + 0.001, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[bookWidth, bookDepth]} />
        <meshStandardMaterial color="#222" />
      </mesh>

      <mesh position={[0, -bookHeight / 2 - 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[bookWidth, bookDepth]} />
        <meshStandardMaterial color="#111" />
      </mesh>
    </group>
  );
}

function Scene({ coverUrl }: { coverUrl: string }) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[2, 3, 4]} intensity={1.2} />
      <directionalLight position={[-2, -1, -3]} intensity={0.3} color="#4466ff" />
      <pointLight position={[0, 2, 3]} intensity={0.5} color="#8888ff" />
      <BookMesh coverUrl={coverUrl} />
    </>
  );
}

export default function FloatingBook3D({ coverUrl, className = "" }: { coverUrl: string; className?: string }) {
  return (
    <div className={`w-full h-full ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 4.5], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <Scene coverUrl={coverUrl} />
      </Canvas>
    </div>
  );
}
