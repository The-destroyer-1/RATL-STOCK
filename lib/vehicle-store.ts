export type Vehicle = {
  id: string;
  model: string;
  plate: string;
  available: boolean;
  wallet: number;
  lastUpdated: string;
};
import { isVehicleBookedNow } from "@/lib/bookings";

type VehicleStore = {
  vehicles: Vehicle[];
  subscribers: Map<string, (payload: string) => void>;
};

declare global {
  // eslint-disable-next-line no-var
  var __VEHICLE_STORE: VehicleStore | undefined;
}

function createDefaultVehicles(): Vehicle[] {
  return [
    {
      id: "demio",
      model: "Mazda Demio",
      plate: "DEM-001",
      available: true,
      wallet: 2500,
      lastUpdated: new Date().toISOString(),
    },
    {
      id: "voxy",
      model: "Toyota Voxy",
      plate: "VOX-002",
      available: true,
      wallet: 8000,
      lastUpdated: new Date().toISOString(),
    },
    {
      id: "passo",
      model: "Toyota Passo",
      plate: "PAS-003",
      available: false,
      wallet: 2200,
      lastUpdated: new Date().toISOString(),
    },
    {
      id: "fielder",
      model: "Toyota Fielder",
      plate: "FIL-004",
      available: true,
      wallet: 4000,
      lastUpdated: new Date().toISOString(),
    },
    {
      id: "spade",
      model: "Toyota Spade",
      plate: "SPA-005",
      available: true,
      wallet: 1900,
      lastUpdated: new Date().toISOString(),
    },
    {
      id: "porte",
      model: "Toyota Porte",
      plate: "POR-006",
      available: false,
      wallet: 2800,
      lastUpdated: new Date().toISOString(),
    },
    {
      id: "vitz",
      model: "Toyota Vitz",
      plate: "VIT-007",
      available: true,
      wallet: 3000,
      lastUpdated: new Date().toISOString(),
    },
    {
      id: "note",
      model: "Nissan Note",
      plate: "NOT-008",
      available: true,
      wallet: 3000,
      lastUpdated: new Date().toISOString(),
    },
    {
      id: "vellfire",
      model: "Toyota Vellfire",
      plate: "VEL-009",
      available: true,
      wallet: 5600,
      lastUpdated: new Date().toISOString(),
    },
    {
      id: "alphard",
      model: "Toyota Alphard",
      plate: "ALP-010",
      available: false,
      wallet: 8000,
      lastUpdated: new Date().toISOString(),
    },
  ];
}

const store: VehicleStore = globalThis.__VEHICLE_STORE || {
  vehicles: createDefaultVehicles(),
  subscribers: new Map(),
};

globalThis.__VEHICLE_STORE = store;

export function publishUpdate() {
  const payload = JSON.stringify({ type: "vehicles", vehicles: getVehicleList() });
  store.subscribers.forEach((subscriber) => subscriber(payload));
}

export function getVehicleList() {
  // compute availability by considering active bookings
  return store.vehicles.map((v) => ({
    ...v,
    available: v.available && !isVehicleBookedNow(v.id),
  }));
}

export function updateVehicleAvailability(id: string, available: boolean) {
  const vehicle = store.vehicles.find((vehicle) => vehicle.id === id);
  if (!vehicle) {
    return null;
  }

  vehicle.available = available;
  vehicle.lastUpdated = new Date().toISOString();
  publishUpdate();
  return vehicle;
}

export function createVehicle(payload: { model: string; plate: string; available?: boolean; wallet?: number }) {
  const id = Math.random().toString(36).slice(2, 8);
  const vehicle = {
    id,
    model: payload.model,
    plate: payload.plate,
    available: payload.available ?? true,
    wallet: payload.wallet ?? 0,
    lastUpdated: new Date().toISOString(),
  };
  store.vehicles.push(vehicle as Vehicle);
  publishUpdate();
  return vehicle as Vehicle;
}

export function deleteVehicle(id: string) {
  const idx = store.vehicles.findIndex((v) => v.id === id);
  if (idx === -1) return null;
  const [removed] = store.vehicles.splice(idx, 1);
  publishUpdate();
  return removed as Vehicle;
}

export function subscribeVehicles(subscriber: (payload: string) => void) {
  const id = Math.random().toString(36).slice(2);
  store.subscribers.set(id, subscriber);
  return () => store.subscribers.delete(id);
}
