"use client";

import { useRef, useState, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Text, Billboard, Sphere, Line } from "@react-three/drei";
import { motion } from "framer-motion";
import * as THREE from "three";
import { Maximize2, Info, TrendingUp, Users, Target, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Competitor {
  id: string;
  name: string;
  position: [number, number, number];
  geoScore: number;
  sov: number;
  growth: number;
  color: string;
  isYou?: boolean;
  domain?: string;
}

interface CompetitorLandscape3DProps {
  companyId?: string;
}

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

function ConnectionLines({ competitors }: { competitors: Competitor[] }) {
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
  }, [competitors]);

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

function Scene({ competitors, onSelectCompetitor }: { competitors: Competitor[], onSelectCompetitor: (c: Competitor) => void }) {
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
      
      <ConnectionLines competitors={competitors} />
      
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

export function CompetitorLandscape3D({ companyId }: CompetitorLandscape3DProps) {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedCompetitor, setSelectedCompetitor] = useState<Competitor | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Fetch competitor data from API
  const fetchCompetitorData = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_GATEWAY || 'http://localhost:4000';
      
      const response = await fetch(`${apiUrl}/api/competitors${companyId ? `?companyId=${companyId}` : ''}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setCompetitors(transformToCompetitors(data));
        setError(null);
      } else if (response.status === 404) {
        // No data yet - show empty state
        setCompetitors(getEmptyCompetitors());
        setError(null);
      } else {
        throw new Error('Failed to fetch competitor data');
      }
    } catch (err) {
      console.error('Failed to fetch competitors:', err);
      setError('Unable to load competitor data');
      // Show empty state instead of fake data
      setCompetitors(getEmptyCompetitors());
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  // Transform API response to Competitor format
  const transformToCompetitors = (data: any): Competitor[] => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return getEmptyCompetitors();
    }

    const colors = ["#8b5cf6", "#ef4444", "#3b82f6", "#f59e0b", "#6b7280", "#10b981", "#ec4899"];
    
    return data.map((comp: any, index: number) => {
      // Calculate 3D position based on metrics
      const x = ((comp.geoScore || 50) - 50) / 10; // GEO score affects X position
      const y = ((comp.sov || 0) / 20) - 1; // Share of voice affects Y position
      const z = ((comp.growth || 0) / 10); // Growth affects Z position
      
      return {
        id: comp.id || `comp-${index}`,
        name: comp.name || comp.domain || `Competitor ${index + 1}`,
        position: [x, y, z] as [number, number, number],
        geoScore: comp.geoScore || 0,
        sov: comp.sov || comp.shareOfVoice || 0,
        growth: comp.growth || comp.growthRate || 0,
        color: comp.isYou ? "#8b5cf6" : colors[index % colors.length],
        isYou: comp.isYou || false,
        domain: comp.domain
      };
    });
  };

  // Get empty competitors for no data state
  const getEmptyCompetitors = (): Competitor[] => {
    return [{
      id: "placeholder",
      name: "No Data",
      position: [0, 0, 0],
      geoScore: 0,
      sov: 0,
      growth: 0,
      color: "#6b7280",
      isYou: false
    }];
  };

  // Set up WebSocket for real-time updates
  useEffect(() => {
    let ws: WebSocket | null = null;
    
    const connectWebSocket = () => {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000/ws';
      const token = localStorage.getItem('auth_token');
      
      try {
        ws = new WebSocket(`${wsUrl}?token=${token}`);
        
        ws.onopen = () => {
          console.log('Competitor landscape WebSocket connected');
          // Subscribe to competitor updates
          ws?.send(JSON.stringify({ 
            type: 'subscribe', 
            channel: 'competitors',
            companyId: companyId 
          }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'competitor_update' && data.payload) {
              setCompetitors(transformToCompetitors(data.payload));
            }
          } catch (err) {
            console.error('Failed to parse WebSocket message:', err);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
        };

        ws.onclose = () => {
          console.log('WebSocket disconnected, attempting reconnect...');
          // Reconnect after 5 seconds
          setTimeout(connectWebSocket, 5000);
        };
      } catch (err) {
        console.error('Failed to connect WebSocket:', err);
      }
    };

    // Initial fetch
    fetchCompetitorData();
    
    // Connect WebSocket for real-time updates
    connectWebSocket();

    // Cleanup
    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, [companyId]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchCompetitorData();
  };

  if (loading) {
    return (
      <div className="glassmorphism rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold mb-1">Competitive Landscape</h2>
            <p className="text-sm text-muted-foreground">Loading competitor data...</p>
          </div>
        </div>
        <div className="h-[400px] rounded-lg bg-black/20 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  const hasRealData = competitors.length > 0 && competitors[0].id !== "placeholder";

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
          <p className="text-sm text-muted-foreground">
            {hasRealData ? "3D visualization of market positioning" : "No competitor data available"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg glassmorphism glassmorphism-hover"
          >
            <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-lg glassmorphism glassmorphism-hover"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm mb-4">
          {error}
        </div>
      )}

      <div className={cn("rounded-lg bg-black/20", isFullscreen ? "h-[calc(100vh-200px)]" : "h-[400px]")}>
        {hasRealData ? (
          <Canvas camera={{ position: [5, 3, 5], fov: 60 }}>
            <Scene competitors={competitors} onSelectCompetitor={setSelectedCompetitor} />
          </Canvas>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400">
            <div className="text-center">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No competitor data available</p>
              <p className="text-sm mt-1">Add competitors to see the landscape visualization</p>
            </div>
          </div>
        )}
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

      {selectedCompetitor && selectedCompetitor.id !== "placeholder" && (
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
                  <p className="text-lg font-bold">{selectedCompetitor.geoScore || '--'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Share of Voice</p>
                  <p className="text-lg font-bold">{selectedCompetitor.sov ? `${selectedCompetitor.sov}%` : '--'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Growth</p>
                  <p className={cn(
                    "text-lg font-bold",
                    selectedCompetitor.growth > 0 ? "text-green-500" : selectedCompetitor.growth < 0 ? "text-red-500" : "text-gray-400"
                  )}>
                    {selectedCompetitor.growth !== 0 ? `${selectedCompetitor.growth > 0 ? "+" : ""}${selectedCompetitor.growth}%` : '--'}
                  </p>
                </div>
              </div>
              {selectedCompetitor.isYou && selectedCompetitor.geoScore > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-purple-400">
                    💡 {
                      selectedCompetitor.geoScore > 80 
                        ? "Excellent position! Maintain your competitive advantage."
                        : selectedCompetitor.geoScore > 60
                        ? "Good position. Focus on content gaps to improve further."
                        : selectedCompetitor.geoScore > 40
                        ? "Average position. Significant improvement opportunities available."
                        : "Below average. Immediate action needed to improve visibility."
                    }
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