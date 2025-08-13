"use client";

import { useRef, useState, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Billboard, Sphere, Line } from "@react-three/drei";
import { motion } from "framer-motion";
import * as THREE from "three";
import { Maximize2, Info, TrendingUp, Users, Target } from "lucide-react";

interface Competitor {
  id: string;
  name: string;
  position: [number, number, number];
  geoScore: number;
  sov: number;
  growth: number;
  color: string;
  isYou?: boolean;
}

const competitors: Competitor[] = [
  {
    id: "you",
    name: "Your Brand",
    position: [2, 3, 1],
    geoScore: 87,
    sov: 32.4,
    growth: 12.5,
    color: "#8b5cf6",
    isYou: true,
  },
  {
    id: "comp1",
    name: "TechCorp",
    position: [3, 2.5, -1],
    geoScore: 92,
    sov: 38.2,
    growth: 8.3,
    color: "#ef4444",
  },
  {
    id: "comp2",
    name: "InnovateCo",
    position: [-2, 2, 0],
    geoScore: 78,
    sov: 18.5,
    growth: 15.2,
    color: "#3b82f6",
  },
  {
    id: "comp3",
    name: "FutureTech",
    position: [-1, -1, 2],
    geoScore: 65,
    sov: 10.9,
    growth: -2.1,
    color: "#f59e0b",
  },
  {
    id: "comp4",
    name: "NextGen",
    position: [0, 0, -2],
    geoScore: 45,
    sov: 5.2,
    growth: -5.8,
    color: "#6b7280",
  },
];

function CompetitorNode({ competitor, onSelect }: { competitor: Competitor; onSelect: (c: Competitor) => void }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime) * 0.1;
      if (hovered) {
        meshRef.current.scale.lerp(new THREE.Vector3(1.2, 1.2, 1.2), 0.1);
      } else {
        meshRef.current.scale.lerp(new THREE.Vector3(1, 1, 1), 0.1);
      }
    }
  });

  const size = (competitor.geoScore / 100) * 0.8 + 0.4;

  return (
    <group position={competitor.position}>
      <Sphere
        ref={meshRef}
        args={[size, 32, 32]}
        onClick={() => onSelect(competitor)}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <meshPhysicalMaterial
          color={competitor.color}
          emissive={competitor.color}
          emissiveIntensity={competitor.isYou ? 0.3 : 0.1}
          roughness={0.3}
          metalness={0.8}
          clearcoat={1}
          clearcoatRoughness={0}
          transparent
          opacity={0.9}
        />
      </Sphere>
      
      {competitor.isYou && (
        <pointLight color={competitor.color} intensity={1} distance={3} />
      )}
      
      <Billboard position={[0, size + 0.5, 0]}>
        <Text
          fontSize={0.2}
          color="white"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="black"
        >
          {competitor.name}
        </Text>
        <Text
          fontSize={0.15}
          color={competitor.growth > 0 ? "#10b981" : "#ef4444"}
          anchorX="center"
          anchorY="top"
          position={[0, -0.2, 0]}
        >
          {competitor.growth > 0 ? "+" : ""}{competitor.growth}%
        </Text>
      </Billboard>
    </group>
  );
}

function ConnectionLines() {
  const points = useMemo(() => {
    const lines = [];
    for (let i = 0; i < competitors.length; i++) {
      for (let j = i + 1; j < competitors.length; j++) {
        const distance = Math.sqrt(
          Math.pow(competitors[i].position[0] - competitors[j].position[0], 2) +
          Math.pow(competitors[i].position[1] - competitors[j].position[1], 2) +
          Math.pow(competitors[i].position[2] - competitors[j].position[2], 2)
        );
        if (distance < 4) {
          lines.push([competitors[i].position, competitors[j].position]);
        }
      }
    }
    return lines;
  }, []);

  return (
    <>
      {points.map((points, index) => (
        <Line
          key={index}
          points={points}
          color="white"
          lineWidth={0.5}
          opacity={0.1}
          transparent
        />
      ))}
    </>
  );
}

function Scene({ onSelectCompetitor }: { onSelectCompetitor: (c: Competitor) => void }) {
  const { camera } = useThree();
  
  useFrame((state) => {
    const time = state.clock.elapsedTime;
    camera.position.x = Math.sin(time * 0.1) * 0.5 + 5;
    camera.position.y = Math.cos(time * 0.1) * 0.5 + 3;
    camera.lookAt(0, 0, 0);
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} intensity={0.5} />
      <pointLight position={[-10, -10, -10]} intensity={0.3} />
      
      <ConnectionLines />
      
      {competitors.map((competitor) => (
        <CompetitorNode
          key={competitor.id}
          competitor={competitor}
          onSelect={onSelectCompetitor}
        />
      ))}
      
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        autoRotate={true}
        autoRotateSpeed={0.5}
      />
    </>
  );
}

export function CompetitorLandscape3D() {
  const [selectedCompetitor, setSelectedCompetitor] = useState<Competitor | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn(
        "glassmorphism rounded-xl p-6",
        isFullscreen && "fixed inset-4 z-50"
      )}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold mb-1">Competitive Landscape</h2>
          <p className="text-sm text-muted-foreground">3D visualization of market positioning</p>
        </div>
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-2 rounded-lg glassmorphism glassmorphism-hover"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      <div className={cn("rounded-lg bg-black/20", isFullscreen ? "h-[calc(100vh-200px)]" : "h-[400px]")}>
        <Canvas camera={{ position: [5, 3, 5], fov: 60 }}>
          <Scene onSelectCompetitor={setSelectedCompetitor} />
        </Canvas>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-purple-500" />
          <div>
            <p className="text-xs text-muted-foreground">Position</p>
            <p className="text-sm font-medium">GEO Score Axis</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-500" />
          <div>
            <p className="text-xs text-muted-foreground">Size</p>
            <p className="text-sm font-medium">Market Share</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-green-500" />
          <div>
            <p className="text-xs text-muted-foreground">Color</p>
            <p className="text-sm font-medium">Growth Rate</p>
          </div>
        </div>
      </div>

      {selectedCompetitor && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-4 glassmorphism rounded-lg"
        >
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium mb-1">{selectedCompetitor.name}</p>
              <div className="grid grid-cols-3 gap-4 mt-2">
                <div>
                  <p className="text-xs text-muted-foreground">GEO Score</p>
                  <p className="text-lg font-bold">{selectedCompetitor.geoScore}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Share of Voice</p>
                  <p className="text-lg font-bold">{selectedCompetitor.sov}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Growth</p>
                  <p className={cn(
                    "text-lg font-bold",
                    selectedCompetitor.growth > 0 ? "text-green-500" : "text-red-500"
                  )}>
                    {selectedCompetitor.growth > 0 ? "+" : ""}{selectedCompetitor.growth}%
                  </p>
                </div>
              </div>
              {selectedCompetitor.isYou && (
                <div className="mt-2">
                  <p className="text-xs text-purple-400">
                    💡 You're outperforming 60% of competitors. Focus on content gaps to overtake TechCorp.
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// Add missing import
import { cn } from "@/lib/utils";