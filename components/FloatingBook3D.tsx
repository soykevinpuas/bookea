"use client";

import { useRef, useState, useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Group, SRGBColorSpace, Texture, TextureLoader, MeshBasicMaterial, BufferGeometry, Float32BufferAttribute, PointsMaterial, AdditiveBlending, Points } from "three";

const FALLBACK_URL = "https://picsum.photos/seed/fallback/400/600";

/* ─── Sparkle Particles ─── */
const seededUnit = (index: number, salt: number) => {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
};

function Sparkles({ count = 60 }: { count?: number }) {
  const pointsRef = useRef<Points>(null);
  const materialRef = useRef<PointsMaterial>(null);

  const [positions, sizes] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const siz = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (seededUnit(i, 1) - 0.5) * 6;
      pos[i * 3 + 1] = (seededUnit(i, 2) - 0.5) * 5;
      pos[i * 3 + 2] = (seededUnit(i, 3) - 0.5) * 4;
      siz[i] = seededUnit(i, 4) * 0.5 + 0.2;
    }
    return [pos, siz];
  }, [count]);

  const geometry = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
    geo.setAttribute("size", new Float32BufferAttribute(sizes, 1));
    return geo;
  }, [positions, sizes]);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    const posArr = pointsRef.current.geometry.attributes.position.array as Float32Array;
    const time = Date.now() * 0.001;
    for (let i = 0; i < count; i++) {
      posArr[i * 3 + 1] += Math.sin(time + i * 0.5) * delta * 0.15;
      posArr[i * 3] += Math.cos(time * 0.7 + i * 0.3) * delta * 0.08;
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
    pointsRef.current.rotation.y += delta * 0.03;
    if (materialRef.current) {
      materialRef.current.opacity = 0.4 + Math.sin(time * 1.5) * 0.3;
    }
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        ref={materialRef}
        color="#c084fc"
        size={0.04}
        transparent
        opacity={0.7}
        blending={AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

function BookMesh({ coverUrl }: { coverUrl: string }) {
  const groupRef = useRef<Group>(null);
  const { pointer } = useThree();
  const [texture, setTexture] = useState<Texture | null>(null);
  const [prevTexture, setPrevTexture] = useState<Texture | null>(null);
  const currentTexRef = useRef<Texture | null>(null);
  const materialRef = useRef<MeshBasicMaterial>(null);

  useEffect(() => {
    let active = true;
    const urlToLoad = coverUrl || FALLBACK_URL;

    const loader = new TextureLoader();
    loader.setCrossOrigin("anonymous");

    loader.load(
      urlToLoad,
      (tex) => {
        if (!active) return;
        tex.colorSpace = SRGBColorSpace;
        tex.needsUpdate = true;
        setPrevTexture(currentTexRef.current);
        currentTexRef.current = tex;
        setTexture(tex);
        if (materialRef.current) materialRef.current.opacity = 0;
      },
      undefined,
      () => {
        console.warn("Texture failed to load", urlToLoad);
        if (urlToLoad !== FALLBACK_URL && active) {
          loader.load(FALLBACK_URL, (fallbackTex) => {
             if (!active) return;
             fallbackTex.colorSpace = SRGBColorSpace;
             fallbackTex.needsUpdate = true;
             setPrevTexture(currentTexRef.current);
             currentTexRef.current = fallbackTex;
             setTexture(fallbackTex);
             if (materialRef.current) materialRef.current.opacity = 0;
          });
        }
      }
    );

    return () => {
      active = false;
    };
  }, [coverUrl]);

  const img = texture?.image as HTMLImageElement | undefined;
  const imgAspect = img && img.width && img.height
    ? img.width / img.height
    : 1.5;

  useFrame((_, delta) => {
    if (groupRef.current) {
      const targetRotY = pointer.x * 0.5;
      const targetRotX = -pointer.y * 0.3;
      groupRef.current.rotation.y += (targetRotY - groupRef.current.rotation.y) * delta * 2;
      groupRef.current.rotation.x += (targetRotX - groupRef.current.rotation.x) * delta * 2;
      groupRef.current.position.y = Math.sin(Date.now() * 0.001) * 0.06;
    }

    // Smooth crossfade
    if (materialRef.current && materialRef.current.opacity < 1) {
      materialRef.current.opacity += delta * 2.5; // Fades in ~0.4s
    }
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

      {/* Front Cover - Previous (Behind) */}
      <mesh position={[0, 0, bookDepth / 2 + 0.001]}>
        <planeGeometry args={[bookWidth, bookHeight]} />
        {prevTexture ? (
          <meshBasicMaterial map={prevTexture} />
        ) : (
          <meshStandardMaterial color="#8B7355" roughness={0.8} />
        )}
      </mesh>

      {/* Front Cover - Current (Fading in) */}
      <mesh position={[0, 0, bookDepth / 2 + 0.002]}>
        <planeGeometry args={[bookWidth, bookHeight]} />
        {texture && (
          <meshBasicMaterial ref={materialRef} map={texture} transparent opacity={1} />
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
      <BookMesh coverUrl={coverUrl} />
      <Sparkles count={50} />
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
