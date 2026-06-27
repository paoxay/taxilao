import 'dart:async';
import 'dart:convert';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geolocator_android/geolocator_android.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart' as map_latlng;
import 'package:permission_handler/permission_handler.dart' as app_permissions;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

const String defaultApiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'https://api.taxilao.com',
);

void main() {
  runApp(const TaxilaoDriverApp());
}

class TaxilaoDriverApp extends StatelessWidget {
  const TaxilaoDriverApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'TAXILAO Driver',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xfff1c45d),
          brightness: Brightness.dark,
          primary: const Color(0xfff1c45d),
          surface: const Color(0xff101722),
        ),
        scaffoldBackgroundColor: const Color(0xff070b11),
        useMaterial3: true,
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xff18212d),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: Color(0xff334155)),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: Color(0xff334155)),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(8),
            borderSide: const BorderSide(color: Color(0xfff1c45d)),
          ),
        ),
      ),
      home: const DriverShell(),
    );
  }
}

class DriverShell extends StatefulWidget {
  const DriverShell({super.key});

  @override
  State<DriverShell> createState() => _DriverShellState();
}

class _DriverShellState extends State<DriverShell> {
  late final DriverSession session;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    session = DriverSession();
    _load();
  }

  Future<void> _load() async {
    await session.restore();
    if (mounted) setState(() => loading = false);
  }

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    return AnimatedBuilder(
      animation: session,
      builder: (context, _) {
        if (!session.isSignedIn) return LoginScreen(session: session);
        return DriverHomeScreen(session: session);
      },
    );
  }
}

class DriverSession extends ChangeNotifier {
  String apiBaseUrl = defaultApiBaseUrl;
  String token = '';
  DriverProfile? driver;

  bool get isSignedIn => token.isNotEmpty && driver != null;

  Future<void> restore() async {
    final prefs = await SharedPreferences.getInstance();
    apiBaseUrl = defaultApiBaseUrl.replaceAll(RegExp(r'/+$'), '');
    await prefs.remove('apiBaseUrl');
    token = prefs.getString('token') ?? '';
    final driverJson = prefs.getString('driver');
    if (driverJson != null && driverJson.isNotEmpty) {
      driver = DriverProfile.fromJson(jsonDecode(driverJson));
    }
    notifyListeners();
  }

  Future<void> login({
    required String username,
    required String password,
  }) async {
    final normalizedUrl =
        defaultApiBaseUrl.trim().replaceAll(RegExp(r'/+$'), '');
    final response = await http.post(
      Uri.parse('$normalizedUrl/driver/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'username': username.trim(), 'password': password}),
    );
    final body = decodeBody(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(body['message']?.toString() ?? 'ເຂົ້າລະບົບບໍ່ສຳເລັດ');
    }
    apiBaseUrl = normalizedUrl;
    token = body['token']?.toString() ?? '';
    driver = DriverProfile.fromJson(body['driver'] as Map<String, dynamic>);
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('apiBaseUrl');
    await prefs.setString('token', token);
    await prefs.setString('driver', jsonEncode(driver!.toJson()));
    notifyListeners();
  }

  Future<void> logout() async {
    token = '';
    driver = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    await prefs.remove('driver');
    notifyListeners();
  }

  Future<void> updateDriverProfile(DriverProfile profile) async {
    driver = profile;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('driver', jsonEncode(profile.toJson()));
    notifyListeners();
  }
}

class DriverApi {
  DriverApi(this.session);

  final DriverSession session;

  Map<String, String> get headers => {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ${session.token}',
      };

  Future<List<DriverBooking>> listBookings() async {
    final response = await http.get(
      Uri.parse('${session.apiBaseUrl}/driver/bookings'),
      headers: headers,
    );
    final body = decodeBody(response);
    if (response.statusCode == 401) {
      await session.logout();
      throw ApiException('Session ໝົດອາຍຸ, ກະລຸນາເຂົ້າໃໝ່');
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(body['message']?.toString() ?? 'ໂຫຼດງານບໍ່ສຳເລັດ');
    }
    if (body is! List) return [];
    return body
        .whereType<Map<String, dynamic>>()
        .map(DriverBooking.fromJson)
        .toList();
  }

  Future<DriverProfile> loadProfile() async {
    final response = await http.get(
      Uri.parse('${session.apiBaseUrl}/driver/me'),
      headers: headers,
    );
    final body = decodeBody(response);
    if (response.statusCode == 401) {
      await session.logout();
      throw ApiException('Session ໝົດອາຍຸ, ກະລຸນາເຂົ້າໃໝ່');
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(body['message']?.toString() ?? 'ໂຫຼດໂປຣໄຟບໍ່ສຳເລັດ');
    }
    return DriverProfile.fromJson(body as Map<String, dynamic>);
  }

  Future<DriverRoute> calculateRoute(LatLng origin, LatLng destination) async {
    final response = await http.post(
      Uri.parse('${session.apiBaseUrl}/maps/route'),
      headers: headers,
      body: jsonEncode({
        'pickupCoordinates': {
          'longitude': origin.longitude,
          'latitude': origin.latitude,
        },
        'dropoffCoordinates': {
          'longitude': destination.longitude,
          'latitude': destination.latitude,
        },
      }),
    );
    final body = decodeBody(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(
          body['message']?.toString() ?? 'ຄຳນວນເສັ້ນທາງບໍ່ສຳເລັດ');
    }
    return DriverRoute.fromJson(body as Map<String, dynamic>);
  }

  Future<DriverBooking> updateStatus(String bookingId, String status) async {
    final response = await http.patch(
      Uri.parse('${session.apiBaseUrl}/driver/bookings/$bookingId/status'),
      headers: headers,
      body: jsonEncode({'status': status}),
    );
    final body = decodeBody(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(body['message']?.toString() ?? 'ປ່ຽນສະຖານະບໍ່ສຳເລັດ');
    }
    return DriverBooking.fromJson(body as Map<String, dynamic>);
  }

  Future<List<ChatMessage>> listChatMessages(String bookingId) async {
    final response = await http.get(
      Uri.parse('${session.apiBaseUrl}/bookings/$bookingId/chat'),
      headers: headers,
    );
    final body = decodeBody(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(body['message']?.toString() ?? 'ໂຫຼດແຊັດບໍ່ສຳເລັດ');
    }
    if (body is! List) return [];
    return body
        .whereType<Map<String, dynamic>>()
        .map(ChatMessage.fromJson)
        .toList();
  }

  Future<ChatMessage> sendChatMessage(String bookingId, String text) async {
    final response = await http.post(
      Uri.parse('${session.apiBaseUrl}/bookings/$bookingId/chat'),
      headers: headers,
      body: jsonEncode({'text': text}),
    );
    final body = decodeBody(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(body['message']?.toString() ?? 'ສົ່ງແຊັດບໍ່ສຳເລັດ');
    }
    return ChatMessage.fromJson(body as Map<String, dynamic>);
  }

  Future<void> submitCustomerReview(
      String bookingId, int rating, String comment) async {
    final response = await http.post(
      Uri.parse('${session.apiBaseUrl}/driver/bookings/$bookingId/review'),
      headers: headers,
      body: jsonEncode({'rating': rating, 'comment': comment}),
    );
    final body = decodeBody(response);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(body['message']?.toString() ?? 'ໃຫ້ດາວບໍ່ສຳເລັດ');
    }
  }

  Future<void> updateAvailability({
    required bool online,
    required bool autoAccept,
    Position? position,
  }) async {
    final response = await http.patch(
      Uri.parse('${session.apiBaseUrl}/driver/availability'),
      headers: headers,
      body: jsonEncode({
        'online': online,
        'autoAccept': autoAccept,
        if (position != null)
          'location': {
            'longitude': position.longitude,
            'latitude': position.latitude,
            'accuracy': position.accuracy,
            'heading': position.heading,
            'speed': position.speed,
          },
      }),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final body = decodeBody(response);
      throw ApiException(
          body['message']?.toString() ?? 'ອັບເດດ Online ບໍ່ສຳເລັດ');
    }
  }

  Future<void> sendDriverLocation(Position position) async {
    final response = await http.patch(
      Uri.parse('${session.apiBaseUrl}/driver/location'),
      headers: headers,
      body: jsonEncode({
        'longitude': position.longitude,
        'latitude': position.latitude,
        'accuracy': position.accuracy,
        'heading': position.heading,
        'speed': position.speed,
      }),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final body = decodeBody(response);
      throw ApiException(
          body['message']?.toString() ?? 'ສົ່ງຕຳແໜ່ງຄົນຂັບບໍ່ສຳເລັດ');
    }
  }

  Future<void> sendLocation(String bookingId, Position position) async {
    final response = await http.patch(
      Uri.parse('${session.apiBaseUrl}/driver/bookings/$bookingId/location'),
      headers: headers,
      body: jsonEncode({
        'longitude': position.longitude,
        'latitude': position.latitude,
        'accuracy': position.accuracy,
        'heading': position.heading,
        'speed': position.speed,
      }),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final body = decodeBody(response);
      throw ApiException(body['message']?.toString() ?? 'ສົ່ງ GPS ບໍ່ສຳເລັດ');
    }
  }
}

