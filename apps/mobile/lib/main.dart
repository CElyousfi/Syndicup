import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app.dart';
import 'core/auth/session.dart';
import 'core/feel/feel.dart';
import 'core/feel/frame_stats.dart';
import 'core/i18n/i18n.dart';
import 'core/push/push_service.dart';
import 'core/widgets/illustration.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp, DeviceOrientation.portraitDown]);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(statusBarColor: Colors.transparent, statusBarIconBrightness: Brightness.dark));

  await Future.wait([initializeDateFormatting('fr'), initializeDateFormatting('ar')]);
  final prefs = await SharedPreferences.getInstance();
  await Feel.init(prefs);
  installFrameStats();
  await SuIllustration.init();
  final session = await SessionStorage().read();
  await PushService.instance.init(locale: Locale(prefs.getString('locale') ?? 'fr'));

  runApp(
    ProviderScope(
      overrides: [
        sharedPrefsProvider.overrideWithValue(prefs),
        initialSessionProvider.overrideWithValue(session),
      ],
      child: const SyndicUpApp(),
    ),
  );
}
