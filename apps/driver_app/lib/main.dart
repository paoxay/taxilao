import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

const String defaultApiBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:4000',
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
    apiBaseUrl = prefs.getString('apiBaseUrl') ?? defaultApiBaseUrl;
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
    required String apiUrl,
  }) async {
    final normalizedUrl = apiUrl.trim().replaceAll(RegExp(r'/+$'), '');
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
    await prefs.setString('apiBaseUrl', apiBaseUrl);
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
    return body.whereType<Map<String, dynamic>>().map(DriverBooking.fromJson).toList();
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
      throw ApiException(body['message']?.toString() ?? 'ອັບເດດ Online ບໍ່ສຳເລັດ');
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
      throw ApiException(body['message']?.toString() ?? 'ສົ່ງຕຳແໜ່ງຄົນຂັບບໍ່ສຳເລັດ');
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

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.session});

  final DriverSession session;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final usernameController = TextEditingController();
  final passwordController = TextEditingController();
  late final TextEditingController apiUrlController;
  bool submitting = false;

  @override
  void initState() {
    super.initState();
    apiUrlController = TextEditingController(text: widget.session.apiBaseUrl);
  }

  @override
  void dispose() {
    usernameController.dispose();
    passwordController.dispose();
    apiUrlController.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (submitting) return;
    setState(() => submitting = true);
    try {
      await widget.session.login(
        username: usernameController.text,
        password: passwordController.text,
        apiUrl: apiUrlController.text,
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
                  const Text('ແອບຄົນຂັບ TAXILAO', style: TextStyle(fontSize: 30, fontWeight: FontWeight.w900)),
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
                          decoration: const InputDecoration(labelText: 'ລະຫັດຜ່ານ', prefixIcon: Icon(Icons.lock_outline)),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: apiUrlController,
                          decoration: const InputDecoration(
                            labelText: 'API URL',
                            helperText: 'Emulator: http://10.0.2.2:4000',
                            prefixIcon: Icon(Icons.cloud_outlined),
                          ),
                        ),
                        const SizedBox(height: 18),
                        SizedBox(
                          width: double.infinity,
                          height: 52,
                          child: FilledButton.icon(
                            onPressed: submitting ? null : submit,
                            icon: submitting
                                ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                                : const Icon(Icons.login),
                            label: Text(submitting ? 'ກຳລັງເຂົ້າ...' : 'ເຂົ້າສູ່ລະບົບ'),
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

  DriverBooking? get activeJob {
    for (final booking in bookings) {
      if (booking.isActiveForDriver) return booking;
    }
    return null;
  }

  List<DriverBooking> get openJobs => bookings.where((booking) => ['PENDING', 'OFFERED', 'CONFIRMED', 'ON_THE_WAY', 'IN_PROGRESS'].contains(booking.status)).toList();

  List<DriverBooking> get finishedJobs => bookings.where((booking) => ['COMPLETED', 'CANCELLED'].contains(booking.status)).toList();

  int get accountBalanceLak => widget.session.driver?.walletBalanceLak ?? 0;

  @override
  void initState() {
    super.initState();
    api = DriverApi(widget.session);
    loadJobs();
    refreshTimer = Timer.periodic(const Duration(seconds: 4), (_) => loadJobs(silent: true));
    countdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted && bookings.any((booking) => booking.status == 'OFFERED')) setState(() {});
    });
  }

  @override
  void dispose() {
    refreshTimer?.cancel();
    countdownTimer?.cancel();
    gpsSubscription?.cancel();
    super.dispose();
  }

  Future<void> loadJobs({bool silent = false}) async {
    if (!silent) setState(() => loading = true);
    try {
      final results = await Future.wait<dynamic>([api.listBookings(), api.loadProfile()]);
      final list = results[0] as List<DriverBooking>;
      final profile = results[1] as DriverProfile;
      if (!mounted) return;
      final offeredIds = list.where((booking) => booking.status == 'OFFERED').map((booking) => booking.id).toSet();
      final newOfferIds = offeredIds.difference(seenOfferIds);
      setState(() {
        widget.session.driver = profile;
        bookings = list;
        seenOfferIds = offeredIds;
        loading = false;
        message = '';
      });
      await widget.session.updateDriverProfile(profile);
      if (newOfferIds.isNotEmpty) {
        await SystemSound.play(SystemSoundType.alert);
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

  Future<void> syncAvailability() async {
    Position? position;
    if (online) {
      final allowed = await requestLocationPermission();
      if (allowed) {
        position = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
      }
    }
    await api.updateAvailability(online: online, autoAccept: autoAccept, position: position);
  }

  Future<void> changeStatus(DriverBooking booking, String status, {bool auto = false}) async {
    if (sendingStatus) return;
    setState(() => sendingStatus = true);
    try {
      final updated = await api.updateStatus(booking.id, status);
      if (!mounted) return;
      setState(() {
        bookings = bookings.map((item) => item.id == updated.id ? updated : item).toList();
        if (!bookings.any((item) => item.id == updated.id)) bookings = [updated, ...bookings];
        message = auto ? 'ຮັບງານອັດຕະໂນມັດແລ້ວ' : 'ອັບເດດສະຖານະແລ້ວ';
      });
      if (status == 'CONFIRMED') await SystemSound.play(SystemSoundType.click);
      await loadJobs(silent: true);
    } catch (error) {
      if (mounted) showSnack(context, error.toString());
    } finally {
      if (mounted) setState(() => sendingStatus = false);
    }
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
    gpsSubscription = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 10),
    ).listen((position) async {
      final currentJob = activeJob;
      final now = DateTime.now();
      if (lastGpsSentAt != null && now.difference(lastGpsSentAt!).inSeconds < 5) return;
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
    if (permission == LocationPermission.denied) permission = await Geolocator.requestPermission();
    if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) {
      if (mounted) showSnack(context, 'ກະລຸນາອະນຸຍາດ location ໃຫ້ແອບ');
      return false;
    }
    return true;
  }

  @override
  Widget build(BuildContext context) {
    final driver = widget.session.driver!;
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xff0d121b),
        title: const BrandHeader(compact: true),
        actions: [
          IconButton(tooltip: 'Refresh', onPressed: () => loadJobs(), icon: const Icon(Icons.refresh)),
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
                  setState(() => online = value);
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
              if (message.isNotEmpty) ...[const SizedBox(height: 12), InfoBanner(message: message)],
              const SizedBox(height: 14),
              if (online && openJobs.isEmpty && !loading) ...[
                ScannerPanel(autoAccept: autoAccept, gpsActive: gpsActive),
                const SizedBox(height: 14),
              ],
              SectionTitle(title: 'ງານກຳລັງຮັບ', count: openJobs.length),
              if (loading)
                const Padding(padding: EdgeInsets.all(28), child: Center(child: CircularProgressIndicator()))
              else if (openJobs.isEmpty)
                EmptyState(text: online ? 'ກຳລັງສະແກນຫາອໍເດີ້ໃກ້ໆ...' : 'ເປີດ Online ເພື່ອຮັບອໍເດີ້')
              else
                ...openJobs.map(
                  (booking) => JobCard(
                    booking: booking,
                    busy: sendingStatus,
                    compact: true,
                    onStatus: (status) => changeStatus(booking, status),
                    onOpenDetails: () => showBookingDetails(context, booking),
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
                    onStatus: (_) {},
                    onOpenDetails: () => showBookingDetails(context, booking),
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
                completedJobs: finishedJobs.where((booking) => booking.status == 'COMPLETED').length,
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
          NavigationDestination(icon: Icon(Icons.local_taxi_outlined), selectedIcon: Icon(Icons.local_taxi), label: 'ງານ'),
          NavigationDestination(icon: Icon(Icons.history_outlined), selectedIcon: Icon(Icons.history), label: 'ປະຫວັດ'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'ໂປຣໄຟ'),
        ],
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
                child: Text(initials(driver.name), style: const TextStyle(color: Color(0xff15110a), fontWeight: FontWeight.w900)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(driver.name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
                    const SizedBox(height: 3),
                    Text('${driver.city} · ${driver.vehicleType}', style: const TextStyle(color: Color(0xffaeb8c7))),
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
              Expanded(child: MiniMetric(icon: Icons.route, label: 'ງານ active', value: activeJob?.shortId ?? '-')),
              Expanded(child: MiniMetric(icon: Icons.gps_fixed, label: 'GPS', value: gpsActive ? 'ກຳລັງສົ່ງ' : 'ພັກ')),
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
    required this.onLogout,
  });

  final DriverProfile driver;
  final bool online;
  final bool autoAccept;
  final bool gpsActive;
  final int balanceLak;
  final int completedJobs;
  final VoidCallback onLogout;

  @override
  Widget build(BuildContext context) {
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
                backgroundImage: driver.portraitUrl.isNotEmpty ? NetworkImage(driver.portraitUrl) : null,
                child: driver.portraitUrl.isEmpty
                    ? Text(initials(driver.name), style: const TextStyle(color: Color(0xff15110a), fontSize: 26, fontWeight: FontWeight.w900))
                    : null,
              ),
              const SizedBox(height: 12),
              Text(driver.name, textAlign: TextAlign.center, style: const TextStyle(fontSize: 23, fontWeight: FontWeight.w900)),
              const SizedBox(height: 4),
              Text('ID: ${driver.id}', style: const TextStyle(color: Color(0xffaeb8c7))),
              const SizedBox(height: 10),
              StatusPill(text: online ? 'ONLINE' : 'OFFLINE', active: online),
            ],
          ),
        ),
        const SizedBox(height: 12),
        AppPanel(
          child: Column(
            children: [
              DetailLine(label: 'ຍອດເງິນ', value: 'LAK ${formatLak(balanceLak)}'),
              if (driver.walletLowBalance)
                DetailLine(label: 'ແຈ້ງເຕືອນ', value: 'ຍອດເງິນໃກ້ໝົດ ກະລຸນາເຕີມເງິນ'),
              DetailLine(label: 'ງານສຳເລັດ', value: '$completedJobs'),
              DetailLine(label: 'ເມືອງ', value: driver.city.isEmpty ? '-' : driver.city),
              DetailLine(label: 'ລົດ', value: driver.vehicleType.isEmpty ? '-' : driver.vehicleType),
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

class ScannerPanel extends StatefulWidget {
  const ScannerPanel({super.key, required this.autoAccept, required this.gpsActive});

  final bool autoAccept;
  final bool gpsActive;

  @override
  State<ScannerPanel> createState() => _ScannerPanelState();
}

class _ScannerPanelState extends State<ScannerPanel> with SingleTickerProviderStateMixin {
  late final AnimationController controller;

  @override
  void initState() {
    super.initState();
    controller = AnimationController(vsync: this, duration: const Duration(seconds: 2))..repeat();
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
                            border: Border.all(color: const Color(0xfff1c45d), width: 2),
                          ),
                        ),
                      ),
                    ),
                    Container(
                      width: 44,
                      height: 44,
                      decoration: const BoxDecoration(color: Color(0xfff1c45d), shape: BoxShape.circle),
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
                const Text('ກຳລັງສະແກນອໍເດີ້ໃກ້ໆ', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900)),
                const SizedBox(height: 5),
                Text(
                  widget.autoAccept ? 'Auto ເປີດຢູ່: ຖ້າມີອໍເດີ້ໃກ້ຈະສົ່ງມາໃຫ້ກົດຮັບ.' : 'ເປີດ Auto ເພື່ອຮັບອໍເດີ້ໃກ້ໆໄວຂຶ້ນ.',
                  style: const TextStyle(color: Color(0xffaeb8c7), height: 1.4),
                ),
                const SizedBox(height: 8),
                StatusPill(text: widget.gpsActive ? 'GPS LIVE' : 'GPS WAITING', active: widget.gpsActive),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class JobCard extends StatelessWidget {
  const JobCard({super.key, required this.booking, required this.busy, required this.onStatus, this.compact = false, this.onOpenDetails});

  final DriverBooking booking;
  final bool busy;
  final bool compact;
  final ValueChanged<String> onStatus;
  final VoidCallback? onOpenDetails;

  @override
  Widget build(BuildContext context) {
    final action = booking.nextAction;
    final secondsLeft = booking.offerSecondsLeft;
    if (compact) {
      return Padding(
        padding: const EdgeInsets.only(top: 8),
        child: InkWell(
          onTap: onOpenDetails,
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
                          Row(
                            children: [
                              Text(booking.bookingTypeLabel, style: const TextStyle(color: Color(0xfff1c45d), fontWeight: FontWeight.w900, fontSize: 11)),
                              const SizedBox(width: 6),
                              Text('#${booking.shortId}', style: const TextStyle(color: Color(0xff8d99aa), fontSize: 11)),
                            ],
                          ),
                          const SizedBox(height: 6),
                          CompactRouteLine(icon: Icons.my_location, text: booking.pickup),
                          const SizedBox(height: 4),
                          CompactRouteLine(icon: Icons.flag_outlined, text: booking.dropoff.isEmpty ? 'ບໍ່ລະບຸຈຸດສົ່ງ' : booking.dropoff),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        StatusPill(text: booking.statusLabel, active: booking.isActiveForDriver),
                        const SizedBox(height: 8),
                        Text(booking.priceLabel, style: const TextStyle(color: Color(0xfff1c45d), fontWeight: FontWeight.w900, fontSize: 13)),
                        Text('${booking.distanceKm.toStringAsFixed(1)} km', style: const TextStyle(color: Color(0xffaeb8c7), fontSize: 11)),
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
                  Text('ກົດຮັບພາຍໃນ $secondsLeft ວິນາທີ', style: const TextStyle(color: Color(0xfff1c45d), fontWeight: FontWeight.w800, fontSize: 11)),
                ],
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
                        icon: const Icon(Icons.cancel_outlined, color: Color(0xffff9b9b)),
                      ),
                      const SizedBox(width: 8),
                    ],
                    if (action != null)
                      Expanded(
                        child: FilledButton.icon(
                          onPressed: busy ? null : () => onStatus(action.status),
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
                      Text(booking.bookingTypeLabel, style: const TextStyle(color: Color(0xfff1c45d), fontWeight: FontWeight.w800, fontSize: 12)),
                      const SizedBox(height: 5),
                      Text(booking.pickup, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
                    ],
                  ),
                ),
                StatusPill(text: booking.statusLabel, active: booking.isActiveForDriver),
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
              Text('ກົດຮັບພາຍໃນ $secondsLeft ວິນາທີ ກ່ອນສົ່ງໃຫ້ຄົນຖັດໄປ', style: const TextStyle(color: Color(0xfff1c45d), fontWeight: FontWeight.w800, fontSize: 12)),
            ],
            if (compact) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(child: Text(booking.dropoff.isEmpty ? 'ບໍ່ໄດ້ລະບຸຈຸດສົ່ງ' : booking.dropoff, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(color: Color(0xffaeb8c7)))),
                  const SizedBox(width: 8),
                  Text(booking.priceLabel, style: const TextStyle(color: Color(0xfff1c45d), fontWeight: FontWeight.w900)),
                ],
              ),
            ],
            if (!compact) ...[
              const SizedBox(height: 12),
              JobLine(icon: Icons.location_on_outlined, label: 'ຈຸດສົ່ງ', value: booking.dropoff.isEmpty ? 'ບໍ່ໄດ້ລະບຸ' : booking.dropoff),
              JobLine(icon: Icons.phone_outlined, label: 'ເບີໂທ', value: booking.customerPhone),
              JobLine(icon: Icons.payments_outlined, label: 'ລາຄາ', value: booking.priceLabel),
              JobLine(icon: Icons.straighten, label: 'ໄລຍະທາງ', value: '${booking.distanceKm.toStringAsFixed(2)} km'),
              if (booking.note.isNotEmpty) JobLine(icon: Icons.notes, label: 'ໝາຍເຫດ', value: booking.note),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(child: OutlinedButton.icon(onPressed: booking.customerPhone.isEmpty ? null : () => launchPhone(booking.customerPhone), icon: const Icon(Icons.call), label: const Text('ໂທ'))),
                  const SizedBox(width: 8),
                  Expanded(child: OutlinedButton.icon(onPressed: booking.hasPickup ? () => launchMap(booking.pickupLocation) : null, icon: const Icon(Icons.navigation_outlined), label: const Text('ນຳທາງ'))),
                ],
              ),
              if (action != null) ...[
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: FilledButton.icon(onPressed: busy ? null : () => onStatus(action.status), icon: Icon(action.icon), label: Text(action.label)),
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
        Expanded(child: Text(text, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700))),
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
          decoration: BoxDecoration(border: Border.all(color: const Color(0xffb89445))),
          child: const Text('TL', style: TextStyle(color: Color(0xfff1c45d), fontWeight: FontWeight.w900)),
        ),
        const SizedBox(width: 10),
        const Text('TAXILAO DRIVER', style: TextStyle(fontWeight: FontWeight.w900, letterSpacing: 0)),
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
        border: Border.all(color: highlight ? const Color(0xffb89445) : const Color(0xff243044)),
        boxShadow: const [BoxShadow(color: Color(0x55000000), blurRadius: 18, offset: Offset(0, 10))],
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
        border: Border.all(color: active ? const Color(0xff23c47a) : const Color(0xff3a4352)),
      ),
      child: Text(
        text,
        style: TextStyle(color: active ? const Color(0xff8df0bf) : const Color(0xffc6cfda), fontSize: 11, fontWeight: FontWeight.w900),
      ),
    );
  }
}

