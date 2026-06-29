import React, { useState, useEffect, useRef } from 'react';
import { MapPin, ThumbsUp, Activity, Award, Info, Compass, Navigation, X } from 'lucide-react';
import { dbGetIssues, dbSupportIssue } from '../services/dbService';
import { Issue } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface InteractiveMapProps {
  onViewIssue: (issueId: string) => void;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({ onViewIssue }) => {
  const { profile } = useAuth();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  // Focus coordinates (Gurgaon default center)
  const defaultCenter = { lat: 28.4595, lng: 77.0266 };
  const [mapCenter, setMapCenter] = useState(defaultCenter);

  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchIssues = async () => {
      try {
        const list = await dbGetIssues();
        setIssues(list);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchIssues();
  }, []);

  const getStatusColor = (status: Issue['status']) => {
    switch (status) {
      case 'Submitted': return 'bg-purple-500 ring-purple-200';
      case 'In Progress': return 'bg-sky-500 ring-sky-200';
      case 'Community Verification': return 'bg-orange-500 ring-orange-200 animate-pulse';
      case 'Verified': return 'bg-green-500 ring-green-200';
      default: return 'bg-blue-500 ring-blue-200';
    }
  };

  // Convert lat/lng coordinates to screen percentages based on current center
  const getXY = (itemLat: number, itemLng: number) => {
    const latDiff = itemLat - mapCenter.lat;
    const lngDiff = itemLng - mapCenter.lng;
    const x = 50 + lngDiff * 4500;
    const y = 50 - latDiff * 4500;
    return { x, y };
  };

  // Interactive Drag Handlers (Mouse & Touch compatible)
  const handleMouseDown = (e: React.MouseEvent) => {
    // Prevent dragging on button clicks
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;

    // Viewport scaling: 100% size is ~ 0.0222 degrees (100 / 4500)
    const latChange = (dy / rect.height) * (100 / 4500);
    const lngChange = -(dx / rect.width) * (100 / 4500);

    setMapCenter(prev => ({
      lat: prev.lat + latChange,
      lng: prev.lng + lngChange
    }));

    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length === 0) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const touch = e.touches[0];
    const dx = touch.clientX - dragStart.x;
    const dy = touch.clientY - dragStart.y;

    const latChange = (dy / rect.height) * (100 / 4500);
    const lngChange = -(dx / rect.width) * (100 / 4500);

    setMapCenter(prev => ({
      lat: prev.lat + latChange,
      lng: prev.lng + lngChange
    }));

    setDragStart({ x: touch.clientX, y: touch.clientY });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const resetToDefaultCenter = () => {
    setMapCenter(defaultCenter);
  };

  // Vector features representing roads and labels mapped to geographic positions
  const sectorLabels = [
    { text: 'SECTOR 56', lat: 28.4635, lng: 77.0216 },
    { text: 'SECTOR 22', lat: 28.4555, lng: 77.0316 },
    { text: 'WARD 8 RESIDENTIAL', lat: 28.4525, lng: 77.0256 },
  ];

  const majorAvenues = [
    { id: 1, lat1: 28.465, lng1: 77.020, lat2: 28.450, lng2: 77.023, isDash: true, color: '#94a3b8', width: 6 },
    { id: 2, lat1: 28.459, lng1: 77.015, lat2: 28.458, lng2: 77.035, isDash: true, color: '#94a3b8', width: 6 },
    { id: 3, lat1: 28.466, lng1: 77.031, lat2: 28.451, lng2: 77.029, isDash: false, color: '#cbd5e1', width: 4 },
  ];

  return (
    <div className="bg-white border border-slate-100 rounded-2xl shadow-xs overflow-hidden flex flex-col h-[calc(100vh-160px)]" id="interactive-map-panel">
      {/* Map Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Geospatial Intelligence Heatmap</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Live coordinate-based tracking of verified neighborhood problems across Sectors.</p>
        </div>
        
        {/* Status Legend */}
        <div className="flex flex-wrap gap-2 text-[10px] font-semibold text-slate-600">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span> Submitted</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-sky-500"></span> In Progress</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></span> Consensus Audit</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500"></span> Verified Resolved</span>
        </div>
      </div>

      <div className="flex-1 relative flex flex-col md:flex-row bg-slate-50 overflow-hidden">
        {/* Left Side: Real Map Representation SVG layout */}
        <div 
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`flex-1 relative min-h-[300px] border-r border-slate-100 overflow-hidden bg-slate-100/60 flex items-center justify-center select-none ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
          style={{ touchAction: 'none' }}
        >
          
          {/* Decorative Vector Grid representing sector street maps */}
          <svg className="absolute inset-0 w-full h-full opacity-35 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern 
                id="grid-pattern" 
                width="60" 
                height="60" 
                patternUnits="userSpaceOnUse"
                x={-(mapCenter.lng - defaultCenter.lng) * 4500 * 5}
                y={(mapCenter.lat - defaultCenter.lat) * 4500 * 5}
              >
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#cbd5e1" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-pattern)" />
            
            {/* Major avenues mapping geographically */}
            {majorAvenues.map((av) => {
              const p1 = getXY(av.lat1, av.lng1);
              const p2 = getXY(av.lat2, av.lng2);
              return (
                <line 
                  key={av.id}
                  x1={`${p1.x}%`} 
                  y1={`${p1.y}%`} 
                  x2={`${p2.x}%`} 
                  y2={`${p2.y}%`} 
                  stroke={av.color} 
                  strokeWidth={av.width} 
                  strokeDasharray={av.isDash ? "5,5" : undefined} 
                />
              );
            })}

            {/* Sector divisions mapping geographically */}
            {sectorLabels.map((lbl, idx) => {
              const p = getXY(lbl.lat, lbl.lng);
              return (
                <text 
                  key={idx}
                  x={`${p.x}%`} 
                  y={`${p.y}%`} 
                  fill="#94a3b8" 
                  fontSize="12" 
                  fontWeight="extrabold"
                  textAnchor="middle"
                >
                  {lbl.text}
                </text>
              );
            })}
          </svg>

          {/* Interactive Marker Nodes */}
          {issues.map((issue) => {
            const xy = getXY(issue.lat, issue.lng);

            // Hide pins that are dragged completely out of bounds to avoid clutter
            if (xy.x < -15 || xy.x > 115 || xy.y < -15 || xy.y > 115) return null;

            return (
              <button
                key={issue.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedIssue(issue);
                }}
                className={`absolute w-8 h-8 -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center text-white ring-4 transition-all duration-300 hover:scale-125 hover:z-20 shadow-md ${getStatusColor(issue.status)} ${
                  selectedIssue?.id === issue.id ? 'scale-125 z-10 ring-white' : ''
                }`}
                style={{ left: `${xy.x}%`, top: `${xy.y}%` }}
                title={issue.title}
              >
                <MapPin className="w-4.5 h-4.5 shrink-0" />
              </button>
            );
          })}

          {/* Map info tag & Panning tips */}
          <div className="absolute bottom-3 left-3 bg-white/95 border border-slate-200/80 p-2.5 rounded-xl shadow-xs text-left max-w-[240px] md:max-w-xs backdrop-blur-md z-10">
            <div className="flex items-center gap-1 text-[10px] font-bold text-slate-700 uppercase">
              <Compass className="w-3.5 h-3.5 text-blue-600 animate-spin-slow" />
              <span>Map Radar Controller</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
              Drag map with <strong>mouse</strong> or <strong>finger</strong> to explore nearby issues. Click pins for telemetry details.
            </p>
          </div>

          {/* Recenter Navigation Button */}
          <button
            type="button"
            onClick={resetToDefaultCenter}
            className="absolute top-3 right-3 p-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl shadow-md transition-all z-10 flex items-center gap-1 text-[10px] font-bold"
            title="Recenter to Sector 29 Epicenter"
          >
            <Navigation className="w-3.5 h-3.5 text-blue-600 rotate-45" />
            <span className="hidden sm:inline">Recenter</span>
          </button>

          {/* Mobile selected issue floating drawer card */}
          {selectedIssue && (
            <div className="absolute bottom-3 left-3 right-3 md:hidden bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xl z-30 flex flex-col gap-3 backdrop-blur-md animate-in fade-in slide-in-from-bottom duration-300">
              <div className="flex justify-between items-start">
                <div className="text-left">
                  <span className="text-[8px] uppercase tracking-wider font-extrabold text-indigo-600">Incident Telemetry</span>
                  <h4 className="text-xs font-bold text-slate-900 mt-0.5">{selectedIssue.title}</h4>
                  <p className="text-[9px] text-slate-400 font-mono">#{selectedIssue.id.slice(0, 8)} • Score: {selectedIssue.priorityScore || 50}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedIssue(null)}
                  className="p-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {selectedIssue.imageUrl && (
                <div className="rounded-lg overflow-hidden border border-slate-100 bg-slate-50 h-20">
                  <img 
                    src={selectedIssue.imageUrl} 
                    alt="Quick preview" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=300&q=80';
                    }}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-left text-[10px] border-t border-slate-150 pt-2">
                <div>
                  <span className="font-semibold text-slate-400 uppercase text-[8px] block">Coordinates</span>
                  <span className="text-slate-700 font-mono">{selectedIssue.lat.toFixed(4)}, {selectedIssue.lng.toFixed(4)}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-400 uppercase text-[8px] block">Responsible Agency</span>
                  <span className="text-slate-800 font-bold block truncate">{selectedIssue.department}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onViewIssue(selectedIssue.id)}
                className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-[10px] text-center flex items-center justify-center gap-1.5 transition-all shadow-xs mt-1"
              >
                <span>Open Full Audit Trail</span>
                <Compass className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Right Side: Marker Quick Inspector (Visible on desktop/tablet only) */}
        <div className="hidden md:flex md:w-80 border-l border-slate-100 p-4 flex-col justify-between bg-white overflow-y-auto" id="map-quick-inspector">
          {selectedIssue ? (
            <div className="space-y-4 text-left">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[9px] uppercase tracking-wider font-bold text-indigo-600 block">Incident Inspector</span>
                  <h4 className="text-sm font-extrabold text-slate-900 mt-1">{selectedIssue.title}</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1 font-mono">
                    #{selectedIssue.id.slice(0, 8)} • Score: {selectedIssue.priorityScore || 50}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedIssue(null)}
                  className="p-1 rounded-full bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
                  title="Deselect"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {selectedIssue.imageUrl && (
                <div className="rounded-xl overflow-hidden border border-slate-100 bg-slate-50">
                  <img 
                    src={selectedIssue.imageUrl} 
                    alt="Quick preview" 
                    className="w-full h-28 object-cover"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = 'https://images.unsplash.com/photo-1541888946425-d81bb19240f5?auto=format&fit=crop&w=300&q=80';
                    }}
                  />
                </div>
              )}

              <div className="space-y-2.5 border-t border-slate-100 pt-3">
                <div className="text-xs">
                  <span className="font-semibold text-slate-400 uppercase text-[9px] block">Location Coordinates</span>
                  <span className="text-slate-700 font-mono mt-0.5 block">{selectedIssue.lat.toFixed(5)}, {selectedIssue.lng.toFixed(5)}</span>
                  <span className="text-slate-500 font-semibold text-[10px] block mt-0.5">{selectedIssue.address}</span>
                </div>

                <div className="text-xs">
                  <span className="font-semibold text-slate-400 uppercase text-[9px] block">Responsible Agency</span>
                  <span className="text-slate-800 font-bold block mt-0.5">{selectedIssue.department}</span>
                </div>

                <div className="text-xs">
                  <span className="font-semibold text-slate-400 uppercase text-[9px] block">Current Stage</span>
                  <span className="text-slate-850 font-semibold block mt-0.5">{selectedIssue.status}</span>
                </div>
                
                {selectedIssue.isMerged && (
                  <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-lg text-[10px] text-indigo-950 font-medium">
                    ✦ This represents <strong>{selectedIssue.affectedCount || 500}</strong> merged duplications!
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => onViewIssue(selectedIssue.id)}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs text-center flex items-center justify-center gap-1.5 transition-all shadow-xs"
                >
                  <span>Open Full Audit Trail</span>
                  <Compass className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="my-auto text-center text-slate-400 p-6 flex flex-col items-center">
              <div className="p-3 bg-slate-50 rounded-full w-fit mb-2.5 text-slate-400">
                <Info className="w-5 h-5 animate-pulse" />
              </div>
              <h5 className="text-xs font-bold text-slate-700">Audit Node Offline</h5>
              <p className="text-[11px] text-slate-500 max-w-xs mt-1 leading-relaxed">
                Click any coordinate pin on the left visual map quadrant to pull live telemetry logs and inspect response times.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
