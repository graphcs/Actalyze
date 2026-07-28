"use client";

import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import { useT } from "../i18n/LocaleProvider";
import { Ltr } from "./Ltr";

/**
 * Where a constituency is — honestly labelled.
 *
 * ── Why there is no constituency polygon here ──────────────────────────────────────
 *
 * There is no machine-readable boundary set for the 2023 delimitation. The Election
 * Commission publishes the delimitation as raster PDFs — scanned maps, not geometry.
 * The one open dataset that looks like the answer (HDX "Pakistan constituency
 * boundaries") is the 2002/2013 delimitation: in it NA-36 is `MOHAMDAN AGENCY,
 * Province: FATA`, an administrative unit abolished by the 25th Amendment. The
 * current NA-36 is Hangu-cum-Orakzai in Khyber Pakhtunkhwa. Rendering that dataset
 * would draw the wrong shape in the wrong province under the right seat number, and
 * an audience of parliamentarians would spot it instantly.
 *
 * So this shows the containing DISTRICT, and says so in the caption. Stating the
 * limitation is the credibility asset here: a Pakistani official already knows the
 * boundaries are not published, and a product that quietly draws a confident polygon
 * is a product that is guessing about everything else too.
 *
 * ── Why the whole map is wrapped in dir="ltr" ──────────────────────────────────────
 *
 * Leaflet computes pane transforms assuming a left-to-right container. Under a
 * `dir="rtl"` ancestor the tile grid offsets are mirrored and tiles land in the wrong
 * places. `ltr-island` (see `pk.css`) pins the direction back for the map subtree.
 */

