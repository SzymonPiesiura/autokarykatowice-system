"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";

const TRIP_STATUSES = [
	{ value: "new", label: "Nowe" },
	{ value: "pending", label: "Oczekuje na potwierdzenie" },
	{ value: "confirmed", label: "Potwierdzone" },
	{ value: "completed", label: "Zrealizowane" },
	{ value: "cancelled", label: "Anulowane" },
] as const;

type Trip = {
	id: string;
	dbId: string;
	date: string;
	time: string;
	endDate: string;
	endTime: string;
	customer: string;
	startLocation: string;
	endLocation: string;
	notes: string;
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
	{
		plate: "SK 12345",
		model: "Autokar turystyczny 49 miejsc",
		status: "Przykładowy",
		next: "Przegląd: 2026-12-15",
	},
	{
		plate: "SK 23456",
		model: "Autokar turystyczny 55 miejsc",
		status: "Przykładowy",
		next: "OC: 2027-02-01",
	},
	{
		plate: "SK 34567",
		model: "Autokar turystyczny Setra 50 miejsc",
		status: "Przykładowy",
		next: "Przegląd: 2027-01-20",
	},
	{
		plate: "SK 45678",
		model: "Autokar 33 miejsca",
		status: "Przykładowy",
		next: "OC: 2027-03-10",
	},
];