class MiniMetric extends StatelessWidget {
  const MiniMetric({super.key, required this.icon, required this.label, required this.value});

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
              Text(label, style: const TextStyle(color: Color(0xff8d99aa), fontSize: 12)),
              Text(value, overflow: TextOverflow.ellipsis, style: const TextStyle(fontWeight: FontWeight.w900)),
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
        Text(title, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w900)),
        const SizedBox(width: 8),
        StatusPill(text: count.toString(), active: count > 0),
      ],
    );
  }
}

class JobLine extends StatelessWidget {
  const JobLine({super.key, required this.icon, required this.label, required this.value});

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
          SizedBox(width: 78, child: Text(label, style: const TextStyle(color: Color(0xff9ba7b7), fontSize: 12))),
          Expanded(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w700))),
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
          SizedBox(width: 118, child: Text(label, style: const TextStyle(color: Color(0xff9ba7b7), fontSize: 12))),
          Expanded(child: Text(value, style: const TextStyle(fontWeight: FontWeight.w800))),
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
      walletLowBalanceWarningLak: numberToInt(json['walletLowBalanceWarningLak']),
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
    required this.customerPhone,
    required this.note,
    required this.status,
    required this.estimatedPriceLak,
    required this.distanceKm,
    required this.durationMinutes,
    required this.passengers,
    required this.pickupAt,
    required this.dispatchExpiresAt,
    required this.pickupLocation,
    required this.dropoffLocation,
  });

  final String id;
  final String bookingType;
  final String driverId;
  final String pickup;
  final String dropoff;
  final String customerPhone;
  final String note;
  final String status;
  final int estimatedPriceLak;
  final double distanceKm;
  final int durationMinutes;
  final int passengers;
  final DateTime? pickupAt;
  final DateTime? dispatchExpiresAt;
  final LatLng? pickupLocation;
  final LatLng? dropoffLocation;

  factory DriverBooking.fromJson(Map<String, dynamic> json) {
    return DriverBooking(
      id: json['id']?.toString() ?? '',
      bookingType: json['bookingType']?.toString() ?? 'RIDE',
      driverId: json['driverId']?.toString() ?? '',
      pickup: json['pickup']?.toString() ?? '',
      dropoff: json['dropoff']?.toString() ?? '',
      customerPhone: json['customerPhone']?.toString() ?? '',
      note: json['note']?.toString() ?? '',
      status: json['status']?.toString() ?? 'PENDING',
      estimatedPriceLak: numberToInt(json['estimatedPriceLak']),
      distanceKm: numberToDouble(json['distanceKm']),
      durationMinutes: numberToInt(json['durationMinutes']),
      passengers: numberToInt(json['passengers']),
      pickupAt: parseDate(json['pickupAt']),
      dispatchExpiresAt: parseDate(json['dispatchExpiresAt']),
      pickupLocation: LatLng.fromGeoJson(json['pickupLocation']),
      dropoffLocation: LatLng.fromGeoJson(json['dropoffLocation']),
    );
  }

  bool get isActiveForDriver => ['CONFIRMED', 'ON_THE_WAY', 'IN_PROGRESS'].contains(status);

  bool get hasPickup => pickupLocation != null;

  bool get hasRoute => pickupLocation != null && dropoffLocation != null;

  int? get offerSecondsLeft {
    if (status != 'OFFERED' || dispatchExpiresAt == null) return null;
    final seconds = dispatchExpiresAt!.difference(DateTime.now()).inSeconds;
    return seconds.clamp(0, 30);
  }

  String get shortId => id.length > 8 ? id.substring(0, 8) : id;

  String get priceLabel => 'LAK ${formatLak(estimatedPriceLak)}';

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
        return const JobAction('ON_THE_WAY', 'ອອກໄປຮັບລູກຄ້າ', Icons.local_taxi);
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
  final parts = name.trim().split(RegExp(r'\s+')).where((part) => part.isNotEmpty).toList();
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
              const Expanded(child: Text('ແຜນທີ່ເສັ້ນທາງ', style: TextStyle(fontWeight: FontWeight.w900))),
              Text('${booking.distanceKm.toStringAsFixed(1)} km', style: const TextStyle(color: Color(0xfff1c45d), fontWeight: FontWeight.w900)),
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
                    Expanded(child: RoutePointLabel(title: 'ຮັບ', text: booking.pickup)),
                    const SizedBox(width: 12),
                    Expanded(child: RoutePointLabel(title: 'ສົ່ງ', text: booking.dropoff.isEmpty ? '-' : booking.dropoff)),
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
                  ? () => launchRouteMap(booking.pickupLocation, booking.dropoffLocation)
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
            Text(title, style: const TextStyle(color: Color(0xfff1c45d), fontSize: 11, fontWeight: FontWeight.w900)),
            Text(text, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w700)),
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
    canvas.drawRRect(RRect.fromRectAndRadius(Offset.zero & size, const Radius.circular(8)), background);
    for (var x = 18.0; x < size.width; x += 32) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), grid);
    }
    for (var y = 16.0; y < size.height; y += 28) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), grid);
    }
    final path = Path()
      ..moveTo(24, size.height * 0.35)
      ..cubicTo(size.width * 0.32, 8, size.width * 0.55, size.height - 8, size.width - 24, size.height * 0.36);
    canvas.drawPath(path, route);
    canvas.drawCircle(Offset(24, size.height * 0.35), 8, pointPaint);
    canvas.drawCircle(Offset(size.width - 24, size.height * 0.36), 8, pointPaint);
  }

  @override
  bool shouldRepaint(covariant RoutePreviewPainter oldDelegate) => oldDelegate.hasRoute != hasRoute;
}

