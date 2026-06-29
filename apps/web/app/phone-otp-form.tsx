"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Lock, Mail, Phone, ShieldCheck, User } from "lucide-react";
import { Locale } from "@taxilao/shared";
import { getApiUrl } from "./config";

const LaoFlag = () => (
  <svg viewBox="0 0 90 60" className="lao-flag" role="img" aria-label="Laos">
    <rect width="90" height="15" fill="#CE1126" />
    <rect y="15" width="90" height="30" fill="#002868" />
    <rect y="45" width="90" height="15" fill="#CE1126" />
    <circle cx="45" cy="30" r="11.5" fill="#ffffff" />
  </svg>
);

function normalizeLaoPhoneClient(raw: string): string | null {
  let digits = (raw || "").replace(/[^\d]/g, "");
  if (!digits) return null;
  if (digits.startsWith("856")) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);
  if (!/^[23]\d{7,9}$/.test(digits)) return null;
  return digits;
}

type Labels = {
  modeOtp: string;
  modePassword: string;
  titleOtp: string;
  leadOtp: string;
  titlePassword: string;
  leadPassword: string;
  phoneLabel: string;
  phonePlaceholder: string;
  sendOtp: string;
  codeLabel: string;
  codePlaceholder: string;
  verify: string;
  resendIn: string;
  resend: string;
  back: string;
  signupTitle: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  passwordPlaceholder: string;
  completeSignup: string;
  loginBtn: string;
};

