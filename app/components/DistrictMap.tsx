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
    if (!targetInfo) {
      setLoading(false);
      return;
    }

    // Fetch district-specific GeoJSON from USDOT ArcGIS REST API
    // This loads ONLY the target district, not the entire state
    const districtNum = parseInt(targetInfo.district, 10).toString(); // Remove leading zero
    const url = `https://services.arcgis.com/P3ePLMYs2RVChkJx/arcgis/rest/services/USA_Congressional_Districts/FeatureServer/0/query?where=STATE_ABBR='${targetInfo.state}'+AND+CD113FIPS='${districtNum}'&outFields=*&f=geojson`;

    console.log(`🗺️  Fetching ${targetInfo.state}-${targetInfo.district} from USDOT ArcGIS...`);

    fetch(url)
      .then((res) => {
        console.log('📦 Response status:', res.status);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        console.log('✅ GeoJSON loaded!');
        console.log('📊 Total features:', data.features?.length);
        if (data.features && data.features.length > 0) {
          console.log('📋 Sample feature properties:', data.features[0].properties);
        }
        setGeoData(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("❌ Error loading congressional district:", error);
        setLoading(false);
      });
  }, [districtCode, targetInfo]);

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

    console.log('✅ Loaded district feature:', {
      targetCode: districtCode,
      properties: properties
    });

    // Style the district (there's only one since we query specifically)
    if ('setStyle' in layer && typeof layer.setStyle === 'function') {
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
    }

    // Add tooltip
    if ('bindTooltip' in layer && typeof layer.bindTooltip === 'function') {
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
            padding: [80, 80],
            maxZoom: 11,
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
