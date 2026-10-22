"use client";

import { useMemo, useState } from "react";

type Trip = {
  id: string; date: string; time: string; customer: string; route: string;
  vehicle: string; driver: string; status: string; revenue: number; costs: number;
};

const tripsSeed: Trip[] = [
  { id: "AK-2026-041", date: "2026-10-23", time: "07:30", customer: "Szkoła Podstawowa nr 8 (DEMO)", route: "Katowice → Kraków → Katowice", vehicle: "SK 12345", driver: "Jan Kowalski (DEMO)", status: "Potwierdzone", revenue: 1800, costs: 720 },
  { id: "AK-2026-042", date: "2026-10-24", time: "06:00", customer: "Biuro Podróży Alfa (DEMO)", route: "Katowice → Zakopane", vehicle: "SK 23456", driver: "Anna Nowak (DEMO)", status: "Przydzielone", revenue: 3200, costs: 1450 },
  { id: "AK-2026-043", date: "2026-10-25", time: "09:00", customer: "Firma Przykładowa (DEMO)", route: "Katowice → Gliwice → Katowice", vehicle: "Do przydzielenia", driver: "Do przydzielenia", status: "Nowe", revenue: 950, costs: 0 },
  { id: "AK-2026-044", date: "2026-10-27", time: "05:30", customer: "Organizator Wyjazdu (DEMO)", route: "Katowice → Wrocław → Katowice", vehicle: "SK 34567", driver: "Piotr Wiśniewski (DEMO)", status: "Oferta wysłana", revenue: 2600, costs: 0 },
];

const vehicles = [
  { plate: "SK 12345", model: "Autokar turystyczny 49 miejsc", status: "Przydzielony", next: "Przegląd: 2026-12-15" },
  { plate: "SK 23456", model: "Autokar turystyczny 55 miejsc", status: "Przydzielony", next: "OC: 2027-02-01" },
  { plate: "SK 34567", model: "Autokar turystyczny Setra 50 miejsc", status: "Planowany wyjazd", next: "Przegląd: 2027-01-20" },
  { plate: "SK 45678", model: "Autokar 33 miejsca", status: "Dostępny", next: "OC: 2027-03-10" },
];

const drivers = [
  { name: "Jan Kowalski (DEMO)", status: "Przydzielony", docs: "Dokumenty przykładowe" },
  { name: "Anna Nowak (DEMO)", status: "Przydzielona", docs: "Dokumenty przykładowe" },
  { name: "Piotr Wiśniewski (DEMO)", status: "Dostępny", docs: "Dokumenty przykładowe" },
];

const money = (n: number) => new Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN", maximumFractionDigits: 0 }).format(n);
const datePL = (s: string) => new Date(s + "T12:00:00").toLocaleDateString("pl-PL");

