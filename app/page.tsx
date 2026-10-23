
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";

type Trip = {
  id: string;
  date: string;
  time: string;
  customer: string;
  route: string;
  vehicle: string;
  driver: string;
  status: string;
  revenue: number;
  costs: number;
};

type DbOrder = {
  id: string;
  order_number: number;
  customer_id: string | null;
  title: string;
  status: string;
  start_at: string;
  end_at: string;
  start_location: string;
  end_location: string;
  revenue: number | string;
  notes: string | null;
};

const vehicles = [
  { plate: "SK 12345", model: "Autokar turystyczny 49 miejsc", status: "Przykładowy", next: "Przegląd: 2026-12-15" },
  { plate: "SK 23456", model: "Autokar turystyczny 55 miejsc", status: "Przykładowy", next: "OC: 2027-02-01" },
  { plate: "SK 34567", model: "Autokar turystyczny Setra 50 miejsc", status: "Przykładowy", next: "Przegląd: 2027-01-20" },
  { plate: "SK 45678", model: "Autokar 33 miejsca", status: "Przykładowy", next: "OC: 2027-03-10" },
];

const drivers = [
  { name: "Kierowca przykładowy 1", status: "Demo", docs: "Dane demonstracyjne" },
  { name: "Kierowca przykładowy 2", status: "Demo", docs: "Dane demonstracyjne" },
  { name: "Kierowca przykładowy 3", status: "Demo", docs: "Dane demonstracyjne" },
];

const money = (n: number) =>
  new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(n);

const datePL = (s: string) => {
  if (!s) return "—";
  return new Date(s + "T12:00:00").toLocaleDateString("pl-PL");
};