LocationSettings driverLocationSettings() {
  return AndroidSettings(
    accuracy: LocationAccuracy.high,
    distanceFilter: 10,
    intervalDuration: const Duration(seconds: 8),
    foregroundNotificationConfig: const ForegroundNotificationConfig(
      notificationTitle: 'TAXILAO Driver ກຳລັງສົ່ງ GPS',
      notificationText: 'ເປີດ Online ເພື່ອຮັບງານ ແລະສົ່ງຕຳແໜ່ງແບບ realtime.',
      enableWakeLock: true,
      setOngoing: true,
    ),
  );
}

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.session});

  final DriverSession session;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final usernameController = TextEditingController();
  final passwordController = TextEditingController();
  bool submitting = false;

  @override
  void dispose() {
    usernameController.dispose();
    passwordController.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (submitting) return;
    setState(() => submitting = true);
    try {
      await widget.session.login(
        username: usernameController.text,
        password: passwordController.text,
      );
    } catch (error) {
      if (mounted) showSnack(context, error.toString());
    } finally {
      if (mounted) setState(() => submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 460),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const BrandHeader(),
                  const SizedBox(height: 28),
                  const Text('ແອບຄົນຂັບ TAXILAO',
                      style:
                          TextStyle(fontSize: 30, fontWeight: FontWeight.w900)),
                  const SizedBox(height: 8),
                  const Text(
                    'ເຂົ້າລະບົບເພື່ອຮັບງານ, ສົ່ງ GPS realtime ແລະຈັດການສະຖານະການເດີນທາງ.',
                    style: TextStyle(color: Color(0xffaeb8c7), height: 1.5),
                  ),
                  const SizedBox(height: 24),
                  AppPanel(
                    child: Column(
                      children: [
                        TextField(
                          controller: usernameController,
                          decoration: const InputDecoration(
                            labelText: 'ຊື່ຜູ້ຂັບ ຫຼື username',
                            prefixIcon: Icon(Icons.person_outline),
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: passwordController,
                          obscureText: true,
                          decoration: const InputDecoration(
                              labelText: 'ລະຫັດຜ່ານ',
                              prefixIcon: Icon(Icons.lock_outline)),
                        ),
                        const SizedBox(height: 18),
                        SizedBox(
                          width: double.infinity,
                          height: 52,
                          child: FilledButton.icon(
                            onPressed: submitting ? null : submit,
                            icon: submitting
                                ? const SizedBox(
                                    width: 18,
                                    height: 18,
                                    child: CircularProgressIndicator(
                                        strokeWidth: 2))
                                : const Icon(Icons.login),
                            label: Text(
                                submitting ? 'ກຳລັງເຂົ້າ...' : 'ເຂົ້າສູ່ລະບົບ'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class DriverHomeScreen extends StatefulWidget {
  const DriverHomeScreen({super.key, required this.session});

  final DriverSession session;

  @override
  State<DriverHomeScreen> createState() => _DriverHomeScreenState();
}

class _DriverHomeScreenState extends State<DriverHomeScreen> {
  late final DriverApi api;
  final AudioPlayer newOrderPlayer = AudioPlayer();
  final AudioPlayer acceptedPlayer = AudioPlayer();
  final AudioPlayer autoAcceptedPlayer = AudioPlayer();
  final FlutterLocalNotificationsPlugin localNotifications =
      FlutterLocalNotificationsPlugin();
  Timer? refreshTimer;
  Timer? countdownTimer;
  StreamSubscription<Position>? gpsSubscription;
  List<DriverBooking> bookings = [];
  String message = '';
  bool loading = true;
  bool online = false;
  bool autoAccept = false;
  bool gpsActive = false;
  bool sendingStatus = false;
  int selectedTab = 0;
  DateTime? lastGpsSentAt;
  Set<String> seenOfferIds = {};
  Set<String> seenAvailableJobIds = {};
  bool jobsLoadedOnce = false;
  bool notificationsReady = false;
  Position? driverPosition;

  DriverBooking? get activeJob {
    for (final booking in bookings) {
      if (booking.isActiveForDriver) return booking;
    }
    return null;
  }

  List<DriverBooking> get openJobs {
    final active = activeJob;
    if (active != null) return [active];
    return bookings
        .where((booking) => ['PENDING', 'OFFERED'].contains(booking.status))
        .toList();
  }

  List<DriverBooking> get finishedJobs {
    final items = bookings
        .where((booking) => ['COMPLETED', 'CANCELLED'].contains(booking.status))
        .toList();
    items.sort((a, b) => b.sortDate.compareTo(a.sortDate));
    return items;
  }

  int get accountBalanceLak => widget.session.driver?.walletBalanceLak ?? 0;

  @override
  void initState() {
    super.initState();
    api = DriverApi(widget.session);
    setupDriverRuntime();
    loadJobs();
    refreshTimer = Timer.periodic(
        const Duration(seconds: 4), (_) => loadJobs(silent: true));
    countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && bookings.any((booking) => booking.status == 'OFFERED'))
        setState(() {});
    });
  }

  @override
  void dispose() {
    refreshTimer?.cancel();
    countdownTimer?.cancel();
    gpsSubscription?.cancel();
    newOrderPlayer.dispose();
    acceptedPlayer.dispose();
    autoAcceptedPlayer.dispose();
    super.dispose();
  }

  Future<void> loadJobs({bool silent = false}) async {
    if (!silent) setState(() => loading = true);
    try {
      final results =
          await Future.wait<dynamic>([api.listBookings(), api.loadProfile()]);
      final list = results[0] as List<DriverBooking>;
      final profile = results[1] as DriverProfile;
      if (!mounted) return;
      final offeredIds = list
          .where((booking) => booking.status == 'OFFERED')
          .map((booking) => booking.id)
          .toSet();
      final hasActiveJob = list.any((booking) => booking.isActiveForDriver);
      final availableJobIds = hasActiveJob
          ? <String>{}
          : list
              .where((booking) =>
                  booking.status == 'PENDING' || booking.status == 'OFFERED')
              .map((booking) => booking.id)
              .toSet();
      final newAvailableJobIds = jobsLoadedOnce
          ? availableJobIds.difference(seenAvailableJobIds)
          : <String>{};
      setState(() {
        widget.session.driver = profile;
        bookings = list;
        seenOfferIds = offeredIds;
        seenAvailableJobIds = availableJobIds;
        jobsLoadedOnce = true;
        loading = false;
        message = '';
      });
      await widget.session.updateDriverProfile(profile);
      if (newAvailableJobIds.isNotEmpty) {
        await playNewOrderSound();
        if (mounted) showSnack(context, 'ມີອໍເດີ້ໃໝ່ເຂົ້າມາ');
      }
      await ensureGpsState();
      await maybeAutoAccept();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        loading = false;
        message = error.toString();
      });
    }
  }

  Future<void> maybeAutoAccept() async {
    // Auto mode means "eligible for automatic dispatch"; the driver still taps accept.
    return;
  }

  Future<void> setupDriverRuntime() async {
    const androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const settings = InitializationSettings(android: androidSettings);
    await localNotifications.initialize(settings);
    await requestNotificationPermission();
    if (mounted) setState(() => notificationsReady = true);
  }

  Future<void> requestNotificationPermission() async {
    final status = await app_permissions.Permission.notification.status;
    if (status.isDenied || status.isRestricted || status.isLimited) {
      await app_permissions.Permission.notification.request();
    }
  }

  Future<void> showDriverNotification({
    required int id,
    required String title,
    required String body,
  }) async {
    if (!notificationsReady) return;
    const androidDetails = AndroidNotificationDetails(
      'taxilao_driver_orders',
      'TAXILAO driver orders',
      channelDescription:
          'Notifications for new and accepted TAXILAO driver jobs.',
      importance: Importance.max,
      priority: Priority.high,
      playSound: true,
      enableVibration: true,
      ticker: 'TAXILAO Driver',
      category: AndroidNotificationCategory.transport,
    );
    await localNotifications.show(
      id,
      title,
      body,
      const NotificationDetails(android: androidDetails),
    );
  }

  Future<void> playNewOrderSound() async {
    await SystemSound.play(SystemSoundType.alert);
    await HapticFeedback.heavyImpact();
    await newOrderPlayer.stop();
    await newOrderPlayer.play(AssetSource('sounds/new_order.wav'));
    await showDriverNotification(
      id: 1001,
      title: 'ມີອໍເດີ້ TAXILAO ໃໝ່',
      body: 'ກົດເຂົ້າແອບເພື່ອເບິ່ງຈຸດຮັບ ແລະຮັບງານພາຍໃນ 30 ວິນາທີ.',
    );
  }

  Future<void> playAcceptedSound() async {
    await SystemSound.play(SystemSoundType.click);
    await HapticFeedback.mediumImpact();
    await acceptedPlayer.stop();
    await acceptedPlayer.play(AssetSource('sounds/order_accepted.wav'));
    await showDriverNotification(
      id: 1002,
      title: 'ຮັບອໍເດີ້ແລ້ວ',
      body: 'ເປີດ GPS ໄວ້ ແລະໄປຮັບລູກຄ້າຕາມຈຸດຮັບ.',
    );
  }

  Future<void> playAutoAcceptedSound() async {
    await SystemSound.play(SystemSoundType.click);
    await HapticFeedback.heavyImpact();
    await autoAcceptedPlayer.stop();
    await autoAcceptedPlayer.play(AssetSource('sounds/auto_accepted.wav'));
    await showDriverNotification(
      id: 1003,
      title: 'ຮັບອໍເດີ້ອັດຕະໂນມັດແລ້ວ',
      body: 'ລະບົບມອບງານໃຫ້ເຈົ້າ ກະລຸນາໄປຮັບລູກຄ້າ.',
    );
  }

  Future<void> syncAvailability() async {
    Position? position;
    if (online) {
      final allowed = await requestLocationPermission();
      if (!allowed) {
        online = false;
        autoAccept = false;
        if (mounted) setState(() {});
      } else {
        position = await Geolocator.getCurrentPosition(
          locationSettings:
              const LocationSettings(accuracy: LocationAccuracy.high),
        );
        driverPosition = position;
      }
    }
    await api.updateAvailability(
        online: online, autoAccept: autoAccept, position: position);
  }

  Future<void> changeStatus(DriverBooking booking, String status,
      {bool auto = false}) async {
    if (sendingStatus) return;
    setState(() => sendingStatus = true);
    try {
      final updated = await api.updateStatus(booking.id, status);
      if (!mounted) return;
      setState(() {
        bookings = bookings
            .map((item) => item.id == updated.id ? updated : item)
            .toList();
        if (!bookings.any((item) => item.id == updated.id))
          bookings = [updated, ...bookings];
        message = auto ? 'ຮັບງານອັດຕະໂນມັດແລ້ວ' : 'ອັບເດດສະຖານະແລ້ວ';
      });
      if (status == 'CONFIRMED') {
        if (auto) {
          await playAutoAcceptedSound();
        } else {
          await playAcceptedSound();
        }
      }
      await loadJobs(silent: true);
    } catch (error) {
      if (mounted) showSnack(context, error.toString());
    } finally {
      if (mounted) setState(() => sendingStatus = false);
    }
  }

  Future<void> confirmCancelBooking(DriverBooking booking) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('ຢືນຢັນຍົກເລີກອໍເດີ້'),
        content: const Text(
            'ຖ້າຍົກເລີກ ງານນີ້ຈະບໍ່ຢູ່ໃນງານທີ່ເຈົ້າກຳລັງຮັບ. ກະລຸນາຍົກເລີກເມື່ອຈຳເປັນເທົ່ານັ້ນ.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(dialogContext).pop(false),
              child: const Text('ບໍ່ຍົກເລີກ')),
          FilledButton(
            style: FilledButton.styleFrom(
                backgroundColor: const Color(0xffef4444)),
            onPressed: () => Navigator.of(dialogContext).pop(true),
            child: const Text('ຍົກເລີກອໍເດີ້'),
          ),
        ],
      ),
    );
    if (confirmed == true) await changeStatus(booking, 'CANCELLED');
  }

  Future<void> ensureGpsState() async {
    if (!online) {
      await gpsSubscription?.cancel();
      gpsSubscription = null;
      if (mounted) setState(() => gpsActive = false);
      return;
    }
    if (gpsSubscription != null) return;
    final allowed = await requestLocationPermission();
    if (!allowed) {
      if (mounted) setState(() => gpsActive = false);
      return;
    }
    gpsSubscription =
        Geolocator.getPositionStream(locationSettings: driverLocationSettings())
            .listen((position) async {
      final currentJob = activeJob;
      final now = DateTime.now();
      if (mounted) setState(() => driverPosition = position);
      if (lastGpsSentAt != null && now.difference(lastGpsSentAt!).inSeconds < 5)
        return;
      lastGpsSentAt = now;
      try {
        if (currentJob == null) {
          await api.sendDriverLocation(position);
        } else {
          await api.sendLocation(currentJob.id, position);
        }
        if (mounted) setState(() => gpsActive = true);
      } catch (_) {
        if (mounted) setState(() => gpsActive = false);
      }
    });
    if (mounted) setState(() => gpsActive = true);
  }

  Future<bool> requestLocationPermission() async {
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      if (mounted) showSnack(context, 'ກະລຸນາເປີດ GPS ໃນເຄື່ອງ');
      return false;
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied)
      permission = await Geolocator.requestPermission();
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      if (mounted) showSnack(context, 'ກະລຸນາອະນຸຍາດ location ໃຫ້ແອບ');
      return false;
    }
    if (permission == LocationPermission.whileInUse) {
      if (mounted) {
        await showDialog<void>(
          context: context,
          builder: (dialogContext) => AlertDialog(
            title: const Text('ຕ້ອງເປີດຕຳແໜ່ງຕະຫຼອດ'),
            content: const Text(
                'ເພື່ອຮັບງານ ແລະສົ່ງ GPS ຂະນະແອບຢູ່ເບື້ອງຫຼັງ, ກະລຸນາເລືອກ Allow all the time ໃນ Settings.'),
            actions: [
              TextButton(
                  onPressed: () => Navigator.of(dialogContext).pop(),
                  child: const Text('ປິດ')),
              FilledButton(
                onPressed: () {
                  Navigator.of(dialogContext).pop();
                  Geolocator.openAppSettings();
                },
                child: const Text('ເປີດ Settings'),
              ),
            ],
          ),
        );
      }
      return false;
    }
    return true;
  }

  void openFloatingChat(DriverBooking booking) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xff0d121b),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (sheetContext) {
        return SafeArea(
          child: Padding(
            padding: EdgeInsets.only(
              left: 16,
              right: 16,
              top: 12,
              bottom: MediaQuery.of(sheetContext).viewInsets.bottom + 16,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    const Icon(Icons.chat_bubble_outline,
                        color: Color(0xfff1c45d)),
                    const SizedBox(width: 8),
                    Expanded(
                        child: Text('ແຊັດກັບ ${booking.customerName}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style:
                                const TextStyle(fontWeight: FontWeight.w900))),
                    IconButton(
                        onPressed: () => Navigator.pop(sheetContext),
                        icon: const Icon(Icons.close)),
                  ],
                ),
                const SizedBox(height: 8),
                DriverCustomerActions(api: api, booking: booking),
              ],
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final driver = widget.session.driver!;
    final activeChatJob = activeJob;
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xff0d121b),
        title: const BrandHeader(compact: true),
        actions: [
          IconButton(
              tooltip: 'Refresh',
              onPressed: () => loadJobs(),
              icon: const Icon(Icons.refresh)),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => loadJobs(),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 32),
          children: [
            if (selectedTab == 0) ...[
              DriverStatusPanel(
                driver: driver,
                online: online,
                autoAccept: autoAccept,
                gpsActive: gpsActive,
                activeJob: activeJob,
                onOnlineChanged: (value) async {
                  if (value) {
                    final allowed = await requestLocationPermission();
                    if (!allowed) {
                      setState(() {
                        online = false;
                        autoAccept = false;
                      });
                      return;
                    }
                  }
                  setState(() {
                    online = value;
                    if (!value) autoAccept = false;
                  });
                  try {
                    await syncAvailability();
                  } catch (error) {
                    if (mounted) showSnack(context, error.toString());
                  }
                  await ensureGpsState();
                  await loadJobs(silent: true);
                  await maybeAutoAccept();
                },
                onAutoAcceptChanged: (value) async {
                  if (value) {
                    final allowed = await requestLocationPermission();
                    if (!allowed) {
                      setState(() => autoAccept = false);
                      return;
                    }
                  }
                  setState(() => autoAccept = value);
                  try {
                    await syncAvailability();
                  } catch (error) {
                    if (mounted) showSnack(context, error.toString());
                  }
                  await loadJobs(silent: true);
                  await maybeAutoAccept();
                },
              ),
              if (message.isNotEmpty) ...[
                const SizedBox(height: 12),
                InfoBanner(message: message)
              ],
              const SizedBox(height: 14),
              if (online && openJobs.isEmpty && !loading) ...[
                ScannerPanel(autoAccept: autoAccept, gpsActive: gpsActive),
                const SizedBox(height: 14),
              ],
              SectionTitle(title: 'ງານກຳລັງຮັບ', count: openJobs.length),
              if (loading)
                const Padding(
                    padding: EdgeInsets.all(28),
                    child: Center(child: CircularProgressIndicator()))
              else if (openJobs.isEmpty)
                EmptyState(
                    text: online
                        ? 'ກຳລັງສະແກນຫາອໍເດີ້ໃກ້ໆ...'
                        : 'ເປີດ Online ເພື່ອຮັບອໍເດີ້')
              else
                ...openJobs.map(
                  (booking) => JobCard(
                    booking: booking,
                    busy: sendingStatus,
                    compact: true,
                    driverPosition: driverPosition,
                    onStatus: (status) => status == 'CANCELLED'
                        ? confirmCancelBooking(booking)
                        : changeStatus(booking, status),
                    onOpenDetails: () => showBookingDetails(context, booking,
                        api: api, driverPosition: driverPosition),
                  ),
                ),
            ],
            if (selectedTab == 1) ...[
              SectionTitle(title: 'ປະຫວັດອໍເດີ້', count: finishedJobs.length),
              if (finishedJobs.isEmpty)
                const EmptyState(text: 'ຍັງບໍ່ມີປະຫວັດ')
              else
                ...finishedJobs.map(
                  (booking) => JobCard(
                    booking: booking,
                    busy: true,
                    compact: true,
                    driverPosition: driverPosition,
                    onStatus: (_) {},
                    onOpenDetails: () => showBookingDetails(context, booking,
                        api: api, driverPosition: driverPosition),
                  ),
                ),
            ],
            if (selectedTab == 2) ...[
              DriverProfilePanel(
                driver: driver,
                online: online,
                autoAccept: autoAccept,
                gpsActive: gpsActive,
                balanceLak: accountBalanceLak,
                completedJobs: finishedJobs
                    .where((booking) => booking.status == 'COMPLETED')
                    .length,
                completedBookings: finishedJobs
                    .where((booking) => booking.status == 'COMPLETED')
                    .toList(),
                onLogout: widget.session.logout,
              ),
            ],
          ],
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: selectedTab,
        onDestinationSelected: (index) => setState(() => selectedTab = index),
        backgroundColor: const Color(0xff0d121b),
        indicatorColor: const Color(0xff2a2416),
        destinations: const [
          NavigationDestination(
              icon: Icon(Icons.local_taxi_outlined),
              selectedIcon: Icon(Icons.local_taxi),
              label: 'ງານ'),
          NavigationDestination(
              icon: Icon(Icons.history_outlined),
              selectedIcon: Icon(Icons.history),
              label: 'ປະຫວັດ'),
          NavigationDestination(
              icon: Icon(Icons.person_outline),
              selectedIcon: Icon(Icons.person),
              label: 'ໂປຣໄຟ'),
        ],
      ),
      floatingActionButton: activeChatJob == null
          ? null
          : FloatingActionButton.extended(
              onPressed: () => openFloatingChat(activeChatJob),
              backgroundColor: const Color(0xfff1c45d),
              foregroundColor: const Color(0xff15110a),
              icon: const Icon(Icons.chat_bubble_outline),
              label: const Text('ແຊັດ'),
            ),
    );
  }
}

