# TAXILAO Driver App

Flutter APK app for TAXILAO drivers.

## Features

- Driver login with username and password using `POST /driver/login`
- Online/offline switch
- Auto-accept switch for pending taxi jobs
- Driver availability upload to `PATCH /driver/availability`
- Idle GPS upload to `PATCH /driver/location`
- Job list from `GET /driver/bookings`
- Job workflow: `PENDING` -> `CONFIRMED` -> `ON_THE_WAY` -> `IN_PROGRESS` -> `COMPLETED`
- Live GPS upload to `PATCH /driver/bookings/:id/location`
- Call customer and open route in Google Maps

## Setup

Flutter SDK is not currently installed on this machine. After installing Flutter,
generate Android platform files:

```powershell
cd D:\api\TAXILAO\apps\driver_app
flutter create --platforms=android --project-name taxilao_driver .
flutter pub get
```

For Android emulator, the default API URL is:

```text
http://10.0.2.2:4000
```

For a real phone on the same Wi-Fi:

```powershell
flutter run --dart-define=API_BASE_URL=http://YOUR_PC_LAN_IP:4000
```

Build APK:

```powershell
flutter build apk --release --dart-define=API_BASE_URL=http://YOUR_API_HOST:4000
```

## Android permissions

When platform files are generated, make sure `android/app/src/main/AndroidManifest.xml`
contains:

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CALL_PHONE" />
```

For production background GPS, add a proper foreground service and notification.
