"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { BadgeCheck, Ban, Banknote, CalendarDays, Car, Crown, Edit, Image, LogOut, Plus, RefreshCcw, Save, Settings, ShieldAlert, Trash2, UserRound, UsersRound, X } from "lucide-react";
import { formatLak } from "@taxilao/shared";
import { getApiUrl } from "./config";

const AdminPlaceManager = dynamic(
  () => import("./admin-place-manager").then((module) => module.AdminPlaceManager),
  { ssr: false }
);

type Driver = {
  id: string;
  username?: string;
  hasPassword?: boolean;
  name: string;
  city: string;
  languages?: string[];
  vehicleType: string;
  startingPriceLak?: number;
  ratePerKmLak?: number | null;
  minimumFareLak?: number | null;
  routes?: string[];
  bio?: string;
  coverUrl?: string;
  portraitUrl?: string;
  vehicleUrl?: string;
  verified: boolean;
  premium: boolean;
  active?: boolean;
  status?: string;
  walletBalanceLak?: number;
  walletLowBalanceWarningLak?: number;
  walletLowBalance?: boolean;
};

type Tour = {
  id: string;
  title: string;
  city: string;
  duration: string;
  priceLak: number;
  description: string;
  imageUrl?: string;
  driverId?: string;
  active?: boolean;
  featuredOnHome?: boolean;
  sortOrder?: number;
};


type DriverLedgerEntry = {
  id: string;
  driverId: string;
  bookingId?: string | null;
  type: string;
  amountLak: number;
  signedAmountLak: number;
  balanceAfterLak: number;
  note?: string;
  actorId?: string;
  createdAt?: string;
};
type Payment = {
  id?: string;
  bookingId: string;
  amountLak: number;
  method: string;
  status: string;
};

type Booking = {
  id: string;
  bookingType?: string;
  tourTitle?: string;
  driverId?: string | null;
  driverName?: string;
  customerName?: string;
  customerPhone?: string;
  customerWhatsapp?: string;
  customerEmail?: string;
  note?: string;
  pickup: string;
  dropoff: string;
  pickupAt?: string;
  distanceKm?: number;
  durationMinutes?: number;
  fareMode?: "FIXED" | "METER";
  passengers: number;
  status: string;
  estimatedPriceLak: number;
  cancelledAt?: string;
  cancelledBy?: string;
  cancellationReason?: string;
  payment?: Payment;
};

type MemberUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  role: string;
  status: string;
  provider?: string;
  customerRating?: number;
  customerReviewCount?: number;
  completedTrips?: number;
  completedBookings?: number;
  bookingCount?: number;
  activeBookings?: number;
  totalSpentLak?: number;
  createdAt?: string;
  lastLoginAt?: string;
  updatedAt?: string;
};

type Dashboard = {
  drivers: number;
  users: number;
  bookings: number;
  pendingBookings: number;
  completedBookings: number;
  revenueLak: number;
  paidRevenueLak: number;
  premiumDrivers: number;
};

type VehicleCategory = {
  id: string;
  code: string;
  name: string;
  nameLo: string;
  description?: string;
  capacity: number;
  ratePerKmLak: number;
  minimumFareLak: number;
  sortOrder: number;
  active?: boolean;
  visibleOnWeb?: boolean;
  default?: boolean;
};

type Pricing = {
  ratePerKmLak: number;
  minimumFareLak: number;
  meterBaseFareLak: number;
  meterIncludedKm: number;
  meterRatePerKmLak: number;
  meterRatePerMinuteLak: number;
  driverCommissionPercent: number;
  driverMinimumBalanceLak: number;
  driverLowBalanceWarningLak: number;
};

type AdminSection = "dashboard" | "users" | "drivers" | "finance" | "vehicles" | "places" | "tours" | "bookings" | "payments";

const bookingStatuses = ["PENDING", "OFFERED", "CONFIRMED", "ON_THE_WAY", "IN_PROGRESS", "COMPLETED", "CANCELLED"];
const paymentStatuses = ["PENDING", "PAID", "FAILED", "REFUNDED"];
const paymentMethods = ["CASH", "BANK_QR", "CARD", "USDT_TRC20", "USDT_BEP20"];
const adminSections: Array<{ id: AdminSection; label: string }> = [
  { id: "dashboard", label: "ໜ້າລວມ" },
  { id: "users", label: "ສະມາຊິກ" },
  { id: "drivers", label: "ຄົນຂັບ" },
  { id: "finance", label: "ການເງິນ" },
  { id: "vehicles", label: "ຫມວດລົດ" },
  { id: "places", label: "ສະຖານທີ່" },
  { id: "tours", label: "ທົວ" },
  { id: "bookings", label: "ການຈອງ" },
  { id: "payments", label: "ການຊຳລະ" }
];

