"use client";

import React, { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";

export interface MiniMatrixItem {
  shortLabel: string;
  status: "REPRESENTATIVE" | "PARTIAL" | "NOT_REPRESENTATIVE";
}

export interface GlobePin {
  id: string;
  name: string;
  lat: number;
  lon: number;
  rank?: number;
  subtitle?: string;
  miniMatrix?: MiniMatrixItem[];
}

function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

function PinMarker({
  pin,
  isSelected,
  isHovered,
  body,
  onSelect,
  onHover,
}: {
  pin: GlobePin;
  isSelected: boolean;
  isHovered: boolean;
  body: "moon" | "mars" | "earth";
  onSelect: (id: string) => void;
  onHover: (pin: GlobePin | null) => void;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const regionRef = useRef<THREE.Group>(null);

  const pos = useMemo(() => latLonToVector3(pin.lat, pin.lon, 2.025), [pin.lat, pin.lon]);
  const surfacePos = useMemo(() => latLonToVector3(pin.lat, pin.lon, 2.012), [pin.lat, pin.lon]);

  // Orient the regional area outline ring flush to the sphere's curved surface
  const surfaceQuat = useMemo(() => {
    const normal = surfacePos.clone().normalize();
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  }, [surfacePos]);

  useFrame(({ clock }) => {
    if (ringRef.current) {
      const scale = isSelected ? 1.25 + Math.sin(clock.getElapsedTime() * 4) * 0.25 : 1.0;
      ringRef.current.scale.set(scale, scale, scale);
    }
    if (regionRef.current && (isHovered || isSelected)) {
      const pulse = 1.0 + Math.sin(clock.getElapsedTime() * 3.5) * 0.06;
      regionRef.current.scale.set(pulse, pulse, 1);
    }
  });

  const isTop5 = body !== "earth" || (pin.rank !== undefined && pin.rank <= 5);

  const pinColor = isSelected
    ? "#22d3ee"
    : isHovered
    ? "#facc15"
    : body === "earth"
    ? isTop5
      ? "#34d399"
      : "#64748b"
    : body === "mars"
    ? "#fb7185"
    : "#38bdf8";

  const radius = isSelected ? 0.072 : isTop5 ? 0.05 : 0.032;
  const areaRadius = body === "earth" ? 0.16 : 0.21;

  return (
    <>
      <group position={pos}>
        <mesh
          onClick={(e) => {
            e.stopPropagation();
            onSelect(pin.id);
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            onHover(pin);
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            onHover(null);
            document.body.style.cursor = "default";
          }}
        >
          <sphereGeometry args={[radius, 14, 14]} />
          <meshStandardMaterial
            color={pinColor}
            emissive={pinColor}
            emissiveIntensity={isSelected ? 2.4 : isTop5 ? 1.35 : 0.6}
          />
        </mesh>

        {(isTop5 || isSelected) && (
          <mesh ref={ringRef}>
            <sphereGeometry args={[radius * 1.75, 10, 10]} />
            <meshBasicMaterial color={pinColor} transparent opacity={isSelected ? 0.42 : 0.16} wireframe />
          </mesh>
        )}
      </group>

      {/* Regional Area Highlight + Crisp Perimeter Outline when Hovered or Selected */}
      {(isHovered || isSelected) && (
        <group ref={regionRef} position={surfacePos} quaternion={surfaceQuat}>
          {/* Shaded Regional Area */}
          <mesh>
            <circleGeometry args={[areaRadius, 36]} />
            <meshBasicMaterial
              color={isSelected ? "#22d3ee" : "#facc15"}
              transparent
              opacity={isSelected ? 0.22 : 0.16}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* Glowing Outer Region Outline */}
          <mesh position={[0, 0, 0.004]}>
            <ringGeometry args={[areaRadius * 0.9, areaRadius * 1.08, 36]} />
            <meshBasicMaterial
              color={isSelected ? "#22d3ee" : "#facc15"}
              transparent
              opacity={0.92}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* Secondary Dashed/Outer Halo Ring */}
          <mesh position={[0, 0, 0.003]}>
            <ringGeometry args={[areaRadius * 1.25, areaRadius * 1.32, 36]} />
            <meshBasicMaterial
              color={isSelected ? "#38bdf8" : "#fde047"}
              transparent
              opacity={0.45}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      )}
    </>
  );
}

