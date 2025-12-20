// src/pages/SupportHelp.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  PhoneCall,
  Mail,
  MapPin,
  ChevronRight,
  ExternalLink,
  Shield,
  Info,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { nearbyPois, type NearbyPoi } from "@/services/nearbyPois";
import { firebaseAuth } from "@/lib/firebase";

type FaqItem = { q: string; a: string };
type LatLng = { lat: number; lon: number };

const MAPLIBRE_JS =
  "https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.js";
const MAPLIBRE_CSS =
  "https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css";

const RASTER_OSM_STYLE = {
  version: 8,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
} as const;

let maplibreLoader: Promise<any> | null = null;

function ensureMaplibre(): Promise<any> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Map chỉ chạy trên trình duyệt"));
  }
  if ((window as any).maplibregl) {
    return Promise.resolve((window as any).maplibregl);
  }
  if (!maplibreLoader) {
    maplibreLoader = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = MAPLIBRE_JS;
      script.async = true;
      script.onload = () => resolve((window as any).maplibregl);
      script.onerror = reject;
      document.head.appendChild(script);

      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = MAPLIBRE_CSS;
      document.head.appendChild(link);
    });
  }
  return maplibreLoader;
}

function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const aa =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(a.lat)) *
      Math.cos(toRad(b.lat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.sqrt(aa));
}