export function AdminDashboard() {
  const apiUrl = getApiUrl();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [tours, setTours] = useState<Tour[]>([]);
  const [vehicleCategories, setVehicleCategories] = useState<VehicleCategory[]>([]);
  const [users, setUsers] = useState<MemberUser[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [pricing, setPricing] = useState<Pricing>({
    ratePerKmLak: 15000,
    minimumFareLak: 50000,
    meterBaseFareLak: 50000,
    meterIncludedKm: 2,
    meterRatePerKmLak: 15000,
    meterRatePerMinuteLak: 1000,
    driverCommissionPercent: 10,
    driverMinimumBalanceLak: 20000,
    driverLowBalanceWarningLak: 50000
  });
  const [activeSection, setActiveSection] = useState<AdminSection>("dashboard");
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTourId, setEditingTourId] = useState<string | null>(null);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const driverFormRef = useRef<HTMLFormElement | null>(null);
  const tourFormRef = useRef<HTMLFormElement | null>(null);
  const vehicleFormRef = useRef<HTMLFormElement | null>(null);
  const pricingFormRef = useRef<HTMLFormElement | null>(null);
  const [showDriverForm, setShowDriverForm] = useState(false);
  const [showTourForm, setShowTourForm] = useState(false);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [showPricingForm, setShowPricingForm] = useState(false);
  const [financeDriverId, setFinanceDriverId] = useState("");
  const [driverLedger, setDriverLedger] = useState<DriverLedgerEntry[]>([]);
  const [walletDirection, setWalletDirection] = useState<"CREDIT" | "DEBIT">("CREDIT");
  const [walletAmountLak, setWalletAmountLak] = useState("");
  const [walletNote, setWalletNote] = useState("");
  const [walletLoading, setWalletLoading] = useState(false);
  const [driverForm, setDriverForm] = useState({
    username: "",
    password: "",
    name: "",
    city: "Vientiane",
    languages: "Lao, English",
    vehicleType: "",
    startingPriceLak: "50000",
    ratePerKmLak: "",
    minimumFareLak: "",
    routes: "",
    bio: "",
    coverUrl: "",
    portraitUrl: "",
    vehicleUrl: "",
    verified: false,
    premium: false,
    active: true
  });
  const [vehicleForm, setVehicleForm] = useState({
    code: "",
    name: "",
    nameLo: "",
    description: "",
    capacity: "4",
    ratePerKmLak: "15000",
    minimumFareLak: "50000",
    sortOrder: "0",
    active: true,
    visibleOnWeb: true,
    default: false
  });
  const [tourForm, setTourForm] = useState({
    title: "",
    city: "Vientiane",
    duration: "1 day",
    priceLak: "850000",
    description: "",
    imageUrl: "",
    driverId: "",
    featuredOnHome: true,
    sortOrder: "0",
    active: true
  });
  const [pricingForm, setPricingForm] = useState({
    ratePerKmLak: "15000",
    minimumFareLak: "50000",
    meterBaseFareLak: "50000",
    meterIncludedKm: "2",
    meterRatePerKmLak: "15000",
    meterRatePerMinuteLak: "1000",
    driverCommissionPercent: "10",
    driverMinimumBalanceLak: "20000",
    driverLowBalanceWarningLak: "50000"
  });
  const [bookingForm, setBookingForm] = useState({
    customerName: "",
    customerPhone: "",
    customerWhatsapp: "",
    customerEmail: "",
    pickup: "",
    dropoff: "",
    pickupAt: "",
    passengers: "1",
    distanceKm: "5",
    driverId: "",
    note: ""
  });

  const pendingDrivers = useMemo(() => drivers.filter((driver) => !driver.verified), [drivers]);
  const suspendedUsers = useMemo(() => users.filter((user) => user.status === "SUSPENDED"), [users]);
  const financeDriver = useMemo(() => drivers.find((driver) => driver.id === financeDriverId) || drivers[0] || null, [drivers, financeDriverId]);
  const lowBalanceDrivers = useMemo(() => drivers.filter((driver) => driver.walletLowBalance), [drivers]);
  const totalDriverWalletLak = useMemo(() => drivers.reduce((total, driver) => total + Number(driver.walletBalanceLak || 0), 0), [drivers]);
  const ledgerCreditLak = useMemo(() => driverLedger.filter((entry) => entry.signedAmountLak > 0).reduce((total, entry) => total + Number(entry.amountLak || 0), 0), [driverLedger]);
  const ledgerDebitLak = useMemo(() => driverLedger.filter((entry) => entry.signedAmountLak < 0).reduce((total, entry) => total + Number(entry.amountLak || 0), 0), [driverLedger]);
  function authHeaders() {
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    };
  }

  async function readJson<T>(response: Response, fallback: T, label: string) {
    const data = await response.json().catch(() => fallback);
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem("taxilao_admin_token");
        setToken("");
        throw new Error("AUTH_EXPIRED");
      }
      const serverMessage = typeof data === "object" && data && "message" in data ? String(data.message) : response.statusText;
      throw new Error(`${label}: ${serverMessage}`);
    }
    return data;
  }

  function readImageFile(file: File) {
    return new Promise<string>((resolve, reject) => {
      if (!file.type.startsWith("image/")) {
        reject(new Error("ກະລຸນາເລືອກຟາຍຮູບເທົ່ານັ້ນ"));
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const image = document.createElement("img");
        image.onload = () => {
          const maxSize = 1600;
          const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.width * scale));
          canvas.height = Math.max(1, Math.round(image.height * scale));
          const context = canvas.getContext("2d");
          if (!context) {
            reject(new Error("ປັບຂະໜາດຮູບບໍ່ສຳເລັດ"));
            return;
          }

          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        };
        image.onerror = () => reject(new Error("ອ່ານຮູບບໍ່ສຳເລັດ"));
        image.src = String(reader.result);
      };
      reader.onerror = () => reject(new Error("ອ່ານຟາຍຮູບບໍ່ສຳເລັດ"));
      reader.readAsDataURL(file);
    });
  }

  async function setDriverImage(field: "coverUrl" | "portraitUrl" | "vehicleUrl", file?: File) {
    if (!file) return;
    try {
      const dataUrl = await readImageFile(file);
      setDriverForm((current) => ({ ...current, [field]: dataUrl }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ອັບໂຫຼດຮູບບໍ່ສຳເລັດ");
    }
  }

  async function setTourImage(file?: File) {
    if (!file) return;
    try {
      const dataUrl = await readImageFile(file);
      setTourForm((current) => ({ ...current, imageUrl: dataUrl }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ອັບໂຫຼດຮູບບໍ່ສຳເລັດ");
    }
  }

  async function loadData() {
    if (!token) return;
    setMessage("ກຳລັງໂຫຼດຂໍ້ມູນ...");

    try {
      const [dashboardRes, usersRes, driversRes, bookingsRes, paymentsRes, toursRes, vehicleCategoriesRes, pricingRes] = await Promise.all([
        fetch(`${apiUrl}/admin/dashboard`, { cache: "no-store", headers: authHeaders() }),
        fetch(`${apiUrl}/admin/users`, { cache: "no-store", headers: authHeaders() }),
        fetch(`${apiUrl}/admin/drivers`, { cache: "no-store", headers: authHeaders() }),
        fetch(`${apiUrl}/admin/bookings`, { cache: "no-store", headers: authHeaders() }),
        fetch(`${apiUrl}/admin/payments`, { cache: "no-store", headers: authHeaders() }),
        fetch(`${apiUrl}/admin/tours`, { cache: "no-store", headers: authHeaders() }),
        fetch(`${apiUrl}/admin/vehicle-categories`, { cache: "no-store", headers: authHeaders() }),
        fetch(`${apiUrl}/admin/pricing`, { cache: "no-store", headers: authHeaders() })
      ]);

      const dashboardData = await readJson<Dashboard | null>(dashboardRes, null, "dashboard");
      const usersData = await readJson<unknown>(usersRes, [], "users");
      const driversData = await readJson<unknown>(driversRes, [], "drivers");
      const bookingsData = await readJson<unknown>(bookingsRes, [], "bookings");
      const paymentsData = await readJson<unknown>(paymentsRes, [], "payments");
      const toursData = await readJson<unknown>(toursRes, [], "tours");
      const vehicleCategoriesData = await readJson<unknown>(vehicleCategoriesRes, [], "vehicle categories");
      const pricingData = await readJson<Pricing>(pricingRes, {
        ratePerKmLak: 15000, minimumFareLak: 50000, meterBaseFareLak: 50000,
        meterIncludedKm: 2, meterRatePerKmLak: 15000, meterRatePerMinuteLak: 1000,
        driverCommissionPercent: 10, driverMinimumBalanceLak: 20000, driverLowBalanceWarningLak: 50000
      }, "pricing");

      setDashboard(dashboardData);
      setUsers(Array.isArray(usersData) ? usersData : []);
      setDrivers(Array.isArray(driversData) ? driversData : []);
      setBookings(Array.isArray(bookingsData) ? bookingsData : []);
      setPayments(Array.isArray(paymentsData) ? paymentsData : []);
      setTours(Array.isArray(toursData) ? toursData : []);
      setVehicleCategories(Array.isArray(vehicleCategoriesData) ? vehicleCategoriesData : []);
      setPricing(pricingData);
      setPricingForm({
        ratePerKmLak: String(pricingData.ratePerKmLak ?? 15000),
        minimumFareLak: String(pricingData.minimumFareLak ?? 50000),
        meterBaseFareLak: String(pricingData.meterBaseFareLak ?? 50000),
        meterIncludedKm: String(pricingData.meterIncludedKm ?? 2),
        meterRatePerKmLak: String(pricingData.meterRatePerKmLak ?? 15000),
        meterRatePerMinuteLak: String(pricingData.meterRatePerMinuteLak ?? 1000),
        driverCommissionPercent: String(pricingData.driverCommissionPercent ?? 10),
        driverMinimumBalanceLak: String(pricingData.driverMinimumBalanceLak ?? 20000),
        driverLowBalanceWarningLak: String(pricingData.driverLowBalanceWarningLak ?? 50000)
      });
      setMessage("ໂຫຼດຂໍ້ມູນສຳເລັດ");
    } catch (error) {
      setDashboard(null);
      setUsers([]);
      setDrivers([]);
      setBookings([]);
      setPayments([]);
      setTours([]);
      setVehicleCategories([]);
      if (error instanceof Error && error.message === "AUTH_EXPIRED") {
        setMessage("Session ໝົດອາຍຸ ກະລຸນາເຂົ້າລະບົບໃໝ່");
      } else {
        setMessage(error instanceof Error ? `ໂຫຼດບໍ່ສຳເລັດ: ${error.message}` : "ໂຫຼດຂໍ້ມູນບໍ່ສຳເລັດ");
      }
    }
  }

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("ກຳລັງເຂົ້າລະບົບ...");

    try {
      const response = await fetch(`${apiUrl}/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const data = await readJson<{ token: string }>(response, { token: "" }, "login");
      localStorage.setItem("taxilao_admin_token", data.token);
      setToken(data.token);
      setPassword("");
      setMessage("ເຂົ້າລະບົບສຳເລັດ");
    } catch (error) {
      setMessage(error instanceof Error ? `ເຂົ້າລະບົບບໍ່ສຳເລັດ: ${error.message}` : "ເຂົ້າລະບົບບໍ່ສຳເລັດ");
    }
  }

  function logout() {
    localStorage.removeItem("taxilao_admin_token");
    setToken("");
    setUsers([]);
    setDrivers([]);
    setBookings([]);
    setPayments([]);
    setTours([]);
    setVehicleCategories([]);
    setDashboard(null);
    setPricing({
      ratePerKmLak: 15000, minimumFareLak: 50000, meterBaseFareLak: 50000,
      meterIncludedKm: 2, meterRatePerKmLak: 15000, meterRatePerMinuteLak: 1000,
      driverCommissionPercent: 10, driverMinimumBalanceLak: 20000, driverLowBalanceWarningLak: 50000
    });
  }

  async function updateUserStatus(userId: string, status: "ACTIVE" | "SUSPENDED") {
    try {
      const response = await fetch(`${apiUrl}/admin/users/${userId}/status`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ status })
      });
      await readJson(response, null, "user status update");
      await loadData();
      setMessage(status === "ACTIVE" ? "ເປີດບັນຊີສະມາຊິກສຳເລັດ" : "ປິດບັນຊີສະມາຊິກສຳເລັດ");
    } catch (error) {
      setMessage(error instanceof Error ? `ອັບເດດບັນຊີບໍ່ສຳເລັດ: ${error.message}` : "ອັບເດດບັນຊີບໍ່ສຳເລັດ");
    }
  }
  function resetDriverForm() {
    setEditingId(null);
    setDriverForm({
      username: "",
      password: "",
      name: "",
      city: "Vientiane",
      languages: "Lao, English",
      vehicleType: "",
      startingPriceLak: "50000",
      ratePerKmLak: "",
      minimumFareLak: "",
      routes: "",
      bio: "",
      coverUrl: "",
      portraitUrl: "",
      vehicleUrl: "",
      verified: false,
      premium: false,
      active: true
    });
  }

  function startCreateDriver() {
    resetDriverForm();
    setActiveSection("drivers");
    setShowDriverForm(true);
    window.setTimeout(() => driverFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function editDriver(driver: Driver) {
    setEditingId(driver.id);
    setActiveSection("drivers");
    setShowDriverForm(true);
    setDriverForm({
      username: driver.username ?? driver.id,
      password: "",
      name: driver.name,
      city: driver.city,
      languages: (driver.languages ?? []).join(", "),
      vehicleType: driver.vehicleType,
      startingPriceLak: String(driver.startingPriceLak ?? 50000),
      ratePerKmLak: driver.ratePerKmLak ? String(driver.ratePerKmLak) : "",
      minimumFareLak: driver.minimumFareLak ? String(driver.minimumFareLak) : "",
      routes: (driver.routes ?? []).join(", "),
      bio: driver.bio ?? "",
      coverUrl: driver.coverUrl ?? "",
      portraitUrl: driver.portraitUrl ?? "",
      vehicleUrl: driver.vehicleUrl ?? "",
      verified: driver.verified,
      premium: driver.premium,
      active: driver.active !== false
    });
    setMessage(`ກຳລັງແກ້ໄຂຄົນຂັບ: ${driver.name}`);
    window.setTimeout(() => driverFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  async function saveDriver(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = {
      username: driverForm.username,
      ...(driverForm.password ? { password: driverForm.password } : {}),
      name: driverForm.name,
      city: driverForm.city,
      languages: driverForm.languages.split(",").map((item) => item.trim()).filter(Boolean),
      vehicleType: driverForm.vehicleType,
      startingPriceLak: Number(driverForm.startingPriceLak || 50000),
      ratePerKmLak: driverForm.ratePerKmLak ? Number(driverForm.ratePerKmLak) : null,
      minimumFareLak: driverForm.minimumFareLak ? Number(driverForm.minimumFareLak) : null,
      routes: driverForm.routes.split(",").map((item) => item.trim()).filter(Boolean),
      bio: driverForm.bio,
      coverUrl: driverForm.coverUrl,
      portraitUrl: driverForm.portraitUrl,
      vehicleUrl: driverForm.vehicleUrl,
      verified: driverForm.verified,
      premium: driverForm.premium,
      active: driverForm.active
    };

    try {
      const response = await fetch(editingId ? `${apiUrl}/admin/drivers/${editingId}` : `${apiUrl}/admin/drivers`, {
        method: editingId ? "PATCH" : "POST",
        headers: authHeaders(),
        body: JSON.stringify(body)
      });
      await readJson(response, null, "save driver");
      resetDriverForm();
      setShowDriverForm(false);
      await loadData();
      setMessage("ບັນທຶກຄົນຂັບສຳເລັດ");
    } catch (error) {
      setMessage(error instanceof Error ? `ບັນທຶກຄົນຂັບບໍ່ສຳເລັດ: ${error.message}` : "ບັນທຶກຄົນຂັບບໍ່ສຳເລັດ");
    }
  }

  async function updateDriver(id: string, action: "verify" | "premium") {
    try {
      const response = await fetch(`${apiUrl}/admin/drivers/${id}/${action}`, { method: "PATCH", headers: authHeaders() });
      await readJson(response, null, action);
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? `ອັບເດດບໍ່ສຳເລັດ: ${error.message}` : "ອັບເດດບໍ່ສຳເລັດ");
    }
  }

  async function disableDriver(id: string) {
    try {
      const response = await fetch(`${apiUrl}/admin/drivers/${id}`, { method: "DELETE", headers: authHeaders() });
      await readJson(response, null, "disable driver");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? `ປິດຄົນຂັບບໍ່ສຳເລັດ: ${error.message}` : "ປິດຄົນຂັບບໍ່ສຳເລັດ");
    }
  }


  async function loadDriverLedger(driverId: string) {
    if (!driverId) return;
    setWalletLoading(true);
    try {
      const response = await fetch(`${apiUrl}/admin/drivers/${driverId}/wallet`, { cache: "no-store", headers: authHeaders() });
      const data = await readJson<{ ledger?: DriverLedgerEntry[] }>(response, { ledger: [] }, "driver wallet");
      setDriverLedger(Array.isArray(data.ledger) ? data.ledger : []);
    } catch (error) {
      setDriverLedger([]);
      setMessage(error instanceof Error ? `ໂຫຼດບັນຊີ wallet ບໍ່ສຳເລັດ: ${error.message}` : "ໂຫຼດບັນຊີ wallet ບໍ່ສຳເລັດ");
    } finally {
      setWalletLoading(false);
    }
  }

  function openDriverFinance(driver: Driver, direction: "CREDIT" | "DEBIT" = "CREDIT") {
    setFinanceDriverId(driver.id);
    setWalletDirection(direction);
    setWalletAmountLak("");
    setWalletNote("");
    setActiveSection("finance");
    void loadDriverLedger(driver.id);
  }

  async function submitWalletAdjustment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const driver = financeDriver;
    if (!driver) {
      setMessage("ກະລຸນາເລືອກຄົນຂັບກ່ອນ");
      return;
    }
    const amountLak = Number(walletAmountLak.replace(/[,\s]/g, ""));
    if (!Number.isFinite(amountLak) || amountLak <= 0) {
      setMessage("ຈຳນວນເງິນ wallet ບໍ່ຖືກຕ້ອງ");
      return;
    }
    if (!walletNote.trim() || walletNote.trim().length < 3) {
      setMessage("ກະລຸນາໃສ່ note ສຳລັບ audit ຢ່າງໜ້ອຍ 3 ຕົວອັກສອນ");
      return;
    }

    setWalletLoading(true);
    try {
      const response = await fetch(`${apiUrl}/admin/drivers/${driver.id}/wallet`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ direction: walletDirection, amountLak, note: walletNote.trim() })
      });
      await readJson(response, null, "adjust driver wallet");
      setWalletAmountLak("");
      setWalletNote("");
      await Promise.all([loadData(), loadDriverLedger(driver.id)]);
      setMessage(`${walletDirection === "CREDIT" ? "ເຕີມ" : "ຫັກ"} wallet ສຳເລັດ: ${driver.name}`);
    } catch (error) {
      setMessage(error instanceof Error ? `ປັບ wallet ບໍ່ສຳເລັດ: ${error.message}` : "ປັບ wallet ບໍ່ສຳເລັດ");
    } finally {
      setWalletLoading(false);
    }
  }
  async function adjustDriverWallet(driver: Driver, direction: "CREDIT" | "DEBIT") {
    openDriverFinance(driver, direction);
  }

  function resetVehicleForm() {
    setEditingVehicleId(null);
    setVehicleForm({
      code: "",
      name: "",
      nameLo: "",
      description: "",
      capacity: "4",
      ratePerKmLak: "15000",
      minimumFareLak: "50000",
      sortOrder: "0",
      active: true,
      visibleOnWeb: true,
      default: false
    });
  }

  function startCreateVehicleCategory() {
    resetVehicleForm();
    setActiveSection("vehicles");
    setShowVehicleForm(true);
    window.setTimeout(() => vehicleFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function editVehicleCategory(category: VehicleCategory) {
    setEditingVehicleId(category.id);
    setActiveSection("vehicles");
    setShowVehicleForm(true);
    setVehicleForm({
      code: category.code || "",
      name: category.name || "",
      nameLo: category.nameLo || category.name || "",
      description: category.description || "",
      capacity: String(category.capacity ?? 1),
      ratePerKmLak: String(category.ratePerKmLak ?? 15000),
      minimumFareLak: String(category.minimumFareLak ?? 50000),
      sortOrder: String(category.sortOrder ?? 0),
      active: category.active !== false,
      visibleOnWeb: category.visibleOnWeb !== false,
      default: Boolean(category.default)
    });
    window.setTimeout(() => vehicleFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  async function saveVehicleCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = {
      code: vehicleForm.code,
      name: vehicleForm.name,
      nameLo: vehicleForm.nameLo,
      description: vehicleForm.description,
      capacity: Number(vehicleForm.capacity || 1),
      ratePerKmLak: Number(vehicleForm.ratePerKmLak || 15000),
      minimumFareLak: Number(vehicleForm.minimumFareLak || 50000),
      sortOrder: Number(vehicleForm.sortOrder || 0),
      active: vehicleForm.active,
      visibleOnWeb: vehicleForm.visibleOnWeb,
      default: vehicleForm.default
    };

    try {
      const response = await fetch(editingVehicleId ? `${apiUrl}/admin/vehicle-categories/${editingVehicleId}` : `${apiUrl}/admin/vehicle-categories`, {
        method: editingVehicleId ? "PATCH" : "POST",
        headers: authHeaders(),
        body: JSON.stringify(body)
      });
      await readJson(response, null, "save vehicle category");
      resetVehicleForm();
      setShowVehicleForm(false);
      await loadData();
      setMessage("ບັນທຶກຫມວດລົດສຳເລັດ");
    } catch (error) {
      setMessage(error instanceof Error ? `ບັນທຶກຫມວດລົດບໍ່ສຳເລັດ: ${error.message}` : "ບັນທຶກຫມວດລົດບໍ່ສຳເລັດ");
    }
  }

  async function disableVehicleCategory(id: string) {
    try {
      const response = await fetch(`${apiUrl}/admin/vehicle-categories/${id}`, { method: "DELETE", headers: authHeaders() });
      await readJson(response, null, "disable vehicle category");
      await loadData();
      setMessage("ປິດຫມວດລົດສຳເລັດ");
    } catch (error) {
      setMessage(error instanceof Error ? `ປິດຫມວດລົດບໍ່ສຳເລັດ: ${error.message}` : "ປິດຫມວດລົດບໍ່ສຳເລັດ");
    }
  }
  function resetTourForm() {
    setEditingTourId(null);
    setTourForm({
      title: "",
      city: "Vientiane",
      duration: "1 day",
      priceLak: "850000",
      description: "",
      imageUrl: "",
      driverId: "",
      featuredOnHome: true,
      sortOrder: "0",
      active: true
    });
  }

  function startCreateTour() {
    resetTourForm();
    setActiveSection("tours");
    setShowTourForm(true);
    window.setTimeout(() => tourFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  function editTour(tour: Tour) {
    setEditingTourId(tour.id);
    setActiveSection("tours");
    setShowTourForm(true);
    setTourForm({
      title: tour.title,
      city: tour.city,
      duration: tour.duration,
      priceLak: String(tour.priceLak ?? 850000),
      description: tour.description,
      imageUrl: tour.imageUrl ?? "",
      driverId: tour.driverId ?? "",
      featuredOnHome: tour.featuredOnHome !== false,
      sortOrder: String(tour.sortOrder ?? 0),
      active: tour.active !== false
    });
  }

  async function saveTour(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = {
      title: tourForm.title,
      city: tourForm.city,
      duration: tourForm.duration,
      priceLak: Number(tourForm.priceLak || 0),
      description: tourForm.description,
      imageUrl: tourForm.imageUrl,
      driverId: tourForm.driverId,
      featuredOnHome: tourForm.featuredOnHome,
      sortOrder: Number(tourForm.sortOrder || 0),
      active: tourForm.active
    };

    try {
      const response = await fetch(editingTourId ? `${apiUrl}/admin/tours/${editingTourId}` : `${apiUrl}/admin/tours`, {
        method: editingTourId ? "PATCH" : "POST",
        headers: authHeaders(),
        body: JSON.stringify(body)
      });
      await readJson(response, null, "save tour");
      resetTourForm();
      setShowTourForm(false);
      await loadData();
      setMessage("ບັນທຶກແພັກເກດທົວສຳເລັດ");
    } catch (error) {
      setMessage(error instanceof Error ? `ບັນທຶກແພັກເກດທົວບໍ່ສຳເລັດ: ${error.message}` : "ບັນທຶກແພັກເກດທົວບໍ່ສຳເລັດ");
    }
  }

  async function disableTour(id: string) {
    try {
      const response = await fetch(`${apiUrl}/admin/tours/${id}`, { method: "DELETE", headers: authHeaders() });
      await readJson(response, null, "disable tour");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? `ປິດແພັກເກດທົວບໍ່ສຳເລັດ: ${error.message}` : "ປິດແພັກເກດທົວບໍ່ສຳເລັດ");
    }
  }

  async function savePricing(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const response = await fetch(`${apiUrl}/admin/pricing`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({
          ratePerKmLak: Number(pricingForm.ratePerKmLak || 15000),
          minimumFareLak: Number(pricingForm.minimumFareLak || 50000),
          meterBaseFareLak: Number(pricingForm.meterBaseFareLak || 50000),
          meterIncludedKm: Number(pricingForm.meterIncludedKm || 2),
          meterRatePerKmLak: Number(pricingForm.meterRatePerKmLak || 15000),
          meterRatePerMinuteLak: Number(pricingForm.meterRatePerMinuteLak || 1000),
          driverCommissionPercent: Number(pricingForm.driverCommissionPercent || 10),
          driverMinimumBalanceLak: Number(pricingForm.driverMinimumBalanceLak || 20000),
          driverLowBalanceWarningLak: Number(pricingForm.driverLowBalanceWarningLak || 50000)
        })
      });
      const data = await readJson<Pricing>(response, {
        ratePerKmLak: 15000, minimumFareLak: 50000, meterBaseFareLak: 50000,
        meterIncludedKm: 2, meterRatePerKmLak: 15000, meterRatePerMinuteLak: 1000,
        driverCommissionPercent: 10, driverMinimumBalanceLak: 20000, driverLowBalanceWarningLak: 50000
      }, "save pricing");
      setPricing(data);
      setPricingForm({
        ratePerKmLak: String(data.ratePerKmLak),
        minimumFareLak: String(data.minimumFareLak),
        meterBaseFareLak: String(data.meterBaseFareLak),
        meterIncludedKm: String(data.meterIncludedKm),
        meterRatePerKmLak: String(data.meterRatePerKmLak),
        meterRatePerMinuteLak: String(data.meterRatePerMinuteLak),
        driverCommissionPercent: String(data.driverCommissionPercent),
        driverMinimumBalanceLak: String(data.driverMinimumBalanceLak),
        driverLowBalanceWarningLak: String(data.driverLowBalanceWarningLak)
      });
      setShowPricingForm(false);
      await loadData();
      setMessage("ບັນທຶກລາຄາລວມສຳເລັດ");
    } catch (error) {
      setMessage(error instanceof Error ? `ບັນທຶກລາຄາບໍ່ສຳເລັດ: ${error.message}` : "ບັນທຶກລາຄາບໍ່ສຳເລັດ");
    }
  }

  function editBooking(booking: Booking) {
    setEditingBookingId(booking.id);
    setActiveSection("bookings");
    setBookingForm({
      customerName: booking.customerName ?? "",
      customerPhone: booking.customerPhone ?? "",
      customerWhatsapp: booking.customerWhatsapp ?? "",
      customerEmail: booking.customerEmail ?? "",
      pickup: booking.pickup,
      dropoff: booking.dropoff,
      pickupAt: booking.pickupAt ? new Date(booking.pickupAt).toISOString().slice(0, 16) : "",
      passengers: String(booking.passengers ?? 1),
      distanceKm: String(booking.distanceKm ?? 5),
      driverId: booking.driverId ?? "",
      note: booking.note ?? ""
    });
  }

  function resetBookingForm() {
    setEditingBookingId(null);
    setBookingForm({
      customerName: "",
      customerPhone: "",
      customerWhatsapp: "",
      customerEmail: "",
      pickup: "",
      dropoff: "",
      pickupAt: "",
      passengers: "1",
      distanceKm: "5",
      driverId: "",
      note: ""
    });
  }

  async function saveBooking(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingBookingId) return;

    try {
      const response = await fetch(`${apiUrl}/admin/bookings/${editingBookingId}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({
          ...bookingForm,
          passengers: Number(bookingForm.passengers || 1),
          distanceKm: Number(bookingForm.distanceKm || 1),
          pickupAt: bookingForm.pickupAt ? new Date(bookingForm.pickupAt).toISOString() : undefined
        })
      });
      await readJson(response, null, "save booking");
      resetBookingForm();
      await loadData();
      setMessage("ບັນທຶກການຈອງສຳເລັດ");
    } catch (error) {
      setMessage(error instanceof Error ? `ບັນທຶກການຈອງບໍ່ສຳເລັດ: ${error.message}` : "ບັນທຶກການຈອງບໍ່ສຳເລັດ");
    }
  }

  async function updateBooking(id: string, body: Record<string, unknown>) {
    try {
      const response = await fetch(`${apiUrl}/admin/bookings/${id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(body)
      });
      await readJson(response, null, "booking update");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? `ອັບເດດການຈອງບໍ່ສຳເລັດ: ${error.message}` : "ອັບເດດການຈອງບໍ່ສຳເລັດ");
    }
  }

  async function cancelBooking(id: string) {
    const reason = window.prompt("Cancel reason", "Admin cancelled stuck booking");
    if (reason === null) return;
    try {
      const response = await fetch(`${apiUrl}/admin/bookings/${id}/status`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ status: "CANCELLED", reason: reason.trim() || "Admin cancelled stuck booking" })
      });
      await readJson(response, null, "cancel booking");
      await loadData();
      setMessage("Booking cancelled");
    } catch (error) {
      setMessage(error instanceof Error ? `Cancel booking failed: ${error.message}` : "Cancel booking failed");
    }
  }

  async function updatePayment(id: string | undefined, body: Record<string, unknown>) {
    if (!id) return;
    try {
      const response = await fetch(`${apiUrl}/admin/payments/${id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(body)
      });
      await readJson(response, null, "payment update");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? `ອັບເດດການຊຳລະບໍ່ສຳເລັດ: ${error.message}` : "ອັບເດດການຊຳລະບໍ່ສຳເລັດ");
    }
  }

  useEffect(() => {
    const savedToken = localStorage.getItem("taxilao_admin_token");
    if (savedToken) setToken(savedToken);
  }, []);

  useEffect(() => {
    loadData();
  }, [token]);
  useEffect(() => {
    if (token && activeSection === "finance" && financeDriver?.id) {
      void loadDriverLedger(financeDriver.id);
    }
  }, [token, activeSection, financeDriver?.id]);

  if (!token) {
    return (
      <main className="login-screen">
        <form className="login-panel" onSubmit={login}>
          <div className="brand">
            <span className="brand-mark">TL</span>
            <span>ຫຼັງບ້ານ TAXILAO</span>
          </div>
          <h1>ເຂົ້າລະບົບ Admin</h1>
          <label htmlFor="adminPassword">ລະຫັດຜ່ານ</label>
          <input id="adminPassword" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          <button className="btn btn-primary" type="submit">ເຂົ້າລະບົບ</button>
          {message ? <p className="admin-message">{message}</p> : null}
        </form>
      </main>
    );
  }

  return (
    <main className="admin-layout">
      <aside className="admin-sidebar">
        <div className="brand">
          <span className="brand-mark">TL</span>
          <span>ຫຼັງບ້ານ</span>
        </div>
        <div className="grid" style={{ marginTop: 28 }}>
          {adminSections.map((section) => (
            <button
              className={activeSection === section.id ? "btn sidebar-btn active" : "btn sidebar-btn"}
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              type="button"
            >
              {section.label}
            </button>
          ))}
        </div>
      </aside>

      <section className="admin-main">
        <p className="eyebrow">ລະບົບຫຼັງບ້ານ</p>
        <h1 style={{ fontSize: "clamp(32px, 5vw, 56px)", marginBottom: 24 }}>ສູນຄວບຄຸມ TAXILAO</h1>
        <button className="btn btn-primary" onClick={loadData} type="button">
          <RefreshCcw size={16} /> ໂຫຼດໃໝ່
        </button>
        <button className="btn admin-logout" onClick={logout} type="button">
          <LogOut size={16} /> ອອກຈາກລະບົບ
        </button>
        {message ? <p className="admin-message">{message}</p> : null}

        {activeSection === "dashboard" ? (
        <>
        <div className="stat-grid" id="dashboard">
          <Stat label="ຄົນຂັບທັງໝົດ" value={(dashboard?.drivers ?? drivers.length).toString()} icon={<UsersRound />} />
          <Stat label="ການຈອງທັງໝົດ" value={(dashboard?.bookings ?? bookings.length).toString()} icon={<CalendarDays />} />
          <Stat label="ລໍຖ້າດຳເນີນການ" value={(dashboard?.pendingBookings ?? 0).toString()} icon={<CalendarDays />} />
          <Stat label="ລາຍຮັບທີ່ຊຳລະແລ້ວ" value={formatLak(dashboard?.paidRevenueLak ?? 0)} icon={<Banknote />} />
          <Stat label="ລາຍຮັບປະເມີນ" value={formatLak(dashboard?.revenueLak ?? 0)} icon={<Banknote />} />
          <Stat label="ຄົນຂັບພຣີມຽມ" value={(dashboard?.premiumDrivers ?? 0).toString()} icon={<Crown />} />
        </div>
        </>
        ) : null}


        {activeSection === "vehicles" ? (
        <>
        <h2 id="vehicles">ຈັດການຫມວດລົດ</h2>
        <div className="admin-actionbar">
          <div>
            <strong>Vehicle Categories</strong>
            <p>ກຳນົດປະເພດລົດ, ລາຄາຕໍ່ km, ລາຄາຂັ້ນຕ່ຳ ແລະການສະແດງຝັ່ງລູກຄ້າ.</p>
          </div>
          <div className="table-actions">
            <button className="btn btn-primary" onClick={startCreateVehicleCategory} type="button"><Plus size={16} /> ເພີ່ມຫມວດລົດ</button>
          </div>
        </div>

        {showVehicleForm ? (
          <form className="admin-form compact-form" onSubmit={saveVehicleCategory} ref={vehicleFormRef}>
            <h3>{editingVehicleId ? "ແກ້ໄຂຫມວດລົດ" : "ເພີ່ມຫມວດລົດ"}</h3>
            <div className="form-grid two-col">
              <label>Code<input value={vehicleForm.code} onChange={(event) => setVehicleForm({ ...vehicleForm, code: event.target.value })} placeholder="suv" required /></label>
              <label>ຊື່ສາກົນ<input value={vehicleForm.name} onChange={(event) => setVehicleForm({ ...vehicleForm, name: event.target.value })} placeholder="SUV" required /></label>
              <label>ຊື່ພາສາລາວ<input value={vehicleForm.nameLo} onChange={(event) => setVehicleForm({ ...vehicleForm, nameLo: event.target.value })} placeholder="ລົດ SUV" required /></label>
              <label>ຈຳນວນບ່ອນນັ່ງ<input type="number" min="1" value={vehicleForm.capacity} onChange={(event) => setVehicleForm({ ...vehicleForm, capacity: event.target.value })} required /></label>
              <label>ລາຄາຕໍ່ km (LAK)<input type="number" min="1" value={vehicleForm.ratePerKmLak} onChange={(event) => setVehicleForm({ ...vehicleForm, ratePerKmLak: event.target.value })} required /></label>
              <label>ລາຄາຂັ້ນຕ່ຳ (LAK)<input type="number" min="1" value={vehicleForm.minimumFareLak} onChange={(event) => setVehicleForm({ ...vehicleForm, minimumFareLak: event.target.value })} required /></label>
              <label>ລຳດັບສະແດງ<input type="number" value={vehicleForm.sortOrder} onChange={(event) => setVehicleForm({ ...vehicleForm, sortOrder: event.target.value })} /></label>
              <label>ຄຳອະທິບາຍ<textarea value={vehicleForm.description} onChange={(event) => setVehicleForm({ ...vehicleForm, description: event.target.value })} /></label>
            </div>
            <div className="check-row">
              <label><input type="checkbox" checked={vehicleForm.active} onChange={(event) => setVehicleForm({ ...vehicleForm, active: event.target.checked })} /> ເປີດໃຊ້ງານ</label>
              <label><input type="checkbox" checked={vehicleForm.visibleOnWeb} onChange={(event) => setVehicleForm({ ...vehicleForm, visibleOnWeb: event.target.checked })} /> ສະແດງຝັ່ງລູກຄ້າ</label>
              <label><input type="checkbox" checked={vehicleForm.default} onChange={(event) => setVehicleForm({ ...vehicleForm, default: event.target.checked })} /> ຕັ້ງເປັນ default</label>
            </div>
            <div className="table-actions">
              <button className="btn btn-primary" type="submit"><Save size={16} /> ບັນທຶກ</button>
              <button className="btn" onClick={resetVehicleForm} type="button"><Plus size={16} /> ຟອມໃໝ່</button>
              <button className="btn" onClick={() => { resetVehicleForm(); setShowVehicleForm(false); }} type="button"><X size={16} /> ປິດ</button>
            </div>
          </form>
        ) : null}

        <div className="table-wrap">
          <table className="table compact-table">
            <thead>
              <tr>
                <th>ຫມວດລົດ</th>
                <th>ລາຄາ</th>
                <th>ບ່ອນນັ່ງ</th>
                <th>ສະຖານະ</th>
                <th>ຈັດການ</th>
              </tr>
            </thead>
            <tbody>
              {vehicleCategories.map((category) => (
                <tr key={category.id}>
                  <td>
                    <div className="driver-cell">
                      <span className="driver-avatar placeholder"><Car size={18} /></span>
                      <div>
                        <strong>{category.nameLo || category.name}</strong>
                        <span>{category.code} · {category.name}</span>
                        {category.description ? <span className="muted-block">{category.description}</span> : null}
                      </div>
                    </div>
                  </td>
                  <td><strong>{formatLak(category.minimumFareLak)}</strong><span className="muted-block">{formatLak(category.ratePerKmLak)} / km</span></td>
                  <td>{category.capacity}</td>
                  <td>
                    <span className={category.active !== false && category.visibleOnWeb !== false ? "status-pill approved" : "status-pill muted"}>{category.active !== false && category.visibleOnWeb !== false ? "ເປີດສະແດງ" : "ປິດ"}</span>
                    {category.default ? <span className="status-pill premium">Default</span> : null}
                  </td>
                  <td>
                    <div className="table-actions mini-actions">
                      <button className="btn" onClick={() => editVehicleCategory(category)} type="button"><Edit size={14} /> ແກ້ໄຂ</button>
                      <button className="btn danger" onClick={() => disableVehicleCategory(category.id)} type="button"><Ban size={14} /> ປິດ</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
        ) : null}
        {activeSection === "users" ? (
        <>
        <h2 id="users">ຈັດການສະມາຊິກ</h2>
        <div className="admin-actionbar">
          <div>
            <strong>Member Accounts</strong>
            <p>ກວດສອບບັນຊີລູກຄ້າ, ສະຖານະ, ອໍເດີ້, ຄະແນນ ແລະຍອດໃຊ້ຈ່າຍ.</p>
          </div>
          <div className="table-actions">
            <span className="admin-kpi-chip"><UsersRound size={15} /> {users.length} ບັນຊີ</span>
            <span className="admin-kpi-chip danger-soft"><ShieldAlert size={15} /> {suspendedUsers.length} ຖືກປິດ</span>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table compact-table admin-users-table">
            <thead>
              <tr>
                <th>ສະມາຊິກ</th>
                <th>ສະຖິຕິການໃຊ້ງານ</th>
                <th>ຄະແນນ</th>
                <th>ສະຖານະ</th>
                <th>ເຂົ້າລະບົບຫຼ້າສຸດ</th>
                <th>ຈັດການ</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="driver-cell">
                      {user.avatarUrl ? <img className="driver-avatar" src={user.avatarUrl} alt={user.name || user.email} /> : <span className="driver-avatar placeholder"><UserRound size={18} /></span>}
                      <div>
                        <strong>{user.name || "ບໍ່ມີຊື່"}</strong>
                        <span>{user.email}</span>
                        <span className="muted-block">ID: {user.id}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <strong>{user.bookingCount ?? 0} ອໍເດີ້</strong>
                    <span className="muted-block">ກຳລັງໃຊ້ງານ {user.activeBookings ?? 0} · ສຳເລັດ {user.completedTrips ?? user.completedBookings ?? 0}</span>
                    <span className="muted-block">ຍອດໃຊ້ຈ່າຍ {formatLak(user.totalSpentLak ?? 0)}</span>
                  </td>
                  <td>
                    <strong>{Number(user.customerRating ?? 5).toFixed(1)} / 5</strong>
                    <span className="muted-block">{user.customerReviewCount ?? 0} ຣີວິວ</span>
                  </td>
                  <td>
                    <span className={user.status === "SUSPENDED" ? "status-pill muted" : "status-pill approved"}>{user.status === "SUSPENDED" ? "ປິດບັນຊີ" : "ເປີດໃຊ້ງານ"}</span>
                    <span className="muted-block">{user.provider === "google" ? "Google" : user.provider || "Member"}</span>
                  </td>
                  <td>{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("lo-LA") : "ຍັງບໍ່ມີ"}</td>
                  <td>
                    <div className="table-actions mini-actions">
                      {user.status === "SUSPENDED" ? (
                        <button className="btn" onClick={() => updateUserStatus(user.id, "ACTIVE")} type="button"><BadgeCheck size={14} /> ເປີດ</button>
                      ) : (
                        <button className="btn danger" onClick={() => updateUserStatus(user.id, "SUSPENDED")} type="button"><Ban size={14} /> ປິດ</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
        ) : null}
        {activeSection === "drivers" ? (
        <>
        <h2 id="drivers">ຈັດການຄົນຂັບ</h2>
        {pendingDrivers.length ? <p className="admin-message">ມີຄົນຂັບລໍຖ້າອະນຸມັດ {pendingDrivers.length} ຄົນ</p> : null}

        <div className="admin-actionbar">
          <div>
            <strong>Driver Operations</strong>
            <p>ລາຄາລວມ: {formatLak(pricing.minimumFareLak)} ຂັ້ນຕ່ຳ / {formatLak(pricing.ratePerKmLak)} ຕໍ່ km</p>
          </div>
          <div className="table-actions">
            <button className="btn btn-primary" onClick={startCreateDriver} type="button"><Plus size={16} /> ເພີ່ມຄົນຂັບ</button>
            <button className="btn" onClick={startCreateTour} type="button"><Plus size={16} /> ເພີ່ມທົວ</button>
            <button className="btn" onClick={() => {
              setShowPricingForm(true);
              window.setTimeout(() => pricingFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
            }} type="button"><Settings size={16} /> ແກ້ລາຄາລວມ</button>
          </div>
        </div>

        {showPricingForm ? (
          <form className="admin-form compact-form" onSubmit={savePricing} ref={pricingFormRef}>
            <h3>ແກ້ໄຂລາຄາລວມ</h3>
            <div className="form-grid two-col">
              <label>ລາຄາຕໍ່ km (LAK)<input type="number" min="1" value={pricingForm.ratePerKmLak} onChange={(event) => setPricingForm({ ...pricingForm, ratePerKmLak: event.target.value })} required /></label>
              <label>ລາຄາຂັ້ນຕ່ຳ (LAK)<input type="number" min="1" value={pricingForm.minimumFareLak} onChange={(event) => setPricingForm({ ...pricingForm, minimumFareLak: event.target.value })} required /></label>
              <label>Meter: ລາຄາເລີ່ມຕົ້ນ (LAK)<input type="number" min="1" value={pricingForm.meterBaseFareLak} onChange={(event) => setPricingForm({ ...pricingForm, meterBaseFareLak: event.target.value })} required /></label>
              <label>Meter: ລວມກິໂລທຳອິດ<input type="number" min="0" step="0.1" value={pricingForm.meterIncludedKm} onChange={(event) => setPricingForm({ ...pricingForm, meterIncludedKm: event.target.value })} required /></label>
              <label>Meter: ລາຄາຕໍ່ km (LAK)<input type="number" min="0" value={pricingForm.meterRatePerKmLak} onChange={(event) => setPricingForm({ ...pricingForm, meterRatePerKmLak: event.target.value })} required /></label>
              <label>Meter: ລາຄາຕໍ່ນາທີ (LAK)<input type="number" min="0" value={pricingForm.meterRatePerMinuteLak} onChange={(event) => setPricingForm({ ...pricingForm, meterRatePerMinuteLak: event.target.value })} required /></label>
              <label>Commission ຄົນຂັບ (%)<input type="number" min="0" max="100" step="0.1" value={pricingForm.driverCommissionPercent} onChange={(event) => setPricingForm({ ...pricingForm, driverCommissionPercent: event.target.value })} required /></label>
              <label>ຍອດຕ່ຳສຸດກ່ອນຮັບງານ (LAK)<input type="number" min="0" value={pricingForm.driverMinimumBalanceLak} onChange={(event) => setPricingForm({ ...pricingForm, driverMinimumBalanceLak: event.target.value })} required /></label>
              <label>ເຕືອນເງິນໃກ້ໝົດ (LAK)<input type="number" min="0" value={pricingForm.driverLowBalanceWarningLak} onChange={(event) => setPricingForm({ ...pricingForm, driverLowBalanceWarningLak: event.target.value })} required /></label>
            </div>
            <div className="table-actions">
              <button className="btn btn-primary" type="submit"><Save size={16} /> ບັນທຶກລາຄາ</button>
              <button className="btn" onClick={() => setShowPricingForm(false)} type="button"><X size={16} /> ປິດ</button>
            </div>
          </form>
        ) : null}

        {showDriverForm ? (
        <form className="admin-form" onSubmit={saveDriver} ref={driverFormRef}>
          <h3>{editingId ? "ແກ້ໄຂຄົນຂັບ" : "ເພີ່ມຄົນຂັບ"}</h3>
          {editingId ? <p className="edit-banner">ກຳລັງແກ້ໄຂຂໍ້ມູນຄົນຂັບ. ປ່ຽນຂໍ້ມູນແລ້ວກົດ “ບັນທຶກການແກ້ໄຂ”.</p> : null}
          <div className="form-grid">
            <label>ຊື່ຜູ້ໃຊ້ Login<input value={driverForm.username} onChange={(event) => setDriverForm({ ...driverForm, username: event.target.value })} placeholder="somchai01" required /></label>
            <label>{editingId ? "ລະຫັດໃໝ່ (ຖ້າຈະປ່ຽນ)" : "ລະຫັດຜ່ານ Login"}<input type="password" value={driverForm.password} onChange={(event) => setDriverForm({ ...driverForm, password: event.target.value })} minLength={6} required={!editingId} /></label>
            <label>ຊື່<input value={driverForm.name} onChange={(event) => setDriverForm({ ...driverForm, name: event.target.value })} required /></label>
            <label>ເມືອງ<input value={driverForm.city} onChange={(event) => setDriverForm({ ...driverForm, city: event.target.value })} required /></label>
            <label>ລົດ<input value={driverForm.vehicleType} onChange={(event) => setDriverForm({ ...driverForm, vehicleType: event.target.value })} required /></label>
            <label>ລາຄາ LAK<input type="number" value={driverForm.startingPriceLak} onChange={(event) => setDriverForm({ ...driverForm, startingPriceLak: event.target.value })} required /></label>
            <label>ລາຄາຕໍ່ km ສະເພາະ<input type="number" min="1" placeholder={String(pricing.ratePerKmLak)} value={driverForm.ratePerKmLak} onChange={(event) => setDriverForm({ ...driverForm, ratePerKmLak: event.target.value })} /></label>
            <label>ລາຄາຂັ້ນຕ່ຳສະເພາະ<input type="number" min="1" placeholder={String(pricing.minimumFareLak)} value={driverForm.minimumFareLak} onChange={(event) => setDriverForm({ ...driverForm, minimumFareLak: event.target.value })} /></label>
            <label>ພາສາ<input value={driverForm.languages} onChange={(event) => setDriverForm({ ...driverForm, languages: event.target.value })} /></label>
            <label>ເສັ້ນທາງ<input value={driverForm.routes} onChange={(event) => setDriverForm({ ...driverForm, routes: event.target.value })} /></label>
            <label className="upload-field">
              ຮູບປົກ
              {driverForm.coverUrl ? <img className="upload-preview" src={driverForm.coverUrl} alt="Driver cover preview" /> : <span className="upload-empty">ເລືອກຮູບປົກ</span>}
              <input type="file" accept="image/*" onChange={(event) => setDriverImage("coverUrl", event.target.files?.[0])} />
            </label>
            <label className="upload-field">
              ຮູບຄົນຂັບ
              {driverForm.portraitUrl ? <img className="upload-preview portrait" src={driverForm.portraitUrl} alt="Driver portrait preview" /> : <span className="upload-empty">ເລືອກຮູບຄົນຂັບ</span>}
              <input type="file" accept="image/*" onChange={(event) => setDriverImage("portraitUrl", event.target.files?.[0])} />
            </label>
            <label className="upload-field">
              ຮູບລົດ
              {driverForm.vehicleUrl ? <img className="upload-preview" src={driverForm.vehicleUrl} alt="Vehicle preview" /> : <span className="upload-empty">ເລືອກຮູບລົດ</span>}
              <input type="file" accept="image/*" onChange={(event) => setDriverImage("vehicleUrl", event.target.files?.[0])} />
            </label>
            <label>Bio<textarea value={driverForm.bio} onChange={(event) => setDriverForm({ ...driverForm, bio: event.target.value })} /></label>
          </div>
          <div className="check-row">
            <label><input type="checkbox" checked={driverForm.verified} onChange={(event) => setDriverForm({ ...driverForm, verified: event.target.checked })} /> ຢືນຢັນແລ້ວ</label>
            <label><input type="checkbox" checked={driverForm.premium} onChange={(event) => setDriverForm({ ...driverForm, premium: event.target.checked })} /> ພຣີມຽມ</label>
            <label><input type="checkbox" checked={driverForm.active} onChange={(event) => setDriverForm({ ...driverForm, active: event.target.checked })} /> ເປີດໃຊ້ງານ</label>
          </div>
          <div className="table-actions">
            <button className="btn btn-primary" type="submit"><Save size={16} /> {editingId ? "ບັນທຶກການແກ້ໄຂ" : "ບັນທຶກ"}</button>
            <button className="btn" onClick={resetDriverForm} type="button"><Plus size={16} /> ຟອມໃໝ່</button>
            <button className="btn" onClick={() => { resetDriverForm(); setShowDriverForm(false); }} type="button"><X size={16} /> ປິດ</button>
          </div>
        </form>
        ) : null}

        <div className="table-wrap">
          <table className="table compact-table">
            <thead>
              <tr>
                <th>ຄົນຂັບ</th>
                <th>ເມືອງ</th>
                <th>ລົດ</th>
                <th>ລາຄາ</th>
                <th>Wallet</th>
                <th>ສະຖານະ</th>
                <th>ຈັດການ</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((driver) => (
                <tr key={driver.id}>
                  <td>
                    <div className="driver-cell">
                      {driver.portraitUrl || driver.vehicleUrl || driver.coverUrl ? (
                        <img className="driver-avatar" src={driver.portraitUrl || driver.vehicleUrl || driver.coverUrl} alt={driver.name} />
                      ) : (
                        <span className="driver-avatar placeholder">TL</span>
                      )}
                      <div>
                        <strong>{driver.name}</strong>
                        <span>@{driver.username ?? driver.id} · {(driver.languages ?? []).slice(0, 3).join(", ") || "Lao"}</span>
                        {!driver.hasPassword ? <span className="muted-block">ຍັງບໍ່ມີລະຫັດ Login</span> : null}
                      </div>
                    </div>
                  </td>
                  <td>{driver.city}</td>
                  <td>{driver.vehicleType}</td>
                  <td>
                    <strong>{formatLak(driver.minimumFareLak ?? pricing.minimumFareLak)}</strong>
                    <span className="muted-block">{formatLak(driver.ratePerKmLak ?? pricing.ratePerKmLak)} / km</span>
                  </td>
                  <td>
                    <strong className={driver.walletLowBalance ? "danger-text" : ""}>{formatLak(driver.walletBalanceLak ?? 0)}</strong>
                    {driver.walletLowBalance ? <span className="muted-block">ເງິນໃກ້ໝົດ</span> : null}
                    <div className="table-actions mini-actions">
                      <button className="btn" onClick={() => adjustDriverWallet(driver, "CREDIT")} type="button"><Plus size={14} /> ເຕີມ</button>
                      <button className="btn danger" onClick={() => adjustDriverWallet(driver, "DEBIT")} type="button"><Banknote size={14} /> ຫັກ</button>
                    </div>
                  </td>
                  <td>
                    <div className="status-pills">
                      <span className={driver.active === false ? "pill danger-pill" : "pill ok-pill"}>{driver.active === false ? "ບລັອກ" : "ເປີດ"}</span>
                      <span className={driver.verified ? "pill ok-pill" : "pill warn-pill"}>{driver.verified ? "ຢືນຢັນ" : "ລໍຖ້າ"}</span>
                      {driver.premium ? <span className="pill gold-pill">Premium</span> : null}
                    </div>
                  </td>
                  <td className="table-actions">
                    <button className="btn" onClick={() => editDriver(driver)} type="button"><Edit size={16} /> ແກ້</button>
                    <button className="btn btn-primary" onClick={() => updateDriver(driver.id, "verify")} type="button"><BadgeCheck size={16} /> ອະນຸມັດ</button>
                    <button className="btn" onClick={() => updateDriver(driver.id, "premium")} type="button"><Crown size={16} /> Premium</button>
                    <button className="btn danger" onClick={() => disableDriver(driver.id)} type="button"><Ban size={16} /> ບລັອກ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
        ) : null}

        {activeSection === "places" ? (
          <AdminPlaceManager apiUrl={apiUrl} token={token} />
        ) : null}

        {activeSection === "tours" ? (
        <>
        <h2 id="tours">ຈັດການ Tour packages</h2>
        {!showTourForm ? (
          <div className="admin-actionbar compact">
            <div>
              <strong>Tour Packages</strong>
              <p>ມີທົວ {tours.length} ລາຍການ</p>
            </div>
            <button className="btn btn-primary" onClick={startCreateTour} type="button"><Plus size={16} /> ເພີ່ມທົວ</button>
          </div>
        ) : null}
        {showTourForm ? (
        <form className="admin-form" onSubmit={saveTour} ref={tourFormRef}>
          <h3>{editingTourId ? "ແກ້ໄຂແພັກເກດທົວ" : "ເພີ່ມແພັກເກດທົວ"}</h3>
          <div className="form-grid">
            <label>ຊື່ທົວ<input value={tourForm.title} onChange={(event) => setTourForm({ ...tourForm, title: event.target.value })} required /></label>
            <label>ເມືອງ<input value={tourForm.city} onChange={(event) => setTourForm({ ...tourForm, city: event.target.value })} required /></label>
            <label>ໄລຍະເວລາ<input value={tourForm.duration} onChange={(event) => setTourForm({ ...tourForm, duration: event.target.value })} required /></label>
            <label>ລາຄາ LAK<input type="number" value={tourForm.priceLak} onChange={(event) => setTourForm({ ...tourForm, priceLak: event.target.value })} required /></label>
            <label>ລຳດັບ Banner<input min="0" type="number" value={tourForm.sortOrder} onChange={(event) => setTourForm({ ...tourForm, sortOrder: event.target.value })} /></label>
            <label className="upload-field">
              ຮູບທົວ
              {tourForm.imageUrl ? <img className="upload-preview" src={tourForm.imageUrl} alt="Tour preview" /> : <span className="upload-empty">ເລືອກຮູບທົວ</span>}
              <input type="file" accept="image/*" onChange={(event) => setTourImage(event.target.files?.[0])} />
            </label>
            <label>ຄົນຂັບ
              <select value={tourForm.driverId} onChange={(event) => setTourForm({ ...tourForm, driverId: event.target.value })}>
                <option value="">ຍັງບໍ່ກຳນົດ</option>
                {drivers.filter((driver) => driver.active !== false).map((driver) => (
                  <option key={driver.id} value={driver.id}>{driver.name} - {driver.city}</option>
                ))}
              </select>
            </label>
            <label>ລາຍລະອຽດ<textarea value={tourForm.description} onChange={(event) => setTourForm({ ...tourForm, description: event.target.value })} required /></label>
          </div>
          <div className="check-row">
            <label><input type="checkbox" checked={tourForm.featuredOnHome} onChange={(event) => setTourForm({ ...tourForm, featuredOnHome: event.target.checked })} /> ສະແດງໃນ Banner ໜ້າຫຼັກ</label>
            <label><input type="checkbox" checked={tourForm.active} onChange={(event) => setTourForm({ ...tourForm, active: event.target.checked })} /> ເປີດໃຊ້ງານ</label>
          </div>
          <div className="table-actions">
            <button className="btn btn-primary" type="submit"><Save size={16} /> ບັນທຶກທົວ</button>
            <button className="btn" onClick={resetTourForm} type="button"><Plus size={16} /> ຟອມໃໝ່</button>
            <button className="btn" onClick={() => { resetTourForm(); setShowTourForm(false); }} type="button"><X size={16} /> ປິດ</button>
          </div>
        </form>
        ) : null}

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ຮູບ</th>
                <th>ທົວ</th>
                <th>ເມືອງ</th>
                <th>ໄລຍະເວລາ</th>
                <th>ລາຄາ</th>
                <th>ຄົນຂັບ</th>
                <th>Banner</th>
                <th>ລຳດັບ</th>
                <th>Active</th>
                <th>ຈັດການ</th>
              </tr>
            </thead>
            <tbody>
              {tours.map((tour) => (
                <tr key={tour.id}>
                  <td>{tour.imageUrl ? <img className="admin-thumb" src={tour.imageUrl} alt={tour.title} /> : <Image size={22} />}</td>
                  <td>{tour.title}</td>
                  <td>{tour.city}</td>
                  <td>{tour.duration}</td>
                  <td>{formatLak(tour.priceLak)}</td>
                  <td>{drivers.find((driver) => driver.id === tour.driverId)?.name ?? "-"}</td>
                  <td>{tour.featuredOnHome === false ? "ບໍ່ສະແດງ" : "ສະແດງ"}</td>
                  <td>{tour.sortOrder ?? 0}</td>
                  <td>{tour.active === false ? "ປິດ" : "ເປີດ"}</td>
                  <td className="table-actions">
                    <button className="btn" onClick={() => editTour(tour)} type="button"><Edit size={16} /> ແກ້</button>
                    <button className="btn danger" onClick={() => disableTour(tour.id)} type="button"><Trash2 size={16} /> ປິດ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
        ) : null}

        {activeSection === "bookings" ? (
        <>
        <h2 id="bookings">ຈັດການການຈອງ</h2>
        {editingBookingId ? (
          <form className="admin-form" onSubmit={saveBooking}>
            <h3>ແກ້ໄຂການຈອງ #{editingBookingId.slice(0, 8)}</h3>
            <div className="form-grid">
              <label>ຊື່ລູກຄ້າ<input value={bookingForm.customerName} onChange={(event) => setBookingForm({ ...bookingForm, customerName: event.target.value })} /></label>
              <label>ເບີໂທ<input value={bookingForm.customerPhone} onChange={(event) => setBookingForm({ ...bookingForm, customerPhone: event.target.value })} /></label>
              <label>WhatsApp<input value={bookingForm.customerWhatsapp} onChange={(event) => setBookingForm({ ...bookingForm, customerWhatsapp: event.target.value })} /></label>
              <label>Email<input value={bookingForm.customerEmail} onChange={(event) => setBookingForm({ ...bookingForm, customerEmail: event.target.value })} /></label>
              <label>ຮັບ<input value={bookingForm.pickup} onChange={(event) => setBookingForm({ ...bookingForm, pickup: event.target.value })} /></label>
              <label>ສົ່ງ<input value={bookingForm.dropoff} onChange={(event) => setBookingForm({ ...bookingForm, dropoff: event.target.value })} /></label>
              <label>ວັນເວລາ<input type="datetime-local" value={bookingForm.pickupAt} onChange={(event) => setBookingForm({ ...bookingForm, pickupAt: event.target.value })} /></label>
              <label>ຜູ້ໂດຍສານ<input type="number" min="1" value={bookingForm.passengers} onChange={(event) => setBookingForm({ ...bookingForm, passengers: event.target.value })} /></label>
              <label>ໄລຍະທາງ km<input type="number" min="1" value={bookingForm.distanceKm} onChange={(event) => setBookingForm({ ...bookingForm, distanceKm: event.target.value })} /></label>
              <label>ຄົນຂັບ
                <select value={bookingForm.driverId} onChange={(event) => setBookingForm({ ...bookingForm, driverId: event.target.value })}>
                  <option value="">ຍັງບໍ່ກຳນົດ</option>
                  {drivers.filter((driver) => driver.active !== false).map((driver) => (
                    <option key={driver.id} value={driver.id}>{driver.name} - {driver.city}</option>
                  ))}
                </select>
              </label>
              <label>ໝາຍເຫດ<textarea value={bookingForm.note} onChange={(event) => setBookingForm({ ...bookingForm, note: event.target.value })} /></label>
            </div>
            <div className="table-actions">
              <button className="btn btn-primary" type="submit"><Save size={16} /> ບັນທຶກການຈອງ</button>
              <button className="btn" onClick={resetBookingForm} type="button">ຍົກເລີກ</button>
            </div>
          </form>
        ) : null}

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>ລູກຄ້າ</th>
                <th>ປະເພດ</th>
                <th>ຕິດຕໍ່</th>
                <th>ຄົນຂັບ</th>
                <th>ເສັ້ນທາງ</th>
                <th>ລາຄາ</th>
                <th>ສະຖານະ</th>
                <th>ຊຳລະ</th>
                <th>ຈັດການ</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id}>
                  <td>{booking.id.slice(0, 8)}</td>
                  <td>{booking.customerName ?? "-"}</td>
                  <td>{booking.bookingType === "TOUR" ? `Tour: ${booking.tourTitle || "-"}` : booking.fareMode === "METER" ? "Ride · Meter" : "Ride · ລາຄາຄົງທີ່"}</td>
                  <td>{booking.customerWhatsapp || booking.customerPhone || "-"}</td>
                  <td>
                    <select className="status-select" value={booking.driverId ?? ""} onChange={(event) => updateBooking(booking.id, { driverId: event.target.value })}>
                      <option value="">ຍັງບໍ່ກຳນົດ</option>
                      {drivers.filter((driver) => driver.active !== false).map((driver) => (
                        <option key={driver.id} value={driver.id}>{driver.name}</option>
                      ))}
                    </select>
                  </td>
                  <td>{booking.pickup} → {booking.dropoff}</td>
                  <td>{formatLak(booking.estimatedPriceLak)}</td>
                  <td>
                    <select className="status-select" value={booking.status} onChange={(event) => updateBooking(booking.id, { status: event.target.value })}>
                      {bookingStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </td>
                  <td>
                    <select className="status-select" value={booking.payment?.status ?? "PENDING"} onChange={(event) => updatePayment(booking.payment?.id, { status: event.target.value })}>
                      {paymentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </td>
                  <td className="table-actions">
                    <button className="btn" onClick={() => editBooking(booking)} type="button"><Edit size={16} /> ແກ້</button>
                    {!["COMPLETED", "CANCELLED"].includes(booking.status) ? (
                      <button className="btn danger" onClick={() => cancelBooking(booking.id)} type="button"><Ban size={16} /> Cancel</button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
        ) : null}

        {activeSection === "finance" ? (
        <>
        <h2 id="finance">ສູນການເງິນຄົນຂັບ</h2>
        <div className="stat-grid finance-stat-grid">
          <Stat label="Wallet ຄົນຂັບລວມ" value={formatLak(totalDriverWalletLak)} icon={<Banknote />} />
          <Stat label="ເງິນໃກ້ໝົດ" value={`${lowBalanceDrivers.length} ຄົນ`} icon={<ShieldAlert />} />
          <Stat label="ເຕີມເງິນ 50 ລາຍການຫຼ້າສຸດ" value={formatLak(ledgerCreditLak)} icon={<Plus />} />
          <Stat label="ຫັກ/Commission 50 ລາຍການຫຼ້າສຸດ" value={formatLak(ledgerDebitLak)} icon={<Banknote />} />
        </div>

        <div className="admin-actionbar finance-panel">
          <div>
            <strong>Wallet Control</strong>
            <p>ເຕີມ ຫຼື ຫັກ wallet ຂອງຄົນຂັບດ້ວຍ audit note. ລະບົບບໍ່ອະນຸຍາດໃຫ້ຫັກຈົນຍອດຕິດລົບ.</p>
          </div>
          <span className="admin-kpi-chip">Commission {pricing.driverCommissionPercent}%</span>
        </div>

        <form className="admin-form compact-form finance-form" onSubmit={submitWalletAdjustment}>
          <div className="form-grid two-col">
            <label>ຄົນຂັບ
              <select value={financeDriver?.id || ""} onChange={(event) => { setFinanceDriverId(event.target.value); void loadDriverLedger(event.target.value); }}>
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>{driver.name} · {formatLak(driver.walletBalanceLak ?? 0)}</option>
                ))}
              </select>
            </label>
            <label>ປະເພດການເງິນ
              <select value={walletDirection} onChange={(event) => setWalletDirection(event.target.value as "CREDIT" | "DEBIT")}>
                <option value="CREDIT">ເຕີມເງິນ</option>
                <option value="DEBIT">ຫັກເງິນ</option>
              </select>
            </label>
            <label>ຈຳນວນ LAK<input type="number" min="1" required value={walletAmountLak} onChange={(event) => setWalletAmountLak(event.target.value)} placeholder="50000" /></label>
            <label>Audit note<input required minLength={3} value={walletNote} onChange={(event) => setWalletNote(event.target.value)} placeholder="ເຫດຜົນການເຕີມ/ຫັກເງິນ" /></label>
          </div>
          {financeDriver ? (
            <div className="finance-driver-summary">
              <span><strong>{financeDriver.name}</strong></span>
              <span>Wallet: <strong className={financeDriver.walletLowBalance ? "danger-text" : ""}>{formatLak(financeDriver.walletBalanceLak ?? 0)}</strong></span>
              <span>ເຕືອນເງິນໃກ້ໝົດ: {formatLak(financeDriver.walletLowBalanceWarningLak ?? pricing.driverLowBalanceWarningLak)}</span>
            </div>
          ) : null}
          <div className="table-actions">
            <button className="btn btn-primary" disabled={walletLoading || !financeDriver} type="submit"><Save size={16} /> {walletLoading ? "ກຳລັງບັນທຶກ" : "ບັນທຶກ Wallet"}</button>
            {financeDriver ? <button className="btn" onClick={() => loadDriverLedger(financeDriver.id)} type="button"><RefreshCcw size={16} /> ໂຫຼດ Ledger</button> : null}
          </div>
        </form>

        <div className="table-wrap">
          <table className="table compact-table finance-ledger-table">
            <thead>
              <tr>
                <th>ວັນເວລາ</th>
                <th>ປະເພດ</th>
                <th>ອໍເດີ້</th>
                <th>ຈຳນວນ</th>
                <th>ຍອດຫຼັງລາຍການ</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {driverLedger.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.createdAt ? new Date(entry.createdAt).toLocaleString("lo-LA") : "-"}</td>
                  <td><span className={entry.signedAmountLak < 0 ? "status-pill muted" : "status-pill approved"}>{entry.type}</span></td>
                  <td>{entry.bookingId ? entry.bookingId.slice(0, 8) : "-"}</td>
                  <td><strong className={entry.signedAmountLak < 0 ? "danger-text" : ""}>{entry.signedAmountLak < 0 ? "-" : "+"}{formatLak(entry.amountLak)}</strong></td>
                  <td>{formatLak(entry.balanceAfterLak)}</td>
                  <td>{entry.note || "-"}</td>
                </tr>
              ))}
              {!driverLedger.length ? (
                <tr><td colSpan={6}>ຍັງບໍ່ມີລາຍການ ledger ສຳລັບຄົນຂັບນີ້</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
        </>
        ) : null}
        {activeSection === "payments" ? (
        <>
        <h2 id="payments">ຈັດການການຊຳລະເງິນ</h2>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Booking</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id ?? payment.bookingId}>
                  <td>{payment.bookingId.slice(0, 8)}</td>
                  <td>
                    <select className="status-select" value={payment.method} onChange={(event) => updatePayment(payment.id, { method: event.target.value })}>
                      {paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}
                    </select>
                  </td>
                  <td>{formatLak(payment.amountLak)}</td>
                  <td>
                    <select className="status-select" value={payment.status} onChange={(event) => updatePayment(payment.id, { status: event.target.value })}>
                      {paymentStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
        ) : null}
      </section>
    </main>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <article className="stat">
      <div style={{ color: "#d7a84a" }}>{icon}</div>
      <div className="meta">{label}</div>
      <h2 style={{ margin: 0 }}>{value}</h2>
    </article>
  );
}
