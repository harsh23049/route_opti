import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import CityMap from './components/CityMap';
import MetricCards from './components/MetricCards';
import RouteControls from './components/RouteControls';
import StopItinerary from './components/StopItinerary';
import Scrubber from './components/Scrubber';
import Legend from './components/Legend';
import { SAMPLE_PRESETS } from './data/sampleCityGraph';
import { checkBackendHealth, optimizeRoute } from './services/optimizerApi';
import { pickRouteView, resolveView } from './utils/routeView';
import { withCustomStops } from './utils/customStops';

const PLAYBACK_SPEED = 0.15; // full tour in about 6.5 s

function defaultStopsFor(preset) {
  return preset.availableCustomerStops.slice(0, preset.defaultStopCount);
}

export default function App() {
  const [selectedPresetId, setSelectedPresetId] = useState(SAMPLE_PRESETS[0].id);
  const activePreset = useMemo(
    () => SAMPLE_PRESETS.find((p) => p.id === selectedPresetId) || SAMPLE_PRESETS[0],
    [selectedPresetId]
  );

  const [selectedStops, setSelectedStops] = useState(() => defaultStopsFor(SAMPLE_PRESETS[0]));
  const [customStops, setCustomStops] = useState([]);
  const [addingStop, setAddingStop] = useState(false);
  const [backendHealth, setBackendHealth] = useState({ online: false, executableExists: false, checked: false });
  const [routeData, setRouteData] = useState(null);
  const [activeView, setActiveView] = useState('optimized');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const animationRef = useRef(null);
  const [isLg, setIsLg] = useState(() => window.matchMedia('(min-width: 1024px)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = (e) => setIsLg(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Map area that stays clear of the floating panel / bottom sheet.
  const insets = useMemo(
    () =>
      isLg
        ? { left: 452, top: 72, right: 190, bottom: 120 }
        : { left: 24, top: 28, right: 76, bottom: Math.round(window.innerHeight * 0.5) + 84 },
    [isLg]
  );

  // The preset plus user-added stops, each wired onto its nearest road.
  const graph = useMemo(() => withCustomStops(activePreset, customStops), [activePreset, customStops]);

  const nodeMap = useMemo(() => {
    const map = new Map();
    graph.nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [graph]);

  // Any change to the inputs invalidates the current route.
  const clearResult = useCallback(() => {
    setRouteData(null);
    setErrorMessage(null);
    setSimulationProgress(0);
    setIsPlaying(false);
    setHoveredNodeId(null);
  }, []);

  const applyStops = useCallback(
    (nextStops) => {
      setSelectedStops(nextStops);
      clearResult();
    },
    [clearResult]
  );

  const handlePresetChange = (newPresetId) => {
    const preset = SAMPLE_PRESETS.find((p) => p.id === newPresetId) || SAMPLE_PRESETS[0];
    setSelectedPresetId(preset.id);
    setSelectedNodeId(null);
    setCustomStops([]);
    applyStops(defaultStopsFor(preset));
  };

  const handleToggleStop = (nodeId) => {
    if (isLoading || nodeId === activePreset.warehouse) return;
    // Added stops exist only while selected, so deselecting one removes it.
    if (customStops.some((s) => s.id === nodeId)) {
      setCustomStops(customStops.filter((s) => s.id !== nodeId));
      applyStops(selectedStops.filter((id) => id !== nodeId));
      return;
    }
    const isOn = selectedStops.includes(nodeId);
    const order = graph.nodes.map((n) => n.id);
    const next = isOn
      ? selectedStops.filter((id) => id !== nodeId)
      : [...selectedStops, nodeId].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    applyStops(next);
  };

  const handleAddStop = ({ lat, lng }) => {
    if (isLoading) return;
    const seq = customStops.reduce((max, s) => Math.max(max, s.seq), 0) + 1;
    const id = `C${seq}`;
    setCustomStops([...customStops, { id, seq, name: `New stop ${seq}`, lat, lng }]);
    applyStops([...selectedStops, id]);
  };

  const resetStops = (stops) => {
    setCustomStops([]);
    applyStops(stops);
  };

  // Health probe
  useEffect(() => {
    let isMounted = true;
    const probe = async () => {
      const health = await checkBackendHealth();
      if (isMounted) setBackendHealth({ ...health, checked: true });
    };
    probe();
    const interval = setInterval(probe, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Playback is derived: reaching the end stops the loop without an extra state update.
  const playing = isPlaying && simulationProgress < 1;

  // Playback loop: the updater only clamps progress, no side effects.
  useEffect(() => {
    if (!playing) return undefined;
    let lastTime = performance.now();
    const loop = (now) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      setSimulationProgress((prev) => Math.min(1, prev + dt * PLAYBACK_SPEED));
      animationRef.current = requestAnimationFrame(loop);
    };
    animationRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationRef.current);
  }, [playing]);

  const handleTogglePlay = () => {
    if (playing) {
      setIsPlaying(false);
      return;
    }
    if (simulationProgress >= 1) setSimulationProgress(0);
    setIsPlaying(true);
  };

  const handleOptimize = async () => {
    if (isLoading || selectedStops.length === 0) return;
    setIsLoading(true);
    setErrorMessage(null);
    setIsPlaying(false);
    setSimulationProgress(0);
    try {
      const result = await optimizeRoute({
        warehouse: activePreset.warehouse,
        stops: selectedStops,
        nodes: graph.nodes.map(({ id, name, lat, lng }) => ({ id, name, lat, lng })),
        roads: graph.roads.map(({ source, target, distance_km, street_name }) => ({ source, target, distance_km, street_name }))
      });
      setRouteData(result);
      setActiveView('optimized');
    } catch (err) {
      setRouteData(null);
      setErrorMessage(err.message || 'Something went wrong while optimizing.');
    } finally {
      setIsLoading(false);
    }
  };

  const view = resolveView(routeData, activeView);
  const routeView = useMemo(() => pickRouteView(routeData, view), [routeData, view]);

  const hasRoute = Boolean(routeData);

  return (
    <div className="app-shell relative h-screen w-full overflow-hidden">
      <CityMap
        key={selectedPresetId}
        graph={graph}
        selectedStops={selectedStops}
        routeView={routeView}
        hasRoute={hasRoute}
        simulationProgress={simulationProgress}
        isPlaying={playing}
        selectedNodeId={selectedNodeId}
        hoveredNodeId={hoveredNodeId}
        onToggleStop={handleToggleStop}
        togglingDisabled={isLoading}
        addMode={addingStop && !isLoading}
        onAddStop={handleAddStop}
        insets={insets}
      />

      <aside
        aria-label="Route planner"
        className="float-card absolute inset-x-0 bottom-0 z-10 flex h-[50vh] flex-col overflow-hidden rounded-t-2xl lg:inset-x-auto lg:bottom-auto lg:left-4 lg:top-4 lg:h-auto lg:max-h-[calc(100vh-32px)] lg:w-[404px] lg:rounded-xl"
      >
        <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-[#E5E7EB] lg:hidden" aria-hidden="true" />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <RouteControls
            presets={SAMPLE_PRESETS}
            selectedPresetId={selectedPresetId}
            onChangePreset={handlePresetChange}
            selectedStopCount={selectedStops.length}
            onResetStops={() => resetStops(defaultStopsFor(activePreset))}
            onClearStops={() => resetStops([])}
            isLoading={isLoading}
            onOptimize={handleOptimize}
            backendHealth={backendHealth}
            addingStop={addingStop}
            onToggleAddStop={() => setAddingStop((on) => !on)}
          />

          {errorMessage && (
            <div role="alert" className="mx-6 mb-4 flex items-start gap-3 rounded-lg border border-[#FECDCA] bg-[#FEF3F2] py-2 pl-3 pr-1 text-[13px] text-[#912018]">
              <svg className="mt-[3px] shrink-0" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <circle cx="7" cy="7" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M7 3.8v3.6M7 9.6v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <span className="flex-1 py-0.5">
                <span className="font-semibold">Could not optimize.</span> {errorMessage}
              </span>
              <button type="button" onClick={() => setErrorMessage(null)} aria-label="Dismiss error" className="-my-1.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-md hover:bg-[#FEE4E2]">
                <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
              </button>
            </div>
          )}

          <div className="border-t border-[#F0F1F3]">
            <MetricCards routeData={routeData} isLoading={isLoading} activeView={view} onChangeView={setActiveView} />
          </div>
          <StopItinerary
            routeView={routeView}
            hasRoute={hasRoute && !isLoading}
            nodeMap={nodeMap}
            warehouseId={activePreset.warehouse}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            onHoverNode={setHoveredNodeId}
          />
          <p className="border-t border-[#F0F1F3] px-6 py-4 text-[12px] leading-relaxed text-[#9CA3AF]">{activePreset.description}</p>
        </div>
      </aside>

      <Legend className="absolute bottom-4 left-[436px] hidden lg:block" />

      {hasRoute && (
        <div className="pointer-events-none absolute inset-x-3 bottom-[calc(50vh+12px)] flex justify-center lg:bottom-4 lg:left-[436px] lg:right-4 lg:justify-end xl:justify-center">
          <Scrubber
            className="pointer-events-auto"
            isPlaying={playing}
            onTogglePlay={handleTogglePlay}
            simulationProgress={simulationProgress}
            totalKm={routeView.distance}
            durationS={1 / PLAYBACK_SPEED}
            onChangeProgress={(p) => {
              setIsPlaying(false);
              setSimulationProgress(p);
            }}
          />
        </div>
      )}
    </div>
  );
}
