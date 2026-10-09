import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:syndicup/core/feel/feel.dart';

/// Couche Alive — drapeau alive_v1 (cache, repli, défaut ON), préférences Sensations,
/// haptique sémantique (anti-rafale 80 ms, réglage, drapeau).
class _FakeAdapter implements HttpClientAdapter {
  _FakeAdapter(this.respond);
  final ResponseBody Function() respond;
  @override
  Future<ResponseBody> fetch(RequestOptions options, Stream<List<int>>? requestStream, Future<void>? cancelFuture) async => respond();
  @override
  void close({bool force = false}) {}
}

Dio _dio(ResponseBody Function() respond) => Dio(BaseOptions(baseUrl: 'http://x/v1', validateStatus: (_) => true))..httpClientAdapter = _FakeAdapter(respond);

ResponseBody _json(int status, String body) => ResponseBody.fromString(body, status, headers: {
      Headers.contentTypeHeader: ['application/json'],
    });

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final calls = <String>[];
  setUp(() {
    calls.clear();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'HapticFeedback.vibrate') calls.add(call.arguments as String);
      return null;
    });
    Haptics.debugReset();
  });

  group('ClientFlags', () {
    test('installation neuve : défaut ON', () async {
      SharedPreferences.setMockInitialValues({});
      ClientFlags.instance.load(await SharedPreferences.getInstance());
      expect(ClientFlags.instance.alive, isTrue);
    });

    test('réponse serveur → appliquée et mémorisée ; serveur injoignable → dernière valeur', () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      ClientFlags.instance.load(prefs);
      await ClientFlags.instance.refresh(dio: _dio(() => _json(200, '{"data":{"flags":{"alive_v1":false}},"meta":{}}')), force: true);
      expect(ClientFlags.instance.alive, isFalse);
      expect(prefs.getBool('flag.alive_v1'), isFalse);

      // Redémarrage hors ligne : la dernière valeur connue s'applique.
      ClientFlags.instance.load(prefs);
      await ClientFlags.instance.refresh(dio: _dio(() => throw DioException(requestOptions: RequestOptions())), force: true);
      expect(ClientFlags.instance.alive, isFalse);

      // 500 : valeur conservée.
      await ClientFlags.instance.refresh(dio: _dio(() => _json(500, '{}')), force: true);
      expect(ClientFlags.instance.alive, isFalse);

      // Rétabli.
      await ClientFlags.instance.refresh(dio: _dio(() => _json(200, '{"data":{"flags":{"alive_v1":true}}}')), force: true);
      expect(ClientFlags.instance.alive, isTrue);
    });

    test('drapeau inconnu ou de mauvais type : ignoré', () async {
      SharedPreferences.setMockInitialValues({});
      ClientFlags.instance.load(await SharedPreferences.getInstance());
      await ClientFlags.instance.refresh(dio: _dio(() => _json(200, '{"data":{"flags":{"alive_v1":"non","autre":true}}}')), force: true);
      expect(ClientFlags.instance.alive, isTrue);
      expect(ClientFlags.instance.values.value.containsKey('autre'), isFalse);
    });
  });

  group('Sensations', () {
    test('défauts ON, persistance locale', () async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      Sensations.instance.load(prefs);
      expect(Sensations.instance.prefs.value, const SensationsPrefs());
      await Sensations.instance.update(const SensationsPrefs(reducedMotion: true, haptics: false, sounds: false));
      Sensations.instance.load(prefs);
      expect(Sensations.instance.prefs.value, const SensationsPrefs(reducedMotion: true, haptics: false, sounds: false));
    });
  });

  group('Haptics', () {
    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      final prefs = await SharedPreferences.getInstance();
      ClientFlags.instance.load(prefs);
      Sensations.instance.load(prefs);
    });

    test('intention → moteur ; anti-rafale de 80 ms', () async {
      Haptics.select();
      Haptics.select();
      expect(calls, ['HapticFeedbackType.selectionClick']);
      await Future<void>.delayed(const Duration(milliseconds: 90));
      Haptics.tap();
      expect(calls.last, 'HapticFeedbackType.lightImpact');
    });

    test('réglage « Vibrations » coupé ou alive_v1 désactivé : muet', () async {
      await Sensations.instance.update(const SensationsPrefs(haptics: false));
      Haptics.success();
      expect(calls, isEmpty);
      await Sensations.instance.update(const SensationsPrefs());
      ClientFlags.instance.debugSet('alive_v1', false);
      Haptics.heavy();
      expect(calls, isEmpty);
      expect(Haptics.lastEmitted, isNull);
      ClientFlags.instance.debugSet('alive_v1', true);
    });
  });
}
