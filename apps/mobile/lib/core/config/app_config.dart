import 'dart:io' show Platform;

import 'package:flutter/foundation.dart';

/// Configuration de build — injectée par `--dart-define`, jamais lue depuis un fichier
/// embarqué (Master Spec Partie 10.3 : aucun secret dans le code).
///
/// Exemples :
///   flutter run --dart-define=API_BASE_URL=http://192.168.1.10:3001/v1
///   flutter build apk --release --dart-define=API_BASE_URL=https://api.copropriete-maroc.ma/v1
class AppConfig {
  AppConfig._();

  static const String _apiBaseUrlDefine = String.fromEnvironment('API_BASE_URL');

  /// Base de l'API (préfixe `/v1` inclus).
  /// - release : production (openapi.yaml `servers[0]`) ;
  /// - debug : l'API locale (`apps/api`, port 3001) — l'émulateur Android atteint l'hôte via
  ///   10.0.2.2, le simulateur iOS via localhost.
  static String get apiBaseUrl {
    if (_apiBaseUrlDefine.isNotEmpty) return _apiBaseUrlDefine;
    if (kReleaseMode) return 'https://api.copropriete-maroc.ma/v1';
    if (Platform.isAndroid) return 'http://10.0.2.2:3001/v1';
    return 'http://localhost:3001/v1';
  }

  /// Base publique du web (liens d'invitation `/{locale}/invitation/{code}` scannés en QR).
  static const String webBaseUrl = String.fromEnvironment(
    'WEB_BASE_URL',
    defaultValue: 'https://app.copropriete-maroc.ma',
  );

  /// Push FCM — activé uniquement si un projet Firebase est fourni au build.
  static const bool pushEnabled = bool.fromEnvironment('FIREBASE_ENABLED', defaultValue: false);
  static const String firebaseApiKey = String.fromEnvironment('FIREBASE_API_KEY');
  static const String firebaseAppId = String.fromEnvironment('FIREBASE_APP_ID');
  static const String firebaseProjectId = String.fromEnvironment('FIREBASE_PROJECT_ID');
  static const String firebaseSenderId = String.fromEnvironment('FIREBASE_SENDER_ID');

  static const String appVersion = String.fromEnvironment('APP_VERSION', defaultValue: '0.1.0');
}