const labelsByLocale: Record<Locale, Labels> = {
  lo: {
    modeOtp: "ເບີ + OTP", modePassword: "ເບີ + ລະຫັດຜ່ານ",
    titleOtp: "ເຂົ້າລະບົບ / ລົງທະບຽນ", leadOtp: "ໃສ່ເບີ ຮັບ OTP ທາງ SMS.",
    titlePassword: "ເຂົ້າລະບົບດ້ວຍລະຫັດຜ່ານ", leadPassword: "ໃສ່ເບີ ແລະ ລະຫັດຜ່ານຂອງເຈົ້າ.",
    phoneLabel: "ເບີໂທ", phonePlaceholder: "20xxxxxxxx",
    sendOtp: "ຂໍລະຫັດ OTP", codeLabel: "ລະຫັດ OTP", codePlaceholder: "6 ຫຼັກ",
    verify: "ຢືນຢັນ", resendIn: "ສົ່ງໄດ້ໃໝ່ໃນ {s}ວິ", resend: "ສົ່ງ OTP ໃໝ່", back: "ປ່ຽນເບີ",
    signupTitle: "ສ້າງບັນຊີ", firstName: "ຊື່", lastName: "ນາມສະກຸນ",
    email: "ອີເມວ", password: "ລະຫັດຜ່ານ", passwordPlaceholder: "ຢ່າງໜ້ອຍ 6 ຕົວ",
    completeSignup: "ສຳເລັດການລົງທະບຽນ", loginBtn: "ເຂົ້າລະບົບ"
  },
  en: {
    modeOtp: "Phone + OTP", modePassword: "Phone + Password",
    titleOtp: "Sign in / Register", leadOtp: "Enter your number to get an OTP via SMS.",
    titlePassword: "Sign in with password", leadPassword: "Enter your number and password.",
    phoneLabel: "Phone", phonePlaceholder: "20xxxxxxxx",
    sendOtp: "Request OTP", codeLabel: "OTP code", codePlaceholder: "6 digits",
    verify: "Verify", resendIn: "Resend in {s}s", resend: "Resend OTP", back: "Change number",
    signupTitle: "Create account", firstName: "First name", lastName: "Last name",
    email: "Email", password: "Password", passwordPlaceholder: "At least 6 characters",
    completeSignup: "Complete sign up", loginBtn: "Sign in"
  },
  th: { modeOtp: "เบอร์ + OTP", modePassword: "เบอร์ + รหัสผ่าน", titleOtp: "เข้าสู่ระบบ / สมัคร", leadOtp: "กรอกเบอร์เพื่อรับ OTP ทาง SMS.", titlePassword: "เข้าสู่ระบบด้วยรหัสผ่าน", leadPassword: "กรอกเบอร์และรหัสผ่านของคุณ.", phoneLabel: "เบอร์โทร", phonePlaceholder: "20xxxxxxxx", sendOtp: "ขอรหัส OTP", codeLabel: "รหัส OTP", codePlaceholder: "6 หลัก", verify: "ยืนยัน", resendIn: "ส่งใหม่ใน {s}วิ", resend: "ส่ง OTP ใหม่", back: "เปลี่ยนเบอร์", signupTitle: "สร้างบัญชี", firstName: "ชื่อ", lastName: "นามสกุล", email: "อีเมล", password: "รหัสผ่าน", passwordPlaceholder: "อย่างน้อย 6 ตัว", completeSignup: "สมัครเสร็จสิ้น", loginBtn: "เข้าสู่ระบบ" },
  zh: { modeOtp: "手机号 + OTP", modePassword: "手机号 + 密码", titleOtp: "登录 / 注册", leadOtp: "输入号码以通过短信接收 OTP。", titlePassword: "用密码登录", leadPassword: "输入号码和密码。", phoneLabel: "手机号", phonePlaceholder: "20xxxxxxxx", sendOtp: "获取验证码", codeLabel: "验证码", codePlaceholder: "6 位", verify: "验证", resendIn: "{s}秒后可重发", resend: "重新发送", back: "更换号码", signupTitle: "创建账户", firstName: "名", lastName: "姓", email: "邮箱", password: "密码", passwordPlaceholder: "至少 6 位", completeSignup: "完成注册", loginBtn: "登录" },
  vi: { modeOtp: "SĐT + OTP", modePassword: "SĐT + Mật khẩu", titleOtp: "Đăng nhập / Đăng ký", leadOtp: "Nhập số để nhận OTP qua SMS.", titlePassword: "Đăng nhập bằng mật khẩu", leadPassword: "Nhập số và mật khẩu.", phoneLabel: "Số điện thoại", phonePlaceholder: "20xxxxxxxx", sendOtp: "Lấy mã OTP", codeLabel: "Mã OTP", codePlaceholder: "6 số", verify: "Xác minh", resendIn: "Gửi lại sau {s}s", resend: "Gửi lại OTP", back: "Đổi số", signupTitle: "Tạo tài khoản", firstName: "Tên", lastName: "Họ", email: "Email", password: "Mật khẩu", passwordPlaceholder: "Ít nhất 6 ký tự", completeSignup: "Hoàn tất đăng ký", loginBtn: "Đăng nhập" },
  ja: { modeOtp: "電話番号 + OTP", modePassword: "電話番号 + パスワード", titleOtp: "ログイン / 新規登録", leadOtp: "番号を入力してSMSでOTPを受信。", titlePassword: "パスワードでログイン", leadPassword: "番号とパスワードを入力。", phoneLabel: "電話番号", phonePlaceholder: "20xxxxxxxx", sendOtp: "OTPを取得", codeLabel: "OTPコード", codePlaceholder: "6桁", verify: "確認", resendIn: "{s}秒後に再送", resend: "OTP再送", back: "番号変更", signupTitle: "アカウント作成", firstName: "名", lastName: "姓", email: "メール", password: "パスワード", passwordPlaceholder: "6文字以上", completeSignup: "登録完了", loginBtn: "ログイン" },
  ko: { modeOtp: "전화번호 + OTP", modePassword: "전화번호 + 비밀번호", titleOtp: "로그인 / 가입", leadOtp: "번호 입력 후 SMS로 OTP 수신.", titlePassword: "비밀번호로 로그인", leadPassword: "번호와 비밀번호 입력.", phoneLabel: "전화번호", phonePlaceholder: "20xxxxxxxx", sendOtp: "OTP 받기", codeLabel: "OTP 코드", codePlaceholder: "6자리", verify: "확인", resendIn: "{s}초 후 재전송", resend: "OTP 재전송", back: "번호 변경", signupTitle: "계정 만들기", firstName: "이름", lastName: "성", email: "이메일", password: "비밀번호", passwordPlaceholder: "최소 6자", completeSignup: "가입 완료", loginBtn: "로그인" }
};