export default function Home() {
  const [tab, setTab] = useState("start");
  const [trips, setTrips] = useState(tripsSeed);
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newCustomer, setNewCustomer] = useState("");
  const [newRoute, setNewRoute] = useState("");
  const [newDate, setNewDate] = useState("2026-10-28");
  const [newRevenue, setNewRevenue] = useState("1500");

  const filteredTrips = useMemo(() => trips.filter(t =>
    [t.id, t.customer, t.route, t.vehicle, t.driver, t.status].join(" ").toLowerCase().includes(search.toLowerCase())
  ), [trips, search]);

  const totalRevenue = trips.reduce((s, t) => s + t.revenue, 0);
  const totalCosts = trips.reduce((s, t) => s + t.costs, 0);
  const margin = totalRevenue - totalCosts;

  function addTrip() {
    if (!newCustomer.trim() || !newRoute.trim() || !newDate) return;
    const nextId = `AK-DEMO-${String(trips.length + 1).padStart(3, "0")}`;
    setTrips([{ id: nextId, date: newDate, time: "08:00", customer: `${newCustomer.trim()} (DEMO)`, route: newRoute.trim(), vehicle: "Do przydzielenia", driver: "Do przydzielenia", status: "Nowe", revenue: Number(newRevenue) || 0, costs: 0 }, ...trips]);
    setShowNew(false); setNewCustomer(""); setNewRoute("");
    setTab("trips");
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brandMark">AK</div>
        <div className="brandText"><strong>AUTOKARY KATOWICE</strong><span>Panel zarządzania flotą · prototyp</span></div>
        <span className="demoBadge">TRYB DEMO</span>
      </header>

      <div className="notice"><strong>Ważne:</strong> to prototyp z fikcyjnymi danymi. Zmiany nie są zapisywane w bazie i znikną po odświeżeniu strony.</div>

      <section className="welcome">
        <div><p className="eyebrow">CENTRUM OPERACYJNE</p><h1>Zarządzanie flotą</h1><p className="subhead">Wyjazdy, pojazdy, kierowcy i rentowność w jednym miejscu.</p></div>
        <button className="primary" onClick={() => setShowNew(true)}>＋ Nowe zlecenie</button>
      </section>

      <section className="stats">
        <Stat label="Zlecenia w prototypie" value={String(trips.length)} detail="Dane przykładowe" />
        <Stat label="Autokary w rejestrze" value="4" detail="Można rozszerzyć do większej floty" />
        <Stat label="Przychód (demo)" value={money(totalRevenue)} detail="Suma wpisanych zleceń" />
        <Stat label="Marża (demo)" value={money(margin)} detail={`Koszty: ${money(totalCosts)}`} />
      </section>

      <nav className="tabs" aria-label="Sekcje systemu">
        {[
          ["start", "Przegląd"], ["trips", "Zlecenia"], ["fleet", "Autokary"], ["drivers", "Kierowcy"], ["finance", "Finanse"]
        ].map(([id, label]) => <button key={id} className={tab === id ? "tab active" : "tab"} onClick={() => setTab(id)}>{label}</button>)}
      </nav>

      {tab === "start" && <section className="panel">
        <div className="panelHead"><div><h2>Najbliższe wyjazdy</h2><p>Przykładowe wpisy do sprawdzenia układu.</p></div><button className="secondary" onClick={() => setTab("trips")}>Wszystkie zlecenia →</button></div>
        <TripTable trips={[...trips].sort((a,b) => (a.date+a.time).localeCompare(b.date+b.time)).slice(0,4)} />
        <div className="twoCol">
          <div className="miniPanel"><h3>Do sprawdzenia</h3><ul><li>Potwierdzić przydziały przed wyjazdem.</li><li>Zweryfikować terminy dokumentów.</li><li>Uzupełnić koszty po zakończeniu kursu.</li></ul></div>
          <div className="miniPanel"><h3>W następnej wersji</h3><ul><li>Logowanie i role użytkowników.</li><li>Trwały zapis w bazie danych.</li><li>Przypomnienia i wykrywanie kolizji.</li></ul></div>
        </div>
      </section>}

      {tab === "trips" && <section className="panel">
        <div className="panelHead"><div><h2>Zlecenia i wyjazdy</h2><p>Wyszukuj zlecenia i sprawdzaj podstawowe dane.</p></div><button className="primary" onClick={() => setShowNew(true)}>＋ Nowe zlecenie</button></div>
        <input className="search" placeholder="Szukaj klienta, trasy, kierowcy…" value={search} onChange={e => setSearch(e.target.value)} />
        <TripTable trips={filteredTrips} />
      </section>}

      {tab === "fleet" && <section className="panel">
        <div className="panelHead"><div><h2>Flota autokarów</h2><p>Rejestr demonstracyjny — bez rzeczywistych dokumentów.</p></div></div>
        <div className="tableWrap"><table><thead><tr><th>Rejestracja</th><th>Pojazd</th><th>Status</th><th>Najbliższy termin</th></tr></thead><tbody>{vehicles.map(v => <tr key={v.plate}><td><strong>{v.plate}</strong></td><td>{v.model}</td><td><span className="status">{v.status}</span></td><td>{v.next}</td></tr>)}</tbody></table></div>
      </section>}

      {tab === "drivers" && <section className="panel">
        <div className="panelHead"><div><h2>Kierowcy</h2><p>Przykładowa lista. Brak prawdziwych danych osobowych.</p></div></div>
        <div className="tableWrap"><table><thead><tr><th>Kierowca</th><th>Status</th><th>Dokumenty</th></tr></thead><tbody>{drivers.map(d => <tr key={d.name}><td><strong>{d.name}</strong></td><td><span className="status">{d.status}</span></td><td>{d.docs}</td></tr>)}</tbody></table></div>
      </section>}

      {tab === "finance" && <section className="panel">
        <div className="panelHead"><div><h2>Rentowność zleceń</h2><p>Kwoty demonstracyjne. To nie jest księgowość ani rejestr faktur.</p></div></div>
        <div className="financeGrid"><Stat label="Przychód" value={money(totalRevenue)} detail="Suma wartości zleceń"/><Stat label="Koszty" value={money(totalCosts)} detail="Wpisane koszty bezpośrednie"/><Stat label="Marża" value={money(margin)} detail={totalRevenue ? `${(margin/totalRevenue*100).toFixed(1).replace(".", ",")}% przychodu` : "Brak przychodu"} /></div>
        <div className="tableWrap"><table><thead><tr><th>Zlecenie</th><th>Klient</th><th>Przychód</th><th>Koszty</th><th>Marża</th></tr></thead><tbody>{trips.map(t => <tr key={t.id}><td><strong>{t.id}</strong></td><td>{t.customer}</td><td>{money(t.revenue)}</td><td>{money(t.costs)}</td><td className={t.revenue-t.costs < 0 ? "negative" : "positive"}>{money(t.revenue-t.costs)}</td></tr>)}</tbody></table></div>
      </section>}

      <footer>Autokary Katowice · prototyp demonstracyjny · nie używać do rzeczywistych danych</footer>

      {showNew && <div className="modalBackdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setShowNew(false); }}>
        <form className="modal" onSubmit={e => { e.preventDefault(); addTrip(); }}>
          <div className="panelHead"><div><h2>Nowe zlecenie DEMO</h2><p>Dodaje wpis tylko do pamięci tej strony.</p></div><button type="button" className="iconButton" onClick={() => setShowNew(false)} aria-label="Zamknij">×</button></div>
          <label>Klient<input required value={newCustomer} onChange={e => setNewCustomer(e.target.value)} placeholder="np. Szkoła Przykładowa" /></label>
          <label>Trasa<input required value={newRoute} onChange={e => setNewRoute(e.target.value)} placeholder="np. Katowice → Kraków → Katowice" /></label>
          <label>Data wyjazdu<input required type="date" value={newDate} onChange={e => setNewDate(e.target.value)} /></label>
          <label>Planowany przychód (zł)<input required type="number" min="0" step="50" value={newRevenue} onChange={e => setNewRevenue(e.target.value)} /></label>
          <div className="modalActions"><button type="button" className="secondary" onClick={() => setShowNew(false)}>Anuluj</button><button className="primary" type="submit">Dodaj do demo</button></div>
        </form>
      </div>}
    </main>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="stat"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function TripTable({ trips }: { trips: Trip[] }) {
  if (!trips.length) return <p className="empty">Brak zleceń pasujących do wyszukiwania.</p>;
  return <div className="tableWrap"><table><thead><tr><th>Termin</th><th>Zlecenie / klient</th><th>Trasa</th><th>Autokar / kierowca</th><th>Status</th><th>Marża demo</th></tr></thead><tbody>{trips.map(t => <tr key={t.id}><td><strong>{datePL(t.date)}</strong><small>{t.time}</small></td><td><strong>{t.id}</strong><small>{t.customer}</small></td><td>{t.route}</td><td>{t.vehicle}<small>{t.driver}</small></td><td><span className="status">{t.status}</span></td><td className={t.revenue-t.costs < 0 ? "negative" : "positive"}>{money(t.revenue-t.costs)}</td></tr>)}</tbody></table></div>;
}