void showBookingDetails(BuildContext context, DriverBooking booking) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: const Color(0xff101722),
    shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(12))),
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
                  Expanded(child: Text('ລາຍລະອຽດອໍເດີ້ ${booking.shortId}', style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w900))),
                  IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close)),
                ],
              ),
              const SizedBox(height: 8),
              RoutePreview(booking: booking),
              const SizedBox(height: 10),
              AppPanel(
                child: Column(
                  children: [
                    DetailLine(label: 'ສະຖານະ', value: booking.statusLabel),
                    DetailLine(label: 'ຈຸດຮັບ', value: booking.pickup),
                    DetailLine(label: 'ຈຸດສົ່ງ', value: booking.dropoff.isEmpty ? '-' : booking.dropoff),
                    DetailLine(label: 'ເບີໂທ', value: booking.customerPhone.isEmpty ? '-' : booking.customerPhone),
                    DetailLine(label: 'ລາຄາ', value: booking.priceLabel),
                    DetailLine(label: 'ໄລຍະທາງ', value: '${booking.distanceKm.toStringAsFixed(2)} km'),
                    DetailLine(label: 'ເວລາ', value: booking.durationMinutes > 0 ? '${booking.durationMinutes} ນາທີ' : '-'),
                    DetailLine(label: 'ຜູ້ໂດຍສານ', value: booking.passengers > 0 ? '${booking.passengers}' : '-'),
                    DetailLine(label: 'ເວລາຮັບ', value: booking.pickupAt == null ? '-' : formatDateTime(booking.pickupAt!)),
                    DetailLine(label: 'ໝາຍເຫດ', value: booking.note.isEmpty ? '-' : booking.note),
                  ],
                ),
              ),
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
  final uri = Uri.parse('https://www.google.com/maps/dir/?api=1&destination=${point.latitude},${point.longitude}');
  await launchUrl(uri, mode: LaunchMode.externalApplication);
}

Future<void> launchRouteMap(LatLng? pickup, LatLng? dropoff) async {
  if (pickup == null || dropoff == null) return;
  final uri = Uri.parse(
    'https://www.google.com/maps/dir/?api=1&origin=${pickup.latitude},${pickup.longitude}&destination=${dropoff.latitude},${dropoff.longitude}&travelmode=driving',
  );
  await launchUrl(uri, mode: LaunchMode.externalApplication);
}
