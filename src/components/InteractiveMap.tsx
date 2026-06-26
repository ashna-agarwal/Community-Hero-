import React, { useState, useEffect } from 'react';
import { MapPin, ThumbsUp, Activity, Award, Info, Compass } from 'lucide-react';
import { dbGetIssues, dbSupportIssue } from '../services/dbService';
import { Issue } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface InteractiveMapProps {
  onViewIssue: (issueId: string) => void;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({ onViewIssue }) => {
  const { profile, updateReputation } = useAuth();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

  // Focus coordinates (Gurgaon default center)
  const mapCenter = { lat: 28.4595, lng: 77.0266 };

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

      <div className="flex-1 relative flex flex-col md:flex-row bg-slate-50">
        {/* Left Side: Real Map Representation SVG layout */}
        <div className="flex-1 relative min-h-[300px] border-r border-slate-100 overflow-hidden bg-slate-100/60 flex items-center justify-center">
          
          {/* Decorative Vector Grid representing sector street maps */}
          <svg className="absolute inset-0 w-full h-full opacity-35 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid-pattern" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#cbd5e1" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-pattern)" />
            {/* Major avenues */}
            <line x1="10%" y1="0" x2="15%" y2="100%" stroke="#94a3b8" strokeWidth="6" strokeDasharray="5,5" />
            <line x1="0" y1="40%" x2="100%" y2="45%" stroke="#94a3b8" strokeWidth="6" strokeDasharray="5,5" />
            <line x1="70%" y1="0" x2="65%" y2="100%" stroke="#e2e8f0" strokeWidth="4" />
            {/* Sector divisions */}
            <text x="15%" y="10%" fill="#94a3b8" fontSize="12" fontWeight="bold">SECTOR 56</text>
            <text x="60%" y="20%" fill="#94a3b8" fontSize="12" fontWeight="bold">SECTOR 22</text>
            <text x="40%" y="80%" fill="#94a3b8" fontSize="12" fontWeight="bold">WARD 8 RESIDENTIAL</text>
          </svg>

          {/* Interactive Marker Nodes */}
          {issues.map((issue) => {
            // Project lat/lng to responsive pixel coordinates inside the grid box
            // Defaulting around mapCenter (28.4595, 77.0266)
            const latDiff = issue.lat - mapCenter.lat;
            const lngDiff = issue.lng - mapCenter.lng;
            
            // Map offsets: Scale differences to fit 10%-90% coordinates bounds nicely
            const xPercent = Math.max(10, Math.min(90, 50 + lngDiff * 4500));
            const yPercent = Math.max(10, Math.min(90, 50 - latDiff * 4500));

            return (
              <button
                key={issue.id}
                onClick={() => setSelectedIssue(issue)}
                className={`absolute w-7 h-7 -translate-x-1/2 -translate-y-1/2 rounded-full flex items-center justify-center text-white ring-4 transition-all duration-300 hover:scale-125 hover:z-20 ${getStatusColor(issue.status)}`}
                style={{ left: `${xPercent}%`, top: `${yPercent}%` }}
                title={issue.title}
              >
                <MapPin className="w-4 h-4 shrink-0" />
              </button>
            );
          })}

          {/* Map info tag */}
          <div className="absolute bottom-3 left-3 bg-white/95 border border-slate-200/80 p-2.5 rounded-xl shadow-xs text-left max-w-xs backdrop-blur-md">
            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-700 uppercase">
              <Compass className="w-3.5 h-3.5 text-blue-600 animate-spin" />
              <span>Geospatial Radar Live</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
              Displaying {issues.length} active incidents. Hover or click markers to inspect municipal accountability details immediately.
            </p>
          </div>
        </div>

        {/* Right Side: Marker Quick Inspector */}
        <div className="w-full md:w-80 border-t md:border-t-0 border-slate-100 p-4 flex flex-col justify-between bg-white overflow-y-auto" id="map-quick-inspector">
          {selectedIssue ? (
            <div className="space-y-4 text-left">
              <div>
                <span className="text-[9px] uppercase tracking-wider font-bold text-indigo-600 block">Incident Inspector</span>
                <h4 className="text-sm font-extrabold text-slate-900 mt-1">{selectedIssue.title}</h4>
                <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1 font-mono">
                  #{selectedIssue.id.slice(0, 8)} • Score: {selectedIssue.priorityScore || 50}
                </p>
              </div>

              {selectedIssue.imageUrl && (
                <div className="rounded-xl overflow-hidden border border-slate-100 bg-slate-50">
                  <img 
                    src={selectedIssue.imageUrl} 
                    alt="Quick preview" 
                    className="w-full h-28 object-cover"
                  />
                </div>
              )}

              <div className="space-y-2.5">
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
                  <span className="text-slate-800 font-semibold block mt-0.5">{selectedIssue.status}</span>
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
                  className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs text-center flex items-center justify-center gap-1.5 transition-all shadow-xs"
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
