export type Role = "USER" | "DRIVER" | "ADMIN" | "SUPER_ADMIN";
export type BookingStatus = "PENDING" | "CONFIRMED" | "ON_THE_WAY" | "COMPLETED" | "CANCELLED";
export type PaymentMethod = "CASH" | "BANK_QR" | "CARD" | "USDT_TRC20" | "USDT_BEP20";
export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

export type Driver = {
  id: string;
  name: string;
  city: string;
  languages: string[];
  vehicleType: string;
  rating: number;
  reviewCount: number;
  startingPriceLak: number;
  verified: boolean;
  premium: boolean;
  routes: string[];
  bio: string;
  coverUrl?: string;
  portraitUrl: string;
  vehicleUrl: string;
};

export type TourPackage = {
  id: string;
  title: string;
  city: string;
  duration: string;
  priceLak: number;
  description: string;
  imageUrl: string;
  driverId: string;
};

export const cities = [
  {
    name: "Vientiane",
    imageUrl: "https://images.unsplash.com/photo-1582809048248-930b38b7b42c?auto=format&fit=crop&w=1200&q=85",
    copy: "Embassies, riverside dining, and effortless airport transfers."
  },
  {
    name: "Luang Prabang",
    imageUrl: "https://images.unsplash.com/photo-1534008897995-27a23e859048?auto=format&fit=crop&w=1200&q=85",
    copy: "Temple mornings, Kuang Si waterfalls, and heritage stays."
  },
  {
    name: "Vang Vieng",
    imageUrl: "https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?auto=format&fit=crop&w=1200&q=85",
    copy: "Limestone views, lagoons, and premium day trips."
  },
  {
    name: "Pakse",
    imageUrl: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=85",
    copy: "Bolaven Plateau routes, coffee farms, and southern Laos."
  }
];

export const drivers: Driver[] = [
  {
    id: "somchai-vte",
    name: "Somchai Vongdala",
    city: "Vientiane",
    languages: ["Lao", "English", "Thai"],
    vehicleType: "Toyota Alphard",
    rating: 4.96,
    reviewCount: 184,
    startingPriceLak: 180000,
    verified: true,
    premium: true,
    routes: ["Wattay Airport", "Vientiane City", "Vang Vieng", "Thai-Lao Friendship Bridge"],
    bio: "Premium airport and city driver with executive van comfort, cold towels, and route planning for business travelers.",
    portraitUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=900&q=85",
    vehicleUrl: "https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&w=1200&q=85"
  },
  {
    id: "khamla-lpb",
    name: "Khamla Phommachanh",
    city: "Luang Prabang",
    languages: ["Lao", "English", "French"],
    vehicleType: "Hyundai Staria",
    rating: 4.92,
    reviewCount: 126,
    startingPriceLak: 220000,
    verified: true,
    premium: true,
    routes: ["Luang Prabang Airport", "Kuang Si Falls", "Pak Ou Caves", "Mekong Sunset"],
    bio: "Heritage city specialist for slow travel, temple etiquette, photo stops, and family-friendly private touring.",
    portraitUrl: "https://images.unsplash.com/photo-1547425260-76bcadfb4f2c?auto=format&fit=crop&w=900&q=85",
    vehicleUrl: "https://images.unsplash.com/photo-1549924231-f129b911e442?auto=format&fit=crop&w=1200&q=85"
  },
  {
    id: "anousone-vv",
    name: "Anousone Keomany",
    city: "Vang Vieng",
    languages: ["Lao", "English", "Thai", "Chinese"],
    vehicleType: "Ford Everest",
    rating: 4.88,
    reviewCount: 98,
    startingPriceLak: 250000,
    verified: true,
    premium: false,
    routes: ["Blue Lagoon", "Nam Xay Viewpoint", "Vang Vieng Station", "Vientiane Transfer"],
    bio: "Adventure-route driver with SUV comfort, mountain-road experience, and flexible photo-stop pacing.",
    portraitUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=900&q=85",
    vehicleUrl: "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=1200&q=85"
  },
  {
    id: "maliny-pakse",
    name: "Maliny Souvannavong",
    city: "Pakse",
    languages: ["Lao", "English", "Thai"],
    vehicleType: "Toyota Fortuner",
    rating: 4.9,
    reviewCount: 74,
    startingPriceLak: 260000,
    verified: true,
    premium: true,
    routes: ["Pakse Airport", "Bolaven Plateau", "Wat Phou", "4000 Islands"],
    bio: "Southern Laos route host with reliable long-distance planning and carefully timed scenic breaks.",
    portraitUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=900&q=85",
    vehicleUrl: "https://images.unsplash.com/photo-1619767886558-efdc259cde1a?auto=format&fit=crop&w=1200&q=85"
  }
];

