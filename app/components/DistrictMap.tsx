"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import L from "leaflet";
import { useMap } from "react-leaflet";
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

// State FIPS code mapping
const STATE_FIPS: Record<string, string> = {
  "AL": "01", "AK": "02", "AZ": "04", "AR": "05", "CA": "06", "CO": "08", "CT": "09", "DE": "10",
  "FL": "12", "GA": "13", "HI": "15", "ID": "16", "IL": "17", "IN": "18", "IA": "19", "KS": "20",
  "KY": "21", "LA": "22", "ME": "23", "MD": "24", "MA": "25", "MI": "26", "MN": "27", "MS": "28",
  "MO": "29", "MT": "30", "NE": "31", "NV": "32", "NH": "33", "NJ": "34", "NM": "35", "NY": "36",
  "NC": "37", "ND": "38", "OH": "39", "OK": "40", "OR": "41", "PA": "42", "RI": "44", "SC": "45",
  "SD": "46", "TN": "47", "TX": "48", "UT": "49", "VT": "50", "VA": "51", "WA": "53", "WV": "54",
  "WI": "55", "WY": "56"
};

export default function DistrictMap({ districtCode }: DistrictMapProps) {
  const [geoData, setGeoData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [targetBounds, setTargetBounds] = useState<L.LatLngBounds | null>(null);
  const [boundsKey, setBoundsKey] = useState(0);

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

  // Parse the target district code
  const parseDistrictCode = (code: string): { state: string; fips: string; district: string } | null => {
    const match = code.match(/^([A-Z]{2})(\d{2})$/i);
    if (!match) return null;

    const state = match[1].toUpperCase();
    const district = match[2];
    const fips = STATE_FIPS[state];

    if (!fips) return null;

    return { state, fips, district };
  };

  const targetInfo = parseDistrictCode(districtCode);

  useEffect(() => {
    if (targetInfo) {
      console.log('🎯 Looking for district:', {
        code: districtCode,
        state: targetInfo.state,
        fips: targetInfo.fips,
        district: targetInfo.district
      });
    }
  }, [districtCode, targetInfo]);

  const onEachDistrict = (feature: GeoJSON.Feature, layer: L.Layer) => {
    const properties = feature.properties as Record<string, string | number | undefined> | null;
    if (!properties || !targetInfo) return;

    // The GeoJSON uses STATEFP and CD118FP (or similar) properties
    const featureStateFP = properties.STATEFP || properties.STATEFP20 || properties.STATE;
    const geoidValue = typeof properties.GEOID === 'string' ? properties.GEOID.slice(-2) : undefined;
    const featureDistrictFP = properties.CD118FP || properties.CD116FP || properties.DISTRICT || geoidValue;

    // Convert to string for consistent comparison
    const featureState = String(featureStateFP);
    const featureDistrict = String(featureDistrictFP);

    // Check if this is the target district
    const isTargetDistrict =
      featureState === targetInfo.fips &&
      featureDistrict === targetInfo.district;

    // Debug logging for first match
    if (isTargetDistrict) {
      console.log('✅ Found target district!', {
        targetCode: districtCode,
        targetFIPS: targetInfo.fips,
        targetDistrict: targetInfo.district,
        featureState,
        featureDistrict,
        properties
      });
    }

    // Style districts
    if ('setStyle' in layer && typeof layer.setStyle === 'function') {
      if (isTargetDistrict) {
        // Highlight the target district
        layer.setStyle({
          fillColor: "#A855F7",
          fillOpacity: 0.7,
          color: "#7C3AED",
          weight: 3,
        });

        // Store bounds for centering
        if ('getBounds' in layer && typeof layer.getBounds === 'function') {
          const bounds = layer.getBounds();
          setTargetBounds(bounds);
          setBoundsKey(prev => prev + 1);
          console.log('🗺️  District bounds set, will fly to:', bounds);
        }
      } else {
        // Show other districts faintly
        layer.setStyle({
          fillColor: "#D4D4D8",
          fillOpacity: 0.15,
          color: "#A1A1AA",
          weight: 0.5,
        });
      }
    }

    // Add tooltip for target district
    if (isTargetDistrict && 'bindTooltip' in layer && typeof layer.bindTooltip === 'function') {
      const districtLabel = `${targetInfo.state}-${targetInfo.district}`;
      layer.bindTooltip(
        `<div style="font-size: 13px; font-weight: 600; color: #7C3AED;">
          District ${districtLabel}
        </div>`,
        { permanent: true, direction: 'center', className: 'district-label' }
      );
    }
  };

  // Component to handle map flyTo
  function MapController() {
    const map = useMap();

    useEffect(() => {
      if (targetBounds && map) {
        console.log('📍 Flying to district bounds:', targetBounds);
        setTimeout(() => {
          map.flyToBounds(targetBounds, {
            padding: [50, 50],
            maxZoom: 10,
            duration: 1.5
          });
        }, 200);
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, boundsKey]);

    return null;
  }

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
      center={[39.8283, -98.5795]}
      zoom={4}
      minZoom={4}
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
      <MapController />
    </MapContainer>
  );
}
