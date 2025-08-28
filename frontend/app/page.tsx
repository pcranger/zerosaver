"use client"

// ZeroSaver – MVP Simulation (React)
// Single-file interactive prototype to demo the core user flows for a "Too Good To Go"-style surplus food marketplace.
// Tabs: Explore (consumer), Partner, Cart/Reservations, Analytics, Admin, Docs (spec).
// Tech assumptions for real build: Next.js + Tailwind, Supabase (DB + Auth) or Auth.js/Clerk, Stripe, Resend, Mapbox, Upstash/Redis for rate limits, Cron for expiries.

import { useMemo, useState, useEffect } from "react"

// --------------------------- Mock Data & Utils ---------------------------
const CATEGORIES = ["Bento", "Bakery", "Grocer", "Café", "Restaurant", "Wholesaler"]
const DIETS = ["Vegan", "Vegetarian", "Gluten-free", "Halal"]

const nowISO = () => new Date().toISOString()
const inMinutes = (mins) => new Date(Date.now() + mins * 60000).toISOString()

const seedDeals = () => [
  {
    id: "d1",
    vendorId: "v1",
    vendor: "Sunset Sushi",
    title: "Assorted sushi box (10pc)",
    description: "Chef's selection of nigiri & maki. Pick-up chilled. Bring a cooler bag if traveling >20 min.",
    imageUrl: "",
    category: "Restaurant",
    diet: ["Halal"],
    originalPrice: 18,
    price: 7.5,
    qty: 12,
    minOrderQty: 1,
    distanceKm: 1.2,
    pickupAddress: "12 Crown St, Wollongong NSW",
    pickupNotes: "Ring bell on arrival.",
    pickupStart: inMinutes(30),
    pickupEnd: inMinutes(150),
    bestBefore: inMinutes(240),
    createdAt: nowISO(),
    expiresAt: inMinutes(180),
    allergens: ["Soy", "Fish", "Gluten"],
    coldChain: true,
    b2b: false,
    rating: 4.6,
    tags: ["End-of-day", "Cold"],
  },
  {
    id: "d2",
    vendorId: "v2",
    vendor: "Daily Bakery",
    title: "Mystery pastry bag",
    description: "A surprise mix of croissants, danishes & buns. Best the same day.",
    imageUrl: "",
    category: "Bakery",
    diet: ["Vegetarian"],
    originalPrice: 16,
    price: 6,
    qty: 8,
    minOrderQty: 1,
    distanceKm: 0.6,
    pickupAddress: "5 Market Ln, Wollongong NSW",
    pickupNotes: "Ask for ZeroSaver bag at counter.",
    pickupStart: inMinutes(10),
    pickupEnd: inMinutes(90),
    bestBefore: inMinutes(120),
    createdAt: nowISO(),
    expiresAt: inMinutes(120),
    allergens: ["Gluten", "Dairy"],
    coldChain: false,
    b2b: false,
    rating: 4.4,
    tags: ["End-of-day"],
  },
  {
    id: "d3",
    vendorId: "v3",
    vendor: "Green Grocer",
    title: "Fruit & veg mixed box (3kg)",
    description: "Seasonal seconds. Great for juicing & soups. Mix varies.",
    imageUrl: "",
    category: "Grocer",
    diet: ["Vegan", "Vegetarian", "Gluten-free"],
    originalPrice: 25,
    price: 10,
    qty: 20,
    minOrderQty: 1,
    distanceKm: 3.4,
    pickupAddress: "88 Keira St, Wollongong NSW",
    pickupNotes: "Loading bay pick-up at rear.",
    pickupStart: inMinutes(60),
    pickupEnd: inMinutes(300),
    bestBefore: inMinutes(360),
    createdAt: nowISO(),
    expiresAt: inMinutes(360),
    allergens: [],
    coldChain: false,
    b2b: false,
    rating: 4.2,
    tags: ["Family size"],
  },
  {
    id: "d4",
    vendorId: "v4",
    vendor: "Bean Scene Café",
    title: "Sandwich + coffee combo",
    description: "Any display sandwich + medium coffee voucher. Collect before 3pm.",
    imageUrl: "",
    category: "Café",
    diet: ["Vegetarian"],
    originalPrice: 19,
    price: 8.5,
    qty: 10,
    minOrderQty: 1,
    distanceKm: 2.1,
    pickupAddress: "21 Crown St, Wollongong NSW",
    pickupNotes: "Show QR at barista.",
    pickupStart: inMinutes(20),
    pickupEnd: inMinutes(160),
    bestBefore: inMinutes(200),
    createdAt: nowISO(),
    expiresAt: inMinutes(200),
    allergens: ["Gluten", "Dairy"],
    coldChain: false,
    b2b: false,
    rating: 4.7,
    tags: ["Lunch"],
  },
  {
    id: "d5",
    vendorId: "v5",
    vendor: "Aussie Foods Wholesale",
    title: "B2B – surplus chicken (5kg)",
    description: "Frozen MD packs, mixed cuts. For licensed businesses only.",
    imageUrl: "",
    category: "Wholesaler",
    diet: ["Halal", "Gluten-free"],
    originalPrice: 45,
    price: 19.9,
    qty: 6,
    minOrderQty: 2,
    distanceKm: 8.7,
    pickupAddress: "2 Industrial Rd, Unanderra NSW",
    pickupNotes: "Dock 3. Bring ABN.",
    pickupStart: inMinutes(120),
    pickupEnd: inMinutes(540),
    bestBefore: inMinutes(600),
    createdAt: nowISO(),
    expiresAt: inMinutes(600),
    allergens: [],
    coldChain: true,
    b2b: true,
    rating: 4.1,
    tags: ["Cold chain", "B2B"],
  },
]

const currency = (n) => `$${n.toFixed(2)}`
const minutesLeft = (iso) => Math.max(0, Math.round((new Date(iso) - Date.now()) / 60000))
const clamp = (n, min, max) => Math.min(Math.max(n, min), max)

