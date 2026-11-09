"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

type Product = {
  id: string;
  name: string;
  sku: string;
  category: string;
  quantity: number;
  unit: string;
  reorderLevel: number;
};

type Movement = {
  id: string;
  productId: string;
  productName: string;
  type: "in" | "out";
  quantity: number;
  note: string;
  vehicleNumber?: string;
  vendor?: string;
  amount?: number;
  unitAmount?: number;
  authorizedBy?: string;
  approvedBy?: string;
  takenBy?: string;
  collectedBy?: string;
  status?: "pending" | "approved";
  createdAt: string;
};

type InventoryBackup = {
  format: "stockroom-backup";
  version: 1;
  exportedAt: string;
  products: Product[];
  movements: Movement[];
  vendors?: string[];
};

const STORAGE_KEY = "stockroom-inventory-v1";
const AUTH_KEY = "stockroom-authenticated";

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function validateBackup(value: unknown): InventoryBackup {
  if (!value || typeof value !== "object") throw new Error("The selected file is not a valid backup.");
  const backup = value as Partial<InventoryBackup>;
  if (backup.format !== "stockroom-backup" || backup.version !== 1) {
    throw new Error("This backup file is not supported.");
  }
  if (!Array.isArray(backup.products) || !Array.isArray(backup.movements)) {
    throw new Error("The backup is missing inventory or movement data.");
  }
  const productsValid = backup.products.every(
    (item) =>
      item &&
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      typeof item.sku === "string" &&
      typeof item.category === "string" &&
      typeof item.unit === "string" &&
      isNonNegativeNumber(item.quantity) &&
      isNonNegativeNumber(item.reorderLevel)
  );
  const movementsValid = backup.movements.every(
    (item) =>
      item &&
      typeof item.id === "string" &&
      typeof item.productId === "string" &&
      typeof item.productName === "string" &&
      (item.type === "in" || item.type === "out") &&
      isNonNegativeNumber(item.quantity) &&
      typeof item.note === "string" &&
      (item.vehicleNumber === undefined || typeof item.vehicleNumber === "string") &&
      (item.vendor === undefined || typeof item.vendor === "string") &&
      (item.amount === undefined || isNonNegativeNumber(item.amount)) &&
      (item.unitAmount === undefined || isNonNegativeNumber(item.unitAmount)) &&
      (item.authorizedBy === undefined || typeof item.authorizedBy === "string") &&
      (item.approvedBy === undefined || typeof item.approvedBy === "string") &&
      (item.takenBy === undefined || typeof item.takenBy === "string") &&
      (item.collectedBy === undefined || typeof item.collectedBy === "string") &&
      (item.status === undefined || item.status === "pending" || item.status === "approved") &&
      typeof item.createdAt === "string"
  );
  if (
    !productsValid ||
    !movementsValid ||
    (backup.vendors !== undefined &&
      (!Array.isArray(backup.vendors) || !backup.vendors.every((vendor) => typeof vendor === "string")))
  ) {
    throw new Error("The backup contains invalid inventory records.");
  }
  return backup as InventoryBackup;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en").format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(value)
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES" }).format(value);
}