export function PhoneOtpForm({ locale, returnTo }: { locale: Locale; returnTo: string }) {
  const t = labelsByLocale[locale] || labelsByLocale.lo;
  const apiUrl = getApiUrl();

  const [mode, setMode] = useState<"otp" | "password">("otp");
  const [step, setStep] = useState<"phone" | "code" | "profile">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registrationToken, setRegistrationToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [devHint, setDevHint] = useState("");
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  function startCountdown(seconds: number) {
    setCountdown(seconds);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((value) => {
        if (value <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
  }

  function storeAndRedirect(accessToken: string, refreshToken: string) {
    localStorage.setItem("taxilao_member_access_token", accessToken);
    localStorage.setItem("taxilao_member_refresh_token", refreshToken);
    const target = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") && !returnTo.includes("\\") ? returnTo : "/dashboard";
    window.location.replace(target);
  }

  async function requestOtp() {
    const normalized = normalizeLaoPhoneClient(phone);
    if (!normalized) { setError("ເບີໂທບໍ່ຖືກຕ້ອງ"); return; }
    setLoading(true);
    setError("");
    setDevHint("");
    try {
      const response = await fetch(`${apiUrl}/auth/phone/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalized })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "ສົ່ງ OTP ບໍ່ສຳເລັດ");
      if (data?.devOtp) setDevHint(`(dev) OTP: ${data.devOtp}`);
      setStep("code");
      startCountdown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ສົ່ງ OTP ບໍ່ສຳເລັດ");
    } finally {
      setLoading(false);
    }
  }

  function onRequestOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void requestOtp();
  }

  async function verify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeLaoPhoneClient(phone);
    if (!normalized) { setError("ເບີໂທບໍ່ຖືກຕ້ອງ"); return; }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/auth/phone/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalized, code })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "ຢືນຢັນບໍ່ສຳເລັດ");
      if (data?.accessToken && data?.refreshToken) {
        storeAndRedirect(data.accessToken, data.refreshToken);
        return;
      }
      if (data?.isNew && data?.registrationToken) {
        setRegistrationToken(data.registrationToken);
        setStep("profile");
        return;
      }
      throw new Error("ບໍ່ສາມາດດຳເນີນການຕໍ່ໄດ້");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ຢືນຢັນບໍ່ສຳເລັດ");
    } finally {
      setLoading(false);
    }
  }

  async function completeSignup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/auth/phone/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationToken, firstName, lastName, email, password })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "ລົງທະບຽນບໍ່ສຳເລັດ");
      if (data?.accessToken && data?.refreshToken) {
        storeAndRedirect(data.accessToken, data.refreshToken);
        return;
      }
      throw new Error("ລົງທະບຽນບໍ່ສຳເລັດ");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ລົງທະບຽນບໍ່ສຳເລັດ");
    } finally {
      setLoading(false);
    }
  }

  async function loginPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeLaoPhoneClient(phone);
    if (!normalized) { setError("ເບີໂທບໍ່ຖືກຕ້ອງ"); return; }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/auth/phone/login-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalized, password })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || "ເຂົ້າລະບົບບໍ່ສຳເລັດ");
      if (data?.accessToken && data?.refreshToken) {
        storeAndRedirect(data.accessToken, data.refreshToken);
        return;
      }
      throw new Error("ເຂົ້າລະບົບບໍ່ສຳເລັດ");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ເຂົ້າລະບົບບໍ່ສຳເລັດ");
    } finally {
      setLoading(false);
    }
  }

  const title = mode === "otp" ? (step === "profile" ? t.signupTitle : t.titleOtp) : t.titlePassword;
  const lead = mode === "otp" ? (step === "profile" ? "" : t.leadOtp) : t.leadPassword;

  return (
    <div className="phone-otp">
      <div className="member-login-icon"><Phone size={26} /></div>
      <h2>{title}</h2>
      {lead ? <p>{lead}</p> : null}

      {error ? <p className="form-message error">{error}</p> : null}
      {devHint ? <p className="form-message dev-hint">{devHint}</p> : null}

      {mode === "otp" && step === "phone" ? (
        <>
          <div className="mode-tabs">
            <button type="button" className="active">{t.modeOtp}</button>
            <button type="button" onClick={() => { setMode("password"); setError(""); }}>{t.modePassword}</button>
          </div>
          <form className="phone-otp-form" onSubmit={onRequestOtp}>
            <label className="field">
              <span>{t.phoneLabel}</span>
              <div className="phone-input-wrap">
                <span className="phone-prefix"><LaoFlag /> +856</span>
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder={t.phonePlaceholder}
                  inputMode="tel"
                  autoComplete="tel"
                  required
                />
              </div>
            </label>
            <button className="btn btn-primary" type="submit" disabled={loading || phone.trim().length < 6}>
              {loading ? <LoaderCircle className="spin" size={18} /> : null}
              {t.sendOtp}
            </button>
          </form>
        </>
      ) : null}

      {mode === "otp" && step === "code" ? (
        <form className="phone-otp-form" onSubmit={verify}>
          <label className="field">
            <span>{t.codeLabel}</span>
            <input
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/[^\d]/g, "").slice(0, 8))}
              placeholder={t.codePlaceholder}
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              autoFocus
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={loading || code.length < 4}>
            {loading ? <LoaderCircle className="spin" size={18} /> : null}
            {t.verify}
          </button>
          <div className="phone-otp-actions">
            <button type="button" className="link-btn" onClick={() => { setStep("phone"); setCode(""); setError(""); }}>
              {t.back}
            </button>
            {countdown > 0 ? (
              <span className="countdown">{t.resendIn.replace("{s}", String(countdown))}</span>
            ) : (
              <button type="button" className="link-btn" onClick={() => requestOtp()} disabled={loading}>
                {t.resend}
              </button>
            )}
          </div>
        </form>
      ) : null}

      {mode === "otp" && step === "profile" ? (
        <form className="phone-otp-form" onSubmit={completeSignup}>
          <div className="field-row">
            <label className="field">
              <span><User size={13} /> {t.firstName}</span>
              <input value={firstName} onChange={(event) => setFirstName(event.target.value)} required maxLength={40} />
            </label>
            <label className="field">
              <span>{t.lastName}</span>
              <input value={lastName} onChange={(event) => setLastName(event.target.value)} maxLength={40} />
            </label>
          </div>
          <label className="field">
            <span><Mail size={13} /> {t.email}</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" inputMode="email" autoComplete="email" required />
          </label>
          <label className="field">
            <span><Lock size={13} /> {t.password}</span>
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder={t.passwordPlaceholder} autoComplete="new-password" required minLength={6} />
          </label>
          <button className="btn btn-primary" type="submit" disabled={loading || !firstName || !email || password.length < 6}>
            {loading ? <LoaderCircle className="spin" size={18} /> : null}
            {t.completeSignup}
          </button>
        </form>
      ) : null}

      {mode === "password" ? (
        <>
          <div className="mode-tabs">
            <button type="button" onClick={() => { setMode("otp"); setStep("phone"); setError(""); }}>{t.modeOtp}</button>
            <button type="button" className="active">{t.modePassword}</button>
          </div>
          <form className="phone-otp-form" onSubmit={loginPassword}>
            <label className="field">
              <span>{t.phoneLabel}</span>
              <div className="phone-input-wrap">
                <span className="phone-prefix"><LaoFlag /> +856</span>
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder={t.phonePlaceholder}
                  inputMode="tel"
                  autoComplete="tel"
                  required
                />
              </div>
            </label>
            <label className="field">
              <span><Lock size={13} /> {t.password}</span>
              <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" required />
            </label>
            <button className="btn btn-primary" type="submit" disabled={loading || phone.trim().length < 6 || !password}>
              {loading ? <LoaderCircle className="spin" size={18} /> : null}
              {t.loginBtn}
            </button>
            <button type="button" className="link-btn center" onClick={() => { setMode("otp"); setStep("phone"); setError(""); setPassword(""); }}>
              {t.modeOtp} →
            </button>
          </form>
        </>
      ) : null}

      <div className="member-login-note">
        <ShieldCheck size={15} />
        <span>OTP ໃຊ້ໄດ້ 5 ນາທີ</span>
      </div>
    </div>
  );
}