class DriverStatusPanel extends StatelessWidget {
  const DriverStatusPanel({
    super.key,
    required this.driver,
    required this.online,
    required this.autoAccept,
    required this.gpsActive,
    required this.activeJob,
    required this.onOnlineChanged,
    required this.onAutoAcceptChanged,
  });

  final DriverProfile driver;
  final bool online;
  final bool autoAccept;
  final bool gpsActive;
  final DriverBooking? activeJob;
  final ValueChanged<bool> onOnlineChanged;
  final ValueChanged<bool> onAutoAcceptChanged;

  @override
  Widget build(BuildContext context) {
    return AppPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 27,
                backgroundColor: const Color(0xfff1c45d),
                child: Text(initials(driver.name),
                    style: const TextStyle(
                        color: Color(0xff15110a), fontWeight: FontWeight.w900)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(driver.name,
                        style: const TextStyle(
                            fontSize: 18, fontWeight: FontWeight.w900)),
                    const SizedBox(height: 3),
                    Text('${driver.city} · ${driver.vehicleType}',
                        style: const TextStyle(color: Color(0xffaeb8c7))),
                  ],
                ),
              ),
              StatusPill(text: online ? 'ONLINE' : 'OFFLINE', active: online),
            ],
          ),
          const SizedBox(height: 16),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: online,
            onChanged: onOnlineChanged,
            title: const Text('ພ້ອມຮັບງານ'),
            subtitle: const Text('ເປີດເພື່ອໃຫ້ລະບົບສົ່ງງານໃຫ້'),
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: autoAccept,
            onChanged: online ? onAutoAcceptChanged : null,
            title: const Text('ຮັບງານອັດຕະໂນມັດ'),
            subtitle: const Text('ຮັບງານ taxi ໃໝ່ເມື່ອບໍ່ມີງານ active'),
          ),
          const Divider(color: Color(0xff263244)),
          Row(
            children: [
              Expanded(
                  child: MiniMetric(
                      icon: Icons.route,
                      label: 'ງານ active',
                      value: activeJob?.shortId ?? '-')),
              Expanded(
                  child: MiniMetric(
                      icon: Icons.gps_fixed,
                      label: 'GPS',
                      value: gpsActive ? 'ກຳລັງສົ່ງ' : 'ພັກ')),
            ],
          ),
        ],
      ),
    );
  }
}

class DriverProfilePanel extends StatelessWidget {
  const DriverProfilePanel({
    super.key,
    required this.driver,
    required this.online,
    required this.autoAccept,
    required this.gpsActive,
    required this.balanceLak,
    required this.completedJobs,
    required this.completedBookings,
    required this.onLogout,
  });

  final DriverProfile driver;
  final bool online;
  final bool autoAccept;
  final bool gpsActive;
  final int balanceLak;
  final int completedJobs;
  final List<DriverBooking> completedBookings;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
    final earnings = DriverEarnings.fromBookings(completedBookings);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AppPanel(
          highlight: true,
          child: Column(
            children: [
              CircleAvatar(
                radius: 48,
                backgroundColor: const Color(0xfff1c45d),
                backgroundImage: driver.portraitUrl.isNotEmpty
                    ? NetworkImage(driver.portraitUrl)
                    : null,
                child: driver.portraitUrl.isEmpty
                    ? Text(initials(driver.name),
                        style: const TextStyle(
                            color: Color(0xff15110a),
                            fontSize: 26,
                            fontWeight: FontWeight.w900))
                    : null,
              ),
              const SizedBox(height: 12),
              Text(driver.name,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                      fontSize: 23, fontWeight: FontWeight.w900)),
              const SizedBox(height: 4),
              Text('ID: ${driver.id}',
                  style: const TextStyle(color: Color(0xffaeb8c7))),
              const SizedBox(height: 10),
              StatusPill(text: online ? 'ONLINE' : 'OFFLINE', active: online),
            ],
          ),
        ),
        const SizedBox(height: 12),
        AppPanel(
          highlight: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                children: [
                  Icon(Icons.payments_outlined, color: Color(0xfff1c45d)),
                  SizedBox(width: 8),
                  Text('ລາຍຮັບ',
                      style:
                          TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                      child: EarningBox(
                          label: 'ມື້ນີ້', value: earnings.todayLak)),
                  const SizedBox(width: 8),
                  Expanded(
                      child:
                          EarningBox(label: 'ອາທິດ', value: earnings.weekLak)),
                  const SizedBox(width: 8),
                  Expanded(
                      child:
                          EarningBox(label: 'ເດືອນ', value: earnings.monthLak)),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 12),
        AppPanel(
          child: Column(
            children: [
              DetailLine(
                  label: 'ຍອດເງິນ', value: 'LAK ${formatLak(balanceLak)}'),
              if (driver.walletLowBalance)
                DetailLine(
                    label: 'ແຈ້ງເຕືອນ', value: 'ຍອດເງິນໃກ້ໝົດ ກະລຸນາເຕີມເງິນ'),
              DetailLine(label: 'ງານສຳເລັດ', value: '$completedJobs'),
              DetailLine(
                  label: 'ເມືອງ',
                  value: driver.city.isEmpty ? '-' : driver.city),
              DetailLine(
                  label: 'ລົດ',
                  value: driver.vehicleType.isEmpty ? '-' : driver.vehicleType),
              DetailLine(label: 'Auto', value: autoAccept ? 'ເປີດ' : 'ປິດ'),
              DetailLine(label: 'GPS', value: gpsActive ? 'ກຳລັງສົ່ງ' : 'ພັກ'),
            ],
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          height: 48,
          child: OutlinedButton.icon(
            onPressed: onLogout,
            icon: const Icon(Icons.logout),
            label: const Text('ອອກຈາກລະບົບ'),
          ),
        ),
      ],
    );
  }
}

