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

interface DistrictInfo {
  district: string;
  name: string;
  properties: Record<string, unknown>;
}

interface CongressionalDistrictMapProps {
  onDistrictClick?: (district: DistrictInfo) => void;
}

export default function CongressionalDistrictMap({ onDistrictClick }: CongressionalDistrictMapProps) {
  const [geoData, setGeoData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch congressional district boundaries
    // Using simplified US congressional districts GeoJSON
    fetch("https://raw.githubusercontent.com/unitedstates/districts/gh-pages/cds/2022/national-overview.geojson")
      .then((res) => res.json())
      .then((data) => {
        setGeoData(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error loading congressional districts:", error);
        setLoading(false);
      });
  }, []);

  const onEachDistrict = (feature: GeoJSON.Feature, layer: L.Layer) => {
    const properties = feature.properties as Record<string, string> | null;
    const districtName = properties?.GEOID || properties?.NAME || "Unknown";
    const state = properties?.STATEFP || "";
    const district = properties?.CD118FP || properties?.DISTRICT || "";

    // Type guard to check if layer has bindTooltip
    if ('bindTooltip' in layer && typeof layer.bindTooltip === 'function') {
      // Add tooltip
      layer.bindTooltip(
        `<div style="font-size: 12px;">
          <strong>District:</strong> ${state}-${district}<br/>
          <strong>Name:</strong> ${districtName}
        </div>`,
        { sticky: true }
      );
    }

    // Type guard to check if layer has setStyle
    if ('setStyle' in layer && typeof layer.setStyle === 'function') {
      // Style districts
      layer.setStyle({
        fillColor: "#3b82f6",
        fillOpacity: 0.2,
        color: "#1e40af",
        weight: 1,
      });
    }

    // Hover effect
    layer.on({
      mouseover: (e: L.LeafletEvent) => {
        const target = e.target;
        if ('setStyle' in target && typeof target.setStyle === 'function') {
          target.setStyle({
            fillOpacity: 0.5,
            weight: 2,
          });
        }
      },
      mouseout: (e: L.LeafletEvent) => {
        const target = e.target;
        if ('setStyle' in target && typeof target.setStyle === 'function') {
          target.setStyle({
            fillOpacity: 0.2,
            weight: 1,
          });
        }
      },
      click: () => {
        if (onDistrictClick) {
          onDistrictClick({
            district: `${state}-${district}`,
            name: districtName,
            properties: properties || {},
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
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
          </div>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Loading districts...</p>
        </div>
      </div>
    );
  }

  return (
    <MapContainer
      center={[39.8283, -98.5795]}
      zoom={4}
      minZoom={3}
      maxZoom={10}
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
          onEachFeature={onEachDistrict}
        />
      )}
    </MapContainer>
  );
}
