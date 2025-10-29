"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Dynamically import Leaflet components to avoid SSR issues
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const GeoJSON = dynamic(
  () => import("react-leaflet").then((mod) => mod.GeoJSON),
  { ssr: false }
);

interface ElectionData {
  [key: string]: {
    name: string;
    margin: number;
    winner: string;
  };
}

interface StateIssue {
  state: string;
  issues: string[];
  loading: boolean;
}

export default function StateHeatMap() {
  const [geoData, setGeoData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [electionData, setElectionData] = useState<ElectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredState, setHoveredState] = useState<StateIssue | null>(null);

  useEffect(() => {
    // Fetch state boundaries GeoJSON
    Promise.all([
      fetch("https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json")
        .then((res) => res.json()),
      fetch("/data/2024-election-results.json")
        .then((res) => res.json())
    ])
      .then(([stateGeo, electionResults]) => {
        setGeoData(stateGeo);
        setElectionData(electionResults.states);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error loading map data:", error);
        setLoading(false);
      });
  }, []);

  const getStateColor = (margin: number): string => {
    if (margin >= 20) return "#991B1B"; // Deep red
    if (margin >= 10) return "#DC2626"; // Light red
    if (margin >= -9.99) return "#A855F7"; // Purple
    if (margin >= -20) return "#2563EB"; // Light blue
    return "#1E3A8A"; // Deep blue
  };

  const fetchStateIssues = async (stateCode: string) => {
    try {
      const response = await fetch(`/api/map/state-news?state=${stateCode}`);
      const data = await response.json();
      return data.issues || [];
    } catch (error) {
      console.error("Error fetching state issues:", error);
      return [];
    }
  };

  const onEachState = (feature: GeoJSON.Feature, layer: L.Layer) => {
    const properties = feature.properties as Record<string, string> | null;
    const stateName = properties?.name || "Unknown";
    const stateCode = properties?.abbreviation || properties?.code || "";

    if (!electionData || !stateCode || !electionData[stateCode]) {
      return;
    }

    const stateData = electionData[stateCode];
    const margin = stateData.margin;
    const winner = stateData.winner;
    const color = getStateColor(margin);

    // Style states
    if ('setStyle' in layer && typeof layer.setStyle === 'function') {
      layer.setStyle({
        fillColor: color,
        fillOpacity: 0.7,
        color: "#18181B",
        weight: 1.5,
      });
    }

    // Create popup content
    const createPopupContent = (issues?: string[]) => {
      const marginText = margin > 0
        ? `R+${margin.toFixed(1)}`
        : `D+${Math.abs(margin).toFixed(1)}`;

      let issuesHtml = '';
      if (issues && issues.length > 0) {
        issuesHtml = issues.map(issue => `<li class="text-xs mb-1">${issue}</li>`).join('');
      } else {
        issuesHtml = '<li class="text-xs text-zinc-500">Loading issues...</li>';
      }

      return `
        <div style="font-size: 14px; min-width: 200px;">
          <div style="font-weight: 600; margin-bottom: 8px; color: ${winner === 'R' ? '#DC2626' : '#2563EB'};">
            ${stateName} (${marginText})
          </div>
          <div style="font-size: 12px; font-weight: 500; margin-bottom: 4px; color: #52525B;">
            Top Issues:
          </div>
          <ul style="list-style: disc; padding-left: 16px; margin: 0;">
            ${issuesHtml}
          </ul>
        </div>
      `;
    };

    // Bind initial tooltip
    if ('bindPopup' in layer && typeof layer.bindPopup === 'function') {
      layer.bindPopup(createPopupContent(), {
        maxWidth: 300,
        className: 'state-popup'
      });
    }

    // Hover effects
    layer.on({
      mouseover: async (e: L.LeafletEvent) => {
        const target = e.target;
        if ('setStyle' in target && typeof target.setStyle === 'function') {
          target.setStyle({
            fillOpacity: 0.9,
            weight: 3,
          });
        }

        // Fetch state issues if not already loaded
        if (!hoveredState || hoveredState.state !== stateCode) {
          setHoveredState({ state: stateCode, issues: [], loading: true });

          const issues = await fetchStateIssues(stateCode);
          setHoveredState({ state: stateCode, issues, loading: false });

          // Update popup with fetched issues
          if ('getPopup' in target && typeof target.getPopup === 'function') {
            const popup = target.getPopup();
            if (popup) {
              popup.setContent(createPopupContent(issues));
            }
          }
        }
      },
      mouseout: (e: L.LeafletEvent) => {
        const target = e.target;
        if ('setStyle' in target && typeof target.setStyle === 'function') {
          target.setStyle({
            fillOpacity: 0.7,
            weight: 1.5,
          });
        }
      },
    });
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-50 dark:bg-zinc-900/40">
        <div className="text-center">
          <div className="inline-flex items-center space-x-2 mb-2">
            <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
            <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
            <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Loading political map...</p>
        </div>
      </div>
    );
  }

  return (
    <MapContainer
      center={[39.8283, -98.5795]}
      zoom={4}
      minZoom={3}
      maxZoom={7}
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%" }}
      className="rounded-xl"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {geoData && (
        <GeoJSON
          data={geoData}
          onEachFeature={onEachState}
        />
      )}
    </MapContainer>
  );
}