class EarningBox extends StatelessWidget {
  const EarningBox({super.key, required this.label, required this.value});

  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: const Color(0xff0d1624),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xff263244)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: const TextStyle(
                  color: Color(0xff9ba7b7),
                  fontSize: 11,
                  fontWeight: FontWeight.w800)),
          const SizedBox(height: 5),
          Text('LAK ${formatLak(value)}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                  color: Color(0xfff1c45d),
                  fontWeight: FontWeight.w900,
                  fontSize: 13)),
        ],
      ),
    );
  }
}

class DriverEarnings {
  const DriverEarnings(
      {required this.todayLak, required this.weekLak, required this.monthLak});

  final int todayLak;
  final int weekLak;
  final int monthLak;

  factory DriverEarnings.fromBookings(List<DriverBooking> bookings) {
    final now = DateTime.now();
    final todayStart = DateTime(now.year, now.month, now.day);
    final weekStart =
        todayStart.subtract(Duration(days: todayStart.weekday - 1));
    final monthStart = DateTime(now.year, now.month);
    var today = 0;
    var week = 0;
    var month = 0;
    for (final booking in bookings) {
      final date = booking.completedAt ??
          booking.updatedAt ??
          booking.pickupAt ??
          booking.createdAt;
      if (date == null) continue;
      final amount = booking.estimatedPriceLak;
      if (!date.isBefore(todayStart)) today += amount;
      if (!date.isBefore(weekStart)) week += amount;
      if (!date.isBefore(monthStart)) month += amount;
    }
    return DriverEarnings(todayLak: today, weekLak: week, monthLak: month);
  }
}

class ScannerPanel extends StatefulWidget {
  const ScannerPanel(
      {super.key, required this.autoAccept, required this.gpsActive});

  final bool autoAccept;
  final bool gpsActive;

  @override
  State<ScannerPanel> createState() => _ScannerPanelState();
}

class _ScannerPanelState extends State<ScannerPanel>
    with SingleTickerProviderStateMixin {
  late final AnimationController controller;

  @override
  void initState() {
    super.initState();
    controller =
        AnimationController(vsync: this, duration: const Duration(seconds: 2))
          ..repeat();
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AppPanel(
      highlight: true,
      child: Row(
        children: [
          SizedBox(
            width: 74,
            height: 74,
            child: AnimatedBuilder(
              animation: controller,
              builder: (context, child) {
                return Stack(
                  alignment: Alignment.center,
                  children: [
                    Transform.scale(
                      scale: 0.65 + controller.value * 0.55,
                      child: Opacity(
                        opacity: 1 - controller.value,
                        child: Container(
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                                color: const Color(0xfff1c45d), width: 2),
                          ),
                        ),
                      ),
                    ),
                    Container(
                      width: 44,
                      height: 44,
                      decoration: const BoxDecoration(
                          color: Color(0xfff1c45d), shape: BoxShape.circle),
                      child: const Icon(Icons.radar, color: Color(0xff15110a)),
                    ),
                  ],
                );
              },
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('ກຳລັງສະແກນອໍເດີ້ໃກ້ໆ',
                    style:
                        TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
                const SizedBox(height: 5),
                Text(
                  widget.autoAccept
                      ? 'Auto ເປີດຢູ່: ຖ້າມີອໍເດີ້ໃກ້ຈະສົ່ງມາໃຫ້ກົດຮັບ.'
                      : 'ເປີດ Auto ເພື່ອຮັບອໍເດີ້ໃກ້ໆໄວຂຶ້ນ.',
                  style: const TextStyle(color: Color(0xffaeb8c7), height: 1.4),
                ),
                const SizedBox(height: 8),
                StatusPill(
                    text: widget.gpsActive ? 'GPS LIVE' : 'GPS WAITING',
                    active: widget.gpsActive),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class JobCard extends StatelessWidget {
  const JobCard({
    super.key,
    required this.booking,
    required this.busy,
    required this.onStatus,
    this.compact = false,
    this.onOpenDetails,
    this.driverPosition,
  });

  final DriverBooking booking;
  final bool busy;
  final bool compact;
  final ValueChanged<String> onStatus;
  final VoidCallback? onOpenDetails;
  final Position? driverPosition;

  @override
  Widget build(BuildContext context) {
    final action = booking.nextAction;
    final secondsLeft = booking.offerSecondsLeft;
    final pickupDistanceKm = driverDistanceToPickupKm(driverPosition, booking);
    if (compact) {
      return Padding(
        padding: const EdgeInsets.only(top: 8),
        child: InkWell(
          onTap: onOpenDetails,
          borderRadius: BorderRadius.circular(8),
          child: AppPanel(
            highlight:
                booking.status == 'PENDING' || booking.status == 'OFFERED',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(booking.bookingTypeLabel,
                                  style: const TextStyle(
                                      color: Color(0xfff1c45d),
                                      fontWeight: FontWeight.w900,
                                      fontSize: 11)),
                              const SizedBox(width: 6),
                              Text('#${booking.shortId}',
                                  style: const TextStyle(
                                      color: Color(0xff8d99aa), fontSize: 11)),
                            ],
                          ),
                          const SizedBox(height: 6),
                          CompactRouteLine(
                              icon: Icons.my_location, text: booking.pickup),
                          const SizedBox(height: 4),
                          CompactRouteLine(
                              icon: Icons.flag_outlined,
                              text: booking.dropoff.isEmpty
                                  ? 'ບໍ່ລະບຸຈຸດສົ່ງ'
                                  : booking.dropoff),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        StatusPill(
                            text: booking.statusLabel,
                            active: booking.isActiveForDriver),
                        const SizedBox(height: 8),
                        Text(booking.priceLabel,
                            style: const TextStyle(
                                color: Color(0xfff1c45d),
                                fontWeight: FontWeight.w900,
                                fontSize: 13)),
                        Text('${booking.distanceKm.toStringAsFixed(1)} km',
                            style: const TextStyle(
                                color: Color(0xffaeb8c7), fontSize: 11)),
                        if (pickupDistanceKm != null)
                          Text('ຫ່າງ ${pickupDistanceKm.toStringAsFixed(1)} km',
                              style: const TextStyle(
                                  color: Color(0xfff1c45d),
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800)),
                      ],
                    ),
                  ],
                ),
                if (booking.status == 'OFFERED' && secondsLeft != null) ...[
                  const SizedBox(height: 8),
                  LinearProgressIndicator(
                    value: (secondsLeft / 30).clamp(0, 1),
                    minHeight: 4,
                    color: const Color(0xfff1c45d),
                    backgroundColor: const Color(0xff2b3443),
                  ),
                  const SizedBox(height: 5),
                  Text('ກົດຮັບພາຍໃນ $secondsLeft ວິນາທີ',
                      style: const TextStyle(
                          color: Color(0xfff1c45d),
                          fontWeight: FontWeight.w800,
                          fontSize: 11)),
                ],
                const SizedBox(height: 10),
                CustomerPreview(booking: booking),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: onOpenDetails,
                        icon: const Icon(Icons.map_outlined, size: 18),
                        label: const Text('ລາຍລະອຽດ'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    if (booking.isActiveForDriver) ...[
                      IconButton(
                        tooltip: 'ຍົກເລີກງານ',
                        onPressed: busy ? null : () => onStatus('CANCELLED'),
                        icon: const Icon(Icons.cancel_outlined,
                            color: Color(0xffff9b9b)),
                      ),
                      const SizedBox(width: 8),
                    ],
                    if (action != null)
                      Expanded(
                        child: FilledButton.icon(
                          onPressed:
                              busy ? null : () => onStatus(action.status),
                          icon: Icon(action.icon, size: 18),
                          label: Text(action.shortLabel),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: InkWell(
        onTap: compact ? onOpenDetails : null,
        borderRadius: BorderRadius.circular(8),
        child: AppPanel(
          highlight: booking.status == 'PENDING' || booking.status == 'OFFERED',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(booking.bookingTypeLabel,
                            style: const TextStyle(
                                color: Color(0xfff1c45d),
                                fontWeight: FontWeight.w800,
                                fontSize: 12)),
                        const SizedBox(height: 5),
                        Text(booking.pickup,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                                fontSize: 17, fontWeight: FontWeight.w900)),
                      ],
                    ),
                  ),
                  StatusPill(
                      text: booking.statusLabel,
                      active: booking.isActiveForDriver),
                ],
              ),
              if (booking.status == 'OFFERED' && secondsLeft != null) ...[
                const SizedBox(height: 8),
                LinearProgressIndicator(
                  value: (secondsLeft / 30).clamp(0, 1),
                  minHeight: 5,
                  color: const Color(0xfff1c45d),
                  backgroundColor: const Color(0xff2b3443),
                ),
                const SizedBox(height: 6),
                Text('ກົດຮັບພາຍໃນ $secondsLeft ວິນາທີ ກ່ອນສົ່ງໃຫ້ຄົນຖັດໄປ',
                    style: const TextStyle(
                        color: Color(0xfff1c45d),
                        fontWeight: FontWeight.w800,
                        fontSize: 12)),
              ],
              if (compact) ...[
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                        child: Text(
                            booking.dropoff.isEmpty
                                ? 'ບໍ່ໄດ້ລະບຸຈຸດສົ່ງ'
                                : booking.dropoff,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(color: Color(0xffaeb8c7)))),
                    const SizedBox(width: 8),
                    Text(booking.priceLabel,
                        style: const TextStyle(
                            color: Color(0xfff1c45d),
                            fontWeight: FontWeight.w900)),
                  ],
                ),
              ],
              if (!compact) ...[
                const SizedBox(height: 12),
                CustomerPreview(booking: booking),
                const SizedBox(height: 12),
                JobLine(
                    icon: Icons.location_on_outlined,
                    label: 'ຈຸດສົ່ງ',
                    value: booking.dropoff.isEmpty
                        ? 'ບໍ່ໄດ້ລະບຸ'
                        : booking.dropoff),
                if (booking.canViewCustomerContact)
                  JobLine(
                      icon: Icons.phone_outlined,
                      label: 'ເບີໂທ',
                      value: booking.customerPhone),
                JobLine(
                    icon: Icons.payments_outlined,
                    label: 'ລາຄາ',
                    value: booking.priceLabel),
                JobLine(
                    icon: Icons.straighten,
                    label: 'ໄລຍະທາງ',
                    value: '${booking.distanceKm.toStringAsFixed(2)} km'),
                if (pickupDistanceKm != null)
                  JobLine(
                      icon: Icons.near_me_outlined,
                      label: 'ຫ່າງຈາກເຈົ້າ',
                      value:
                          '${pickupDistanceKm.toStringAsFixed(2)} km ຫາຈຸດຮັບ'),
                if (booking.canViewCustomerContact && booking.note.isNotEmpty)
                  JobLine(
                      icon: Icons.notes, label: 'ໝາຍເຫດ', value: booking.note),
                const SizedBox(height: 12),
                Row(
                  children: [
                    if (booking.canViewCustomerContact) ...[
                      Expanded(
                          child: OutlinedButton.icon(
                              onPressed: booking.customerPhone.isEmpty
                                  ? null
                                  : () => launchPhone(booking.customerPhone),
                              icon: const Icon(Icons.call),
                              label: const Text('ໂທ'))),
                      const SizedBox(width: 8),
                    ],
                    Expanded(
                        child: OutlinedButton.icon(
                            onPressed: booking.hasPickup
                                ? () => launchMap(booking.pickupLocation)
                                : null,
                            icon: const Icon(Icons.navigation_outlined),
                            label: const Text('ນຳທາງ'))),
                  ],
                ),
                if (action != null) ...[
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: FilledButton.icon(
                        onPressed: busy ? null : () => onStatus(action.status),
                        icon: Icon(action.icon),
                        label: Text(action.label)),
                  ),
                ],
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class CompactRouteLine extends StatelessWidget {
  const CompactRouteLine({super.key, required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 15, color: const Color(0xfff1c45d)),
        const SizedBox(width: 6),
        Expanded(
            child: Text(text,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                    fontSize: 13, fontWeight: FontWeight.w700))),
      ],
    );
  }
}