const MapContainer = dynamic(
  () => import("react-leaflet").then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(() => import("react-leaflet").then((m) => m.TileLayer), {
  ssr: false,
});
const CircleMarker = dynamic(
  () => import("react-leaflet").then((m) => m.CircleMarker),
  { ssr: false }
);
const Tooltip = dynamic(() => import("react-leaflet").then((m) => m.Tooltip), {
  ssr: false,
});

/**
 * District centres, hand-checked.
 *
 * Not a geocoding call: a demo must not depend on a third-party lookup that can rate
 * limit mid-presentation, and district names in the na.gov.pk roster ("Karachi
 * Central", "Shaheed Benazirabad") are not always what a geocoder expects. Keys are
 * lowercased district names exactly as they appear in `data/pk/constituencies.json`.
 */
const DISTRICT_CENTRES: Record<string, [number, number]> = {
  // Punjab
  lahore: [31.5204, 74.3587],
  "nankana sahib": [31.4504, 73.7076],
  sheikhupura: [31.7131, 73.9783],
  kasur: [31.1187, 74.4506],
  okara: [30.8138, 73.4534],
  faisalabad: [31.4187, 73.0791],
  "toba tek singh": [30.9709, 72.4826],
  jhang: [31.2781, 72.3317],
  chiniot: [31.7208, 72.9789],
  gujranwala: [32.1877, 74.1945],
  sialkot: [32.4945, 74.5229],
  narowal: [32.1014, 74.8734],
  gujrat: [32.5731, 74.0789],
  hafizabad: [32.0712, 73.6885],
  "mandi bahauddin": [32.5861, 73.4917],
  rawalpindi: [33.5651, 73.0169],
  attock: [33.7661, 72.3609],
  chakwal: [32.9328, 72.8630],
  jhelum: [32.9425, 73.7257],
  sargodha: [32.0836, 72.6711],
  khushab: [32.2955, 72.3489],
  mianwali: [32.5839, 71.5370],
  bhakkar: [31.6265, 71.0654],
  multan: [30.1575, 71.5249],
  khanewal: [30.3017, 71.9321],
  lodhran: [29.5467, 71.6276],
  vehari: [30.0442, 72.3441],
  sahiwal: [30.6682, 73.1114],
  pakpattan: [30.3411, 73.3873],
  bahawalpur: [29.3956, 71.6836],
  bahawalnagar: [29.9994, 73.2536],
  "rahim yar khan": [28.4202, 70.2952],
  "dera ghazi khan": [30.0489, 70.6403],
  muzaffargarh: [30.0736, 71.1805],
  layyah: [30.9693, 70.9428],
  rajanpur: [29.1041, 70.3300],
  // Islamabad
  ict: [33.6844, 73.0479],
  islamabad: [33.6844, 73.0479],
  // Sindh
  "karachi central": [24.9333, 67.0500],
  "karachi east": [24.9056, 67.0822],
  "karachi south": [24.8500, 67.0200],
  "karachi west": [24.9200, 66.9800],
  "karachi malir": [24.8938, 67.1932],
  malir: [24.8938, 67.1932],
  korangi: [24.8330, 67.1330],
  keamari: [24.8600, 66.9800],
  hyderabad: [25.3960, 68.3578],
  jamshoro: [25.4300, 68.2800],
  matiari: [25.5975, 68.4453],
  "tando allahyar": [25.4600, 68.7190],
  "tando muhammad khan": [25.1236, 68.5378],
  badin: [24.6560, 68.8370],
  thatta: [24.7460, 67.9240],
  sujawal: [24.6050, 68.0760],
  dadu: [26.7300, 67.7800],
  "shaheed benazirabad": [26.2442, 68.4096],
  naushahro: [26.8400, 68.1250],
  "naushahro feroze": [26.8400, 68.1250],
  sanghar: [26.0470, 68.9490],
  "mirpur khas": [25.5276, 69.0122],
  umerkot: [25.3614, 69.7360],
  tharparkar: [24.8900, 70.1800],
  khairpur: [27.5295, 68.7592],
  sukkur: [27.7052, 68.8574],
  ghotki: [28.0040, 69.3160],
  shikarpur: [27.9556, 68.6382],
  jacobabad: [28.2769, 68.4514],
  kashmore: [28.4340, 69.5860],
  larkana: [27.5600, 68.2264],
  "qambar shahdadkot": [27.5860, 67.9260],
  // Khyber Pakhtunkhwa
  peshawar: [34.0151, 71.5249],
  nowshera: [34.0153, 71.9747],
  charsadda: [34.1453, 71.7308],
  mardan: [34.1989, 72.0231],
  swabi: [34.1200, 72.4700],
  kohat: [33.5869, 71.4414],
  hangu: [33.5333, 71.0500],
  orakzai: [33.7000, 70.9000],
  karak: [33.1167, 71.0942],
  bannu: [32.9889, 70.6056],
  lakki: [32.6080, 70.9110],
  "lakki marwat": [32.6080, 70.9110],
  "dera ismail khan": [31.8313, 70.9017],
  tank: [32.2170, 70.3830],
  abbottabad: [34.1688, 73.2215],
  haripur: [33.9942, 72.9333],
  mansehra: [34.3300, 73.1968],
  "torghar": [34.5800, 72.8300],
  battagram: [34.6770, 73.0230],
  kohistan: [35.1000, 73.0500],
  "lower kohistan": [34.9000, 73.0000],
  "kolai pallas": [34.8500, 73.1500],
  swat: [34.7717, 72.3600],
  shangla: [34.8000, 72.6667],
  buner: [34.4200, 72.5000],
  malakand: [34.5670, 71.9330],
  dir: [35.2000, 71.8760],
  "lower dir": [34.9000, 71.8500],
  "upper dir": [35.2000, 71.8760],
  chitral: [35.8511, 71.7864],
  "lower chitral": [35.8511, 71.7864],
  "upper chitral": [36.2000, 72.2000],
  bajaur: [34.6800, 71.5100],
  mohmand: [34.5330, 71.3000],
  khyber: [34.0400, 71.2000],
  kurram: [33.8600, 70.1000],
  "north waziristan": [32.9500, 70.0500],
  "south waziristan": [32.3000, 69.6500],
  // Balochistan
  quetta: [30.1798, 66.9750],
  pishin: [30.5830, 66.9930],
  chaman: [30.9200, 66.4500],
  "killa abdullah": [30.7500, 66.6500],
  loralai: [30.3700, 68.6000],
  zhob: [31.3410, 69.4490],
  sibi: [29.5430, 67.8770],
  nasirabad: [28.4000, 68.0000],
  jaffarabad: [28.3000, 68.2500],
  jhal: [28.2900, 67.4400],
  "jhal magsi": [28.2900, 67.4400],
  kachhi: [29.0000, 67.7000],
  bolan: [29.0000, 67.7000],
  khuzdar: [27.8000, 66.6167],
  kalat: [29.0260, 66.5920],
  mastung: [29.7990, 66.8450],
  lasbela: [25.8800, 66.6200],
  gwadar: [25.1264, 62.3225],
  kech: [26.0060, 63.0480],
  turbat: [26.0060, 63.0480],
  panjgur: [26.9700, 64.1000],
  awaran: [26.4560, 65.2320],
  kharan: [28.5840, 65.4150],
  chagai: [29.3000, 64.7000],
  washuk: [27.8300, 64.9200],
  barkhan: [29.8970, 69.5250],
  "dera bugti": [29.0350, 69.1580],
  kohlu: [29.8950, 69.2530],
  musakhel: [30.8500, 69.8200],
  sherani: [31.2000, 69.7000],
  harnai: [30.1000, 67.9400],
  ziarat: [30.3820, 67.7260],
  duki: [30.1500, 68.5700],
  sohbatpur: [28.5100, 68.5400],
};

/** Fallback when the district is not in the table above. */
const PROVINCE_CENTRES: Record<string, [number, number]> = {
  PB: [30.9, 72.0],
  SD: [26.0, 68.5],
  KP: [34.3, 71.9],
  BA: [28.5, 66.0],
  ICT: [33.6844, 73.0479],
};

const PAKISTAN_CENTRE: [number, number] = [30.3753, 69.3451];

interface PkMapProps {
  code: string;
  districts: string[];
  province: string | null;
  /** Party colour for the marker. */
  color: string;
  label: string;
}

function resolveCentre(
  districts: string[],
  province: string | null
): { centre: [number, number]; zoom: number; precise: boolean } {
  for (const d of districts) {
    const hit = DISTRICT_CENTRES[d.trim().toLowerCase()];
    if (hit) {
      // City districts are small; a multi-district `-cum-` seat needs more room.
      return { centre: hit, zoom: districts.length > 1 ? 8 : 10, precise: true };
    }
  }
  if (province && PROVINCE_CENTRES[province]) {
    return { centre: PROVINCE_CENTRES[province], zoom: 6, precise: false };
  }
  return { centre: PAKISTAN_CENTRE, zoom: 5, precise: false };
}

export function PkMap({ code, districts, province, color, label }: PkMapProps) {
  const t = useT();
  const { centre, zoom } = resolveCentre(districts, province);

  return (
    <div>
      {/* dir="ltr" + ltr-island: Leaflet's pane transforms assume LTR. */}
      <div dir="ltr" className="ltr-island h-[360px] w-full overflow-hidden rounded-xl">
        <MapContainer
          center={centre}
          zoom={zoom}
          zoomControl={false}
          scrollWheelZoom={false}
          dragging={false}
          touchZoom={false}
          doubleClickZoom={false}
          boxZoom={false}
          keyboard={false}
          attributionControl={false}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <CircleMarker
            center={centre}
            radius={11}
            pathOptions={{
              color: "#ffffff",
              weight: 3,
              fillColor: color,
              fillOpacity: 0.9,
            }}
          >
            <Tooltip permanent direction="top" offset={[0, -10]}>
              <span style={{ fontWeight: 600 }}>{code}</span>
              {label ? ` — ${label}` : ""}
            </Tooltip>
          </CircleMarker>
        </MapContainer>
      </div>

      {/* Saying what this is NOT is the point of the caption. */}
      <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        {t("constituency.mapCaption")}
      </p>
      <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500 urdu-prose">
        {t("constituency.mapCaptionWhy")}
      </p>
      {districts.length > 0 && (
        <p className="mt-2 text-xs text-zinc-500">
          {t("constituency.districts")}:{" "}
          <Ltr className="font-medium">{districts.join(" · ")}</Ltr>
        </p>
      )}
    </div>
  );
}

export default PkMap;