const SupportHelp = () => {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const hotline = "1900 1234";
  const supportEmail = "support@vietbank.com";

  // ==== Map/Location states (from file 1) ====
  const [locating, setLocating] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [radius, setRadius] = useState(1500);
  const [amenity, setAmenity] = useState("atm");
  const [userPosition, setUserPosition] = useState<LatLng | null>(null);
  const [nearbyAtms, setNearbyAtms] = useState<NearbyPoi[]>([]);
  const [filterName, setFilterName] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [lastSearchRadius, setLastSearchRadius] = useState<number | null>(null);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const highlightedIdRef = useRef<string | null>(null);

  const faqs: FaqItem[] = useMemo(
    () => [
      {
        q: "Quên mật khẩu đăng nhập thì làm sao?",
        a: "Tại màn hình Đăng nhập, chọn “Quên mật khẩu” và nhập email đã đăng ký. Hệ thống sẽ gửi email hướng dẫn đặt lại mật khẩu (có thể nằm trong Spam).",
      },
      {
        q: "Không nhận được OTP khi giao dịch?",
        a: "Hãy kiểm tra kết nối mạng, kiểm tra hộp thư Spam/Quảng cáo. Nếu vẫn không có, đợi 1–2 phút rồi thử gửi lại OTP.",
      },
      {
        q: "Chuyển tiền liên ngân hàng bao lâu thì nhận được?",
        a: "Thông thường vài phút đến vài chục phút tùy ngân hàng/giờ giao dịch. Nếu ngoài giờ, giao dịch có thể xử lý vào ngày làm việc tiếp theo.",
      },
      {
        q: "Mất điện thoại / nghi ngờ lộ thông tin phải làm gì?",
        a: "Hãy đổi mật khẩu ngay, đổi PIN giao dịch và liên hệ tổng đài để được hỗ trợ khóa phiên đăng nhập nếu cần.",
      },
    ],
    []
  );

  const displayedAtms = useMemo(() => {
    if (!filterName) return nearbyAtms;
    return nearbyAtms.filter((p) => p.name === filterName);
  }, [filterName, nearbyAtms]);

  const filterOptions = useMemo(() => {
    const set = new Set<string>();
    nearbyAtms.forEach((p) => {
      if (p.name) set.add(p.name);
    });
    return Array.from(set);
  }, [nearbyAtms]);

  useEffect(() => {
    if (filterName && !filterOptions.includes(filterName)) {
      setFilterName(null);
    }
  }, [filterName, filterOptions]);

  const poiGeoJson = useMemo(
    () => ({
      type: "FeatureCollection",
      features: displayedAtms.map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lon, p.lat] },
        properties: {
          id: p.id,
          name: p.name,
          address: p.address ?? "",
          distanceM: p.distanceM ?? null,
        },
      })),
    }),
    [displayedAtms]
  );

  const handleFindBranch = async () => {
    if (!firebaseAuth.currentUser) {
      toast.error("Bạn cần đăng nhập trước khi tìm chi nhánh/ATM.");
      return;
    }

    setLocating(true);
    let current: LatLng | null = null;

    // Step 1: get location
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Thiết bị không hỗ trợ định vị"));
          return;
        }
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 12000,
        });
      });

      current = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      setUserPosition(current);
    } catch (error) {
      console.error("Geolocation error:", error);
      toast.error("Không lấy được vị trí. Kiểm tra quyền GPS.");
      setNearbyAtms([]);
      setLocating(false);
      return;
    }

    // Step 2: query nearby POIs
    try {
      const res = await nearbyPois({
        lat: current.lat,
        lon: current.lon,
        radiusM: radius,
        amenity,
        limit: 80,
      });

      const enriched = res.pois.map((item) => {
        const distanceM = haversineM(current!, { lat: item.lat, lon: item.lon });
        const address =
          item.tags?.["addr:full"] ||
          item.tags?.["addr:street"] ||
          item.tags?.name ||
          item.tags?.amenity;
        return { ...item, address, distanceM };
      });

      enriched.sort((a, b) => (a.distanceM ?? 0) - (b.distanceM ?? 0));

      const amenityFiltered = enriched.filter((item) => {
        const tag = item.tags?.amenity?.toLowerCase();
        return !tag || !amenity ? true : tag === amenity;
      });

      setFilterName(null);
      setFilterOpen(false);
      setNearbyAtms(amenityFiltered);
      setLastSearchRadius(radius);
      toast.success("Đã lấy vị trí và tải danh sách xung quanh");
    } catch (error) {
      console.error("nearbyPois error:", error);
      toast.error("Lỗi khi tìm địa điểm. Thử lại sau.");
      setNearbyAtms([]);
    } finally {
      setLocating(false);
    }
  };

  // init MapLibre once
  useEffect(() => {
    let map: any;
    let destroyed = false;

    ensureMaplibre()
      .then((maplibregl) => {
        if (destroyed || !mapContainerRef.current) return;

        map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: RASTER_OSM_STYLE as any,
          center: [106.7009, 10.7769],
          zoom: 12,
        });

        map.addControl(new maplibregl.NavigationControl(), "top-right");

        map.on("load", () => {
          map.addSource("atm-pois", {
            type: "geojson",
            data: poiGeoJson as any,
            cluster: true,
            clusterMaxZoom: 14,
            clusterRadius: 50,
          });

          map.addLayer({
            id: "atm-clusters",
            type: "circle",
            source: "atm-pois",
            filter: ["has", "point_count"],
            paint: {
              "circle-color": "#0ea5e9",
              "circle-radius": ["step", ["get", "point_count"], 16, 30, 22, 100, 28],
              "circle-opacity": 0.85,
            },
          });

          map.addLayer({
            id: "atm-cluster-count",
            type: "symbol",
            source: "atm-pois",
            filter: ["has", "point_count"],
            layout: {
              "text-field": "{point_count_abbreviated}",
              "text-size": 12,
            },
            paint: { "text-color": "#0b2747" },
          });

          map.addLayer({
            id: "atm-unclustered",
            type: "circle",
            source: "atm-pois",
            filter: ["!", ["has", "point_count"]],
            paint: {
              "circle-color": "#2563eb",
              "circle-radius": 7,
              "circle-stroke-width": 1.5,
              "circle-stroke-color": "#f8fafc",
            },
          });

          map.on("click", "atm-clusters", (e: any) => {
            const f = e.features?.[0];
            if (!f) return;
            const clusterId = f.properties?.cluster_id;
            const src = map.getSource("atm-pois") as any;
            src.getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
              if (err) return;
              const [lng, lat] = (f.geometry as any).coordinates;
              map.easeTo({ center: [lng, lat], zoom });
            });
          });

          map.on("click", "atm-unclustered", (e: any) => {
            const f = e.features?.[0];
            if (!f) return;
            const [lng, lat] = (f.geometry as any).coordinates;
            const name = f.properties?.name ?? "Địa điểm";
            const distanceM = f.properties?.distanceM;
            const address = f.properties?.address;
            const distanceTxt =
              typeof distanceM === "number"
                ? `${(distanceM / 1000).toFixed(2)} km`
                : "Khoảng cách chưa xác định";

            new maplibregl.Popup({ offset: 16 })
              .setLngLat([lng, lat])
              .setHTML(
                `<strong>${name}</strong><br/>${address ?? ""}<br/>${distanceTxt}`
              )
              .addTo(map);
          });

          map.on("mouseenter", "atm-clusters", () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", "atm-clusters", () => {
            map.getCanvas().style.cursor = "";
          });
          map.on("mouseenter", "atm-unclustered", () => {
            map.getCanvas().style.cursor = "pointer";
          });
          map.on("mouseleave", "atm-unclustered", () => {
            map.getCanvas().style.cursor = "";
          });

          mapInstanceRef.current = map;
          setMapReady(true);
        });
      })
      .catch((err) => {
        console.error("Load MapLibre failed", err);
        toast.error("Không tải được bản đồ. Kiểm tra kết nối mạng.");
      });

    return () => {
      destroyed = true;
      if (map) map.remove();
      mapInstanceRef.current = null;
      setMapReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // update POI source when data changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!mapReady || !map) return;
    const src = map.getSource("atm-pois") as any;
    if (src?.setData) src.setData(poiGeoJson as any);
  }, [mapReady, poiGeoJson]);

  // update user marker
  useEffect(() => {
    const maplibregl = (window as any).maplibregl;
    const map = mapInstanceRef.current;
    if (!maplibregl || !map || !userPosition) return;

    if (userMarkerRef.current) userMarkerRef.current.remove();

    userMarkerRef.current = new maplibregl.Marker({
      color: "#f97316",
      draggable: false,
    })
      .setLngLat([userPosition.lon, userPosition.lat])
      .addTo(map);

    map.easeTo({ center: [userPosition.lon, userPosition.lat], zoom: 14 });
  }, [userPosition]);

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-accent p-6 pb-8">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/profile")}
            className="text-primary-foreground hover:bg-white/20 rounded-full p-2 transition-colors"
            aria-label="Quay lại"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-lg font-bold text-primary-foreground">
            Trợ giúp & Hỗ trợ
          </h1>
          <div className="w-10" />
        </div>

        <div className="mt-4 rounded-2xl bg-white/15 p-4 text-primary-foreground/95">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-white/20 p-2">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold">Hỗ trợ nhanh – an toàn</p>
              <p className="text-xs text-primary-foreground/80">
                Luôn bảo mật OTP/PIN/mật khẩu. VietBank không yêu cầu cung cấp OTP
                qua tin nhắn/chat.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 -mt-4 space-y-4">
        {/* Chi nhánh / ATM (FE theo file 2 + gắn định vị từ file 1) */}
       
        <Card className="p-5 space-y-4">
          <h2 className="text-sm font-semibold mb-1">
            Chi nhánh, ATM & thông tin cộng đồng
          </h2>

          <div className="space-y-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                <p className="text-sm font-medium">
                  Tìm chi nhánh / ATM gần bạn
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <label className="flex items-center gap-2">
                  <span>Loại:</span>
                  <select
                    className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
                    value={amenity}
                    onChange={(e) => setAmenity(e.target.value)}
                  >
                    <option value="atm">ATM</option>
                    <option value="bank">Ngân hàng</option>
                    <option value="restaurant">Nhà hàng</option>
                    <option value="cafe">Cafe</option>
                    <option value="hospital">Bệnh viện</option>
                    <option value="pharmacy">Nhà thuốc</option>
                  </select>
                </label>
                <span>Bán kính:</span>
                <input
                  type="number"
                  className="h-8 w-24 rounded-md border border-input bg-transparent px-2 text-sm"
                  min={50}
                  max={20000}
                  step={50}
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value || 0))}
                />
                <span>m</span>
              </div>

              <div className="flex gap-2 relative">
                <Button size="sm" onClick={handleFindBranch} disabled={locating}>
                  {locating ? "Đang lấy vị trí..." : "Lấy vị trí & tìm"}
                </Button>

                <div className="relative">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!nearbyAtms.length}
                    onClick={() => setFilterOpen((v) => !v)}
                  >
                    {filterName ? `Lọc: ${filterName}` : "Lọc kết quả"}
                  </Button>

                  {filterOpen && (
                    <div className="absolute right-0 z-20 mt-2 w-56 rounded-md border border-muted bg-background shadow-md max-h-60 overflow-y-auto scrollbar-none">
                      <button
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60"
                        onClick={() => {
                          setFilterName(null);
                          setFilterOpen(false);
                        }}
                      >
                        Hiện tất cả ({nearbyAtms.length})
                      </button>
                      {filterOptions.map((name) => (
                        <button
                          key={name}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60"
                          onClick={() => {
                            setFilterName(name);
                            setFilterOpen(false);
                          }}
                        >
                          {name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="relative h-[320px] w-full overflow-hidden rounded-xl border border-muted">
              {!mapReady && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70 text-sm text-muted-foreground">
                  Đang tải bản đồ...
                </div>
              )}
              <div ref={mapContainerRef} className="h-full w-full" />
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div>
                {displayedAtms.length ? (
                  <span>
                    {displayedAtms.length} điểm trong bán kính ~
                    {Math.round(lastSearchRadius ?? radius)}m
                    {filterName ? ` (lọc từ ${nearbyAtms.length})` : ""}
                  </span>
                ) : (
                  <span>Chưa có dữ liệu. Bấm "Lấy vị trí & tìm".</span>
                )}
              </div>
              {userPosition && (
                <span>
                  Vị trí của bạn: {userPosition.lat.toFixed(5)},{" "}
                  {userPosition.lon.toFixed(5)}
                </span>
              )}
            </div>

            {displayedAtms.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1 scrollbar-none">
                {displayedAtms.map((atm) => (
                  <div
                    key={atm.id}
                    className="flex items-center justify-between rounded-lg border border-muted px-3 py-2 text-sm hover:bg-muted/60 cursor-pointer transition-colors"
                    onClick={() => {
                      const map = mapInstanceRef.current;
                      if (!map) return;
                      highlightedIdRef.current = atm.id;
                      map.easeTo({
                        center: [atm.lon, atm.lat],
                        zoom: 15,
                        duration: 800,
                      });
                    }}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{atm.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {atm.address ?? "Đang cập nhật"}
                      </span>
                    </div>
                    <div className="text-right text-xs text-primary">
                      {typeof atm.distanceM === "number"
                        ? `${(atm.distanceM / 1000).toFixed(2)} km`
                        : "Khoảng cách ?"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                Không có điểm nào để hiển thị.
              </div>
            )}
          </div>
        </Card>

        {/* Thông tin liên hệ (giữ nguyên FE file 2: chỉ hiển thị) */}
        <Card className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <PhoneCall className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Liên hệ ngân hàng</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-xl border border-muted/60 p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <PhoneCall className="w-4 h-4 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">Hotline</p>
                <p className="text-xs text-muted-foreground">{hotline} (24/7)</p>
              </div>
            </div>

            <div className="rounded-xl border border-muted/60 p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="w-4 h-4 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">Email hỗ trợ</p>
                <p className="text-xs text-muted-foreground">{supportEmail}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
            Thời gian phản hồi email thường trong vòng 24–48h (ngày làm việc).
          </div>
        </Card>

        {/* FAQ (giữ nguyên FE file 2) */}
        <Card className="p-5 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Info className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold">Câu hỏi thường gặp</h2>
          </div>

          <div className="space-y-2">
            {faqs.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-muted/60 overflow-hidden"
                >
                  <button
                    type="button"
                    className="w-full flex items-center justify-between px-3 py-3 text-left hover:bg-muted/50 transition-colors"
                    onClick={() => setOpenFaq((p) => (p === idx ? null : idx))}
                  >
                    <span className="text-sm font-medium">{item.q}</span>
                    <ChevronRight
                      className={`w-4 h-4 text-muted-foreground transition-transform ${
                        isOpen ? "rotate-90" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-3 text-xs text-muted-foreground leading-relaxed">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Footer app info (giữ nguyên FE file 2) */}
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Phiên bản ứng dụng</p>
              <p className="text-sm font-medium">VietBank Mobile v1.0.0</p>
            </div>
            <button
              className="text-xs text-primary hover:underline"
              onClick={() =>
                toast.info("Điều khoản sử dụng & chính sách bảo mật (demo)")
              }
            >
              Điều khoản &amp; Chính sách
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SupportHelp;
