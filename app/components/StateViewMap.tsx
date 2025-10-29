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

interface StateViewMapProps {
  stateCode: string; // e.g., "VA", "NY"
  pollingTrend?: string | null; // e.g., "D+5", "R+3", "Toss-up"
}

// Mapping of full state names to abbreviations
const STATE_NAME_TO_CODE: Record<string, string> = {
  "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR", "California": "CA",
  "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE", "Florida": "FL", "Georgia": "GA",
  "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL", "Indiana": "IN", "Iowa": "IA",
  "Kansas": "KS", "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
  "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS", "Missouri": "MO",
  "Montana": "MT", "Nebraska": "NE", "Nevada": "NV", "New Hampshire": "NH", "New Jersey": "NJ",
  "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH",
  "Oklahoma": "OK", "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT", "Vermont": "VT",
  "Virginia": "VA", "Washington": "WA", "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY",
  "District of Columbia": "DC"
};

export default function StateViewMap({ stateCode, pollingTrend }: StateViewMapProps) {
  const [geoData, setGeoData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch state boundaries GeoJSON
    fetch("https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json")
      .then((res) => res.json())
      .then((stateGeo) => {
        setGeoData(stateGeo);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error loading map data:", error);
        setLoading(false);
      });
  }, []);

  const getPollingColor = (trend: string | null | undefined): string => {
    if (!trend) return "#A855F7"; // Purple if no polling

    // Parse polling trend to determine color
    if (trend.toLowerCase().includes("toss") || trend.toLowerCase().includes("tie")) {
      return "#A855F7"; // Purple for toss-up
    }

    // Extract margin if available (e.g., "D+5", "R+3")
    const match = trend.match(/([DR])([+-]?)(\d+)/i);
    if (match) {
      const party = match[1].toUpperCase();
      const margin = parseInt(match[3]) || 0;

      if (party === "R") {
        if (margin >= 20) return "#991B1B"; // Deep red
        if (margin >= 10) return "#DC2626"; // Light red
        return "#F87171"; // Light pink
      } else {
        if (margin >= 20) return "#1E3A8A"; // Deep blue
        if (margin >= 10) return "#2563EB"; // Light blue
        return "#60A5FA"; // Light blue
      }
    }

    // Default to purple if can't parse
    return "#A855F7";
  };

  const onEachState = (feature: GeoJSON.Feature, layer: L.Layer) => {
    const properties = feature.properties as Record<string, string> | null;
    const stateName = properties?.name || "Unknown";
    const featureStateCode = STATE_NAME_TO_CODE[stateName];

    // Check if this is the target state
    const isTargetState = featureStateCode === stateCode.toUpperCase();

    // Style states
    if ('setStyle' in layer && typeof layer.setStyle === 'function') {
      if (isTargetState) {
        // Highlight the target state with polling color
        const color = getPollingColor(pollingTrend);
        layer.setStyle({
          fillColor: color,
          fillOpacity: 0.7,
          color: "#18181B",
          weight: 2.5,
        });
      } else {
        // Show other states faintly
        layer.setStyle({
          fillColor: "#D4D4D8",
          fillOpacity: 0.2,
          color: "#A1A1AA",
          weight: 0.5,
        });
      }
    }

    // Add label for target state
    if (isTargetState && 'bindTooltip' in layer && typeof layer.bindTooltip === 'function') {
      layer.bindTooltip(
        `<div style="font-size: 12px; font-weight: 600;">
          ${stateName}
        </div>`,
        { permanent: true, direction: 'center', className: 'state-label' }
      );
    }
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
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <MapContainer
      center={[39.8283, -98.5795]}
      zoom={4}
      minZoom={3}
      maxZoom={6}
      scrollWheelZoom={false}
      style={{ height: "100%", width: "100%" }}
      className="rounded-xl"
      zoomControl={false}
      dragging={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {geoData && (
        <GeoJSON
          data={geoData}
          onEachFeature={onEachState}
          key={`${stateCode}-${pollingTrend}`} // Re-render when state or polling changes
        />
      )}
    </MapContainer>
  );
}