// Emissions estimate: 1kg food waste ≈ 2.5kg CO2e (rough avg, demo only)
const co2eSaved = (orders) => {
  let kg = 0
  orders.forEach((o) => {
    // rough proxy: each item ≈ 0.4kg; B2B 5kg
    const perItemKg = /5kg/.test(o.title) ? 5 : 0.4
    kg += perItemKg * o.qty
  })
  return kg * 2.5
}

// ----------------及ひRoot App ---------------------------
export default function ZeroSaverMVP() {
  const [activeTab, setActiveTab] = useState("Explore")
  const [role, setRole] = useState("guest") // guest | consumer | partner | admin
  const [deals, setDeals] = useState(seedDeals())
  const [cart, setCart] = useState([]) // {dealId, qty, title, price}
  const [partners, setPartners] = useState([
    { id: "v1", name: "Sunset Sushi", approved: true, type: "Restaurant" },
    { id: "v2", name: "Daily Bakery", approved: true, type: "Bakery" },
    { id: "v3", name: "Green Grocer", approved: true, type: "Grocer" },
    { id: "v4", name: "Bean Scene Café", approved: true, type: "Café" },
    { id: "v5", name: "Aussie Foods Wholesale", approved: false, type: "Wholesaler" },
  ])
  const [filters, setFilters] = useState({ q: "", cat: "All", diet: "All", maxKm: 10 })

  // expire deals in real-time (demo)
  useEffect(() => {
    const id = setInterval(() => {
      setDeals((prev) => prev.filter((d) => minutesLeft(d.expiresAt) > 0 && d.qty > 0))
    }, 10000)
    return () => clearInterval(id)
  }, [])

  const addToCart = (deal, qty = 1) => {
    if (deal.qty < 1) return
    const take = clamp(qty, 1, deal.qty)
    setCart((c) => {
      const idx = c.findIndex((x) => x.dealId === deal.id)
      if (idx >= 0) {
        const copy = [...c]
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + take }
        return copy
      }
      return [...c, { dealId: deal.id, qty: take, title: deal.title, price: deal.price, vendor: deal.vendor }]
    })
    setDeals((all) => all.map((d) => (d.id === deal.id ? { ...d, qty: d.qty - take } : d)))
  }

  const removeFromCart = (dealId) => {
    const item = cart.find((x) => x.dealId === dealId)
    if (!item) return
    // return stock
    setDeals((all) => all.map((d) => (d.id === dealId ? { ...d, qty: d.qty + item.qty } : d)))
    setCart((c) => c.filter((x) => x.dealId !== dealId))
  }

  const checkout = () => {
    if (cart.length === 0) return alert("Cart empty")
    alert("Reservation confirmed! (Demo) – You'll receive a QR code by email.")
    setCart([])
  }

  const filteredDeals = useMemo(() => {
    return deals
      .filter((d) => partners.find((p) => p.id === d.vendorId)?.approved)
      .filter((d) => (filters.cat === "All" ? true : d.category === filters.cat))
      .filter((d) => (filters.diet === "All" ? true : d.diet.includes(filters.diet)))
      .filter((d) => d.distanceKm <= filters.maxKm)
      .filter((d) =>
        filters.q
          ? (d.vendor + d.title + d.category + d.tags.join(" ")).toLowerCase().includes(filters.q.toLowerCase())
          : true,
      )
      .sort((a, b) => a.distanceKm - b.distanceKm)
  }, [deals, filters, partners])

  const orders = useMemo(() => {
    // In this demo, each checkout clears the cart; simulate orders as difference between seed and current qty
    const seeded = seedDeals()
    const out = []
    seeded.forEach((sd) => {
      const current = deals.find((d) => d.id === sd.id)
      const sold = current ? sd.qty - current.qty : sd.qty // if expired/removed, assume sold
      if (sold > 0) out.push({ dealId: sd.id, title: sd.title, qty: sold })
    })
    return out
  }, [deals])

  // --------------------------- UI ---------------------------
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <Header activeTab={activeTab} setActiveTab={setActiveTab} role={role} setRole={setRole} cartCount={cart.length} />

      <main className="max-w-6xl mx-auto p-4 md:p-6">
        {activeTab === "Explore" && (
          <Explore deals={filteredDeals} filters={filters} setFilters={setFilters} onReserve={addToCart} />
        )}
        {activeTab === "Partner" && (
          <PartnerDashboard partners={partners} setPartners={setPartners} addDeal={(d) => setDeals((x) => [d, ...x])} />
        )}
        {activeTab === "Cart" && <Cart cart={cart} removeItem={removeFromCart} checkout={checkout} />}
        {activeTab === "Analytics" && <Analytics orders={orders} />}
        {activeTab === "Admin" && <Admin partners={partners} setPartners={setPartners} />}
        {activeTab === "Docs" && <Docs />}
      </main>

      <footer className="border-t bg-white">
        <div className="max-w-6xl mx-auto p-4 text-sm text-neutral-500 flex items-center justify-between">
          <div>© {new Date().getFullYear()} ZeroSaver · Reduce waste, save money · Demo</div>
          <div className="italic">MVP Prototype – not production code</div>
        </div>
      </footer>
    </div>
  )
}

