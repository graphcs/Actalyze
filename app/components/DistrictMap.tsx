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

interface DistrictMapProps {
  districtCode: string; // e.g., "VA05", "NY01"
}

export default function DistrictMap({ districtCode }: DistrictMapProps) {
  const [geoData, setGeoData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapCenter, setMapCenter] = useState<[number, number]>([39.8283, -98.5795]);
  const [mapZoom, setMapZoom] = useState(6);

  useEffect(() => {
    // Fetch congressional district boundaries
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
    const state = properties?.STATEFP || properties?.STATE || "";
    const district = properties?.CD118FP || properties?.DISTRICT || "";

    // Create district code from properties (e.g., "VA05")
    const featureDistrictCode = `${state}${district}`.toUpperCase();
    const targetDistrictCode = districtCode.toUpperCase();

    // Check if this is the target district
    const isTargetDistrict = featureDistrictCode === targetDistrictCode ||
      featureDistrictCode === targetDistrictCode.replace(/^([A-Z]{2})0?(\d+)$/, '$1$2');

    // Style districts
    if ('setStyle' in layer && typeof layer.setStyle === 'function') {
      if (isTargetDistrict) {
        // Highlight the target district
        layer.setStyle({
          fillColor: "#A855F7",
          fillOpacity: 0.6,
          color: "#7C3AED",
          weight: 3,
        });

        // Center map on this district
        if ('getBounds' in layer && typeof layer.getBounds === 'function') {
          const bounds = layer.getBounds();
          setMapCenter([bounds.getCenter().lat, bounds.getCenter().lng]);
          setMapZoom(8);
        }
      } else {
        // Show other districts faintly
        layer.setStyle({
          fillColor: "#9CA3AF",
          fillOpacity: 0.1,
          color: "#6B7280",
          weight: 0.5,
        });
      }
    }

    // Add tooltip for target district
    if (isTargetDistrict && 'bindTooltip' in layer && typeof layer.bindTooltip === 'function') {
      const districtName = properties?.NAME || `District ${district}`;
      layer.bindTooltip(
        `<div style="font-size: 12px; font-weight: 600;">
          ${districtName}
        </div>`,
        { permanent: true, direction: 'center', className: 'district-label' }
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
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Loading district map...</p>
        </div>
      </div>
    );
  }

  return (
    <MapContainer
      center={mapCenter}
      zoom={mapZoom}
      minZoom={5}
      maxZoom={12}
      scrollWheelZoom={true}
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
          key={districtCode} // Re-render when district changes
        />
      )}
    </MapContainer>
  );
}
