import React from 'react';
import { formatDistance } from '../utils/formatters';

export default function StopItinerary({
  routeData,
  activeAlgorithm,
  nodeMap,
  warehouseId,
  selectedNodeId,
  onSelectNode
}) {
  if (!routeData) {
    return (
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 text-center text-slate-500 text-xs">
        Run Nearest Neighbor or 2-Opt to compute dispatch itinerary.
      </div>
    );
  }

  const isNN = activeAlgorithm === 'nearest_neighbor';
  const tour = isNN
    ? routeData.initialRoute || []
    : routeData.optimizedRoute || [];

  const legs = isNN && routeData.initialLegs
    ? routeData.initialLegs
    : (routeData.legs || []);

  return (
    <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl flex flex-col h-full max-h-[580px]">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div>
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Dispatch Itinerary
          </h3>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {tour.length > 2 ? `${tour.length - 2} customer stops + warehouse loop` : 'Direct loop'}
          </p>
        </div>
        <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase">
          {activeAlgorithm === 'nearest_neighbor' ? 'NN Tour' : '2-Opt Tour'}
        </span>
      </div>

      {/* Stop Sequence List */}
      <div className="flex-1 overflow-y-auto space-y-2 pt-3 pr-1 text-xs">
        {tour.map((stopId, idx) => {
          const node = nodeMap?.get(stopId);
          const isWarehouse = stopId === warehouseId;
          const isStart = idx === 0;
          const isReturn = idx === tour.length - 1 && idx > 0;
          const leg = idx > 0 ? legs[idx - 1] : null;
          const isSelected = selectedNodeId === stopId;

          return (
            <div
              key={`itinerary-${stopId}-${idx}`}
              onClick={() => onSelectNode && onSelectNode(stopId)}
              className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                isSelected
                  ? 'bg-slate-800 border-cyan-400 shadow-sm'
                  : 'bg-slate-850/60 border-slate-800 hover:bg-slate-800/80 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {/* Badge: Warehouse or Step Number */}
                <div
                  className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-[10px] shrink-0 ${
                    isWarehouse
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}
                >
                  {isStart ? 'DEP' : isReturn ? 'END' : idx}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white truncate text-xs">
                      {isWarehouse ? (isStart ? 'Warehouse Departure' : 'Warehouse Return') : node?.name || stopId}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {stopId}
                    </span>
                  </div>

                  {/* Leg distance & road nodes */}
                  {leg && (
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-[11px] text-slate-400">
                      <span className="text-cyan-400 font-medium">
                        +{formatDistance(leg.distanceKm)}
                      </span>
                      {leg.pathNodes && leg.pathNodes.length > 2 && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          via {leg.pathNodes.slice(1, -1).join(' → ')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