export default function Page() {
  const [authenticated, setAuthenticated] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [loginError, setLoginError] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [vendors, setVendors] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [modal, setModal] = useState<"movement" | null>(null);
  const [movementType, setMovementType] = useState<"in" | "out">("in");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const importRef = useRef<HTMLInputElement>(null);
  const movementFormRef = useRef<HTMLFormElement>(null);
  const [newPartMode, setNewPartMode] = useState(false);
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [newVendor, setNewVendor] = useState("");
  const [selectedVendor, setSelectedVendor] = useState("");
  const [movementQuantity, setMovementQuantity] = useState("");
  const [movementAmount, setMovementAmount] = useState("");
  const [approvalNames, setApprovalNames] = useState<Record<string, string>>({});

  function scrollToSection(event: React.MouseEvent<HTMLAnchorElement>, sectionId: string) {
    event.preventDefault();
    window.history.replaceState(null, "", `#${sectionId}`);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  useEffect(() => {
    setAuthenticated(sessionStorage.getItem(AUTH_KEY) === "true");
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { products?: Product[]; movements?: Movement[]; vendors?: string[] };
        if (Array.isArray(parsed.products) && Array.isArray(parsed.movements)) {
          setProducts(parsed.products);
          setMovements(parsed.movements);
          setVendors(Array.isArray(parsed.vendors) ? parsed.vendors : []);
        }
      }
    } catch {
      setError("Saved inventory could not be read. Import a valid backup to restore your data.");
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ products, movements, vendors }));
    }
  }, [products, movements, vendors, loaded]);

  const lowStockCount = products.filter((product) => product.quantity <= product.reorderLevel).length;
  const totalUnits = products.reduce((sum, product) => sum + product.quantity, 0);
  const stockInTotal = movements
    .filter((movement) => movement.type === "in" && movement.status !== "pending")
    .reduce((sum, movement) => sum + movement.quantity, 0);
  const stockOutTotal = movements
    .filter((movement) => movement.type === "out")
    .reduce((sum, movement) => sum + movement.quantity, 0);
  const pendingStockIns = movements.filter(
    (movement) => movement.type === "in" && movement.status === "pending"
  );
  const stockInStatements = movements.filter((movement) => movement.type === "in");
  const approvedStockInAmount = stockInStatements
    .filter((movement) => movement.status !== "pending")
    .reduce((sum, movement) => sum + (movement.amount ?? 0), 0);
  const pendingStockInAmount = pendingStockIns.reduce(
    (sum, movement) => sum + (movement.amount ?? 0),
    0
  );
  const totalStockInAmount = approvedStockInAmount + pendingStockInAmount;

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch =
        !query ||
        [product.name, product.sku, product.category].some((value) => value.toLowerCase().includes(query));
      const matchesFilter =
        filter === "all" ||
        (filter === "low" && product.quantity <= product.reorderLevel) ||
        (filter === "in-stock" && product.quantity > product.reorderLevel);
      return matchesSearch && matchesFilter;
    });
  }, [products, search, filter]);

  function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (passcode !== "0799708249") {
      setLoginError("That passcode is not correct. Please try again.");
      return;
    }
    sessionStorage.setItem(AUTH_KEY, "true");
    setAuthenticated(true);
    setLoginError("");
  }

  function exportBackup() {
    const backup: InventoryBackup = {
      format: "stockroom-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      products,
      movements,
      vendors,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `stockroom-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("Backup exported successfully.");
    setError("");
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const backup = validateBackup(JSON.parse(await file.text()));
      if (!window.confirm(`Replace current data with ${backup.products.length} products and ${backup.movements.length} movements?`)) {
        return;
      }
      setProducts(backup.products);
      setMovements(backup.movements);
      setVendors(backup.vendors ?? []);
      setNotice("Backup imported successfully.");
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The backup could not be imported.");
    } finally {
      event.target.value = "";
    }
  }

  function recordMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const quantity = Number(movementQuantity);
    const note = String(form.get("note") ?? "").trim();
    const vehicleNumber = String(form.get("vehicleNumber") ?? "").trim();
    const authorizedBy = String(form.get("authorizedBy") ?? "").trim();
    const takenBy = String(form.get("takenBy") ?? "").trim();
    const amount = movementAmount === "" ? NaN : Number(movementAmount);
    const vendor = movementType === "in" ? selectedVendor.trim() : "";
    if (!Number.isInteger(quantity) || quantity <= 0) {
      setError("Enter a whole quantity greater than zero.");
      return;
    }
    if (!authorizedBy || (movementType === "out" && !takenBy)) {
      setError(movementType === "in"
        ? "Enter the name of the person authorizing this stock in."
        : "Enter the names of the person authorizing and taking this spare.");
      return;
    }
    if (movementType === "in" && !vendor) {
      setError("Select a vendor for this stock in.");
      return;
    }
    if (movementType === "out" && !vehicleNumber) {
      setError("Enter the vehicle number for this stock out.");
      return;
    }
    if (movementType === "in" && (!isNonNegativeNumber(amount) || amount <= 0)) {
      setError("Enter a total stock-in amount greater than zero in KSh.");
      return;
    }
    let product: Product | undefined;
    if (movementType === "in" && newPartMode) {
      const name = String(form.get("newPartName") ?? "").trim();
      const sku = String(form.get("newPartSku") ?? "").trim();
      const category = String(form.get("newPartCategory") ?? "").trim();
      const unit = String(form.get("newPartUnit") ?? "").trim();
      const reorderLevel = Number(form.get("reorderLevel"));
      if (!name || !sku || !category || !unit || !isNonNegativeNumber(reorderLevel)) {
        setError("Complete all new part details with a valid reorder level.");
        return;
      }
      if (products.some((item) => item.sku.toLowerCase() === sku.toLowerCase())) {
        setError("That SKU is already in your inventory.");
        return;
      }
      product = { id: makeId(), name, sku, category, quantity: 0, unit, reorderLevel };
      setProducts((current) => [product!, ...current]);
    } else {
      const productId = String(form.get("productId") ?? "");
      product = products.find((item) => item.id === productId);
      if (!product) {
        setError("Choose a part before saving the stock movement.");
        return;
      }
    }
    if (movementType === "out" && quantity > product.quantity) {
      setError(`Only ${formatNumber(product.quantity)} ${product.unit} available for ${product.name}.`);
      return;
    }
    const unitAmount = movementType === "in" ? amount / quantity : undefined;
    const movement: Movement = {
      id: makeId(),
      productId: product.id,
      productName: product.name,
      type: movementType,
      quantity,
      note,
      ...(movementType === "out" ? { vehicleNumber, takenBy } : { amount, unitAmount, vendor, status: "pending" as const }),
      authorizedBy,
      createdAt: new Date().toISOString(),
    };
    setProducts((current) =>
      current.map((item) =>
        item.id === product!.id
          ? {
              ...item,
              quantity: item.quantity + (movementType === "out" ? -quantity : 0),
            }
          : item
      )
    );
    setMovements((current) => [
      movement,
      ...current,
    ]);
    movementFormRef.current?.reset();
    setNewPartMode(false);
    setShowAddVendor(false);
    setSelectedVendor("");
    setNewVendor("");
    setMovementQuantity("");
    setMovementAmount("");
    setModal(null);
    setError("");
    setNotice(movementType === "in"
      ? "Stock-in statement saved as pending. Inventory updates after approval."
      : "Stock out recorded for vehicle repair.");
  }

  function approveStockIn(movement: Movement, approver: string) {
    if (movement.type !== "in" || movement.status !== "pending") return;
    const approvedBy = approver.trim();
    if (!approvedBy) {
      setError("Enter the approver name before approving this stock in.");
      return;
    }
    setProducts((current) =>
      current.map((item) =>
        item.id === movement.productId ? { ...item, quantity: item.quantity + movement.quantity } : item
      )
    );
    setMovements((current) =>
      current.map((item) =>
        item.id === movement.id ? { ...item, approvedBy, status: "approved" } : item
      )
    );
    setApprovalNames((current) => ({ ...current, [movement.id]: "" }));
    setError("");
    setNotice(`Stock-in approved. ${movement.productName} inventory updated.`);
  }

  function addVendor() {
    const name = newVendor.trim();
    if (!name) {
      setError("Enter a vendor name.");
      return;
    }
    if (vendors.some((vendor) => vendor.toLowerCase() === name.toLowerCase())) {
      setError("That vendor already exists.");
      return;
    }
    setVendors((current) => [...current, name].sort((a, b) => a.localeCompare(b)));
    setSelectedVendor(name);
    setNewVendor("");
    setShowAddVendor(false);
    setError("");
  }

  function clearMovementForm() {
    movementFormRef.current?.reset();
    setNewPartMode(false);
    setSelectedVendor("");
    setNewVendor("");
    setShowAddVendor(false);
    setMovementQuantity("");
    setMovementAmount("");
    setError("");
  }

  function deleteMovement(movement: Movement) {
    if (!window.confirm(`Delete the ${movement.type === "in" ? "stock-in" : "stock-out"} statement for ${movement.productName}?`)) {
      return;
    }
    const product = products.find((item) => item.id === movement.productId);
    if (!product) {
      setError("This statement cannot be deleted because its inventory item is missing.");
      return;
    }
    if (
      movement.type === "in" &&
      movement.status !== "pending" &&
      product.quantity < movement.quantity
    ) {
      setError("This stock-in statement cannot be deleted because some of its stock has already been issued.");
      return;
    }
    setProducts((current) =>
      current.map((item) =>
        item.id === movement.productId
          ? {
              ...item,
              quantity: item.quantity + (
                movement.type === "out"
                  ? movement.quantity
                  : movement.status === "pending" ? 0 : -movement.quantity
              ),
            }
          : item
      )
    );
    setMovements((current) => current.filter((item) => item.id !== movement.id));
    setError("");
    setNotice("Statement deleted and inventory adjusted.");
  }

  if (!authenticated) {
    return (
      <main className="login-screen">
        <section className="login-card">
          <div className="brand-mark">S</div>
          <p className="eyebrow">RATL STOCKS</p>
          <h1>Welcome back</h1>
          <p className="login-copy">Enter your passcode to manage your inventory.</p>
          <form onSubmit={signIn}>
            <label htmlFor="passcode">Passcode</label>
            <input
              id="passcode"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={passcode}
              onChange={(event) => setPasscode(event.target.value)}
              placeholder="Enter your passcode"
              autoFocus
            />
            {loginError && <p className="form-error">{loginError}</p>}
            <button className="primary-button login-button" type="submit">Unlock dashboard <span>→</span></button>
          </form>
          <p className="login-foot">Inventory, movement history, and backups in one place.</p>
        </section>
      </main>
    );
  }

  return (
    <main className={`app-shell${modal === "movement" && movementType === "in" ? " print-stock-in" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">S</div>
          <div><strong>ratl stocks</strong><span>INVENTORY MANAGER</span></div>
        </div>
        <p className="nav-label">WORKSPACE</p>
        <a className="nav-item active" href="#overview" onClick={(event) => scrollToSection(event, "overview")}>
          <span className="nav-icon">▦</span> Overview
        </a>
        <a className="nav-item" href="#inventory" onClick={(event) => scrollToSection(event, "inventory")}>
          <span className="nav-icon">□</span> Inventory
        </a>
        <a className="nav-item" href="#activity" onClick={(event) => scrollToSection(event, "activity")}>
          <span className="nav-icon">↔</span> Stock movements
        </a>
        <a className="nav-item" href="#spares-cost" onClick={(event) => scrollToSection(event, "spares-cost")}>
          <span className="nav-icon">↗</span> Cash Flow
        </a>
        <div className="sidebar-bottom">
          <div className="sidebar-help"><span className="help-dot" /><div><strong>All changes saved</strong><small>Stored on this device</small></div></div>
          <button
            className="nav-item signout-button"
            onClick={() => {
              sessionStorage.removeItem(AUTH_KEY);
              setAuthenticated(false);
            }}
          ><span className="nav-icon">↪</span> Sign out</button>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div><p className="breadcrumb">Workspace <span>/</span> Overview</p><p className="topbar-date">{new Intl.DateTimeFormat("en", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date())}</p></div>
          <div className="topbar-actions">
            <input ref={importRef} className="file-input" type="file" accept=".json,application/json" onChange={importBackup} />
            <button className="quiet-button" onClick={() => importRef.current?.click()}><span>↑</span> Import backup</button>
            <button className="quiet-button" onClick={exportBackup}><span>↓</span> Export backup</button>
            <div className="avatar">S</div>
          </div>
        </header>

        <div className="dashboard-content" id="overview">
          <div className="page-heading">
            <div><p className="eyebrow">YOUR BUSINESS AT A GLANCE</p><h1>Inventory overview</h1><p className="subheading">Track what comes in, what goes out, and what needs restocking.</p></div>
            <div className="heading-actions">
              <button className="secondary-button" onClick={() => { setMovementType("out"); setNewPartMode(false); setModal("movement"); setError(""); }}>− Stock out</button>
              <button className="primary-button" onClick={() => { setMovementType("in"); setModal("movement"); setError(""); }}>＋ Stock in</button>
            </div>
          </div>

          {(notice || error) && <div className={`notice ${error ? "notice-error" : ""}`} role="status">{error || notice}<button onClick={() => { setNotice(""); setError(""); }} aria-label="Dismiss">×</button></div>}

          <div className="stats-grid">
            <article className="stat-card"><div className="stat-top"><span className="stat-label">TOTAL PRODUCTS</span><span className="stat-icon purple">□</span></div><strong>{formatNumber(products.length)}</strong><p>Unique items tracked</p></article>
            <article className="stat-card"><div className="stat-top"><span className="stat-label">TOTAL UNITS</span><span className="stat-icon blue">▤</span></div><strong>{formatNumber(totalUnits)}</strong><p>Units currently in stock</p></article>
            <article className="stat-card"><div className="stat-top"><span className="stat-label">STOCK RECEIVED</span><span className="stat-icon green">↙</span></div><strong>{formatNumber(stockInTotal)}</strong><p>Units received, all time</p></article>
            <article className="stat-card"><div className="stat-top"><span className="stat-label">LOW STOCK ALERTS</span><span className="stat-icon orange">!</span></div><strong>{formatNumber(lowStockCount)}</strong><p>Items at or below reorder level</p></article>
          </div>

          <section className="panel approval-panel">
            <div className="panel-heading">
              <div><h2>Stock-in approval checklist</h2><p>Stock stays pending and is excluded from inventory until approved.</p></div>
              <span className="activity-count">{pendingStockIns.length} pending</span>
            </div>
            {pendingStockIns.length > 0
              ? <div className="approval-list">{pendingStockIns.map((movement) => <div className="approval-item" key={movement.id}>
                  <span><strong>{movement.productName}</strong><small>{formatNumber(movement.quantity)} · {movement.vendor || "Vendor not recorded"} · {formatCurrency(movement.amount ?? 0)}</small></span>
                  <small>Authorized by {movement.authorizedBy || "—"}</small>
                  <input
                    className="approval-name"
                    aria-label={`Approved by name for ${movement.productName}`}
                    value={approvalNames[movement.id] ?? ""}
                    onChange={(event) => setApprovalNames((current) => ({ ...current, [movement.id]: event.target.value }))}
                    placeholder="Approved by"
                  />
                  <label className="approval-check"><input
                    type="checkbox"
                    checked={false}
                    aria-label={`Approve stock in for ${movement.productName}`}
                    onChange={() => approveStockIn(movement, approvalNames[movement.id] ?? "")}
                  /> Approve</label>
                  <em>Pending</em>
                </div>)}</div>
              : <p className="approval-empty">No stock-ins are waiting for approval.</p>}
          </section>

          <section className="panel spares-cost-panel" id="spares-cost">
            <div className="panel-heading">
              <div><h2>Cash Flow</h2><p>Itemized spare-part stock-in costs in Kenyan Shillings (KSh).</p></div>
              <span className="activity-count">{stockInStatements.length} entries</span>
            </div>
            <div className="cost-summary-grid">
              <article className="cost-summary-card cost-confirmed">
                <span>Approved stock-in total</span>
                <strong>{formatCurrency(approvedStockInAmount)}</strong>
                <small>Confirmed and included in stock</small>
              </article>
              <article className="cost-summary-card cost-pending">
                <span>Pending approval</span>
                <strong>{formatCurrency(pendingStockInAmount)}</strong>
                <small>Waiting for checklist approval</small>
              </article>
              <article className="cost-summary-card cost-total">
                <span>Total recorded</span>
                <strong>{formatCurrency(totalStockInAmount)}</strong>
                <small>Approved plus pending stock-ins</small>
              </article>
            </div>
            <div className="table-scroll cost-table-scroll">
              <table className="cost-table">
                <thead><tr>
                  <th>DATE</th><th>SPARE</th><th>VENDOR</th><th>QUANTITY</th>
                  <th>UNIT COST</th><th>TOTAL COST</th><th>STATUS</th>
                  <th>AUTHORIZED BY</th><th>APPROVED BY</th>
                </tr></thead>
                <tbody>
                  {stockInStatements.map((movement) => (
                    <tr key={movement.id}>
                      <td>{formatDate(movement.createdAt)}</td>
                      <td><strong>{movement.productName}</strong></td>
                      <td>{movement.vendor || "—"}</td>
                      <td>{formatNumber(movement.quantity)}</td>
                      <td>{movement.unitAmount === undefined ? "—" : formatCurrency(movement.unitAmount)}</td>
                      <td><strong>{movement.amount === undefined ? "—" : formatCurrency(movement.amount)}</strong></td>
                      <td><span className={`cost-status ${movement.status === "pending" ? "cost-status-pending" : "cost-status-approved"}`}>{movement.status === "pending" ? "Pending" : "Approved"}</span></td>
                      <td>{movement.authorizedBy || "—"}</td>
                      <td>{movement.approvedBy || (movement.status === "pending" ? "Awaiting approval" : "—")}</td>
                    </tr>
                  ))}
                  {stockInStatements.length === 0 && <tr><td colSpan={9} className="cost-empty">No stock-in amounts recorded yet.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="table-footer">Amounts are calculated from each saved stock-in statement. Pending amounts are not counted as approved spend.</div>
          </section>

          <div className="content-grid">
            <section className="panel inventory-panel" id="inventory">
              <div className="panel-heading">
                <div><h2>Inventory</h2><p>Your products and current stock levels</p></div>
                <button className="primary-button small-button" onClick={() => { setMovementType("in"); setModal("movement"); setError(""); }}>＋ Stock in</button>
              </div>
              <div className="table-controls">
                <div className="search-box"><span>⌕</span><input aria-label="Search inventory" placeholder="Search products..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
                <select aria-label="Filter inventory" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All products</option><option value="in-stock">In stock</option><option value="low">Low stock</option></select>
              </div>
              <div className="table-scroll">
                <table>
                  <thead><tr><th>PRODUCT</th><th>SKU</th><th>CATEGORY</th><th>IN STOCK</th><th>STATUS</th></tr></thead>
                  <tbody>
                    {visibleProducts.map((product) => {
                      const low = product.quantity <= product.reorderLevel;
                      return <tr key={product.id}>
                        <td><div className="product-cell"><span className="product-thumb">{product.name.slice(0, 1).toUpperCase()}</span><strong>{product.name}</strong></div></td>
                        <td className="sku-cell">{product.sku}</td><td>{product.category}</td>
                        <td><strong>{formatNumber(product.quantity)}</strong><span className="unit-label"> {product.unit}</span></td>
                        <td><span className={`status-pill ${low ? "status-low" : "status-good"}`}><i />{low ? "Low stock" : "In stock"}</span></td>
                      </tr>;
                    })}
                    {visibleProducts.length === 0 && <tr><td colSpan={5}><div className="empty-state"><span className="empty-icon">□</span><strong>{products.length ? "No products found" : "Your inventory is ready"}</strong><p>{products.length ? "Try a different search or filter." : "Use Stock in to add a part and record its opening quantity."}</p>{!products.length && <button className="secondary-button" onClick={() => { setMovementType("in"); setNewPartMode(true); setModal("movement"); }}>＋ Stock in new part</button>}</div></td></tr>}
                  </tbody>
                </table>
              </div>
              <div className="table-footer">Showing <strong>{visibleProducts.length}</strong> of <strong>{products.length}</strong> products</div>
            </section>

            <section className="panel activity-panel" id="activity">
              <div className="panel-heading"><div><h2>Stock statements</h2><p>Latest stock activity and transaction details</p></div><div className="movement-heading-actions"><span className="activity-count">{movements.length}</span><button className="secondary-button small-button" onClick={() => window.print()}>Print statements</button></div></div>
              <div className="movement-list">
                {movements.map((movement) => <div className="movement-row" key={movement.id}>
                  <span className={`movement-symbol ${movement.type === "in" ? "movement-in" : "movement-out"}`}>{movement.type === "in" ? "↓" : "↑"}</span>
                  <div className="movement-description"><strong>{movement.productName}</strong><span>{[
                    movement.type === "out" && movement.vehicleNumber ? `Vehicle: ${movement.vehicleNumber}` : "",
                    movement.type === "out" ? "Purpose: Vehicle repair" : "",
                    movement.vendor ? `Vendor: ${movement.vendor}` : "",
                    movement.amount !== undefined ? `Total: ${formatCurrency(movement.amount)}` : "",
                    movement.unitAmount !== undefined ? `Unit: ${formatCurrency(movement.unitAmount)}` : "",
                    movement.authorizedBy ? `Authorized by: ${movement.authorizedBy}` : "",
                    movement.takenBy ? `Taken by: ${movement.takenBy}` : "",
                    movement.approvedBy ? `Approved by: ${movement.approvedBy}` : "",
                    movement.note,
                    movement.type === "in" ? (movement.status === "pending" ? "Pending approval" : "Approved") : "",
                    formatDate(movement.createdAt),
                  ].filter(Boolean).join(" · ")}</span></div>
                  <strong className={movement.type === "in" ? "quantity-in" : "quantity-out"}>{movement.type === "in" ? "+" : "−"}{formatNumber(movement.quantity)}</strong>
                  <button className="delete-statement-button" onClick={() => deleteMovement(movement)} aria-label={`Delete statement for ${movement.productName}`}>Delete</button>
                </div>)}
                {!movements.length && <div className="empty-activity"><span>↔</span><strong>No movements yet</strong><p>Stock received or issued will show up here.</p></div>}
              </div>
              <div className="activity-summary"><span>Units received</span><strong className="quantity-in">+{formatNumber(stockInTotal)}</strong><span>Units issued</span><strong className="quantity-out">−{formatNumber(stockOutTotal)}</strong></div>
            </section>
          </div>
          <footer className="dashboard-footer"><span>Ratl Stocks inventory</span><span>Backup your data regularly using Export backup.</span></footer>
        </div>
      </section>

      {modal && <div className={`modal-backdrop${movementType === "in" ? " print-stock-in" : ""}`} onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}>
        <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal-heading"><div><p className="eyebrow">STOCK MOVEMENT</p><h2 id="modal-title">{movementType === "in" ? "Stock in" : "Stock out"}</h2></div><button className="close-button" onClick={() => setModal(null)} aria-label="Close">×</button></div>
          <form className="modal-form" ref={movementFormRef} onSubmit={recordMovement}>
            {movementType === "in" && <div className="print-report-heading">
              <h1>RASHID AMIR TRANSPORTERS LIMITED</h1>
              <h2>STOCK IN REPORT</h2>
              <p>Printed {new Date().toLocaleString()}</p>
            </div>}
            <div className="movement-toggle"><button type="button" className={movementType === "in" ? "selected" : ""} onClick={() => { setMovementType("in"); setError(""); }}>↓ Stock in</button><button type="button" className={movementType === "out" ? "selected" : ""} onClick={() => { setMovementType("out"); setNewPartMode(false); setError(""); }}>↑ Stock out</button></div>
            {movementType === "in" && <button className="text-action" type="button" onClick={() => setNewPartMode((current) => !current)}>{newPartMode ? "Choose an existing part" : "＋ Add a new part"}</button>}
            {movementType === "in" && newPartMode ? <>
              <label>Part name<input name="newPartName" required placeholder="Enter part name" /></label>
              <div className="form-row"><label>SKU<input name="newPartSku" required placeholder="Part/SKU number" /></label><label>Category<input name="newPartCategory" required placeholder="Category" /></label></div>
              <div className="form-row"><label>Unit<input name="newPartUnit" required placeholder="e.g. pieces" /></label><label>Reorder level<input name="reorderLevel" type="number" min="0" step="1" defaultValue="5" required /></label></div>
            </> : <label>Part name<select name="productId" required defaultValue=""><option value="" disabled>Select a part</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} — {formatNumber(product.quantity)} {product.unit}</option>)}</select></label>}
            <label>Quantity<input name="quantity" type="number" min="1" step="1" required placeholder="Enter quantity" value={movementQuantity} onChange={(event) => setMovementQuantity(event.target.value)} /></label>
            {movementType === "in" && <>
              <label>Total amount (KSh)<input name="amount" type="number" min="0.01" step="0.01" required placeholder="Enter total stock value in KSh" value={movementAmount} onChange={(event) => setMovementAmount(event.target.value)} /></label>
              <div className="amount-preview">Amount per unit: <strong>{movementAmount && Number(movementQuantity) > 0 ? formatCurrency(Number(movementAmount) / Number(movementQuantity)) : formatCurrency(0)}</strong></div>
            </>}
            {movementType === "out" && <label>Vehicle number<input name="vehicleNumber" required maxLength={30} placeholder="e.g. KDA 123A" /></label>}
            {movementType === "in" && <>
              <label>Vendor<select required value={selectedVendor} onChange={(event) => setSelectedVendor(event.target.value)}><option value="" disabled>Select a vendor</option>{vendors.map((vendor) => <option key={vendor} value={vendor}>{vendor}</option>)}</select></label>
              <button type="button" className="text-action" onClick={() => { setShowAddVendor((current) => !current); setError(""); }}>{showAddVendor ? "Cancel adding vendor" : "＋ Add vendor"}</button>
              {showAddVendor && <div className="vendor-add-row"><input aria-label="New vendor name" value={newVendor} onChange={(event) => setNewVendor(event.target.value)} placeholder="New vendor name" /><button type="button" className="secondary-button small-button" onClick={addVendor}>Save vendor</button></div>}
            </>}
            <div className="form-row">
              <label>Authorized by<input name="authorizedBy" required placeholder="Name" /></label>
              {movementType === "in"
                ? <span className="approval-hint">This stock-in will remain pending until an approver confirms it in the checklist.</span>
                : <label>Taken by<input name="takenBy" required placeholder="Name of person taking the spare" /></label>}
            </div>
            <label>Note <span className="optional-label">OPTIONAL</span><input name="note" maxLength={100} placeholder="Add a note" /></label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={clearMovementForm}>Clear</button>
              {movementType === "in" && <button type="button" className="secondary-button" onClick={() => window.print()}>Print form</button>}
              <button type="button" className="secondary-button" onClick={() => setModal(null)}>Cancel</button>
              <button type="submit" className="primary-button">Save</button>
            </div>
          </form>
        </section>
      </div>}
    </main>
  );
}