class BrandHeader extends StatelessWidget {
  const BrandHeader({super.key, this.compact = false});

  final bool compact;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: compact ? 34 : 42,
          height: compact ? 34 : 42,
          alignment: Alignment.center,
          decoration:
              BoxDecoration(border: Border.all(color: const Color(0xffb89445))),
          child: const Text('TL',
              style: TextStyle(
                  color: Color(0xfff1c45d), fontWeight: FontWeight.w900)),
        ),
        const SizedBox(width: 10),
        const Text('TAXILAO DRIVER',
            style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 0)),
      ],
    );
  }
}

class AppPanel extends StatelessWidget {
  const AppPanel({super.key, required this.child, this.highlight = false});

  final Widget child;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: highlight ? const Color(0xff172334) : const Color(0xff101722),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(
            color:
                highlight ? const Color(0xffb89445) : const Color(0xff243044)),
        boxShadow: const [
          BoxShadow(
              color: Color(0x55000000), blurRadius: 18, offset: Offset(0, 10))
        ],
      ),
      child: child,
    );
  }
}

class StatusPill extends StatelessWidget {
  const StatusPill({super.key, required this.text, required this.active});

  final String text;
  final bool active;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: active ? const Color(0xff06351f) : const Color(0xff242936),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(
            color: active ? const Color(0xff23c47a) : const Color(0xff3a4352)),
      ),
      child: Text(
        text,
        style: TextStyle(
            color: active ? const Color(0xff8df0bf) : const Color(0xffc6cfda),
            fontSize: 11,
            fontWeight: FontWeight.w900),
      ),
    );
  }
}

class MiniMetric extends StatelessWidget {
  const MiniMetric(
      {super.key,
      required this.icon,
      required this.label,
      required this.value});

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, color: const Color(0xfff1c45d), size: 20),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label,
                  style:
                      const TextStyle(color: Color(0xff8d99aa), fontSize: 12)),
              Text(value,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w900)),
            ],
          ),
        ),
      ],
    );
  }
}

class SectionTitle extends StatelessWidget {
  const SectionTitle({super.key, required this.title, required this.count});

  final String title;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(title,
            style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w900)),
        const SizedBox(width: 8),
        StatusPill(text: count.toString(), active: count > 0),
      ],
    );
  }
}

class JobLine extends StatelessWidget {
  const JobLine(
      {super.key,
      required this.icon,
      required this.label,
      required this.value});

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: const Color(0xfff1c45d)),
          const SizedBox(width: 8),
          SizedBox(
              width: 78,
              child: Text(label,
                  style:
                      const TextStyle(color: Color(0xff9ba7b7), fontSize: 12))),
          Expanded(
              child: Text(value,
                  style: const TextStyle(fontWeight: FontWeight.w700))),
        ],
      ),
    );
  }
}

class InfoBanner extends StatelessWidget {
  const InfoBanner({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xff10251b),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xff1f9d62)),
      ),
      child: Row(
        children: [
          const Icon(Icons.check_circle_outline, color: Color(0xff8df0bf)),
          const SizedBox(width: 8),
          Expanded(child: Text(message)),
        ],
      ),
    );
  }
}

class EmptyState extends StatelessWidget {
  const EmptyState({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: AppPanel(
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(18),
            child: Text(text, style: const TextStyle(color: Color(0xffaeb8c7))),
          ),
        ),
      ),
    );
  }
}

class DetailLine extends StatelessWidget {
  const DetailLine({super.key, required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
              width: 118,
              child: Text(label,
                  style:
                      const TextStyle(color: Color(0xff9ba7b7), fontSize: 12))),
          Expanded(
              child: Text(value,
                  style: const TextStyle(fontWeight: FontWeight.w800))),
        ],
      ),
    );
  }
}

class CustomerPreview extends StatelessWidget {
  const CustomerPreview({super.key, required this.booking});

  final DriverBooking booking;

  @override
  Widget build(BuildContext context) {
    final customerName = booking.customerName.trim();
    final initial =
        customerName.isEmpty ? 'T' : customerName.substring(0, 1).toUpperCase();
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xff111b26),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xff263347)),
      ),
      child: Row(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(22),
            child: booking.customerAvatarUrl.isEmpty
                ? Container(
                    width: 44,
                    height: 44,
                    alignment: Alignment.center,
                    color: const Color(0xff263347),
                    child: Text(initial,
                        style: const TextStyle(
                            color: Color(0xfff1c45d),
                            fontWeight: FontWeight.w900,
                            fontSize: 18)),
                  )
                : Image.network(
                    booking.customerAvatarUrl,
                    width: 44,
                    height: 44,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      width: 44,
                      height: 44,
                      alignment: Alignment.center,
                      color: const Color(0xff263347),
                      child: Text(initial,
                          style: const TextStyle(
                              color: Color(0xfff1c45d),
                              fontWeight: FontWeight.w900)),
                    ),
                  ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('ລູກຄ້າ',
                    style: TextStyle(color: Color(0xff9ba7b7), fontSize: 11)),
                Text(booking.customerName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                        fontWeight: FontWeight.w900, fontSize: 15)),
              ],
            ),
          ),
          const Icon(Icons.star, color: Color(0xfff1c45d), size: 18),
          const SizedBox(width: 4),
          Text(booking.customerRating.toStringAsFixed(1),
              style: const TextStyle(fontWeight: FontWeight.w900)),
          const SizedBox(width: 8),
          Text('${booking.customerTrips} trips',
              style: const TextStyle(color: Color(0xff9ba7b7), fontSize: 11)),
        ],
      ),
    );
  }
}

class DriverProfile {
  DriverProfile({
    required this.id,
    required this.name,
    required this.city,
    required this.vehicleType,
    required this.portraitUrl,
    required this.walletBalanceLak,
    required this.walletLowBalanceWarningLak,
    required this.walletLowBalance,
  });

  final String id;
  final String name;
  final String city;
  final String vehicleType;
  final String portraitUrl;
  final int walletBalanceLak;
  final int walletLowBalanceWarningLak;
  final bool walletLowBalance;

  factory DriverProfile.fromJson(Map<String, dynamic> json) {
    return DriverProfile(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? 'Driver',
      city: json['city']?.toString() ?? '',
      vehicleType: json['vehicleType']?.toString() ?? '',
      portraitUrl: json['portraitUrl']?.toString() ?? '',
      walletBalanceLak: numberToInt(json['walletBalanceLak']),
      walletLowBalanceWarningLak:
          numberToInt(json['walletLowBalanceWarningLak']),
      walletLowBalance: json['walletLowBalance'] == true,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'city': city,
        'vehicleType': vehicleType,
        'portraitUrl': portraitUrl,
        'walletBalanceLak': walletBalanceLak,
        'walletLowBalanceWarningLak': walletLowBalanceWarningLak,
        'walletLowBalance': walletLowBalance,
      };
}

class DriverBooking {
  DriverBooking({
    required this.id,
    required this.bookingType,
    required this.driverId,
    required this.pickup,
    required this.dropoff,
    required this.customerName,
    required this.customerAvatarUrl,
    required this.customerRating,
    required this.customerTrips,
    required this.customerContactVisible,
    required this.customerReviewGiven,
    required this.customerPhone,
    required this.note,
    required this.status,
    required this.estimatedPriceLak,
    required this.distanceKm,
    required this.durationMinutes,
    required this.passengers,
    required this.pickupAt,
    required this.dispatchExpiresAt,
    required this.createdAt,
    required this.updatedAt,
    required this.completedAt,
    required this.pickupLocation,
    required this.dropoffLocation,
    required this.routePoints,
  });

  final String id;
  final String bookingType;
  final String driverId;
  final String pickup;
  final String dropoff;
  final String customerName;
  final String customerAvatarUrl;
  final double customerRating;
  final int customerTrips;
  final bool customerContactVisible;
  final bool customerReviewGiven;
  final String customerPhone;
  final String note;
  final String status;
  final int estimatedPriceLak;
  final double distanceKm;
  final int durationMinutes;
  final int passengers;
  final DateTime? pickupAt;
  final DateTime? dispatchExpiresAt;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final DateTime? completedAt;
  final LatLng? pickupLocation;
  final LatLng? dropoffLocation;
  final List<map_latlng.LatLng> routePoints;

  factory DriverBooking.fromJson(Map<String, dynamic> json) {
    return DriverBooking(
      id: json['id']?.toString() ?? '',
      bookingType: json['bookingType']?.toString() ?? 'RIDE',
      driverId: json['driverId']?.toString() ?? '',
      pickup: json['pickup']?.toString() ?? '',
      dropoff: json['dropoff']?.toString() ?? '',
      customerName: ((json['customerDisplay'] is Map
                  ? json['customerDisplay']['name']
                  : null) ??
              json['customerName'] ??
              'TAXILAO customer')
          .toString(),
      customerAvatarUrl: (json['customerDisplay'] is Map
                  ? json['customerDisplay']['avatarUrl']
                  : null)
              ?.toString() ??
          '',
      customerRating: numberToDouble(json['customerDisplay'] is Map
          ? json['customerDisplay']['rating']
          : 5),
      customerTrips: numberToInt(json['customerDisplay'] is Map
          ? json['customerDisplay']['trips']
          : 0),
      customerContactVisible: json['customerContactVisible'] == true,
      customerReviewGiven: json['customerReview'] is Map &&
          json['customerReview']['rating'] != null,
      customerPhone: json['customerPhone']?.toString() ?? '',
      note: json['note']?.toString() ?? '',
      status: json['status']?.toString() ?? 'PENDING',
      estimatedPriceLak: numberToInt(json['estimatedPriceLak']),
      distanceKm: numberToDouble(json['distanceKm']),
      durationMinutes: numberToInt(json['durationMinutes']),
      passengers: numberToInt(json['passengers']),
      pickupAt: parseDate(json['pickupAt']),
      dispatchExpiresAt: parseDate(json['dispatchExpiresAt']),
      createdAt: parseDate(json['createdAt']),
      updatedAt: parseDate(json['updatedAt']),
      completedAt: parseDate(json['completedAt']),
      pickupLocation: LatLng.fromGeoJson(json['pickupLocation']),
      dropoffLocation: LatLng.fromGeoJson(json['dropoffLocation']),
      routePoints: DriverRoute.pointsFromGeometry(json['routeGeometry']),
    );
  }