const drivers = [
	{
		name: "Kierowca przykładowy 1",
		status: "Demo",
		docs: "Dane demonstracyjne",
	},
	{
		name: "Kierowca przykładowy 2",
		status: "Demo",
		docs: "Dane demonstracyjne",
	},
	{
		name: "Kierowca przykładowy 3",
		status: "Demo",
		docs: "Dane demonstracyjne",
	},
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
		date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
			2,
			"0",
		)}-${String(date.getDate()).padStart(2, "0")}`,
		time: `${String(date.getHours()).padStart(2, "0")}:${String(
			date.getMinutes(),
		).padStart(2, "0")}`,
	};
};

const statusLabel = (status: string) => {
	const labels: Record<string, string> = {
		new: "Nowe",
		pending: "Oczekuje na potwierdzenie",
		confirmed: "Potwierdzone",
		in_progress: "W trakcie realizacji",
		completed: "Zrealizowane",
		cancelled: "Anulowane",
		offer_sent: "Oferta wysłana",
		assigned: "Przydzielone",
	};

	return labels[status] ?? status;
};

const statusColor = (status: string): React.CSSProperties => {
	const colors: Record<string, React.CSSProperties> = {
		new: {
			background: "#e2e8f0",
			color: "#334155",
			border: "1px solid #cbd5e1",
		},
		pending: {
			background: "#fef3c7",
			color: "#92400e",
			border: "1px solid #fcd34d",
		},
		confirmed: {
			background: "#dbeafe",
			color: "#1d4ed8",
			border: "1px solid #93c5fd",
		},
		in_progress: {
			background: "#ede9fe",
			color: "#6d28d9",
			border: "1px solid #c4b5fd",
		},
		completed: {
			background: "#dcfce7",
			color: "#166534",
			border: "1px solid #86efac",
		},
		cancelled: {
			background: "#fee2e2",
			color: "#991b1b",
			border: "1px solid #fca5a5",
		},
	};

	return (
		colors[status] ?? {
			background: "#f1f5f9",
			color: "#334155",
			border: "1px solid #cbd5e1",
		}
	);
};

const DEFAULT_DATE = "2026-10-28";
const DEFAULT_START_TIME = "08:00";
const DEFAULT_END_TIME = "18:00";
const DEFAULT_REVENUE = "1500";

export default function Home() {
	const [tab, setTab] = useState("start");
	const [trips, setTrips] = useState<Trip[]>([]);
	const [search, setSearch] = useState("");

	const [showNew, setShowNew] = useState(false);
	const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
	const [deleteBusy, setDeleteBusy] = useState<string | null>(null);
	const [statusBusy, setStatusBusy] = useState<string | null>(null);

	const [newCustomer, setNewCustomer] = useState("");
	const [newStart, setNewStart] = useState("");
	const [newEnd, setNewEnd] = useState("");
	const [newDate, setNewDate] = useState(DEFAULT_DATE);
	const [newTime, setNewTime] = useState(DEFAULT_START_TIME);
	const [newEndDate, setNewEndDate] = useState(DEFAULT_DATE);
	const [newEndTime, setNewEndTime] = useState(DEFAULT_END_TIME);
	const [newRevenue, setNewRevenue] = useState(DEFAULT_REVENUE);
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

	// Pobieranie zleceń z Supabase.
	const loadOrders = useCallback(async () => {
		setOrdersLoading(true);
		setDbStatus("Pobieranie zleceń z bazy...");

		try {
			const { data, error } = await supabase
				.from("orders")
				.select(
					"id, order_number, customer_id, title, status, start_at, end_at, start_location, end_location, revenue, notes",
				)
				.order("start_at", { ascending: true });

			if (error) {
				throw new Error(error.message);
			}

			const orders = (data ?? []) as DbOrder[];

			const customerIds = Array.from(
				new Set(
					orders
						.map((order) => order.customer_id)
						.filter((id): id is string => Boolean(id)),
				),
			);

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
						(customers ?? []).map((customer) => [customer.id, customer.name]),
					);
				}
			}

			const mapped: Trip[] = orders.map((order) => {
				const start = dateTimeParts(order.start_at);
				const end = dateTimeParts(order.end_at);

				return {
					id: `AK-${order.order_number}`,
					dbId: order.id,
					date: start.date,
					time: start.time,
					endDate: end.date,
					endTime: end.time,
					customer: order.customer_id
						? (customerNames[order.customer_id] ?? order.title)
						: order.title,
					startLocation: order.start_location,
					endLocation: order.end_location,
					notes: order.notes ?? "",
					route: `${order.start_location} → ${order.end_location}`,
					vehicle: "Nieprzydzielony",
					driver: "Nieprzydzielony",
					status: order.status,
					revenue: Number(order.revenue) || 0,
					costs: 0,
				};
			});

			setTrips(mapped);
			setDbStatus(`Połączenie działa. Zlecenia w bazie: ${mapped.length}.`);
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Nieznany błąd pobierania zleceń.";

			console.error("Błąd pobierania zleceń:", message);
			setDbStatus("Nie udało się pobrać zleceń: " + message);
		} finally {
			setOrdersLoading(false);
		}
	}, []);

	// Sprawdzenie sesji użytkownika i jego uprawnień.
	useEffect(() => {
		let active = true;

		async function checkUser() {
			try {
				const {
					data: { session },
					error: sessionError,
				} = await supabase.auth.getSession();

				if (!active) return;

				if (sessionError) {
					setLoginError("Nie udało się sprawdzić sesji. Zaloguj się ponownie.");
					setAuthLoading(false);
					return;
				}

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
			} catch {
				if (!active) return;

				setLoginError("Nie udało się sprawdzić logowania.");
				setAuthLoading(false);
			}
		}

		void checkUser();

		return () => {
			active = false;
		};
	}, []);

	useEffect(() => {
		if (userEmail) {
			void loadOrders();
		}
	}, [userEmail, loadOrders]);

	// Logowanie.
	async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setLoginError("");
		setLoginBusy(true);

		try {
			const { data, error } = await supabase.auth.signInWithPassword({
				email: loginEmail,
				password: loginPassword,
			});

			if (error || !data.user) {
				setLoginError("Logowanie nie powiodło się. Sprawdź e-mail i hasło.");
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
				return;
			}

			setUserEmail(data.user.email ?? "");
			setLoginPassword("");
			setAuthLoading(false);
		} catch {
			setLoginError("Wystąpił błąd podczas logowania.");
		} finally {
			setLoginBusy(false);
		}
	}

	// Wylogowanie.
	async function handleLogout() {
		const { error } = await supabase.auth.signOut();

		if (error) {
			setDbStatus("Nie udało się wylogować: " + error.message);
			return;
		}

		setUserEmail("");
		setTrips([]);
		setTab("start");
		setDbStatus("Oczekiwanie na logowanie...");
		setLoginPassword("");
	}

	// Przywrócenie domyślnych pól formularza.
	function resetForm() {
		setEditingTrip(null);
		setNewCustomer("");
		setNewStart("");
		setNewEnd("");
		setNewDate(DEFAULT_DATE);
		setNewTime(DEFAULT_START_TIME);
		setNewEndDate(DEFAULT_DATE);
		setNewEndTime(DEFAULT_END_TIME);
		setNewRevenue(DEFAULT_REVENUE);
		setNewNotes("");
		setFormError("");
	}

	// Otwieranie pustego formularza nowego zlecenia.
	function openNewTrip() {
		resetForm();
		setShowNew(true);
	}

	// Zamknięcie formularza.
	function closeForm() {
		if (saveBusy) return;

		setShowNew(false);
		resetForm();
	}

	// Otwieranie formularza edycji.
	function openEditTrip(trip: Trip) {
		setEditingTrip(trip);

		setNewCustomer(trip.customer);
		setNewStart(trip.startLocation);
		setNewEnd(trip.endLocation);
		setNewDate(trip.date);
		setNewTime(trip.time);
		setNewEndDate(trip.endDate);
		setNewEndTime(trip.endTime);
		setNewRevenue(String(trip.revenue));
		setNewNotes(trip.notes);

		setFormError("");
		setShowNew(true);
	}

	// Dodawanie nowego zlecenia lub zapisywanie edycji.
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
			setFormError(
				"Data i godzina zakończenia muszą być późniejsze niż rozpoczęcia.",
			);
			return;
		}

		if (!Number.isFinite(revenue) || revenue < 0) {
			setFormError("Podaj prawidłowy przychód, nie mniejszy niż 0.");
			return;
		}

		setSaveBusy(true);

		try {
			const customerName = newCustomer.trim();

			// Najpierw sprawdzamy, czy klient już istnieje.
			const { data: existingCustomer, error: findError } = await supabase
				.from("customers")
				.select("id")
				.eq("name", customerName)
				.limit(1)
				.maybeSingle();

			if (findError) {
				throw new Error(
					"Nie udało się sprawdzić klienta: " + findError.message,
				);
			}

			let customerId: string | null = existingCustomer?.id ?? null;

			// Jeśli klient nie istnieje, tworzymy go.
			if (!customerId) {
				const { data: createdCustomer, error: createCustomerError } =
					await supabase
						.from("customers")
						.insert({ name: customerName })
						.select("id")
						.single();

				if (createCustomerError) {
					throw new Error(
						"Nie udało się zapisać klienta: " + createCustomerError.message,
					);
				}

				customerId = createdCustomer.id;
			}

			const orderPayload = {
				customer_id: customerId,
				title: customerName,
				start_at: startAt.toISOString(),
				end_at: endAt.toISOString(),
				start_location: newStart.trim(),
				end_location: newEnd.trim(),
				revenue,
				notes: newNotes.trim() || null,
			};

			if (editingTrip) {
				// Aktualizacja istniejącego zlecenia.
				const { data: updatedOrder, error: updateError } = await supabase
					.from("orders")
					.update(orderPayload)
					.eq("id", editingTrip.dbId)
					.select("id")
					.maybeSingle();

				if (updateError) {
					throw new Error(
						"Nie udało się zaktualizować zlecenia: " + updateError.message,
					);
				}

				if (!updatedOrder) {
					throw new Error(
						"Nie znaleziono zlecenia do edycji albo konto nie ma uprawnień do jego zmiany.",
					);
				}
			} else {
				// Wstawienie nowego zlecenia.
				const {
					data: { user },
					error: userError,
				} = await supabase.auth.getUser();

				if (userError) {
					throw new Error(
						"Nie udało się sprawdzić zalogowanego użytkownika: " +
							userError.message,
					);
				}

				const { error: insertError } = await supabase.from("orders").insert({
					...orderPayload,
					status: "new",
					created_by: user?.id ?? null,
				});

				if (insertError) {
					throw new Error(
						"Nie udało się zapisać zlecenia: " + insertError.message,
					);
				}
			}

			setShowNew(false);
			resetForm();
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

	// Usuwanie zlecenia po potwierdzeniu.
	async function deleteTrip(trip: Trip) {
		const confirmed = window.confirm(
			`Czy na pewno chcesz usunąć zlecenie ${trip.id} dla klienta ${trip.customer}? Tej operacji nie można cofnąć.`,
		);

		if (!confirmed) return;

		setDeleteBusy(trip.dbId);
		setDbStatus("Usuwanie zlecenia...");

		try {
			const { data: deletedOrder, error } = await supabase
				.from("orders")
				.delete()
				.eq("id", trip.dbId)
				.select("id")
				.maybeSingle();

			if (error) {
				throw new Error(error.message);
			}

			if (!deletedOrder) {
				throw new Error(
					"Zlecenie nie zostało usunięte. Sprawdź uprawnienia do usuwania zleceń.",
				);
			}

			await loadOrders();
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Nie udało się usunąć zlecenia.";

			setDbStatus("Błąd usuwania zlecenia: " + message);
		} finally {
			setDeleteBusy(null);
		}
	}

	async function changeTripStatus(trip: Trip, newStatus: string) {
		if (!TRIP_STATUSES.some((status) => status.value === newStatus)) {
			setDbStatus("Wybrano nieprawidłowy status.");
			return;
		}

		if (trip.status === newStatus) return;

		setStatusBusy(trip.dbId);
		setDbStatus(`Zapisywanie statusu zlecenia ${trip.id}...`);

		try {
			const { data, error } = await supabase
				.from("orders")
				.update({ status: newStatus })
				.eq("id", trip.dbId)
				.select("id")
				.maybeSingle();

			if (error) {
				throw new Error(error.message);
			}

			if (!data) {
				throw new Error(
					"Nie udało się zmienić statusu. Sprawdź uprawnienia do edycji zleceń.",
				);
			}

			await loadOrders();
			setDbStatus(
				`Zmieniono status zlecenia ${trip.id} na „${statusLabel(newStatus)}”.`,
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Nieznany błąd.";

			setDbStatus("Błąd zmiany statusu: " + message);
		} finally {
			setStatusBusy(null);
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
					.includes(search.toLowerCase()),
			),
		[trips, search],
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
				<button className="secondary" onClick={handleLogout} type="button">
					Wyloguj
				</button>
			</header>

			<div className="notice">
				<strong>Status bazy danych:</strong> {dbStatus}
				<p>
					Lista zleceń jest pobierana z Supabase. Koszty i przydziały floty nie
					są jeszcze podłączone.
				</p>
				<button
					className="secondary"
					onClick={() => void loadOrders()}
					disabled={ordersLoading}
					type="button"
				>
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

				<button className="primary" onClick={openNewTrip} type="button">
					＋ Nowe zlecenie
				</button>
			</section>

			<section className="stats">
				<Stat
					label="Zlecenia w bazie"
					value={String(trips.length)}
					detail="Dane pobrane z Supabase"
				/>
				<Stat
					label="Autokary w rejestrze"
					value="4"
					detail="Dane demonstracyjne"
				/>
				<Stat
					label="Przychód ze zleceń"
					value={money(totalRevenue)}
					detail="Wartości zapisane w bazie"
				/>
				<Stat
					label="Marża orientacyjna"
					value={money(margin)}
					detail={`Koszty demo: ${money(totalCosts)}`}
				/>
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
						type="button"
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
						<button
							className="secondary"
							onClick={() => setTab("trips")}
							type="button"
						>
							Wszystkie zlecenia →
						</button>
					</div>

					<TripTable
						trips={[...trips]
							.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
							.slice(0, 4)}
						onEdit={openEditTrip}
						onDelete={deleteTrip}
						deleteBusy={deleteBusy}
						onStatusChange={changeTripStatus}
						statusBusy={statusBusy}
					/>

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
						<button className="primary" onClick={openNewTrip} type="button">
							＋ Nowe zlecenie
						</button>
					</div>

					<input
						className="search"
						placeholder="Szukaj klienta, trasy, kierowcy…"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
					/>

					{ordersLoading ? (
						<p>Wczytywanie zleceń...</p>
					) : (
						<TripTable
							trips={filteredTrips}
							onEdit={openEditTrip}
							onDelete={deleteTrip}
							deleteBusy={deleteBusy}
							onStatusChange={changeTripStatus}
							statusBusy={statusBusy}
						/>
					)}
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
							<thead>
								<tr>
									<th>Rejestracja</th>
									<th>Pojazd</th>
									<th>Status</th>
									<th>Najbliższy termin</th>
								</tr>
							</thead>
							<tbody>
								{vehicles.map((vehicle) => (
									<tr key={vehicle.plate}>
										<td>
											<strong>{vehicle.plate}</strong>
										</td>
										<td>{vehicle.model}</td>
										<td>
											<span className="status">{vehicle.status}</span>
										</td>
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
							<p>
								Lista demonstracyjna — nie zawiera rzeczywistych przydziałów.
							</p>
						</div>
					</div>

					<div className="tableWrap">
						<table>
							<thead>
								<tr>
									<th>Kierowca</th>
									<th>Status</th>
									<th>Dokumenty</th>
								</tr>
							</thead>
							<tbody>
								{drivers.map((driver) => (
									<tr key={driver.name}>
										<td>
											<strong>{driver.name}</strong>
										</td>
										<td>
											<span className="status">{driver.status}</span>
										</td>
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
							<p>
								Przychody pochodzą z bazy. Koszty pozostają na razie zerowe.
							</p>
						</div>
					</div>

					<div className="financeGrid">
						<Stat
							label="Przychód"
							value={money(totalRevenue)}
							detail="Suma wartości zleceń"
						/>
						<Stat
							label="Koszty"
							value={money(totalCosts)}
							detail="Koszty niepodłączone"
						/>
						<Stat
							label="Marża orientacyjna"
							value={money(margin)}
							detail="Bez rzeczywistych kosztów"
						/>
					</div>

					<div className="tableWrap">
						<table>
							<thead>
								<tr>
									<th>Zlecenie</th>
									<th>Klient</th>
									<th>Przychód</th>
									<th>Koszty</th>
									<th>Różnica</th>
								</tr>
							</thead>
							<tbody>
								{trips.map((trip) => (
									<tr key={trip.dbId}>
										<td>
											<strong>{trip.id}</strong>
										</td>
										<td>{trip.customer}</td>
										<td>{money(trip.revenue)}</td>
										<td>{money(trip.costs)}</td>
										<td
											className={
												trip.revenue - trip.costs < 0 ? "negative" : "positive"
											}
										>
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
						if (e.target === e.currentTarget && !saveBusy) {
							closeForm();
						}
					}}
				>
					<form className="modal" onSubmit={addTrip}>
						<div className="panelHead">
							<div>
								<h2>
									{editingTrip
										? `Edycja zlecenia ${editingTrip.id}`
										: "Nowe zlecenie"}
								</h2>
								<p>
									{editingTrip
										? "Zmień dane zlecenia i zapisz aktualizację."
										: "Zlecenie i ewentualny nowy klient zostaną zapisani w bazie."}
								</p>
							</div>

							<button
								type="button"
								className="iconButton"
								onClick={closeForm}
								aria-label="Zamknij"
								disabled={saveBusy}
							>
								×
							</button>
						</div>

						<label>
							Klient
							<input
								required
								value={newCustomer}
								onChange={(e) => setNewCustomer(e.target.value)}
								placeholder="Nazwa klienta"
							/>
						</label>

						<label>
							Miejsce rozpoczęcia
							<input
								required
								value={newStart}
								onChange={(e) => setNewStart(e.target.value)}
								placeholder="np. Katowice"
							/>
						</label>

						<label>
							Miejsce zakończenia
							<input
								required
								value={newEnd}
								onChange={(e) => setNewEnd(e.target.value)}
								placeholder="np. Kraków"
							/>
						</label>

						<label>
							Data wyjazdu
							<input
								required
								type="date"
								value={newDate}
								onChange={(e) => setNewDate(e.target.value)}
							/>
						</label>

						<label>
							Godzina rozpoczęcia
							<input
								required
								type="time"
								value={newTime}
								onChange={(e) => setNewTime(e.target.value)}
							/>
						</label>

						<label>
							Data zakończenia
							<input
								required
								type="date"
								value={newEndDate}
								onChange={(e) => setNewEndDate(e.target.value)}
							/>
						</label>

						<label>
							Godzina zakończenia
							<input
								required
								type="time"
								value={newEndTime}
								onChange={(e) => setNewEndTime(e.target.value)}
							/>
						</label>

						<label>
							Planowany przychód (zł)
							<input
								required
								type="number"
								min="0"
								step="0.01"
								value={newRevenue}
								onChange={(e) => setNewRevenue(e.target.value)}
							/>
						</label>

						<label>
							Uwagi (opcjonalnie)
							<textarea
								value={newNotes}
								onChange={(e) => setNewNotes(e.target.value)}
								rows={3}
							/>
						</label>

						{formError && (
							<p role="alert" style={{ color: "crimson" }}>
								{formError}
							</p>
						)}

						<div className="modalActions">
							<button
								type="button"
								className="secondary"
								onClick={closeForm}
								disabled={saveBusy}
							>
								Anuluj
							</button>

							<button className="primary" type="submit" disabled={saveBusy}>
								{saveBusy
									? "Zapisywanie..."
									: editingTrip
										? "Zapisz zmiany"
										: "Zapisz zlecenie"}
							</button>
						</div>
					</form>
				</div>
			)}
		</main>
	);
}

function Stat({
	label,
	value,
	detail,
}: {
	label: string;
	value: string;
	detail: string;
}) {
	return (
		<div className="stat">
			<span>{label}</span>
			<strong>{value}</strong>
			<small>{detail}</small>
		</div>
	);
}

function TripTable({
	trips,
	onEdit,
	onDelete,
	deleteBusy,
	onStatusChange,
	statusBusy,
}: {
	trips: Trip[];
	onEdit: (trip: Trip) => void;
	onDelete: (trip: Trip) => void;
	deleteBusy: string | null;
	onStatusChange: (trip: Trip, newStatus: string) => void;
	statusBusy: string | null;
}) {
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
						<th>Akcje</th>
					</tr>
				</thead>

				<tbody>
					{trips.map((trip) => (
						<tr key={trip.dbId}>
							<td>
								<strong>{datePL(trip.date)}</strong>
								<small>{trip.time}</small>
							</td>

							<td>
								<strong>{trip.id}</strong>
								<small>{trip.customer}</small>
							</td>

							<td>{trip.route}</td>

							<td>
								{trip.vehicle}
								<small>{trip.driver}</small>
							</td>

							<td>
								<select
									className="status"
									value={trip.status}
									disabled={statusBusy === trip.dbId}
									onChange={(e) => onStatusChange(trip, e.target.value)}
									aria-label={`Status zlecenia ${trip.id}`}
									style={{
										maxWidth: 210,
										padding: "7px 10px",
										cursor: statusBusy === trip.dbId ? "wait" : "pointer",
										...statusColor(trip.status),
									}}
								>
									{!TRIP_STATUSES.some((s) => s.value === trip.status) && (
										<option value={trip.status}>
											{statusLabel(trip.status)} (starszy status)
										</option>
									)}

									{TRIP_STATUSES.map((status) => (
										<option key={status.value} value={status.value}>
											{status.label}
										</option>
									))}
								</select>

								{statusBusy === trip.dbId && <small>Zapisywanie...</small>}
							</td>

							<td
								className={
									trip.revenue - trip.costs < 0 ? "negative" : "positive"
								}
							>
								{money(trip.revenue - trip.costs)}
							</td>

							<td>
								<div
									style={{
										display: "flex",
										gap: 8,
										flexWrap: "wrap",
									}}
								>
									<button
										type="button"
										className="secondary"
										onClick={() => onEdit(trip)}
										disabled={deleteBusy === trip.dbId}
									>
										Edytuj
									</button>

									<button
										type="button"
										className="secondary"
										onClick={() => onDelete(trip)}
										disabled={deleteBusy === trip.dbId}
									>
										{deleteBusy === trip.dbId ? "Usuwanie..." : "Usuń"}
									</button>
								</div>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
