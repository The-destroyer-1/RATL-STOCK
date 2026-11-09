"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Vehicle } from "@/lib/vehicle-store";

const ADMIN_PASSCODE = "HUSSAM2026";

export default function AdminPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState("");

  const fetchVehicles = async () => {
    try {
      const response = await fetch("/api/vehicles");
      if (!response.ok) {
        throw new Error("Unable to load vehicles.");
      }
      const data = await response.json();
      setVehicles(data.vehicles ?? []);
    } catch (err) {
      setError("Failed to load admin fleet.");
    }
  };

  const fetchBookings = async () => {
    try {
      const res = await fetch("/api/bookings");
      if (!res.ok) return;
      const data = await res.json();
      setBookings(data.bookings ?? []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const stored = sessionStorage.getItem("adminLoggedIn");
    if (stored === "true") {
      setIsAuthenticated(true);
    }

    fetchVehicles();

    const eventSource = new EventSource("/api/vehicle-stream");
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.vehicles) {
          setVehicles(payload.vehicles);
          // refresh bookings when vehicle list updates
          fetchBookings();
        }
      } catch {
        // ignore
      }
    };

    return () => eventSource.close();
  }, []);

  useEffect(() => {
    fetchBookings();
  }, []);

  const toggleVehicle = async (vehicle: Vehicle) => {
    try {
      const response = await fetch("/api/vehicles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: vehicle.id, available: !vehicle.available }),
      });
      if (!response.ok) {
        throw new Error("Update failed");
      }
      const data = await response.json();
      setVehicles((current) =>
        current.map((item) => (item.id === data.vehicle.id ? data.vehicle : item))
      );
    } catch (err) {
      setError("Unable to update availability.");
    }
  };

  const [newModel, setNewModel] = useState("");
  const [newPlate, setNewPlate] = useState("");
  const [newWallet, setNewWallet] = useState<number | "">("");

  const registerVehicle = async (event?: FormEvent) => {
    if (event) event.preventDefault();
    if (!newModel || !newPlate) {
      setError("Model and plate are required.");
      return;
    }
    try {
      const res = await fetch("/api/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: newModel, plate: newPlate, wallet: Number(newWallet) || 0 }),
      });
      if (!res.ok) {
        setError("Unable to register vehicle.");
        return;
      }
      const data = await res.json();
      setNewModel("");
      setNewPlate("");
      setNewWallet("");
      // refresh list
      fetchVehicles();
    } catch (err) {
      setError("Unable to register vehicle.");
    }
  };

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password === ADMIN_PASSCODE) {
      setIsAuthenticated(true);
      sessionStorage.setItem("adminLoggedIn", "true");
      setLoginError("");
    } else {
      setLoginError("Invalid admin passcode.");
      setPassword("");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem("adminLoggedIn");
    setPassword("");
  };

  return (
    <main className="admin-page">
      <header className="admin-header">
        <div>
          <h1>Admin Fleet Panel</h1>
          <p>Manage each vehicle wallet and availability in real time.</p>
        </div>
      </header>

      {!isAuthenticated ? (
        <section className="admin-login">
          <h2>Admin Login</h2>
          <p>Enter the admin passcode to access fleet controls.</p>
          <form onSubmit={handleLogin}>
            <label>
              Passcode
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter admin passcode"
              />
            </label>
            <button type="submit">Sign in</button>
            {loginError && <div className="error-box">{loginError}</div>}
          </form>
        </section>
      ) : (
        <section className="admin-grid">
          <div className="admin-toolbar">
            <span>Admin logged in</span>
            <button className="logout-button" onClick={handleLogout}>
              Log out
            </button>
          </div>
          <section className="admin-login" style={{ marginBottom: 18 }}>
            <h2>Register Vehicle</h2>
            <form onSubmit={registerVehicle}>
              <label>
                Model
                <input value={newModel} onChange={(e) => setNewModel(e.target.value)} placeholder="Vehicle model" />
              </label>
              <label>
                Plate
                <input value={newPlate} onChange={(e) => setNewPlate(e.target.value)} placeholder="Plate number" />
              </label>
              <label>
                Wallet
                <input type="number" value={newWallet as any} onChange={(e) => setNewWallet(e.target.value ? Number(e.target.value) : "")} placeholder="Initial wallet" />
              </label>
              <button type="submit">Register vehicle</button>
            </form>
          </section>
          {error && <div className="error-box">{error}</div>}

          {vehicles.map((vehicle) => (
            <div key={vehicle.id} className="admin-card">
              <div className="admin-card-top">
                <div>
                  <p className="vehicle-model">{vehicle.model}</p>
                  <p className="vehicle-plate">Plate: {vehicle.plate}</p>
                </div>
                <span className={`status-badge ${vehicle.available ? "available" : "unavailable"}`}>
                  {vehicle.available ? "Available" : "Unavailable"}
                </span>
              </div>
              <p>Wallet balance: KSh {vehicle.wallet.toLocaleString()}</p>
              <p>Last updated: {new Date(vehicle.lastUpdated).toLocaleString()}</p>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="toggle-button" onClick={() => toggleVehicle(vehicle)}>
                  Mark {vehicle.available ? "Unavailable" : "Available"}
                </button>
                <button
                  onClick={async () => {
                    if (!confirm(`Delete vehicle ${vehicle.model} (${vehicle.plate})? This cannot be undone.`)) return;
                    try {
                      const res = await fetch(`/api/vehicles?id=${vehicle.id}`, { method: "DELETE" });
                      if (!res.ok) {
                        const err = await res.json().catch(() => ({ error: 'Delete failed' }));
                        setError(err.error || "Unable to delete vehicle.");
                        return;
                      }
                      // success — refresh list (stream should also update clients)
                      fetchVehicles();
                    } catch (e) {
                      setError("Unable to delete vehicle.");
                    }
                  }}
                  style={{ background: "#ef4444", color: "white", border: "none", borderRadius: 12, padding: "10px 12px" }}
                >
                  Delete
                </button>
              </div>

              {/* bookings for this vehicle */}
              <div style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "#fff" }}>
                <strong>Bookings</strong>
                {bookings.filter((b) => b.vehicleId === vehicle.id).length === 0 ? (
                  <div style={{ color: "#666", marginTop: 8 }}>No bookings</div>
                ) : (
                  bookings
                    .filter((b) => b.vehicleId === vehicle.id)
                    .map((b) => (
                      <div key={b.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 8 }}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{b.name}</div>
                          <div style={{ fontSize: "0.9rem", color: "#444" }}>
                            {new Date(b.startOn).toLocaleDateString()} — {new Date(b.endOn).toLocaleDateString()}
                          </div>
                        </div>
                        <div>
                          <button
                            className="toggle-button"
                            onClick={async () => {
                              if (!confirm(`Cancel booking for ${b.name}?`)) return;
                              const res = await fetch(`/api/bookings?id=${b.id}`, { method: "DELETE" });
                              if (res.ok) {
                                setBookings((cur) => cur.filter((x) => x.id !== b.id));
                              } else {
                                setError("Unable to cancel booking.");
                              }
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </div>
          ))}

          <section style={{ gridColumn: "1 / -1", marginTop: 18 }}>
            <h2>Bookings</h2>
            {bookings.length === 0 ? (
              <p>No bookings yet.</p>
            ) : (
              bookings.map((b) => (
                <div key={b.id} style={{ marginBottom: 12, padding: 12, borderRadius: 12, background: "#fff" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <strong>{b.model} ({b.plate})</strong>
                      <div>{b.name} — {b.email}</div>
                      <div>
                        {new Date(b.startOn).toLocaleDateString()} to {new Date(b.endOn).toLocaleDateString()}
                      </div>
                      <div style={{ fontSize: "0.9rem", color: "#666" }}>Created: {new Date(b.createdAt).toLocaleString()}</div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <button
                        className="toggle-button"
                        onClick={async () => {
                          if (!confirm(`Cancel booking ${b.model} (${b.plate})?`)) return;
                          const res = await fetch(`/api/bookings?id=${b.id}`, { method: "DELETE" });
                          if (res.ok) {
                            setBookings((cur) => cur.filter((x) => x.id !== b.id));
                          } else {
                            setError("Unable to cancel booking.");
                          }
                        }}
                      >
                        Cancel booking
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </section>
        </section>
      )}
    </main>
  );
}