  bool get isActiveForDriver =>
      ['CONFIRMED', 'ON_THE_WAY', 'IN_PROGRESS'].contains(status);

  bool get canViewCustomerContact =>
      customerContactVisible || isActiveForDriver || status == 'COMPLETED';

  bool get hasPickup => pickupLocation != null;

  bool get hasRoute => pickupLocation != null && dropoffLocation != null;

  int? get offerSecondsLeft {
    if (status != 'OFFERED' || dispatchExpiresAt == null) return null;
    final seconds = dispatchExpiresAt!.difference(DateTime.now()).inSeconds;
    return seconds.clamp(0, 30);
  }

  String get shortId => id.length > 8 ? id.substring(0, 8) : id;

  String get priceLabel => 'LAK ${formatLak(estimatedPriceLak)}';

  DateTime get sortDate =>
      completedAt ??
      updatedAt ??
      pickupAt ??
      createdAt ??
      DateTime.fromMillisecondsSinceEpoch(0);

  String get bookingTypeLabel {
    if (bookingType == 'DRIVER_RESERVATION') return 'ຈອງຄົນຂັບ';
    if (bookingType == 'TOUR') return 'ທົວ';
    return 'ເອີ້ນລົດ Taxi';
  }

  String get statusLabel {
    switch (status) {
      case 'PENDING':
        return 'ງານໃໝ່';
      case 'OFFERED':
        return 'ສົ່ງຫາເຈົ້າ';
      case 'CONFIRMED':
        return 'ຮັບແລ້ວ';
      case 'ON_THE_WAY':
        return 'ກຳລັງໄປຮັບ';
      case 'IN_PROGRESS':
        return 'ກຳລັງເດີນທາງ';
      case 'COMPLETED':
        return 'ສຳເລັດ';
      case 'CANCELLED':
        return 'ຍົກເລີກ';
      default:
        return status;
    }
  }

  JobAction? get nextAction {
    switch (status) {
      case 'PENDING':
        return const JobAction('CONFIRMED', 'ຮັບງານ', Icons.task_alt);
      case 'OFFERED':
        return const JobAction('CONFIRMED', 'ຮັບອໍເດີ້', Icons.task_alt);
      case 'CONFIRMED':
        return const JobAction(
            'ON_THE_WAY', 'ອອກໄປຮັບລູກຄ້າ', Icons.local_taxi);
      case 'ON_THE_WAY':
        return const JobAction('IN_PROGRESS', 'ເລີ່ມເດີນທາງ', Icons.play_arrow);
      case 'IN_PROGRESS':
        return const JobAction('COMPLETED', 'ສຳເລັດງານ', Icons.flag);
      default:
        return null;
    }
  }
}

class JobAction {
  const JobAction(this.status, this.label, this.icon);

  final String status;
  final String label;
  final IconData icon;

  String get shortLabel {
    switch (status) {
      case 'CONFIRMED':
        return 'ຮັບ';
      case 'ON_THE_WAY':
        return 'ໄປຮັບ';
      case 'IN_PROGRESS':
        return 'ເລີ່ມ';
      case 'COMPLETED':
        return 'ຈົບ';
      default:
        return label;
    }
  }
}

class LatLng {
  const LatLng(this.latitude, this.longitude);

  final double latitude;
  final double longitude;

  static LatLng? fromGeoJson(dynamic value) {
    if (value is! Map<String, dynamic>) return null;
    final coordinates = value['coordinates'];
    if (coordinates is! List || coordinates.length < 2) return null;
    final longitude = numberToDouble(coordinates[0]);
    final latitude = numberToDouble(coordinates[1]);
    if (longitude == 0 && latitude == 0) return null;
    return LatLng(latitude, longitude);
  }

  map_latlng.LatLng toMapPoint() => map_latlng.LatLng(latitude, longitude);
}

class DriverRoute {
  const DriverRoute({
    required this.distanceKm,
    required this.durationMinutes,
    required this.points,
  });

  final double distanceKm;
  final int durationMinutes;
  final List<map_latlng.LatLng> points;

  factory DriverRoute.fromJson(Map<String, dynamic> json) {
    return DriverRoute(
      distanceKm: numberToDouble(json['distanceKm']),
      durationMinutes: numberToInt(json['durationMinutes']),
      points: pointsFromGeometry(json['geometry']),
    );
  }

  static List<map_latlng.LatLng> pointsFromGeometry(dynamic geometry) {
    if (geometry is! Map<String, dynamic>) return [];
    final coordinates = geometry['coordinates'];
    if (coordinates is! List) return [];
    final points = <map_latlng.LatLng>[];
    for (final coordinate in coordinates) {
      if (coordinate is List && coordinate.length >= 2) {
        final longitude = numberToDouble(coordinate[0]);
        final latitude = numberToDouble(coordinate[1]);
        if (latitude != 0 || longitude != 0)
          points.add(map_latlng.LatLng(latitude, longitude));
      }
    }
    return points;
  }
}

class ChatMessage {
  const ChatMessage({
    required this.id,
    required this.bookingId,
    required this.senderRole,
    required this.senderName,
    required this.text,
    required this.attachmentUrl,
    required this.attachmentType,
    required this.createdAt,
  });

  final String id;
  final String bookingId;
  final String senderRole;
  final String senderName;
  final String text;
  final String attachmentUrl;
  final String attachmentType;
  final DateTime? createdAt;

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: json['id']?.toString() ?? '',
      bookingId: json['bookingId']?.toString() ?? '',
      senderRole: json['senderRole']?.toString() ?? '',
      senderName: json['senderName']?.toString() ?? '',
      text: json['text']?.toString() ?? '',
      attachmentUrl: json['attachmentUrl']?.toString() ?? '',
      attachmentType: json['attachmentType']?.toString() ?? '',
      createdAt: parseDate(json['createdAt']),
    );
  }
}

double? driverDistanceToPickupKm(Position? position, DriverBooking booking) {
  final pickup = booking.pickupLocation;
  if (position == null || pickup == null) return null;
  final meters = Geolocator.distanceBetween(
    position.latitude,
    position.longitude,
    pickup.latitude,
    pickup.longitude,
  );
  return meters / 1000;
}

String formatKm(double value) {
  if (value < 1) return '${(value * 1000).round()} m';
  return '${value.toStringAsFixed(value >= 10 ? 1 : 2)} km';
}

class ApiException implements Exception {
  ApiException(this.message);

  final String message;

  @override
  String toString() => message;
}

dynamic decodeBody(http.Response response) {
  if (response.body.isEmpty) return {};
  return jsonDecode(utf8.decode(response.bodyBytes));
}

int numberToInt(dynamic value) {
  if (value is int) return value;
  if (value is double) return value.round();
  return int.tryParse(value?.toString() ?? '') ?? 0;
}

double numberToDouble(dynamic value) {
  if (value is double) return value;
  if (value is int) return value.toDouble();
  return double.tryParse(value?.toString() ?? '') ?? 0;
}

DateTime? parseDate(dynamic value) {
  if (value == null) return null;
  return DateTime.tryParse(value.toString());
}

String formatDateTime(DateTime value) {
  final local = value.toLocal();
  String two(int input) => input.toString().padLeft(2, '0');
  return '${two(local.day)}/${two(local.month)}/${local.year} ${two(local.hour)}:${two(local.minute)}';
}

String formatLak(int value) {
  final text = value.toString();
  final buffer = StringBuffer();
  for (var i = 0; i < text.length; i++) {
    final remaining = text.length - i;
    buffer.write(text[i]);
    if (remaining > 1 && remaining % 3 == 1) buffer.write(',');
  }
  return buffer.toString();
}

String initials(String name) {
  final parts = name
      .trim()
      .split(RegExp(r'\s+'))
      .where((part) => part.isNotEmpty)
      .toList();
  if (parts.isEmpty) return 'TL';
  if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
  return '${parts[0].substring(0, 1)}${parts[1].substring(0, 1)}'.toUpperCase();
}

void showSnack(BuildContext context, String message) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
}

class RoutePreview extends StatelessWidget {
  const RoutePreview({super.key, required this.booking});

  final DriverBooking booking;

  @override
  Widget build(BuildContext context) {
    return AppPanel(
      highlight: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.map_outlined, color: Color(0xfff1c45d)),
              const SizedBox(width: 8),
              const Expanded(
                  child: Text('ແຜນທີ່ເສັ້ນທາງ',
                      style: TextStyle(fontWeight: FontWeight.w900))),
              Text('${booking.distanceKm.toStringAsFixed(1)} km',
                  style: const TextStyle(
                      color: Color(0xfff1c45d), fontWeight: FontWeight.w900)),
            ],
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 118,
            width: double.infinity,
            child: CustomPaint(
              painter: RoutePreviewPainter(hasRoute: booking.hasRoute),
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    Expanded(
                        child: RoutePointLabel(
                            title: 'ຮັບ', text: booking.pickup)),
                    const SizedBox(width: 12),
                    Expanded(
                        child: RoutePointLabel(
                            title: 'ສົ່ງ',
                            text: booking.dropoff.isEmpty
                                ? '-'
                                : booking.dropoff)),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: booking.hasRoute
                  ? () => launchRouteMap(
                      booking.pickupLocation, booking.dropoffLocation)
                  : booking.hasPickup
                      ? () => launchMap(booking.pickupLocation)
                      : null,
              icon: const Icon(Icons.navigation_outlined),
              label: const Text('ເປີດແມັບນຳທາງ'),
            ),
          ),
        ],
      ),
    );
  }
}

class RoutePointLabel extends StatelessWidget {
  const RoutePointLabel({super.key, required this.title, required this.text});

  final String title;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.bottomCenter,
      child: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: const Color(0xdd101722),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xff334155)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title,
                style: const TextStyle(
                    color: Color(0xfff1c45d),
                    fontSize: 11,
                    fontWeight: FontWeight.w900)),
            Text(text,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style:
                    const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
          ],
        ),
      ),
    );
  }
}

class RoutePreviewPainter extends CustomPainter {
  RoutePreviewPainter({required this.hasRoute});

  final bool hasRoute;