function RotatingGlobe({
  body,
  pins,
  selectedPinId,
  hoveredPinId,
  onSelectPin,
  onHoverPin,
}: {
  body: "moon" | "mars" | "earth";
  pins: GlobePin[];
  selectedPinId: string | null;
  hoveredPinId: string | null;
  onSelectPin: (id: string) => void;
  onHoverPin: (pin: GlobePin | null) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const texture = useLoader(THREE.TextureLoader, `/textures/${body}.jpg`);

  useFrame((_, delta) => {
    if (groupRef.current && !selectedPinId && !hoveredPinId) {
      groupRef.current.rotation.y += delta * 0.06;
    }
  });

  const haloColor = body === "mars" ? "#f97316" : body === "earth" ? "#38bdf8" : "#94a3b8";

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[2, 64, 64]} />
        <meshStandardMaterial
          map={texture}
          bumpMap={texture}
          bumpScale={body === "moon" ? 0.04 : 0.025}
          roughness={body === "earth" ? 0.65 : 0.92}
          metalness={0.05}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[2.06, 48, 48]} />
        <meshBasicMaterial
          color={haloColor}
          transparent
          opacity={body === "moon" ? 0.04 : 0.12}
          side={THREE.BackSide}
        />
      </mesh>

      {pins.map((pin) => (
        <PinMarker
          key={pin.id}
          pin={pin}
          isSelected={pin.id === selectedPinId}
          isHovered={pin.id === hoveredPinId}
          body={body}
          onSelect={onSelectPin}
          onHover={onHoverPin}
        />
      ))}
    </group>
  );
}

export default function PlanetGlobe({
  body,
  pins,
  selectedPinId,
  onSelectPin,
}: {
  body: "moon" | "mars" | "earth";
  pins: GlobePin[];
  selectedPinId: string | null;
  onSelectPin: (id: string) => void;
}) {
  const [hoveredPin, setHoveredPin] = useState<GlobePin | null>(null);
  const camPos: [number, number, number] = body === "moon" ? [0, -2.8, 4.4] : [0, 1.0, 5.2];

  const activePin = hoveredPin || pins.find((p) => p.id === selectedPinId) || null;

  return (
    <div className="w-full h-full min-h-[380px] relative">
      {activePin && (
        <div className="absolute top-3 right-3 z-10 px-3 py-2.5 rounded-2xl bg-slate-950/92 border border-cyan-400/50 text-white text-xs font-mono shadow-2xl pointer-events-none max-w-[270px]">
          <div className="font-bold text-cyan-300 truncate">
            {activePin.rank ? `#${activePin.rank} ` : ""}
            {activePin.name}
          </div>
          <div className="text-[10px] text-slate-400">
            {activePin.lat.toFixed(2)}°, {activePin.lon.toFixed(2)}°
          </div>
          {activePin.subtitle && <div className="text-[10px] text-emerald-300 mt-0.5">{activePin.subtitle}</div>}

          {activePin.miniMatrix && (
            <div className="grid grid-cols-3 gap-1 mt-2 pt-2 border-t border-slate-800">
              {activePin.miniMatrix.map((item, idx) => (
                <span
                  key={idx}
                  className={`px-1.5 py-0.5 rounded text-[9px] text-center border ${
                    item.status === "REPRESENTATIVE"
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : item.status === "PARTIAL"
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                      : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                  }`}
                >
                  {item.shortLabel}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <Canvas camera={{ position: camPos, fov: 45 }}>
        <ambientLight intensity={0.75} />
        <directionalLight position={[10, 6, 8]} intensity={1.8} />
        <pointLight position={[-8, -5, -6]} intensity={0.35} color="#38bdf8" />
        <Stars radius={60} depth={30} count={1800} factor={3} fade />
        <React.Suspense fallback={null}>
          <RotatingGlobe
            body={body}
            pins={pins}
            selectedPinId={selectedPinId}
            hoveredPinId={hoveredPin?.id || null}
            onSelectPin={onSelectPin}
            onHoverPin={setHoveredPin}
          />
        </React.Suspense>
        <OrbitControls enablePan={false} minDistance={3.2} maxDistance={8.5} />
      </Canvas>
    </div>
  );
}