function Header({ activeTab, setActiveTab, role, setRole, cartCount }) {
  return (
    <div className="bg-white border-b sticky top-0 z-10">
      <div className="max-w-6xl mx-auto flex items-center gap-3 p-3 md:p-4">
        <div className="font-black text-xl md:text-2xl tracking-tight">
          <span className="bg-emerald-500 text-white px-2 py-1 rounded">Zero</span>
          <span className="ml-1">Saver</span>
        </div>
        <nav className="ml-4 flex gap-2 md:gap-3 text-sm">
          {["Explore", "Partner", "Cart", "Analytics", "Admin", "Docs"].map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-3 py-1.5 rounded-full border ${activeTab === t ? "bg-neutral-900 text-white border-neutral-900" : "bg-white hover:bg-neutral-100"}`}
            >
              {t}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <span className="hidden md:inline text-neutral-500">Role:</span>
          <select value={role} onChange={(e) => setRole(e.target.value)} className="border rounded px-2 py-1">
            <option value="guest">Guest</option>
            <option value="consumer">Consumer</option>
            <option value="partner">Partner</option>
            <option value="admin">Admin</option>
          </select>
          <div className="relative">
            <button className="px-3 py-1.5 rounded-full border" onClick={() => setActiveTab("Cart")}>
              Cart
            </button>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-emerald-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {cartCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Explore({ deals, filters, setFilters, onReserve }) {
  const [selected, setSelected] = useState(null)
  return (
    <section>
      <div className="flex flex-col md:flex-row gap-3 md:items-end mb-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 flex-1">
          <div>
            <label className="text-xs text-neutral-500">Search</label>
            <input
              value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              placeholder="Sushi, bakery, vegan…"
              className="w-full border rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="text-xs text-neutral-500">Category</label>
            <select
              value={filters.cat}
              onChange={(e) => setFilters({ ...filters, cat: e.target.value })}
              className="w-full border rounded px-3 py-2"
            >
              <option>All</option>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-neutral-500">Dietary</label>
            <select
              value={filters.diet}
              onChange={(e) => setFilters({ ...filters, diet: e.target.value })}
              className="w-full border rounded px-3 py-2"
            >
              <option>All</option>
              {DIETS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-neutral-500">Max distance: {filters.maxKm}km</label>
            <input
              type="range"
              min={1}
              max={20}
              value={filters.maxKm}
              onChange={(e) => setFilters({ ...filters, maxKm: Number(e.target.value) })}
              className="w-full"
            />
          </div>
          <div className="hidden md:block" />
        </div>
      </div>

      {deals.length === 0 && (
        <div className="p-6 bg-white rounded-xl border text-center">No results. Try widening your filters.</div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {deals.map((d) => (
          <div key={d.id} className="bg-white border rounded-2xl p-4 flex flex-col">
            <div
              className="h-28 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-200 mb-3"
              style={
                d.imageUrl
                  ? { backgroundImage: `url(${d.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                  : {}
              }
            />
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{d.title}</div>
                <div className="text-sm text-neutral-500">
                  {d.vendor} • {d.category} • {d.distanceKm}km
                </div>
              </div>
              <div className="text-right">
                <div className="text-neutral-500 line-through text-xs">{currency(d.originalPrice)}</div>
                <div className="text-lg font-bold">{currency(d.price)}</div>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-neutral-600">
              <span className="px-2 py-0.5 bg-neutral-100 rounded-full">{d.diet[0] || "—"}</span>
              {d.tags.slice(0, 2).map((t) => (
                <span key={t} className="px-2 py-0.5 bg-neutral-100 rounded-full">
                  {t}
                </span>
              ))}
              <span className="ml-auto px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                {minutesLeft(d.expiresAt)}m left
              </span>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <button
                disabled={d.qty === 0}
                onClick={() => onReserve(d, d.minOrderQty || 1)}
                className={`flex-1 px-3 py-2 rounded-xl border ${d.qty === 0 ? "opacity-50 cursor-not-allowed" : "bg-neutral-900 text-white border-neutral-900"}`}
              >
                Reserve
              </button>
              <button className="px-3 py-2 rounded-xl border" onClick={() => setSelected(d)}>
                Details
              </button>
              <div className="text-xs text-neutral-500">Stock: {d.qty}</div>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div className="max-w-xl w-full bg-white rounded-2xl border" onClick={(e) => e.stopPropagation()}>
            <div
              className="h-40 rounded-t-2xl bg-gradient-to-br from-emerald-100 to-emerald-200"
              style={
                selected.imageUrl
                  ? {
                      backgroundImage: `url(${selected.imageUrl})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }
                  : {}
              }
            />
            <div className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-bold">{selected.title}</div>
                  <div className="text-sm text-neutral-500">
                    {selected.vendor} • {selected.category}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-neutral-500 line-through text-xs">{currency(selected.originalPrice)}</div>
                  <div className="text-xl font-black">{currency(selected.price)}</div>
                </div>
              </div>
              {selected.description && <p className="mt-2 text-sm">{selected.description}</p>}
              <div className="flex items-center gap-2 mt-2 text-xs text-neutral-600">
                {(selected.diet[0] || "").length > 0 && (
                  <span className="px-2 py-0.5 bg-neutral-100 rounded-full">{selected.diet[0]}</span>
                )}
                {selected.coldChain && <span className="px-2 py-0.5 bg-neutral-100 rounded-full">Cold chain</span>}
                {selected.b2b && <span className="px-2 py-0.5 bg-neutral-100 rounded-full">B2B</span>}
                <span className="ml-auto px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                  {minutesLeft(selected.expiresAt)}m left
                </span>
              </div>
              <div className="text-xs text-neutral-500 mt-2">
                Stock: {selected.qty} · Min order: {selected.minOrderQty}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function PartnerDashboard({ partners, setPartners, addDeal }) {
  const [form, setForm] = useState({
    vendorId: partners[0]?.id || "v1",
    title: "",
    description: "",
    imageUrl: "",
    category: "Restaurant",
    diet: [],
    originalPrice: 0,
    price: 0,
    qty: 1,
    minOrderQty: 1,
    distanceKm: 1,
    pickupAddress: "",
    pickupStart: inMinutes(30),
    pickupEnd: inMinutes(180),
    expiresAt: inMinutes(200),
    bestBefore: inMinutes(240),
    allergens: [],
    coldChain: false,
    b2b: false,
    tags: [],
    pickupNotes: "",
  })

  const vendor = partners.find((p) => p.id === form.vendorId)
  const descLimit = 240

  const create = () => {
    if (!vendor?.approved) return alert("Your partner account is pending approval.")
    if (!form.title || form.price <= 0) return alert("Please fill in a title and price.")
    const id = Math.random().toString(36).slice(2, 8)
    const combinedTags = Array.from(
      new Set([...form.tags, ...(form.b2b ? ["B2B"] : []), ...(form.coldChain ? ["Cold chain"] : [])]),
    )
    addDeal({
      id,
      vendorId: form.vendorId,
      vendor: vendor.name,
      rating: 4.3,
      createdAt: nowISO(),
      title: form.title,
      description: form.description,
      imageUrl: form.imageUrl,
      category: form.category,
      diet: form.diet,
      originalPrice: form.originalPrice,
      price: form.price,
      qty: form.qty,
      minOrderQty: form.minOrderQty,
      distanceKm: form.distanceKm,
      pickupAddress: form.pickupAddress,
      pickupNotes: form.pickupNotes,
      pickupStart: form.pickupStart,
      pickupEnd: form.pickupEnd,
      bestBefore: form.bestBefore,
      expiresAt: form.expiresAt,
      allergens: form.allergens,
      coldChain: form.coldChain,
      b2b: form.b2b,
      tags: combinedTags,
    })
    alert("Deal published! It will auto-expire at the selected time.")
    setForm({ ...form, title: "", description: "", imageUrl: "", price: 0, originalPrice: 0, qty: 1 })
  }

  return (
    <section className="grid md:grid-cols-2 gap-6">
      <div className="bg-white border rounded-2xl p-4">
        <div className="font-semibold mb-3">Manual listing editor (for sellers)</div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <label className="col-span-2">
            <span className="text-xs text-neutral-500">Vendor</span>
            <select
              value={form.vendorId}
              onChange={(e) => setForm({ ...form, vendorId: e.target.value })}
              className="w-full border rounded px-3 py-2"
            >
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.approved ? "" : "(Pending)"}
                </option>
              ))}
            </select>
          </label>
          <label className="col-span-2">
            <span className="text-xs text-neutral-500">Title</span>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g., 2x chicken burrito bowls"
              className="w-full border rounded px-3 py-2"
            />
          </label>
          <label className="col-span-2">
            <span className="text-xs text-neutral-500">
              Description <span className="text-neutral-400">(max {descLimit} chars)</span>
            </span>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value.slice(0, descLimit) })}
              placeholder="What's inside, portion size, storage, any caveats…"
              className="w-full border rounded px-3 py-2 h-24"
            />
            <div className="text-[11px] text-neutral-500 text-right">
              {form.description.length}/{descLimit}
            </div>
          </label>
          <label className="col-span-2">
            <span className="text-xs text-neutral-500">Image URL (optional)</span>
            <input
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
              placeholder="https://…"
              className="w-full border rounded px-3 py-2"
            />
          </label>
          <label>
            <span className="text-xs text-neutral-500">Category</span>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full border rounded px-3 py-2"
            >
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="text-xs text-neutral-500">Dietary tags</span>
            <input
              value={form.diet.join(", ")}
              onChange={(e) =>
                setForm({
                  ...form,
                  diet: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              className="w-full border rounded px-3 py-2"
            />
          </label>
          <label>
            <span className="text-xs text-neutral-500">Qty</span>
            <input
              type="number"
              min={1}
              value={form.qty}
              onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })}
              className="w-full border rounded px-3 py-2"
            />
          </label>
          <label>
            <span className="text-xs text-neutral-500">Min order qty</span>
            <input
              type="number"
              min={1}
              value={form.minOrderQty}
              onChange={(e) => setForm({ ...form, minOrderQty: Number(e.target.value) })}
              className="w-full border rounded px-3 py-2"
            />
          </label>
          <label>
            <span className="text-xs text-neutral-500">Original price</span>
            <input
              type="number"
              min={0}
              value={form.originalPrice}
              onChange={(e) => setForm({ ...form, originalPrice: Number(e.target.value) })}
              className="w-full border rounded px-3 py-2"
            />
          </label>
          <label>
            <span className="text-xs text-neutral-500">ZeroSaver price</span>
            <input
              type="number"
              min={0}
              value={form.price}
              onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              className="w-full border rounded px-3 py-2"
            />
          </label>
          <label className="col-span-2">
            <span className="text-xs text-neutral-500">Pickup address</span>
            <input
              value={form.pickupAddress}
              onChange={(e) => setForm({ ...form, pickupAddress: e.target.value })}
              placeholder="Street, suburb, state"
              className="w-full border rounded px-3 py-2"
            />
          </label>
          <label>
            <span className="text-xs text-neutral-500">Pickup starts</span>
            <input
              type="datetime-local"
              value={form.pickupStart.slice(0, 16)}
              onChange={(e) => setForm({ ...form, pickupStart: new Date(e.target.value).toISOString() })}
              className="w-full border rounded px-3 py-2"
            />
          </label>
          <label>
            <span className="text-xs text-neutral-500">Pickup ends</span>
            <input
              type="datetime-local"
              value={form.pickupEnd.slice(0, 16)}
              onChange={(e) => setForm({ ...form, pickupEnd: new Date(e.target.value).toISOString() })}
              className="w-full border rounded px-3 py-2"
            />
          </label>
          <label>
            <span className="text-xs text-neutral-500">Best before</span>
            <input
              type="datetime-local"
              value={form.bestBefore.slice(0, 16)}
              onChange={(e) => setForm({ ...form, bestBefore: new Date(e.target.value).toISOString() })}
              className="w-full border rounded px-3 py-2"
            />
          </label>
          <label>
            <span className="text-xs text-neutral-500">Allergens (comma)</span>
            <input
              value={form.allergens.join(", ")}
              onChange={(e) =>
                setForm({
                  ...form,
                  allergens: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              className="w-full border rounded px-3 py-2"
            />
          </label>
          <label className="col-span-2">
            <span className="text-xs text-neutral-500">Pickup notes (shown after checkout)</span>
            <input
              value={form.pickupNotes}
              onChange={(e) => setForm({ ...form, pickupNotes: e.target.value })}
              className="w-full border rounded px-3 py-2"
            />
          </label>
          <div className="col-span-2 flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={form.coldChain}
                onChange={(e) => setForm({ ...form, coldChain: e.target.checked })}
              />{" "}
              Requires cold chain
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={form.b2b} onChange={(e) => setForm({ ...form, b2b: e.target.checked })} />{" "}
              B2B only
            </label>
          </div>
          <label className="col-span-2">
            <span className="text-xs text-neutral-500">Offer tags</span>
            <input
              value={form.tags.join(", ")}
              onChange={(e) =>
                setForm({
                  ...form,
                  tags: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
              className="w-full border rounded px-3 py-2"
            />
          </label>
          <button onClick={create} className="col-span-2 mt-1 px-4 py-2 rounded-xl border bg-neutral-900 text-white">
            Publish
          </button>
        </div>
      </div>

      <div className="bg-white border rounded-2xl p-4 h-fit">
        <div className="font-semibold mb-2">Listing preview</div>
        <div className="bg-white border rounded-2xl p-4">
          <div
            className="h-28 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-200 mb-3"
            style={
              form.imageUrl
                ? { backgroundImage: `url(${form.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                : {}
            }
          />
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-semibold">{form.title || "Listing title"}</div>
              <div className="text-sm text-neutral-500">
                {form.vendorId} • {form.category} • {form.distanceKm}km
              </div>
            </div>
            <div className="text-right">
              {form.originalPrice > 0 && (
                <div className="text-neutral-500 line-through text-xs">{currency(form.originalPrice)}</div>
              )}
              <div className="text-lg font-bold">{form.price > 0 ? currency(form.price) : "$0.00"}</div>
            </div>
          </div>
          {form.description && <p className="mt-2 text-sm">{form.description}</p>}
          <div className="flex items-center gap-2 mt-2 text-xs text-neutral-600">
            {(form.diet[0] || "").length > 0 && (
              <span className="px-2 py-0.5 bg-neutral-100 rounded-full">{form.diet[0]}</span>
            )}
            {form.coldChain && <span className="px-2 py-0.5 bg-neutral-100 rounded-full">Cold chain</span>}
            {form.b2b && <span className="px-2 py-0.5 bg-neutral-100 rounded-full">B2B</span>}
            <span className="ml-auto px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
              {minutesLeft(form.expiresAt)}m left
            </span>
          </div>
          <div className="text-xs text-neutral-500 mt-2">
            Stock: {form.qty} · Min order: {form.minOrderQty}
          </div>
        </div>
        <div className="font-semibold mt-4 mb-2">Partner health</div>
        <ul className="text-sm space-y-2">
          <li>
            • Approval status:{" "}
            {vendor?.approved ? (
              <span className="text-emerald-600">Approved</span>
            ) : (
              <span className="text-amber-600">Pending</span>
            )}
          </li>
          <li>• Suggested discount range: 50–70% off</li>
          <li>• Auto-expiry enabled; items will be hidden after expiry</li>
          <li>• QR pickup verification built-in (demo in Cart)</li>
          <li>• B2B offers & cold-chain flag supported</li>
        </ul>
      </div>
    </section>
  )
}

function Docs() {
  return (
    <section className="prose max-w-none">
      <h2>ZeroSaver MVP – Functional Spec (v0)</h2>
      <p>This is the shortlist of functions required to ship an end-to-end MVP. Grouped by user role.</p>

      <h3>1) Consumer (buyer)</h3>
      <ul>
        <li>
          Browse surplus deals (list + basic map later), filter by <em>category</em>, <em>dietary</em>,{" "}
          <em>distance</em>, <em>pickup window</em>, <em>price</em>.
        </li>
        <li>Deal card shows vendor, discount vs RRP, time remaining, stock, diet tags, distance, rating.</li>
        <li>
          Reserve/checkout flow (Stripe intent): pay & receive reservation <strong>QR code</strong> + pickup window by
          email/SMS (Resend/Twilio).
        </li>
        <li>Order history with status: Reserved → Picked up → Refunded/Expired.</li>
        <li>
          Account basics: sign in with email/Google/Apple; manage notifications, dietary prefs, default radius; save
          favourites.
        </li>
        <li>Per-pickup rating + report issue (goes to Ops/Admin).</li>
      </ul>

      <h3>2) Supplier / Partner</h3>
      <ul>
        <li>Onboarding form: ABN, category, pickup location, bank details (Stripe Connect), proof (photo).</li>
        <li>
          <strong>Manual listing editor:</strong> title, rich description (short), image URL/upload, qty &amp; min
          order, price &amp; RRP, diet/allergens, tags, <em>pickup address</em>, pickup window, best-before, pickup
          notes, B2B-only toggle, cold-chain flag.
        </li>
        <li>Stock &amp; expiry: live stock decrement on reservation; auto-hide at expiry; pause/resume.</li>
        <li>
          Pickup verification: scan customer QR → mark <em>Picked up</em>; auto-refund if expired &amp; uncollected
          (policy).
        </li>
        <li>Payouts dashboard (Stripe): balance, upcoming payout, fees, invoices.</li>
        <li>Basic analytics: sold qty, revenue, waste avoided (kg), top pickup slots.</li>
        <li>(Later) Bulk CSV upload &amp; templates; schedule recurring drops; API for POS integration.</li>
      </ul>

      <h3>3) Admin / Ops</h3>
      <ul>
        <li>Review/approve partners; KYB checks; flag risky categories.</li>
        <li>Content moderation: reported deals, takedown, audit log.</li>
        <li>Refund & dispute tooling; manual comp credits.</li>
        <li>Fees config: platform fee %, Stripe fees pass-through; promo codes.</li>
        <li>ESG reporting: total food saved (kg), CO₂e avoided, partner league board, monthly CSV export.</li>
      </ul>

      <h3>4) Notifications</h3>
      <ul>
        <li>Email/SMS on reservation, reminder 30 mins before pickup, and when partner updates time window.</li>
        <li>Push (later): opt-in web push for favourites or nearby drops.</li>
      </ul>

      <h3>5) Non-functional (MVP bar)</h3>
      <ul>
        <li>Performance: p95 page TTFB &lt; 500ms (edge caching); API p95 &lt; 300ms.</li>
        <li>Accessibility: WCAG AA for consumer flows; keyboard nav; alt text.</li>
        <li>Data privacy: AU-hosted data (Supabase Sydney); GDPR-like consents.</li>
        <li>Reliability: graceful expiry jobs; rate limits; audit logging.</li>
      </ul>

      <h3>6) Suggested tech stack (v0 friendly)</h3>
      <ul>
        <li>
          <strong>Frontend:</strong> Next.js App Router, Tailwind, shadcn/ui, TanStack Query.
        </li>
        <li>
          <strong>Auth:</strong> Supabase Auth or Auth.js; roles: consumer, partner, admin.
        </li>
        <li>
          <strong>DB:</strong> Supabase (Postgres) schemas below; RLS policies by role.
        </li>
        <li>
          <strong>Payments:</strong> Stripe Checkout + Connect (Express) for partner payouts.
        </li>
        <li>
          <strong>Maps/Geo:</strong> Mapbox; store lat/lng; Haversine search within N km.
        </li>
        <li>
          <strong>Emails:</strong> Resend; <code>reservation_created</code>, <code>pickup_reminder</code>,{" "}
          <code>payout_notification</code>.
        </li>
        <li>
          <strong>Background jobs:</strong> Vercel Cron or Supabase Scheduler for expiries/refunds.
        </li>
      </ul>

      <h3>7) Minimal schema (Postgres)</h3>
      <pre className="whitespace-pre-wrap text-xs bg-neutral-50 p-3 rounded-xl border">{`
  users(id, email, role, diet_prefs text[], radius_km int, created_at)
  partners(id, owner_user_id, name, abn, type, lat, lng, approved bool, stripe_account_id)
  deals(id, partner_id, title, category, diet text[], rrp_cents int, price_cents int, qty int,
        pickup_start timestamptz, pickup_end timestamptz, expires_at timestamptz, tags text[], created_at)
  orders(id, user_id, deal_id, qty, amount_cents, status enum('reserved','picked_up','refunded','expired'),
         qr_code, created_at, picked_up_at)
  reports(id, order_id, user_id, reason, details, created_at)
  payouts(id, partner_id, amount_cents, period_start, period_end, status)
`}</pre>

      <h3>8) Key API endpoints (REST)</h3>
      <ul>
        <li>
          <code>POST /api/partners/apply</code> – create partner; admin review.
        </li>
        <li>
          <code>POST /api/deals</code> – partner creates deal; <code>PATCH /api/deals/:id</code>.
        </li>
        <li>
          <code>POST /api/checkout</code> – Stripe Checkout session; returns URL.
        </li>
        <li>
          <code>POST /api/webhooks/stripe</code> – on <em>payment_succeeded</em>, create order + QR.
        </li>
        <li>
          <code>POST /api/orders/:id/verify</code> – partner scans QR to mark picked up.
        </li>
        <li>
          <code>POST /api/orders/:id/refund</code> – admin/auto on expiry per policy.
        </li>
      </ul>

      <h3>9) Success metrics (MVP)</h3>
      <ul>
        <li>GMV, take rate, orders/week, item sell-through %, avg discount %.</li>
        <li>Food saved (kg), CO₂e avoided (kg), active partners, repeat rate.</li>
      </ul>

      <h3>10) Roadmap next</h3>
      <ul>
        <li>Simple map view & clustering; real-time drops; referral program.</li>
        <li>Cold-chain flag + pickup SLA, partner compliance checklist.</li>
        <li>B2B marketplace lane with minimum order qty & delivery quotes.</li>
      </ul>

      <p>
        <em>Tip:</em> Use this prototype to walk judges/investors through: discover → reserve → pickup verification →
        impact analytics.
      </p>
    </section>
  )
}