  @override
  void paint(Canvas canvas, Size size) {
    final background = Paint()..color = const Color(0xff0b1220);
    final grid = Paint()
      ..color = const Color(0xff1f2a3a)
      ..strokeWidth = 1;
    final route = Paint()
      ..color = hasRoute ? const Color(0xfff1c45d) : const Color(0xff64748b)
      ..strokeWidth = 4
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    final pointPaint = Paint()..color = const Color(0xfff1c45d);
    canvas.drawRRect(
        RRect.fromRectAndRadius(Offset.zero & size, const Radius.circular(8)),
        background);
    for (var x = 18.0; x < size.width; x += 32) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), grid);
    }
    for (var y = 16.0; y < size.height; y += 28) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), grid);
    }
    final path = Path()
      ..moveTo(24, size.height * 0.35)
      ..cubicTo(size.width * 0.32, 8, size.width * 0.55, size.height - 8,
          size.width - 24, size.height * 0.36);
    canvas.drawPath(path, route);
    canvas.drawCircle(Offset(24, size.height * 0.35), 8, pointPaint);
    canvas.drawCircle(
        Offset(size.width - 24, size.height * 0.36), 8, pointPaint);
  }

  @override
  bool shouldRepaint(covariant RoutePreviewPainter oldDelegate) =>
      oldDelegate.hasRoute != hasRoute;
}

class LiveRoutePreview extends StatefulWidget {
  const LiveRoutePreview(
      {super.key,
      required this.api,
      required this.booking,
      this.driverPosition});

  final DriverApi api;
  final DriverBooking booking;
  final Position? driverPosition;

  @override
  State<LiveRoutePreview> createState() => _LiveRoutePreviewState();
}

class _LiveRoutePreviewState extends State<LiveRoutePreview> {
  DriverRoute? driverToPickupRoute;
  bool loadingRoute = false;
  String routeMessage = '';

  @override
  void initState() {
    super.initState();
    loadDriverRoute();
  }

  @override
  void didUpdateWidget(covariant LiveRoutePreview oldWidget) {
    super.didUpdateWidget(oldWidget);
    final oldPosition = oldWidget.driverPosition;
    final newPosition = widget.driverPosition;
    final movedEnough = oldPosition == null ||
        newPosition == null ||
        Geolocator.distanceBetween(
              oldPosition.latitude,
              oldPosition.longitude,
              newPosition.latitude,
              newPosition.longitude,
            ) >
            80;
    if (oldWidget.booking.id != widget.booking.id || movedEnough)
      loadDriverRoute();
  }

  Future<void> loadDriverRoute() async {
    final position = widget.driverPosition;
    final pickup = widget.booking.pickupLocation;
    if (position == null || pickup == null) return;
    setState(() {
      loadingRoute = true;
      routeMessage = '';
    });
    try {
      final route = await widget.api.calculateRoute(
        LatLng(position.latitude, position.longitude),
        pickup,
      );
      if (!mounted) return;
      setState(() {
        driverToPickupRoute = route;
        loadingRoute = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        driverToPickupRoute = null;
        loadingRoute = false;
        routeMessage = 'ຄຳນວນ route ຈິງບໍ່ໄດ້ ສະແດງແບບປະມານກ່ອນ';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final booking = widget.booking;
    final driverPosition = widget.driverPosition;
    final driverPoint = driverPosition == null
        ? null
        : map_latlng.LatLng(driverPosition.latitude, driverPosition.longitude);
    final pickupPoint = booking.pickupLocation?.toMapPoint();
    final dropoffPoint = booking.dropoffLocation?.toMapPoint();
    final driverRoutePoints = driverToPickupRoute?.points ??
        <map_latlng.LatLng>[
          if (driverPoint != null) driverPoint,
          if (pickupPoint != null) pickupPoint,
        ];
    final customerRoutePoints = booking.routePoints.isNotEmpty
        ? booking.routePoints
        : <map_latlng.LatLng>[
            if (pickupPoint != null) pickupPoint,
            if (dropoffPoint != null) dropoffPoint,
          ];
    final points = <map_latlng.LatLng>[
      if (driverPoint != null) driverPoint,
      if (pickupPoint != null) pickupPoint,
      if (dropoffPoint != null) dropoffPoint,
      ...driverRoutePoints,
      ...customerRoutePoints,
    ];
    final center = points.isEmpty
        ? const map_latlng.LatLng(17.9757, 102.6331)
        : averagePoint(points);
    final pickupDistanceKm = driverToPickupRoute?.distanceKm ??
        driverDistanceToPickupKm(driverPosition, booking);
    final pickupDurationMinutes = driverToPickupRoute?.durationMinutes;

    return AppPanel(
      highlight: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.map_outlined, color: Color(0xfff1c45d)),
              const SizedBox(width: 8),
              const Expanded(
                  child: Text('ແຜນທີ່ໄປຈຸດຮັບ',
                      style: TextStyle(fontWeight: FontWeight.w900))),
              Text(
                pickupDistanceKm == null
                    ? '${booking.distanceKm.toStringAsFixed(1)} km'
                    : formatKm(pickupDistanceKm),
                style: const TextStyle(
                    color: Color(0xfff1c45d), fontWeight: FontWeight.w900),
              ),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: SizedBox(
              height: 220,
              width: double.infinity,
              child: Stack(
                children: [
                  FlutterMap(
                    options: MapOptions(
                        initialCenter: center,
                        initialZoom: points.length > 1 ? 12.5 : 14),
                    children: [
                      TileLayer(
                        urlTemplate:
                            'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                        userAgentPackageName: 'com.taxilao.driver',
                      ),
                      PolylineLayer(
                        polylines: [
                          if (driverPoint != null && pickupPoint != null)
                            Polyline(
                                points: driverRoutePoints,
                                strokeWidth: 5,
                                color: const Color(0xffef4444)),
                          if (pickupPoint != null &&
                              dropoffPoint != null &&
                              customerRoutePoints.length > 1)
                            Polyline(
                                points: customerRoutePoints,
                                strokeWidth: 5,
                                color: const Color(0xfff1c45d)),
                        ],
                      ),
                      MarkerLayer(
                        markers: [
                          if (driverPoint != null)
                            routeMarker(driverPoint, Icons.local_taxi,
                                const Color(0xff22c55e), 'ເຈົ້າ'),
                          if (pickupPoint != null)
                            routeMarker(pickupPoint, Icons.flag,
                                const Color(0xffef4444), 'ຮັບ'),
                          if (dropoffPoint != null)
                            routeMarker(dropoffPoint, Icons.location_on,
                                const Color(0xfff1c45d), 'ສົ່ງ'),
                        ],
                      ),
                    ],
                  ),
                  Positioned(
                    left: 10,
                    right: 10,
                    bottom: 10,
                    child: RouteSummaryPill(
                      pickupDistanceKm: pickupDistanceKm,
                      pickupDurationMinutes: pickupDurationMinutes,
                      routeDistanceKm: booking.distanceKm,
                      durationMinutes: booking.durationMinutes,
                      loadingRoute: loadingRoute,
                      routeMessage: routeMessage,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                  child: DriverRoutePointLabel(
                      title: 'ຮັບ', text: booking.pickup)),
              const SizedBox(width: 8),
              Expanded(
                  child: DriverRoutePointLabel(
                      title: 'ສົ່ງ',
                      text: booking.dropoff.isEmpty ? '-' : booking.dropoff)),
            ],
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: driverPoint != null && pickupPoint != null
                  ? () => launchRouteFromDriver(
                      driverPosition!, booking.pickupLocation)
                  : booking.hasRoute
                      ? () => launchRouteMap(
                          booking.pickupLocation, booking.dropoffLocation)
                      : booking.hasPickup
                          ? () => launchMap(booking.pickupLocation)
                          : null,
              icon: const Icon(Icons.navigation_outlined),
              label: const Text('ເປີດແມັບນຳທາງ'),
            ),
          ),
        ],
      ),
    );
  }
}

map_latlng.LatLng averagePoint(List<map_latlng.LatLng> points) {
  final latitude =
      points.map((point) => point.latitude).reduce((a, b) => a + b) /
          points.length;
  final longitude =
      points.map((point) => point.longitude).reduce((a, b) => a + b) /
          points.length;
  return map_latlng.LatLng(latitude, longitude);
}

Marker routeMarker(
    map_latlng.LatLng point, IconData icon, Color color, String label) {
  return Marker(
    point: point,
    width: 64,
    height: 56,
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          decoration: BoxDecoration(
              color: const Color(0xee101722),
              borderRadius: BorderRadius.circular(6)),
          child: Text(label,
              style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                  color: Colors.white)),
        ),
        Icon(icon, color: color, size: 30),
      ],
    ),
  );
}

class RouteSummaryPill extends StatelessWidget {
  const RouteSummaryPill({
    super.key,
    required this.pickupDistanceKm,
    required this.routeDistanceKm,
    required this.durationMinutes,
    this.pickupDurationMinutes,
    this.loadingRoute = false,
    this.routeMessage = '',
  });

  final double? pickupDistanceKm;
  final int? pickupDurationMinutes;
  final double routeDistanceKm;
  final int durationMinutes;
  final bool loadingRoute;
  final String routeMessage;

  @override
  Widget build(BuildContext context) {
    final pickupTime =
        pickupDurationMinutes == null ? '' : ' • $pickupDurationMinutes ນາທີ';
    final pickupText = loadingRoute
        ? 'ກຳລັງຄຳນວນ route ຈິງ...'
        : pickupDistanceKm == null
            ? 'GPS ກຳລັງຈັບຕຳແໜ່ງ'
            : 'ໄປຮັບ ${formatKm(pickupDistanceKm!)}$pickupTime';
    final routeText = routeDistanceKm > 0
        ? 'ທາງລູກຄ້າ ${formatKm(routeDistanceKm)}'
        : 'ບໍ່ມີຈຸດສົ່ງ';
    final timeText = durationMinutes > 0 ? ' $durationMinutes ນາທີ' : '';
    final suffix = routeMessage.isEmpty ? '' : '\n$routeMessage';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xee101722),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0x99f1c45d)),
      ),
      child: Text(
        '$pickupText • $routeText$timeText$suffix',
        maxLines: 3,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(
            color: Color(0xfff8d77a),
            fontWeight: FontWeight.w900,
            fontSize: 12),
      ),
    );
  }
}

class DriverRoutePointLabel extends StatelessWidget {
  const DriverRoutePointLabel(
      {super.key, required this.title, required this.text});