export const tourPackages: TourPackage[] = [
  {
    id: "vientiane-city",
    title: "Vientiane City Signature",
    city: "Vientiane",
    duration: "6 hours",
    priceLak: 850000,
    description: "Patuxai, That Luang, riverside sunset, and premium dinner transfer.",
    imageUrl: "https://images.unsplash.com/photo-1563492065599-3520f775eeed?auto=format&fit=crop&w=1200&q=85",
    driverId: "somchai-vte"
  },
  {
    id: "vang-vieng-day",
    title: "Vang Vieng Day Trip",
    city: "Vang Vieng",
    duration: "1 day",
    priceLak: 1450000,
    description: "Private SUV transfer, lagoon stops, viewpoint timing, and return to Vientiane.",
    imageUrl: "https://images.unsplash.com/photo-1587330979470-3016b6702d89?auto=format&fit=crop&w=1200&q=85",
    driverId: "anousone-vv"
  },
  {
    id: "luang-prabang-three",
    title: "Luang Prabang 3 Days",
    city: "Luang Prabang",
    duration: "3 days",
    priceLak: 3900000,
    description: "Airport meet, heritage core, Kuang Si Falls, Pak Ou Caves, and sunset routes.",
    imageUrl: "https://images.unsplash.com/photo-1528181304800-259b08848526?auto=format&fit=crop&w=1200&q=85",
    driverId: "khamla-lpb"
  }
];

export const reviews = [
  {
    name: "Amelia R.",
    country: "Australia",
    quote: "The driver was early, the vehicle was spotless, and every stop felt carefully planned."
  },
  {
    name: "Kenji T.",
    country: "Japan",
    quote: "Easy airport pickup and a very comfortable ride to Vang Vieng. Premium service."
  },
  {
    name: "Nadia S.",
    country: "France",
    quote: "Luang Prabang was effortless with a driver who understood timing, photos, and local culture."
  }
];

export function formatLak(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "LAK",
    maximumFractionDigits: 0
  }).format(amount);
}

export function calculateUrbanPrice(distanceKm: number, ratePerKm = 15000, minimumFare = 50000) {
  return Math.max(Math.round(distanceKm * ratePerKm), minimumFare);
}

export const i18n = {
  locales: ["lo", "en", "th", "zh", "vi", "ja", "ko"] as const,
  defaultLocale: "lo",
  labels: {
    lo: "ລາວ",
    en: "EN",
    th: "ไทย",
    zh: "中文",
    vi: "Tiếng Việt",
    ja: "日本語",
    ko: "한국어"
  },
  flags: {
    lo: "🇱🇦",
    en: "🇬🇧",
    th: "🇹🇭",
    zh: "🇨🇳",
    vi: "🇻🇳",
    ja: "🇯🇵",
    ko: "🇰🇷"
  },
  nativeNames: {
    lo: "ພາສາລາວ",
    en: "English",
    th: "ภาษาไทย",
    zh: "中文",
    vi: "Tiếng Việt",
    ja: "日本語",
    ko: "한국어"
  }
} as const;

export type Locale = (typeof i18n.locales)[number];

export function getLocale(value?: string): Locale {
  return i18n.locales.includes(value as Locale) ? (value as Locale) : i18n.defaultLocale;
}