function Cart({ cart, removeItem, checkout }) {
  const total = cart.reduce((s, x) => s + x.qty * x.price, 0)
  return (
    <section className="grid md:grid-cols-3 gap-6">
      <div className="md:col-span-2 bg-white border rounded-2xl p-4">
        <div className="font-semibold mb-3">Your reservations</div>
        {cart.length === 0 ? (
          <div className="text-sm text-neutral-500">No items yet. Add deals from Explore.</div>
        ) : (
          <div className="space-y-3">
            {cart.map((it) => (
              <div key={it.dealId} className="flex items-center justify-between border rounded-xl p-3">
                <div>
                  <div className="font-medium">{it.title}</div>
                  <div className="text-xs text-neutral-500">
                    {it.vendor} • Qty {it.qty}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{currency(it.qty * it.price)}</div>
                  <button className="text-xs underline text-neutral-500" onClick={() => removeItem(it.dealId)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="bg-white border rounded-2xl p-4 h-fit">
        <div className="font-semibold mb-2">Summary</div>
        <div className="flex items-center justify-between text-sm mb-1">
          <span>Subtotal</span>
          <span>{currency(total)}</span>
        </div>
        <div className="flex items-center justify-between text-sm text-emerald-700">
          <span>Waste saved est.</span>
          <span>{Math.round((co2eSaved(cart) / 2.5) * 10) / 10} kg food</span>
        </div>
        <div className="flex items-center justify-between text-sm text-emerald-700 mb-3">
          <span>CO₂e avoided est.</span>
          <span>{Math.round(co2eSaved(cart))} kg</span>
        </div>
        <button onClick={checkout} className="w-full px-4 py-2 rounded-xl border bg-neutral-900 text-white">
          Confirm reservation
        </button>
        <div className="text-xs text-neutral-500 mt-2">You'll receive a QR code via email/SMS. Show it at pickup.</div>
      </div>
    </section>
  )
}

function Analytics({ orders }) {
  const totalOrders = orders.length
  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0)
  const totalWasteSaved = orders.reduce(
    (sum, order) => sum + (order.items?.reduce((itemSum, item) => itemSum + (item.wasteSaved || 0.5), 0) || 0),
    0,
  )
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

  // Calculate monthly data for charts
  const monthlyData = orders.reduce((acc, order) => {
    const month = new Date(order.date).toLocaleDateString("en-US", { month: "short" })
    if (!acc[month]) {
      acc[month] = { orders: 0, revenue: 0, waste: 0 }
    }
    acc[month].orders += 1
    acc[month].revenue += order.total
    acc[month].waste += order.items?.reduce((sum, item) => sum + (item.wasteSaved || 0.5), 0) || 0
    return acc
  }, {})

  const chartData = Object.entries(monthlyData).map(([month, data]) => ({
    month,
    ...data,
  }))

  // Top performing categories
  const categoryStats = orders.reduce((acc, order) => {
    order.items?.forEach((item) => {
      const category = item.category || "Restaurant"
      if (!acc[category]) {
        acc[category] = { orders: 0, revenue: 0 }
      }
      acc[category].orders += 1
      acc[category].revenue += item.price
    })
    return acc
  }, {})

  const topCategories = Object.entries(categoryStats)
    .sort(([, a], [, b]) => b.revenue - a.revenue)
    .slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-500">Total Orders</p>
              <p className="text-2xl font-bold text-neutral-900">{totalOrders}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-600 text-xl">📦</span>
            </div>
          </div>
          <p className="text-xs text-green-600 mt-2">+12% from last month</p>
        </div>

        <div className="bg-white border rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-500">Total Revenue</p>
              <p className="text-2xl font-bold text-neutral-900">${totalRevenue.toFixed(2)}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 text-xl">💰</span>
            </div>
          </div>
          <p className="text-xs text-blue-600 mt-2">+8% from last month</p>
        </div>

        <div className="bg-white border rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-500">Waste Saved</p>
              <p className="text-2xl font-bold text-neutral-900">{totalWasteSaved.toFixed(1)}kg</p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
              <span className="text-emerald-600 text-xl">🌱</span>
            </div>
          </div>
          <p className="text-xs text-emerald-600 mt-2">+15% from last month</p>
        </div>

        <div className="bg-white border rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-500">Avg Order Value</p>
              <p className="text-2xl font-bold text-neutral-900">${avgOrderValue.toFixed(2)}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <span className="text-purple-600 text-xl">📊</span>
            </div>
          </div>
          <p className="text-xs text-purple-600 mt-2">+5% from last month</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border rounded-2xl p-6">
          <h3 className="font-semibold mb-4">Monthly Performance</h3>
          <div className="space-y-4">
            {chartData.map((data, index) => (
              <div key={data.month} className="flex items-center justify-between">
                <span className="text-sm text-neutral-600">{data.month}</span>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-xs text-neutral-500">{data.orders} orders</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-xs text-neutral-500">${data.revenue.toFixed(0)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-6">
          <h3 className="font-semibold mb-4">Top Categories</h3>
          <div className="space-y-4">
            {topCategories.map(([category, stats], index) => (
              <div key={category} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="w-6 h-6 bg-neutral-100 rounded-full flex items-center justify-center text-xs font-medium">
                    {index + 1}
                  </span>
                  <span className="text-sm font-medium">{category}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">${stats.revenue.toFixed(0)}</p>
                  <p className="text-xs text-neutral-500">{stats.orders} orders</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="bg-white border rounded-2xl p-6">
        <h3 className="font-semibold mb-4">Recent Orders</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-100">
                <th className="text-left py-3 px-2 text-sm font-medium text-neutral-500">Order ID</th>
                <th className="text-left py-3 px-2 text-sm font-medium text-neutral-500">Customer</th>
                <th className="text-left py-3 px-2 text-sm font-medium text-neutral-500">Items</th>
                <th className="text-left py-3 px-2 text-sm font-medium text-neutral-500">Total</th>
                <th className="text-left py-3 px-2 text-sm font-medium text-neutral-500">Status</th>
                <th className="text-left py-3 px-2 text-sm font-medium text-neutral-500">Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 10).map((order, index) => (
                <tr key={index} className="border-b border-neutral-50">
                  <td className="py-3 px-2 text-sm">#{order.id || `ORD-${index + 1}`}</td>
                  <td className="py-3 px-2 text-sm">{order.customer || "Anonymous"}</td>
                  <td className="py-3 px-2 text-sm">{order.items?.length || 1} items</td>
                  <td className="py-3 px-2 text-sm font-medium">${order.total.toFixed(2)}</td>
                  <td className="py-3 px-2">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {order.status || "Completed"}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-sm text-neutral-500">{new Date(order.date).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function Admin({ partners, setPartners }) {
  const [selectedPartner, setSelectedPartner] = useState(null)
  const [showAddPartner, setShowAddPartner] = useState(false)
  const [newPartner, setNewPartner] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    category: "Restaurant",
    status: "pending",
  })

  const handleApprovePartner = (partnerId) => {
    setPartners(partners.map((p) => (p.id === partnerId ? { ...p, status: "approved" } : p)))
  }

  const handleRejectPartner = (partnerId) => {
    setPartners(partners.map((p) => (p.id === partnerId ? { ...p, status: "rejected" } : p)))
  }

  const handleAddPartner = () => {
    const partner = {
      ...newPartner,
      id: Date.now(),
      joinDate: new Date().toISOString(),
      totalDeals: 0,
      rating: 0,
    }
    setPartners([...partners, partner])
    setNewPartner({
      name: "",
      email: "",
      phone: "",
      address: "",
      category: "Restaurant",
      status: "pending",
    })
    setShowAddPartner(false)
  }

  const pendingPartners = partners.filter((p) => p.status === "pending")
  const approvedPartners = partners.filter((p) => p.status === "approved")
  const rejectedPartners = partners.filter((p) => p.status === "rejected")

  return (
    <div className="space-y-6">
      {/* Admin Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white border rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-500">Total Partners</p>
              <p className="text-2xl font-bold text-neutral-900">{partners.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 text-xl">🏪</span>
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-500">Pending Approval</p>
              <p className="text-2xl font-bold text-orange-600">{pendingPartners.length}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
              <span className="text-orange-600 text-xl">⏳</span>
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-500">Approved</p>
              <p className="text-2xl font-bold text-green-600">{approvedPartners.length}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-600 text-xl">✅</span>
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-neutral-500">Rejected</p>
              <p className="text-2xl font-bold text-red-600">{rejectedPartners.length}</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <span className="text-red-600 text-xl">❌</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Partner Management</h2>
        <button
          onClick={() => setShowAddPartner(true)}
          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700"
        >
          Add Partner
        </button>
      </div>

      {/* Add Partner Modal */}
      {showAddPartner && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Add New Partner</h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Partner Name"
                value={newPartner.name}
                onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })}
                className="w-full p-3 border rounded-lg"
              />
              <input
                type="email"
                placeholder="Email"
                value={newPartner.email}
                onChange={(e) => setNewPartner({ ...newPartner, email: e.target.value })}
                className="w-full p-3 border rounded-lg"
              />
              <input
                type="tel"
                placeholder="Phone"
                value={newPartner.phone}
                onChange={(e) => setNewPartner({ ...newPartner, phone: e.target.value })}
                className="w-full p-3 border rounded-lg"
              />
              <input
                type="text"
                placeholder="Address"
                value={newPartner.address}
                onChange={(e) => setNewPartner({ ...newPartner, address: e.target.value })}
                className="w-full p-3 border rounded-lg"
              />
              <select
                value={newPartner.category}
                onChange={(e) => setNewPartner({ ...newPartner, category: e.target.value })}
                className="w-full p-3 border rounded-lg"
              >
                <option value="Restaurant">Restaurant</option>
                <option value="Bakery">Bakery</option>
                <option value="Grocery">Grocery</option>
                <option value="Cafe">Cafe</option>
              </select>
            </div>
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowAddPartner(false)}
                className="flex-1 px-4 py-2 border rounded-lg text-neutral-600 hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddPartner}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Add Partner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Partners Table */}
      <div className="bg-white border rounded-2xl p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-100">
                <th className="text-left py-3 px-2 text-sm font-medium text-neutral-500">Partner</th>
                <th className="text-left py-3 px-2 text-sm font-medium text-neutral-500">Category</th>
                <th className="text-left py-3 px-2 text-sm font-medium text-neutral-500">Status</th>
                <th className="text-left py-3 px-2 text-sm font-medium text-neutral-500">Total Deals</th>
                <th className="text-left py-3 px-2 text-sm font-medium text-neutral-500">Rating</th>
                <th className="text-left py-3 px-2 text-sm font-medium text-neutral-500">Join Date</th>
                <th className="text-left py-3 px-2 text-sm font-medium text-neutral-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {partners.map((partner) => (
                <tr key={partner.id} className="border-b border-neutral-50">
                  <td className="py-3 px-2">
                    <div>
                      <p className="text-sm font-medium">{partner.name}</p>
                      <p className="text-xs text-neutral-500">{partner.email}</p>
                    </div>
                  </td>
                  <td className="py-3 px-2 text-sm">{partner.category}</td>
                  <td className="py-3 px-2">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        partner.status === "approved"
                          ? "bg-green-100 text-green-800"
                          : partner.status === "pending"
                            ? "bg-orange-100 text-orange-800"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {partner.status}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-sm">{partner.totalDeals || 0}</td>
                  <td className="py-3 px-2 text-sm">
                    {partner.rating ? `${partner.rating.toFixed(1)} ⭐` : "No ratings"}
                  </td>
                  <td className="py-3 px-2 text-sm text-neutral-500">
                    {new Date(partner.joinDate).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-2">
                    <div className="flex space-x-2">
                      {partner.status === "pending" && (
                        <>
                          <button
                            onClick={() => handleApprovePartner(partner.id)}
                            className="text-green-600 hover:text-green-800 text-sm"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectPartner(partner.id)}
                            className="text-red-600 hover:text-red-800 text-sm"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setSelectedPartner(partner)}
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        View
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Partner Details Modal */}
      {selectedPartner && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Partner Details</h3>
              <button onClick={() => setSelectedPartner(null)} className="text-neutral-400 hover:text-neutral-600">
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-neutral-500">Name</label>
                  <p className="text-sm">{selectedPartner.name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-500">Category</label>
                  <p className="text-sm">{selectedPartner.category}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-500">Email</label>
                  <p className="text-sm">{selectedPartner.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-500">Phone</label>
                  <p className="text-sm">{selectedPartner.phone || "Not provided"}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium text-neutral-500">Address</label>
                  <p className="text-sm">{selectedPartner.address || "Not provided"}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-500">Status</label>
                  <p className="text-sm capitalize">{selectedPartner.status}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-neutral-500">Join Date</label>
                  <p className="text-sm">{new Date(selectedPartner.joinDate).toLocaleDateString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