  final String title;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: const Color(0xdd101722),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xff334155)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title,
              style: const TextStyle(
                  color: Color(0xfff1c45d),
                  fontSize: 11,
                  fontWeight: FontWeight.w900)),
          Text(text,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style:
                  const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class DriverCustomerActions extends StatefulWidget {
  const DriverCustomerActions(
      {super.key, required this.api, required this.booking});

  final DriverBooking booking;
  final DriverApi api;

  @override
  State<DriverCustomerActions> createState() => _DriverCustomerActionsState();
}

class _DriverCustomerActionsState extends State<DriverCustomerActions> {
  final messageController = TextEditingController();
  Timer? timer;
  List<ChatMessage> messages = [];
  bool loading = false;
  bool sending = false;
  String error = '';

  bool get chatEnabled => ['CONFIRMED', 'ON_THE_WAY', 'IN_PROGRESS']
      .contains(widget.booking.status);

  @override
  void initState() {
    super.initState();
    if (chatEnabled) {
      loadMessages();
      timer = Timer.periodic(
          const Duration(seconds: 5), (_) => loadMessages(silent: true));
    }
  }

  @override
  void dispose() {
    timer?.cancel();
    messageController.dispose();
    super.dispose();
  }

  Future<void> loadMessages({bool silent = false}) async {
    if (!chatEnabled) return;
    if (!silent) setState(() => loading = true);
    try {
      final next = await widget.api.listChatMessages(widget.booking.id);
      if (!mounted) return;
      setState(() {
        messages = next;
        loading = false;
        error = '';
      });
    } catch (exception) {
      if (!mounted) return;
      setState(() {
        loading = false;
        error = exception.toString();
      });
    }
  }

  Future<void> sendMessage() async {
    final text = messageController.text.trim();
    if (text.isEmpty || sending) return;
    setState(() => sending = true);
    try {
      final message = await widget.api.sendChatMessage(widget.booking.id, text);
      if (!mounted) return;
      messageController.clear();
      setState(() {
        messages = [...messages, message];
        sending = false;
        error = '';
      });
    } catch (exception) {
      if (!mounted) return;
      setState(() {
        sending = false;
        error = exception.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: widget.booking.customerPhone.isEmpty
                      ? null
                      : () => launchPhone(widget.booking.customerPhone),
                  icon: const Icon(Icons.call_outlined),
                  label: const Text('ໂທ'),
                ),
              ),
              const SizedBox(width: 8),
              IconButton.filledTonal(
                tooltip: 'ຖ່າຍຮູບ',
                onPressed: () =>
                    showSnack(context, 'ຮູບ/ສຽງຈະຕໍ່ upload UI ໃນຂັ້ນຕໍ່ໄປ'),
                icon: const Icon(Icons.photo_camera_outlined),
              ),
              const SizedBox(width: 6),
              IconButton.filledTonal(
                tooltip: 'ອັດສຽງ',
                onPressed: () =>
                    showSnack(context, 'ຮູບ/ສຽງຈະຕໍ່ upload UI ໃນຂັ້ນຕໍ່ໄປ'),
                icon: const Icon(Icons.mic_none),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              const Icon(Icons.chat_bubble_outline,
                  color: Color(0xfff1c45d), size: 18),
              const SizedBox(width: 7),
              const Text('ແຊັດກັບລູກຄ້າ',
                  style: TextStyle(fontWeight: FontWeight.w900)),
              const Spacer(),
              if (loading)
                const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2)),
            ],
          ),
          const SizedBox(height: 8),
          if (!chatEnabled)
            const Text('ແຊັດຈະເປີດຫຼັງຈາກຮັບອໍເດີ້ແລ້ວ',
                style: TextStyle(color: Color(0xffaeb8c7)))
          else ...[
            Container(
              constraints: const BoxConstraints(maxHeight: 170),
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xff0d1624),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xff263244)),
              ),
              child: messages.isEmpty
                  ? const Center(
                      child: Text('ຍັງບໍ່ມີຂໍ້ຄວາມ',
                          style: TextStyle(color: Color(0xff9ba7b7))))
                  : ListView.builder(
                      shrinkWrap: true,
                      itemCount: messages.length,
                      itemBuilder: (context, index) {
                        final message = messages[index];
                        final mine = message.senderRole == 'DRIVER';
                        return Align(
                          alignment: mine
                              ? Alignment.centerRight
                              : Alignment.centerLeft,
                          child: Container(
                            margin: const EdgeInsets.only(bottom: 6),
                            padding: const EdgeInsets.symmetric(
                                horizontal: 10, vertical: 7),
                            constraints: const BoxConstraints(maxWidth: 260),
                            decoration: BoxDecoration(
                              color: mine
                                  ? const Color(0xff2a2416)
                                  : const Color(0xff172131),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(message.senderName,
                                    style: const TextStyle(
                                        color: Color(0xfff1c45d),
                                        fontSize: 10,
                                        fontWeight: FontWeight.w900)),
                                Text(message.text,
                                    style: const TextStyle(
                                        fontWeight: FontWeight.w700)),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: messageController,
                    minLines: 1,
                    maxLines: 3,
                    decoration:
                        const InputDecoration(hintText: 'ພິມຂໍ້ຄວາມ...'),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  onPressed: sending ? null : sendMessage,
                  icon: sending
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(Icons.send),
                ),
              ],
            ),
            if (error.isNotEmpty) ...[
              const SizedBox(height: 6),
              Text(error,
                  style:
                      const TextStyle(color: Color(0xffff9b9b), fontSize: 12)),
            ],
          ],
        ],
      ),
    );
  }
}

class DriverCustomerReviewPanel extends StatefulWidget {
  const DriverCustomerReviewPanel(
      {super.key, required this.api, required this.booking});

  final DriverApi api;
  final DriverBooking booking;

  @override
  State<DriverCustomerReviewPanel> createState() =>
      _DriverCustomerReviewPanelState();
}

class _DriverCustomerReviewPanelState extends State<DriverCustomerReviewPanel> {
  final commentController = TextEditingController();
  int rating = 5;
  bool sent = false;
  bool sending = false;
  String message = '';

  @override
  void initState() {
    super.initState();
    sent = widget.booking.customerReviewGiven;
  }

  @override
  void dispose() {
    commentController.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    final comment = commentController.text.trim();
    if (sent || sending) return;
    if (comment.isEmpty) {
      setState(() => message = 'ກະລຸນາໃສ່ຄຳເຫັນສັ້ນໆ');
      return;
    }
    setState(() {
      sending = true;
      message = '';
    });
    try {
      await widget.api.submitCustomerReview(widget.booking.id, rating, comment);
      if (!mounted) return;
      setState(() {
        sent = true;
        sending = false;
        message = 'ໃຫ້ດາວລູກຄ້າສຳເລັດ';
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        sending = false;
        message = error.toString();
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AppPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.star_rate_rounded, color: Color(0xfff1c45d)),
              const SizedBox(width: 8),
              Expanded(
                  child: Text('ໃຫ້ດາວລູກຄ້າ ${widget.booking.customerName}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w900))),
              if (sent)
                const Badge(
                  label: Text('ໃຫ້ແລ້ວ'),
                  backgroundColor: Color(0xff1f7a4b),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: List.generate(5, (index) {
              final value = index + 1;
              return IconButton(
                onPressed: sent ? null : () => setState(() => rating = value),
                icon: Icon(
                  value <= rating ? Icons.star : Icons.star_border,
                  color: const Color(0xfff1c45d),
                ),
              );
            }),
          ),
          TextField(
            controller: commentController,
            enabled: !sent,
            minLines: 2,
            maxLines: 4,
            decoration: const InputDecoration(
                hintText: 'ຂຽນຄຳເຫັນເຊັ່ນ: ລູກຄ້າສຸພາບ ລໍຖ້າຕາມຈຸດ...'),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: sent || sending ? null : submit,
              icon: sending
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2))
                  : const Icon(Icons.check_circle_outline),
              label: Text(sent
                  ? 'ໃຫ້ດາວແລ້ວ'
                  : sending
                      ? 'ກຳລັງບັນທຶກ...'
                      : 'ບັນທຶກຄະແນນ'),
            ),
          ),
          if (message.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(message,
                style: const TextStyle(color: Color(0xfff1c45d), fontSize: 12)),
          ],
        ],
      ),
    );
  }
}

void showBookingDetails(BuildContext context, DriverBooking booking,
    {required DriverApi api, Position? driverPosition}) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: const Color(0xff101722),
    shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(12))),
    builder: (context) {
      return SafeArea(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(18, 16, 18, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                        child: Text('ລາຍລະອຽດອໍເດີ້ ${booking.shortId}',
                            style: const TextStyle(
                                fontSize: 20, fontWeight: FontWeight.w900))),
                    IconButton(
                        onPressed: () => Navigator.pop(context),
                        icon: const Icon(Icons.close)),
                  ],
                ),
                const SizedBox(height: 8),
                LiveRoutePreview(
                    api: api, booking: booking, driverPosition: driverPosition),
                const SizedBox(height: 10),
                AppPanel(
                  child: Column(
                    children: [
                      CustomerPreview(booking: booking),
                      const SizedBox(height: 12),
                      DetailLine(label: 'ສະຖານະ', value: booking.statusLabel),
                      DetailLine(label: 'ຈຸດຮັບ', value: booking.pickup),
                      DetailLine(
                          label: 'ຈຸດສົ່ງ',
                          value:
                              booking.dropoff.isEmpty ? '-' : booking.dropoff),
                      if (booking.canViewCustomerContact)
                        DetailLine(
                            label: 'ເບີໂທ',
                            value: booking.customerPhone.isEmpty
                                ? '-'
                                : booking.customerPhone),
                      DetailLine(label: 'ລາຄາ', value: booking.priceLabel),
                      DetailLine(
                          label: 'ໄລຍະທາງ',
                          value: '${booking.distanceKm.toStringAsFixed(2)} km'),
                      if (driverDistanceToPickupKm(driverPosition, booking) !=
                          null)
                        DetailLine(
                            label: 'ຫ່າງຈາກເຈົ້າ',
                            value:
                                '${formatKm(driverDistanceToPickupKm(driverPosition, booking)!)} ຫາຈຸດຮັບ'),
                      DetailLine(
                          label: 'ເວລາ',
                          value: booking.durationMinutes > 0
                              ? '${booking.durationMinutes} ນາທີ'
                              : '-'),
                      DetailLine(
                          label: 'ຜູ້ໂດຍສານ',
                          value: booking.passengers > 0
                              ? '${booking.passengers}'
                              : '-'),
                      DetailLine(
                          label: 'ເວລາຮັບ',
                          value: booking.pickupAt == null
                              ? '-'
                              : formatDateTime(booking.pickupAt!)),
                      if (booking.canViewCustomerContact)
                        DetailLine(
                            label: 'ໝາຍເຫດ',
                            value: booking.note.isEmpty ? '-' : booking.note),
                    ],
                  ),
                ),
                if (booking.canViewCustomerContact) ...[
                  const SizedBox(height: 10),
                  DriverCustomerActions(api: api, booking: booking),
                ],
                if (booking.status == 'COMPLETED') ...[
                  const SizedBox(height: 10),
                  DriverCustomerReviewPanel(api: api, booking: booking),
                ],
              ],
            ),
          ),
        ),
      );
    },
  );
}

Future<void> launchPhone(String phone) async {
  final uri = Uri(scheme: 'tel', path: phone);
  await launchUrl(uri);
}

Future<void> launchMap(LatLng? point) async {
  if (point == null) return;
  final uri = Uri.parse(
      'https://www.google.com/maps/dir/?api=1&destination=${point.latitude},${point.longitude}');
  await launchUrl(uri, mode: LaunchMode.externalApplication);
}

Future<void> launchRouteMap(LatLng? pickup, LatLng? dropoff) async {
  if (pickup == null || dropoff == null) return;
  final uri = Uri.parse(
    'https://www.google.com/maps/dir/?api=1&origin=${pickup.latitude},${pickup.longitude}&destination=${dropoff.latitude},${dropoff.longitude}&travelmode=driving',
  );
  await launchUrl(uri, mode: LaunchMode.externalApplication);
}

Future<void> launchRouteFromDriver(
    Position driverPosition, LatLng? pickup) async {
  if (pickup == null) return;
  final uri = Uri.parse(
    'https://www.google.com/maps/dir/?api=1&origin=${driverPosition.latitude},${driverPosition.longitude}&destination=${pickup.latitude},${pickup.longitude}&travelmode=driving',
  );
  await launchUrl(uri, mode: LaunchMode.externalApplication);
}