export const homepageCopy: Record<Locale, {
  navDrivers: string;
  navTours: string;
  navBooking: string;
  navAdmin: string;
  login: string;
  book: string;
  eyebrow: string;
  headline: string;
  lead: string;
  bookPremiumDriver: string;
  becomeDriver: string;
  popularCities: string;
  popularCitiesTitle: string;
  featuredDrivers: string;
  featuredDriversTitle: string;
  privateTours: string;
  privateToursTitle: string;
  reviews: string;
  reviewsTitle: string;
}> = {
  lo: {
    navDrivers: "ຄົນຂັບ",
    navTours: "ທົວ",
    navBooking: "ເອີ້ນລົດ",
    navAdmin: "ຫຼັງບ້ານ",
    login: "ເຂົ້າລະບົບ",
    book: "ເອີ້ນລົດ",
    eyebrow: "ຄົນຂັບສ່ວນຕົວພຣີມຽມໃນລາວ",
    headline: "TAXILAO.COM",
    lead: "ຈອງຄົນຂັບ Taxi ພຣີມຽມ, ຮັບສົ່ງສະໜາມບິນ ແລະທົວສ່ວນຕົວໃນວຽງຈັນ, ຫຼວງພະບາງ, ວັງວຽງ, ປາກເຊ ແລະເມືອງອື່ນໆ.",
    bookPremiumDriver: "ເອີ້ນລົດ",
    becomeDriver: "ສະໝັກເປັນຄົນຂັບ",
    popularCities: "ເມືອງຍອດນິຍົມ",
    popularCitiesTitle: "ເລີ່ມຈາກເສັ້ນທາງທີ່ຄົນຂໍຫຼາຍທີ່ສຸດ",
    featuredDrivers: "ຄົນຂັບແນະນຳ",
    featuredDriversTitle: "ສະແດງຄົນຂັບພຣີມຽມກ່ອນ",
    privateTours: "ທົວສ່ວນຕົວ",
    privateToursTitle: "ແພັກເກດທົວກັບຄົນຂັບທີ່ໄວ້ໃຈໄດ້",
    reviews: "ຣີວິວລູກຄ້າ",
    reviewsTitle: "ອອກແບບເພື່ອນັກທ່ອງທ່ຽວຕ່າງຊາດ"
  },
  en: {
    navDrivers: "Drivers",
    navTours: "Tours",
    navBooking: "Call a taxi",
    navAdmin: "Admin",
    login: "Sign in",
    book: "Call taxi",
    eyebrow: "Premium private drivers in Laos",
    headline: "TAXILAO.COM",
    lead: "Book verified premium taxi drivers, airport transfers, and private tours in Vientiane, Luang Prabang, Vang Vieng, Pakse, and destinations across Laos.",
    bookPremiumDriver: "Call a taxi",
    becomeDriver: "Become a driver",
    popularCities: "Popular destinations",
    popularCitiesTitle: "Start with the most requested routes in Laos",
    featuredDrivers: "Featured drivers",
    featuredDriversTitle: "Premium drivers, ready when you are",
    privateTours: "Private tours",
    privateToursTitle: "Curated journeys with trusted local drivers",
    reviews: "Customer reviews",
    reviewsTitle: "Made for travelers from around the world"
  },
  th: {
    navDrivers: "คนขับ",
    navTours: "ทัวร์",
    navBooking: "เรียกรถ",
    navAdmin: "หลังบ้าน",
    login: "เข้าสู่ระบบ",
    book: "เรียกรถ",
    eyebrow: "คนขับส่วนตัวพรีเมียมในลาว",
    headline: "TAXILAO.COM",
    lead: "จองแท็กซี่พรีเมียม รถรับส่งสนามบิน และทัวร์ส่วนตัวในเวียงจันทน์ หลวงพระบาง วังเวียง ปากเซ และเมืองอื่นๆ",
    bookPremiumDriver: "เรียกรถ",
    becomeDriver: "สมัครเป็นคนขับ",
    popularCities: "เมืองยอดนิยม",
    popularCitiesTitle: "เริ่มจากเส้นทางยอดนิยมในลาว",
    featuredDrivers: "คนขับแนะนำ",
    featuredDriversTitle: "แสดงคนขับพรีเมียมก่อน",
    privateTours: "ทัวร์ส่วนตัว",
    privateToursTitle: "แพ็กเกจทัวร์กับคนขับที่เชื่อถือได้",
    reviews: "รีวิวลูกค้า",
    reviewsTitle: "ออกแบบเพื่อผู้เดินทางต่างชาติ"
  },
  zh: {
    navDrivers: "司机",
    navTours: "旅游",
    navBooking: "预订",
    navAdmin: "后台",
    login: "登录",
    book: "预订",
    eyebrow: "老挝高端私人司机",
    headline: "TAXILAO.COM",
    lead: "预订老挝认证高端出租车司机、机场接送和私人旅游路线，覆盖万象、琅勃拉邦、万荣、巴色等城市。",
    bookPremiumDriver: "预订高端司机",
    becomeDriver: "成为司机",
    popularCities: "热门城市",
    popularCitiesTitle: "从老挝最受欢迎的路线开始",
    featuredDrivers: "推荐司机",
    featuredDriversTitle: "优先展示高端司机",
    privateTours: "私人旅游",
    privateToursTitle: "与可信赖司机同行的精选行程",
    reviews: "客户评价",
    reviewsTitle: "为国际旅客设计"
  },
  vi: {
    navDrivers: "Tài xế",
    navTours: "Tour",
    navBooking: "Đặt xe",
    navAdmin: "Quản trị",
    login: "Đăng nhập",
    book: "Đặt",
    eyebrow: "Tài xế riêng cao cấp tại Lào",
    headline: "TAXILAO.COM",
    lead: "Đặt tài xế taxi cao cấp, đưa đón sân bay và tour riêng tại Viêng Chăn, Luang Prabang, Vang Vieng, Pakse và nhiều điểm đến khác.",
    bookPremiumDriver: "Đặt tài xế cao cấp",
    becomeDriver: "Đăng ký tài xế",
    popularCities: "Thành phố phổ biến",
    popularCitiesTitle: "Bắt đầu với các tuyến được yêu cầu nhiều nhất ở Lào",
    featuredDrivers: "Tài xế nổi bật",
    featuredDriversTitle: "Ưu tiên tài xế cao cấp",
    privateTours: "Tour riêng",
    privateToursTitle: "Hành trình chọn lọc cùng tài xế đáng tin cậy",
    reviews: "Đánh giá khách hàng",
    reviewsTitle: "Thiết kế cho du khách quốc tế"
  },
  ja: {
    navDrivers: "ドライバー",
    navTours: "ツアー",
    navBooking: "予約",
    navAdmin: "管理",
    login: "ログイン",
    book: "予約",
    eyebrow: "ラオスのプレミアム専用ドライバー",
    headline: "TAXILAO.COM",
    lead: "ビエンチャン、ルアンパバーン、バンビエン、パクセなどで、認証済みプレミアムタクシー、空港送迎、プライベートツアーを予約できます。",
    bookPremiumDriver: "プレミアムドライバーを予約",
    becomeDriver: "ドライバー登録",
    popularCities: "人気都市",
    popularCitiesTitle: "ラオスで人気のルートから始める",
    featuredDrivers: "おすすめドライバー",
    featuredDriversTitle: "プレミアムドライバーを優先表示",
    privateTours: "プライベートツアー",
    privateToursTitle: "信頼できるドライバーとの厳選ツアー",
    reviews: "お客様の声",
    reviewsTitle: "海外旅行者のための体験"
  },
  ko: {
    navDrivers: "기사",
    navTours: "투어",
    navBooking: "예약",
    navAdmin: "관리",
    login: "로그인",
    book: "예약",
    eyebrow: "라오스 프리미엄 개인 기사",
    headline: "TAXILAO.COM",
    lead: "비엔티안, 루앙프라방, 방비엥, 팍세 등에서 인증된 프리미엄 택시 기사, 공항 이동, 개인 투어를 예약하세요.",
    bookPremiumDriver: "프리미엄 기사 예약",
    becomeDriver: "기사 등록",
    popularCities: "인기 도시",
    popularCitiesTitle: "라오스에서 가장 많이 찾는 경로부터 시작",
    featuredDrivers: "추천 기사",
    featuredDriversTitle: "프리미엄 기사 우선 표시",
    privateTours: "개인 투어",
    privateToursTitle: "신뢰할 수 있는 기사와 함께하는 맞춤 일정",
    reviews: "고객 리뷰",
    reviewsTitle: "해외 여행자를 위한 서비스"
  }
};
