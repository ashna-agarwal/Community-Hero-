import React, { useState, useEffect, useRef } from 'react';
import { Info, Compass, Navigation, X } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { dbGetIssues } from '../services/dbService';
import { Issue, IssueStatus } from '../types';

// Haversine formula to compute distance in km between two coordinates
function getDistanceInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface InteractiveMapProps {
  onViewIssue: (issueId: string) => void;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({ onViewIssue }) => {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  // Focus coordinates (Gurgaon default center)
  const defaultCenter = { lat: 28.4595, lng: 77.0266 };

  // Maps statuses to beautiful pin hex colors representing the theme legend
  const getPinColor = (status: IssueStatus): string => {
    switch (status) {
      case 'Submitted':
      case 'AI Analysis':
      case 'Department Assigned':
      case 'Under Review':
        return '#a855f7'; // Purple-500
      case 'In Progress':
      case 'Resolved':
        return '#0ea5e9'; // Sky-500
      case 'Community Verification':
        return '#f97316'; // Orange-500
      case 'Verified':
      case 'Closed':
        return '#22c55e'; // Green-500
      default:
        return '#3b82f6'; // Blue-500
    }
  };

  // Custom function to generate custom colored SVG marker icon
  const createIssueIcon = (color: string) => {
    return L.divIcon({
      html: `
        <div class="relative flex items-center justify-center cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="2.5" class="w-8 h-8 drop-shadow-md hover:scale-110 transition-transform duration-200">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
        </div>
      `,
      className: 'custom-issue-marker',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    });
  };

  // Fetch coordinates from Firestore
  useEffect(() => {
    const fetchIssues = async () => {
      try {
        const list = await dbGetIssues();
        setIssues(list);
      } catch (err) {
        console.error('[InteractiveMap] Error loading issues:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchIssues();
  }, []);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Use default center initially
    const map = L.map(mapContainerRef.current, {
      center: [defaultCenter.lat, defaultCenter.lng],
      zoom: 13,
      zoomControl: true,
      attributionControl: true
    });

    mapRef.current = map;

    // Set up standard OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // Layer group to hold issue pins dynamically
    const markersGroup = L.layerGroup().addTo(map);
    markersGroupRef.current = markersGroup;

    // Call invalidateSize with a small timeout to make sure it renders beautifully within flexible layouts
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    // Clean up
    return () => {
      clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      markersGroupRef.current = null;
    };
  }, []);

  // Get User's Live Location on mount
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(loc);
          if (mapRef.current) {
            mapRef.current.flyTo([loc.lat, loc.lng], 14, { animate: true, duration: 1.5 });
          }
        },
        (error) => {
          console.warn('[InteractiveMap] Geolocation failed or denied:', error);
          // Gracefully default to Gurgaon center
          if (mapRef.current) {
            mapRef.current.setView([defaultCenter.lat, defaultCenter.lng], 13);
          }
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      console.warn('[InteractiveMap] Geolocation is not supported.');
    }
  }, []);

  // Track & Update User Location Marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userLocation) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
    } else {
      const userIcon = L.divIcon({
        html: `
          <div class="relative flex h-10 w-10 items-center justify-center">
            <span class="absolute inline-flex h-6 w-6 animate-ping rounded-full bg-blue-400 opacity-75"></span>
            <span class="relative inline-flex h-4 w-4 rounded-full bg-blue-600 border-2 border-white shadow-md"></span>
          </div>
        `,
        className: 'custom-user-marker',
        iconSize: [40, 40],
        iconAnchor: [20, 20]
      });

      const userMarker = L.marker([userLocation.lat, userLocation.lng], {
        icon: userIcon,
        title: 'You are here'
      }).addTo(map);

      userMarkerRef.current = userMarker;
    }
  }, [userLocation]);

  // Sync Issues to markers Group
  useEffect(() => {
    const markersGroup = markersGroupRef.current;
    if (!markersGroup || issues.length === 0) return;

    // Clear previous issue layers
    markersGroup.clearLayers();

    // Map all issues as Leaflet markers
    issues.forEach((issue) => {
      if (typeof issue.lat !== 'number' || typeof issue.lng !== 'number') return;
      
      const pinColor = getPinColor(issue.status);
      const icon = createIssueIcon(pinColor);

      const marker = L.marker([issue.lat, issue.lng], {
        icon: icon,
        title: issue.title
      });

      // Show details when pin is clicked
      marker.on('click', () => {
        setSelectedIssue(issue);
      });

      marker.addTo(markersGroup);
    });
  }, [issues]);

  // Recenter handler
  const handleRecenter = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(loc);
          if (mapRef.current) {
            mapRef.current.flyTo([loc.lat, loc.lng], 14, { animate: true, duration: 1.5 });
          }
        },
        (error) => {
          console.warn('[InteractiveMap] Recenter geolocation failed:', error);
          const target = userLocation || defaultCenter;
          if (mapRef.current) {
            mapRef.current.flyTo([target.lat, target.lng], 14, { animate: true, duration: 1.5 });
          }
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      const target = userLocation || defaultCenter;
      if (mapRef.current) {
        mapRef.current.flyTo([target.lat, target.lng], 13, { animate: true, duration: 1.5 });
      }
    }
  };

  // Nearby issues logic (issues within 5km of user location)
  const nearbyRadiusKm = 5;
  const nearbyIssues = userLocation
    ? issues.filter(issue => getDistanceInKm(userLocation.lat, userLocation.lng, issue.lat, issue.lng) <= nearbyRadiusKm)
    : [];

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
        {/* Left Side: Leaflet Map Container */}
        <div className="flex-1 relative min-h-[300px] border-r border-slate-100 overflow-hidden">
          
          {/* Real Map Frame target */}
          <div ref={mapContainerRef} className="w-full h-full z-0" />

          {/* Map info tag & Panning tips */}
          <div className="absolute bottom-3 left-3 bg-white/95 border border-slate-200/80 p-2.5 rounded-xl shadow-xs text-left max-w-[240px] md:max-w-xs backdrop-blur-md z-[1000]">
            <div className="flex items-center justify-between gap-1.5 text-[10px] font-bold text-slate-700 uppercase">
              <span className="flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-blue-600 animate-spin-slow" />
                <span>Map Radar Controller</span>
              </span>
              {userLocation && (
                <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full font-extrabold text-[9px] border border-blue-100">
                  {nearbyIssues.length} nearby
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
              {userLocation ? (
                <>
                  Found <strong>{nearbyIssues.length} issues</strong> within {nearbyRadiusKm}km of your location. Click pins for telemetry details.
                </>
              ) : (
                <>
                  Drag map or enable location permission to explore issues near you. Click pins for telemetry details.
                </>
              )}
            </p>
          </div>

          {/* Recenter Navigation Button */}
          <button
            type="button"
            onClick={handleRecenter}
            className="absolute top-3 right-3 p-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl shadow-md transition-all z-[1000] flex items-center gap-1 text-[10px] font-bold"
            title="Recenter to Live Location"
          >
            <Navigation className="w-3.5 h-3.5 text-blue-600 rotate-45" />
            <span className="hidden sm:inline">Recenter</span>
          </button>

          {/* Mobile selected issue floating drawer card */}
          {selectedIssue && (
            <div className="absolute bottom-3 left-3 right-3 md:hidden bg-white border border-slate-200/80 p-4 rounded-2xl shadow-xl z-[1010] flex flex-col gap-3 backdrop-blur-md animate-in fade-in slide-in-from-bottom duration-300">
              <div className="flex justify-between items-start">
                <div className="text-left">
                  <span className="text-[8px] uppercase tracking-wider font-extrabold text-indigo-600">Incident Telemetry</span>
                  <h4 className="text-xs font-bold text-slate-900 mt-0.5">{selectedIssue.title}</h4>
                  <p className="text-[9px] text-slate-400 font-mono">#{selectedIssue.id.slice(0, 8)}</p>
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

        {/* Right Side: Marker Quick Inspector */}
        <div className="hidden md:flex md:w-80 border-l border-slate-100 p-4 flex-col justify-between bg-white overflow-y-auto" id="map-quick-inspector">
          {selectedIssue ? (
            <div className="space-y-4 text-left">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[9px] uppercase tracking-wider font-bold text-indigo-600 block">Incident Inspector</span>
                  <h4 className="text-sm font-extrabold text-slate-900 mt-1">{selectedIssue.title}</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1 font-mono">
                    #{selectedIssue.id.slice(0, 8)}
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