const dateTimeParts = (value: string) => {
  const date = new Date(value);
  return {
    date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
    time: `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
  };
};

const statusLabel = (status: string) => {
  const labels: Record<string, string> = {
    new: "Nowe",
    offer_sent: "Oferta wysłana",
    confirmed: "Potwierdzone",
    assigned: "Przydzielone",
    completed: "Zakończone",
    cancelled: "Anulowane",
  };
  return labels[status] ?? status;
};

export default function Home() {
  const [tab, setTab] = useState("start");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);

  const [newCustomer, setNewCustomer] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newDate, setNewDate] = useState("2026-10-28");
  const [newTime, setNewTime] = useState("08:00");
  const [newEndDate, setNewEndDate] = useState("2026-10-28");
  const [newEndTime, setNewEndTime] = useState("18:00");
  const [newRevenue, setNewRevenue] = useState("1500");
  const [newNotes, setNewNotes] = useState("");

  const [dbStatus, setDbStatus] = useState("Oczekiwanie na logowanie...");
  const [authLoading, setAuthLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setDbStatus("Pobieranie zleceń z bazy...");

    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, order_number, customer_id, title, status, start_at, end_at, start_location, end_location, revenue, notes"
      )
      .order("start_at", { ascending: true });

    if (error) {
      console.error("Błąd pobierania zleceń:", error.message);
      setDbStatus("Nie udało się pobrać zleceń: " + error.message);
      setOrdersLoading(false);
      return;
    }

    const orders = (data ?? []) as DbOrder[];
    const customerIds = [
      ...new Set(
        orders
          .map((order) => order.customer_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];

    let customerNames: Record<string, string> = {};

    if (customerIds.length > 0) {
      const { data: customers, error: customerError } = await supabase
        .from("customers")
        .select("id, name")
        .in("id", customerIds);

      if (customerError) {
        console.error("Błąd pobierania klientów:", customerError.message);
      } else {
        customerNames = Object.fromEntries(
          (customers ?? []).map((customer) => [customer.id, customer.name])
        );
      }
    }

    const mapped: Trip[] = orders.map((order) => {
      const parts = dateTimeParts(order.start_at);

      return {
        id: `AK-${order.order_number}`,
        date: parts.date,
        time: parts.time,
        customer: order.customer_id
          ? customerNames[order.customer_id] ?? order.title
          : order.title,
        route: `${order.start_location} → ${order.end_location}`,
        vehicle: "Nieprzydzielony",
        driver: "Nieprzydzielony",
        status: statusLabel(order.status),
        revenue: Number(order.revenue) || 0,
        costs: 0,
      };
    });

    setTrips(mapped);
    setDbStatus(`Połączenie działa. Zlecenia w bazie: ${mapped.length}.`);
    setOrdersLoading(false);
  }, []);

  useEffect(() => {
    let active = true;

    async function checkUser() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;

      if (!session) {
        setAuthLoading(false);
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!active) return;

      if (error || profile?.role !== "office") {
        await supabase.auth.signOut();
        if (!active) return;
        setLoginError("To konto nie ma uprawnień biura.");
        setAuthLoading(false);
        return;
      }

      setUserEmail(session.user.email ?? "");
      setAuthLoading(false);
    }

    checkUser();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (userEmail) {
      loadOrders();
    }
  }, [userEmail, loadOrders]);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoginError("");
    setLoginBusy(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });

    if (error || !data.user) {
      setLoginError("Logowanie nie powiodło się. Sprawdź e-mail i hasło.");
      setLoginBusy(false);
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profileError || profile?.role !== "office") {
      await supabase.auth.signOut();
      setLoginError("Konto nie ma uprawnień biura.");
      setLoginBusy(false);
      return;
    }

    setUserEmail(data.user.email ?? "");
    setLoginPassword("");
    setAuthLoading(false);
    setLoginBusy(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setUserEmail("");
    setTrips([]);
    setTab("start");
    setDbStatus("Oczekiwanie na logowanie...");
  }

  async function addTrip(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");

    if (!newCustomer.trim() || !newStart.trim() || !newEnd.trim()) {
      setFormError("Uzupełnij klienta oraz miejsce rozpoczęcia i zakończenia.");
      return;
    }

    const startAt = new Date(`${newDate}T${newTime}`);
    const endAt = new Date(`${newEndDate}T${newEndTime}`);
    const revenue = Number(newRevenue);

    if (
      Number.isNaN(startAt.getTime()) ||
      Number.isNaN(endAt.getTime()) ||
      endAt <= startAt
    ) {
      setFormError("Data i godzina zakończenia muszą być późniejsze niż rozpoczęcia.");
      return;
    }

    if (!Number.isFinite(revenue) || revenue < 0) {
      setFormError("Podaj prawidłowy przychód, nie mniejszy niż 0.");
      return;
    }

    setSaveBusy(true);

    try {
      const customerName = newCustomer.trim();

      const { data: existingCustomer, error: findError } = await supabase
        .from("customers")
        .select("id")
        .eq("name", customerName)
        .limit(1)
        .maybeSingle();

      if (findError) {
        throw new Error("Nie udało się sprawdzić klienta: " + findError.message);
      }

      let customerId: string | null = existingCustomer?.id ?? null;

      if (!customerId) {
        const { data: createdCustomer, error: createCustomerError } =
          await supabase
            .from("customers")
            .insert({ name: customerName })
            .select("id")
            .single();

        if (createCustomerError) {
          throw new Error(
            "Nie udało się zapisać klienta: " + createCustomerError.message
          );
        }

        customerId = createdCustomer.id;
      }

      const { error: orderError } = await supabase.from("orders").insert({
        customer_id: customerId,
        title: customerName,
        status: "new",
        start_at: startAt.toISOString(),
        end_at: endAt.toISOString(),
        start_location: newStart.trim(),
        end_location: newEnd.trim(),
        revenue,
        notes: newNotes.trim() || null,
        created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
      });

      if (orderError) {
        throw new Error("Nie udało się zapisać zlecenia: " + orderError.message);
      }

      setShowNew(false);
      setNewCustomer("");
      setNewStart("");
      setNewEnd("");
      setNewDate("2026-10-28");
      setNewTime("08:00");
      setNewEndDate("2026-10-28");
      setNewEndTime("18:00");
      setNewRevenue("1500");
      setNewNotes("");
      setTab("trips");

      await loadOrders();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Wystąpił nieznany błąd.";
      setFormError(message);
    } finally {
      setSaveBusy(false);
    }
  }

  const filteredTrips = useMemo(
    () =>
      trips.filter((trip) =>
        [
          trip.id,
          trip.customer,
          trip.route,
          trip.vehicle,
          trip.driver,
          trip.status,
        ]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase())
      ),
    [trips, search]
  );

  const totalRevenue = trips.reduce((sum, trip) => sum + trip.revenue, 0);
  const totalCosts = trips.reduce((sum, trip) => sum + trip.costs, 0);
  const margin = totalRevenue - totalCosts;

  if (authLoading) {
    return (
      <main className="shell">
        <section className="panel">Sprawdzanie logowania...</section>
      </main>
    );
  }

  if (!userEmail) {
    return (
      <main className="shell">
        <header className="topbar">
          <div className="brandMark">AK</div>
          <div className="brandText">
            <strong>AUTOKARY KATOWICE</strong>
            <span>Panel zarządzania flotą</span>
          </div>
        </header>

        <section
          className="panel"
          style={{ maxWidth: 440, margin: "48px auto", padding: 24 }}
        >
          <h1>Logowanie</h1>
          <p>Zaloguj się na konto biura.</p>

          <form onSubmit={handleLogin}>
            <label>
              Adres e-mail
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                autoComplete="username"
              />
            </label>

            <label>
              Hasło
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>

            {loginError && (
              <p role="alert" style={{ color: "crimson" }}>
                {loginError}
              </p>
            )}

            <button className="primary" type="submit" disabled={loginBusy}>
              {loginBusy ? "Logowanie..." : "Zaloguj się"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brandMark">AK</div>
        <div className="brandText">
          <strong>AUTOKARY KATOWICE</strong>
          <span>Panel zarządzania flotą</span>
        </div>
        <button className="secondary" onClick={handleLogout}>
          Wyloguj
        </button>
      </header>

      <div className="notice">
        <strong>Status bazy danych:</strong> {dbStatus}
        <p>Lista zleceń jest pobierana z Supabase. Koszty i przydziały floty nie są jeszcze podłączone.</p>
        <button className="secondary" onClick={loadOrders} disabled={ordersLoading}>
          {ordersLoading ? "Odświeżanie..." : "Odśwież zlecenia"}
        </button>
      </div>

      <section className="welcome">
        <div>
          <p className="eyebrow">CENTRUM OPERACYJNE</p>
          <h1>Zarządzanie flotą</h1>
          <p className="subhead">
            Wyjazdy, pojazdy, kierowcy i rentowność w jednym miejscu.
          </p>
        </div>
        <button className="primary" onClick={() => { setFormError(""); setShowNew(true); }}>
          ＋ Nowe zlecenie
        </button>
      </section>

      <section className="stats">
        <Stat label="Zlecenia w bazie" value={String(trips.length)} detail="Dane pobrane z Supabase" />
        <Stat label="Autokary w rejestrze" value="4" detail="Dane demonstracyjne" />
        <Stat label="Przychód ze zleceń" value={money(totalRevenue)} detail="Wartości zapisane w bazie" />
        <Stat label="Marża orientacyjna" value={money(margin)} detail={`Koszty demo: ${money(totalCosts)}`} />
      </section>

      <nav className="tabs" aria-label="Sekcje systemu">
        {[
          ["start", "Przegląd"],
          ["trips", "Zlecenia"],
          ["fleet", "Autokary"],
          ["drivers", "Kierowcy"],
          ["finance", "Finanse"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={tab === id ? "tab active" : "tab"}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "start" && (
        <section className="panel">
          <div className="panelHead">
            <div>
              <h2>Najbliższe wyjazdy</h2>
              <p>Rzeczywiste zlecenia zapisane w bazie danych.</p>
            </div>
            <button className="secondary" onClick={() => setTab("trips")}>
              Wszystkie zlecenia →
            </button>
          </div>
          <TripTable trips={[...trips].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 4)} />
          <div className="twoCol">
            <div className="miniPanel">
              <h3>Do sprawdzenia</h3>
              <ul>
                <li>Potwierdzić przydziały przed wyjazdem.</li>
                <li>Zweryfikować terminy dokumentów.</li>
                <li>Uzupełnić koszty po zakończeniu kursu.</li>
              </ul>
            </div>
            <div className="miniPanel">
              <h3>Kolejne etapy</h3>
              <ul>
                <li>Podłączenie pojazdów i kierowców.</li>
                <li>Rejestrowanie kosztów.</li>
                <li>Kontrola kolizji terminów.</li>
              </ul>
            </div>
          </div>
        </section>
      )}

      {tab === "trips" && (
        <section className="panel">
          <div className="panelHead">
            <div>
              <h2>Zlecenia i wyjazdy</h2>
              <p>Lista zleceń pobranych z Supabase.</p>
            </div>
            <button className="primary" onClick={() => { setFormError(""); setShowNew(true); }}>
              ＋ Nowe zlecenie
            </button>
          </div>
          <input
            className="search"
            placeholder="Szukaj klienta, trasy, kierowcy…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {ordersLoading ? <p>Wczytywanie zleceń...</p> : <TripTable trips={filteredTrips} />}
        </section>
      )}

      {tab === "fleet" && (
        <section className="panel">
          <div className="panelHead">
            <div>
              <h2>Flota autokarów</h2>
              <p>Rejestr demonstracyjny — nie jest jeszcze połączony z bazą.</p>
            </div>
          </div>
          <div className="tableWrap">
            <table>
              <thead><tr><th>Rejestracja</th><th>Pojazd</th><th>Status</th><th>Najbliższy termin</th></tr></thead>
              <tbody>
                {vehicles.map((vehicle) => (
                  <tr key={vehicle.plate}>
                    <td><strong>{vehicle.plate}</strong></td>
                    <td>{vehicle.model}</td>
                    <td><span className="status">{vehicle.status}</span></td>
                    <td>{vehicle.next}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "drivers" && (
        <section className="panel">
          <div className="panelHead">
            <div>
              <h2>Kierowcy</h2>
              <p>Lista demonstracyjna — nie zawiera rzeczywistych przydziałów.</p>
            </div>
          </div>
          <div className="tableWrap">
            <table>
              <thead><tr><th>Kierowca</th><th>Status</th><th>Dokumenty</th></tr></thead>
              <tbody>
                {drivers.map((driver) => (
                  <tr key={driver.name}>
                    <td><strong>{driver.name}</strong></td>
                    <td><span className="status">{driver.status}</span></td>
                    <td>{driver.docs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === "finance" && (
        <section className="panel">
          <div className="panelHead">
            <div>
              <h2>Rentowność zleceń</h2>
              <p>Przychody pochodzą z bazy. Koszty pozostają na razie zerowe.</p>
            </div>
          </div>
          <div className="financeGrid">
            <Stat label="Przychód" value={money(totalRevenue)} detail="Suma wartości zleceń" />
            <Stat label="Koszty" value={money(totalCosts)} detail="Koszty niepodłączone" />
            <Stat label="Marża orientacyjna" value={money(margin)} detail="Bez rzeczywistych kosztów" />
          </div>
          <div className="tableWrap">
            <table>
              <thead><tr><th>Zlecenie</th><th>Klient</th><th>Przychód</th><th>Koszty</th><th>Różnica</th></tr></thead>
              <tbody>
                {trips.map((trip) => (
                  <tr key={trip.id}>
                    <td><strong>{trip.id}</strong></td>
                    <td>{trip.customer}</td>
                    <td>{money(trip.revenue)}</td>
                    <td>{money(trip.costs)}</td>
                    <td className={trip.revenue - trip.costs < 0 ? "negative" : "positive"}>
                      {money(trip.revenue - trip.costs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <footer>Autokary Katowice · panel w trakcie wdrażania</footer>

      {showNew && (
        <div
          className="modalBackdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saveBusy) setShowNew(false);
          }}
        >
          <form className="modal" onSubmit={addTrip}>
            <div className="panelHead">
              <div>
                <h2>Nowe zlecenie</h2>
                <p>Zlecenie i ewentualny nowy klient zostaną zapisani w bazie.</p>
              </div>
              <button
                type="button"
                className="iconButton"
                onClick={() => setShowNew(false)}
                aria-label="Zamknij"
                disabled={saveBusy}
              >
                ×
              </button>
            </div>

            <label>
              Klient
              <input required value={newCustomer} onChange={(e) => setNewCustomer(e.target.value)} placeholder="Nazwa klienta" />
            </label>

            <label>
              Miejsce rozpoczęcia
              <input required value={newStart} onChange={(e) => setNewStart(e.target.value)} placeholder="np. Katowice" />
            </label>

            <label>
              Miejsce zakończenia
              <input required value={newEnd} onChange={(e) => setNewEnd(e.target.value)} placeholder="np. Kraków" />
            </label>

            <label>
              Data wyjazdu
              <input required type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </label>

            <label>
              Godzina rozpoczęcia
              <input required type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
            </label>

            <label>
              Data zakończenia
              <input required type="date" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} />
            </label>

            <label>
              Godzina zakończenia
              <input required type="time" value={newEndTime} onChange={(e) => setNewEndTime(e.target.value)} />
            </label>

            <label>
              Planowany przychód (zł)
              <input required type="number" min="0" step="0.01" value={newRevenue} onChange={(e) => setNewRevenue(e.target.value)} />
            </label>

            <label>
              Uwagi (opcjonalnie)
              <textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} rows={3} />
            </label>

            {formError && <p role="alert" style={{ color: "crimson" }}>{formError}</p>}

            <div className="modalActions">
              <button type="button" className="secondary" onClick={() => setShowNew(false)} disabled={saveBusy}>
                Anuluj
              </button>
              <button className="primary" type="submit" disabled={saveBusy}>
                {saveBusy ? "Zapisywanie..." : "Zapisz zlecenie"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function TripTable({ trips }: { trips: Trip[] }) {
  if (!trips.length) {
    return <p className="empty">Brak zleceń do wyświetlenia.</p>;
  }

  return (
    <div className="tableWrap">
      <table>
        <thead>
          <tr>
            <th>Termin</th>
            <th>Zlecenie / klient</th>
            <th>Trasa</th>
            <th>Autokar / kierowca</th>
            <th>Status</th>
            <th>Różnica orientacyjna</th>
          </tr>
        </thead>
        <tbody>
          {trips.map((trip) => (
            <tr key={trip.id}>
              <td><strong>{datePL(trip.date)}</strong><small>{trip.time}</small></td>
              <td><strong>{trip.id}</strong><small>{trip.customer}</small></td>
              <td>{trip.route}</td>
              <td>{trip.vehicle}<small>{trip.driver}</small></td>
              <td><span className="status">{trip.status}</span></td>
              <td className={trip.revenue - trip.costs < 0 ? "negative" : "positive"}>
                {money(trip.revenue - trip.costs)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
