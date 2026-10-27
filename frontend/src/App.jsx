import React, { useState, useEffect, useMemo, useRef } from 'react';
import Header from './components/Header';
import CityMap from './components/CityMap';
import MetricCards from './components/MetricCards';
import RouteControls from './components/RouteControls';
import StopItinerary from './components/StopItinerary';
import { SAMPLE_PRESETS } from './data/sampleCityGraph';
import { checkBackendHealth, optimizeRoute } from './services/optimizerApi';

export default function App() {
  // Preset and graph selection state
  const [selectedPresetId, setSelectedPresetId] = useState(SAMPLE_PRESETS[0].id);
  const activePreset = useMemo(() => {
    return SAMPLE_PRESETS.find((p) => p.id === selectedPresetId) || SAMPLE_PRESETS[0];
  }, [selectedPresetId]);

  const [selectedStopCount, setSelectedStopCount] = useState(activePreset.defaultStopCount);

  // Synchronize stop count when switching presets
  const handlePresetChange = (newPresetId) => {
    setSelectedPresetId(newPresetId);
    const targetPreset = SAMPLE_PRESETS.find((p) => p.id === newPresetId) || SAMPLE_PRESETS[0];
    setSelectedStopCount(targetPreset.defaultStopCount);
    setRouteData(null);
    setErrorMessage(null);
    setSimulationProgress(0);
    setIsPlaying(false);
  };

  // Derive active customer stops according to stop count selector
  const activeStops = useMemo(() => {
    return activePreset.availableCustomerStops.slice(0, selectedStopCount);
  }, [activePreset, selectedStopCount]);

  // Node Map for fast node info lookups
  const nodeMap = useMemo(() => {
    const map = new Map();
    activePreset.nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [activePreset]);

  // System state
  const [backendHealth, setBackendHealth] = useState({ online: false, executableExists: false });
  const [routeData, setRouteData] = useState(null);
  const [activeAlgorithm, setActiveAlgorithm] = useState('two_opt');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  // Simulation playback state
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const animationRef = useRef(null);

  // 1. Initial health probe on mount
  useEffect(() => {
    let isMounted = true;
    const probe = async () => {
      const health = await checkBackendHealth();
      if (isMounted) setBackendHealth(health);
    };
    probe();
    const interval = setInterval(probe, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // 2. Playback animation loop
  useEffect(() => {
    if (!isPlaying) {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      return;
    }

    let lastTime = performance.now();
    const loop = (currentTime) => {
      const dt = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      setSimulationProgress((prev) => {
        const next = prev + dt * 0.15; // Complete tour in ~6.5 seconds
        if (next >= 1.0) {
          setIsPlaying(false);
          return 1.0;
        }
        return next;
      });

      animationRef.current = requestAnimationFrame(loop);
    };

    animationRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [isPlaying]);

  // 3. Execution handler invoking Express API -> C++ binary
  const handleExecuteOptimization = async (targetAlgorithm) => {
    if (isLoading) return; // Prevent repeated clicks while in-flight
    setIsLoading(true);
    setErrorMessage(null);
    setIsPlaying(false);
    setSimulationProgress(0);

    const payload = {
      warehouse: activePreset.warehouse,
      stops: activeStops,
      nodes: activePreset.nodes,
      roads: activePreset.roads
    };

    try {
      const result = await optimizeRoute(payload);
      setRouteData(result);
      setActiveAlgorithm(targetAlgorithm);
      setSimulationProgress(0);
    } catch (err) {
      console.error('[App] Optimization request failed:', err);
      setErrorMessage(err.message || 'An unexpected error occurred during optimization');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased selection:bg-cyan-500 selection:text-slate-950">
      {/* Header */}
      <Header backendHealth={backendHealth} />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-5">
        {/* Error Notification Alert */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start justify-between gap-3 text-xs shadow-lg animate-fadeIn">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-400 hover:text-rose-200 font-bold ml-2"
            >
              ✕
            </button>
          </div>
        )}

        {/* Backend Offline Warning Banner */}
        {!backendHealth.online && (
          <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between gap-2 shadow-sm">
            <span>
              <strong>Backend Offline:</strong> Start the Express API server with{' '}
              <code className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-amber-200">
                cd backend && npm start
              </code>{' '}
              to run C++ optimization requests.
            </span>
          </div>
        )}

        {/* Metric Cards Row */}
        <MetricCards
          initialDistance={routeData?.initialDistance}
          optimizedDistance={routeData?.optimizedDistance}
          distanceSaved={routeData?.distanceSaved}
          improvementPercent={routeData?.improvementPercent}
          executionTimeMs={routeData?.executionTimeMs}
          hasResult={Boolean(routeData)}
        />

        {/* Dashboard Grid: Map on Left, Itinerary & Info on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Simulated SVG City Map & Controls (8 cols) */}
          <div className="lg:col-span-8 space-y-5">
            <CityMap
              graph={activePreset}
              activeRouteData={routeData}
              activeAlgorithm={activeAlgorithm}
              simulationProgress={simulationProgress}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
            />

            <RouteControls
              presets={SAMPLE_PRESETS}
              selectedPresetId={selectedPresetId}
              onChangePreset={handlePresetChange}
              availableCustomerStops={activePreset.availableCustomerStops}
              selectedStopCount={selectedStopCount}
              onChangeStopCount={setSelectedStopCount}
              activeAlgorithm={activeAlgorithm}
              onChangeActiveAlgorithm={setActiveAlgorithm}
              isLoading={isLoading}
              onRunNearestNeighbor={() => handleExecuteOptimization('nearest_neighbor')}
              onRunTwoOpt={() => handleExecuteOptimization('two_opt')}
              hasResult={Boolean(routeData)}
              isPlaying={isPlaying}
              onTogglePlay={() => setIsPlaying((p) => !p)}
              simulationProgress={simulationProgress}
              onChangeProgress={(p) => {
                setIsPlaying(false);
                setSimulationProgress(p);
              }}
            />
          </div>

          {/* Right Column: Dispatch Itinerary & Graph Specs (4 cols) */}
          <div className="lg:col-span-4 space-y-5">
            <StopItinerary
              routeData={routeData}
              activeAlgorithm={activeAlgorithm}
              nodeMap={nodeMap}
              warehouseId={activePreset.warehouse}
              selectedNodeId={selectedNodeId}
              onSelectNode={setSelectedNodeId}
            />

            {/* Active Graph Specifications Card */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <span className="font-bold text-white uppercase tracking-wider text-[11px]">
                  Graph Network Topology
                </span>
                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono text-[10px]">
                  Sample Data
                </span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                {activePreset.description}
              </p>
              <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-750">
                  <div className="text-slate-400 text-[10px] uppercase font-sans">Total Nodes</div>
                  <div className="text-white font-bold mt-0.5">{activePreset.nodes.length}</div>
                </div>
                <div className="p-2 rounded-lg bg-slate-800/60 border border-slate-750">
                  <div className="text-slate-400 text-[10px] uppercase font-sans">Road Edges</div>
                  <div className="text-white font-bold mt-0.5">{activePreset.roads.length}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 px-6 py-3 text-center text-xs text-slate-500">
        Smart Delivery Route Optimization • College Algorithms Mini-Project • C++17 Core / Express API / Native SVG Map
      </footer>
    </div>
  );
}
