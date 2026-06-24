"use client";

import { useRef, useState, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { TextureLoader, Group } from "three";

function BookMesh({ coverUrl }: { coverUrl: string }) {
  const groupRef = useRef<Group>(null);
  const { pointer } = useThree();
  const [texture, setTexture] = useState<any>(null);
  const [imgAspect, setImgAspect] = useState(1.5);

  useEffect(() => {
    if (!coverUrl) return;
    const loader = new TextureLoader();
    const tex = loader.load(
      coverUrl,
      (loaded) => {
        setTexture(loaded);
        const img = loaded.image as HTMLImageElement;
        if (img?.width && img?.height) {
          setImgAspect(img.width / img.height);
        }
      },
      undefined,
      () => { /* error - texture stays null, fallback shows plain book */ },
    );
    return () => { tex.dispose(); };
  }, [coverUrl]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const targetRotY = pointer.x * 0.5;
    const targetRotX = -pointer.y * 0.3;
    groupRef.current.rotation.y += (targetRotY - groupRef.current.rotation.y) * delta * 2;
    groupRef.current.rotation.x += (targetRotX - groupRef.current.rotation.x) * delta * 2;
    groupRef.current.position.y = Math.sin(Date.now() * 0.001) * 0.15;
  });

  const bookHeight = 2.7;
  const bookWidth = bookHeight * Math.min(imgAspect, 1.8);
  const bookDepth = 0.25;

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[bookWidth, bookHeight, bookDepth]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      <mesh position={[0, 0, bookDepth / 2 + 0.001]}>
        <planeGeometry args={[bookWidth, bookHeight]} />
        <meshStandardMaterial map={texture} toneMapped={false} />
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
      <directionalLight position={[2, 4, 5]} intensity={1.5} />
      <directionalLight position={[-2, -1, -3]} intensity={0.3} color="#4466ff" />
      <pointLight position={[0, 2, 3]} intensity={0.5} color="#8888ff" />
      <BookMesh coverUrl={coverUrl} />
    </>
  );
}

export default function FloatingBook3D({ coverUrl, className = "" }: { coverUrl: string; className?: string }) {
  if (!coverUrl) return null;

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
