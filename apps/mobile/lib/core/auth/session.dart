import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../api/api_client.dart';
import '../api/models.dart';

/// Session locale : jetons Supabase (rotatifs) + copropriété active. Stockés dans le trousseau
/// (Keychain / EncryptedSharedPreferences), jamais en clair.
class Session {
  final String accessToken;
  final String refreshToken;
  final String? coproprieteId;
  const Session({required this.accessToken, required this.refreshToken, this.coproprieteId});

  Session copyWith({String? accessToken, String? refreshToken, String? coproprieteId, bool clearCopro = false}) => Session(
        accessToken: accessToken ?? this.accessToken,
        refreshToken: refreshToken ?? this.refreshToken,
        coproprieteId: clearCopro ? null : (coproprieteId ?? this.coproprieteId),
      );
}

class SessionStorage {
  SessionStorage([FlutterSecureStorage? storage])
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
              iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock_this_device),
            );
  final FlutterSecureStorage _storage;

  static const _kAccess = 'su_access';
  static const _kRefresh = 'su_refresh';
  static const _kCopro = 'su_copro';
  static const _kInvitationJeton = 'su_invitation_jeton';

  Future<Session?> read() async {
    final a = await _storage.read(key: _kAccess);
    final r = await _storage.read(key: _kRefresh);
    if (a == null || r == null) return null;
    return Session(accessToken: a, refreshToken: r, coproprieteId: await _storage.read(key: _kCopro));
  }

  Future<void> write(Session s) async {
    await _storage.write(key: _kAccess, value: s.accessToken);
    await _storage.write(key: _kRefresh, value: s.refreshToken);
    if (s.coproprieteId == null) {
      await _storage.delete(key: _kCopro);
    } else {
      await _storage.write(key: _kCopro, value: s.coproprieteId);
    }
  }

  Future<void> clear() async {
    await _storage.delete(key: _kAccess);
    await _storage.delete(key: _kRefresh);
    await _storage.delete(key: _kCopro);
  }

  /// Jeton d'appareil des invitations (usage unique des codes — M17) : généré une fois par
  /// installation, comme le cookie `su_invitation` du web.
  Future<String> invitationJeton(String Function() generate) async {
    final existing = await _storage.read(key: _kInvitationJeton);
    if (existing != null) return existing;
    final j = generate();
    await _storage.write(key: _kInvitationJeton, value: j);
    return j;
  }
}

final sessionStorageProvider = Provider<SessionStorage>((_) => SessionStorage());

/// Session chargée avant `runApp` (override dans main.dart).
final initialSessionProvider = Provider<Session?>((_) => null);

class SessionController extends Notifier<Session?> implements TokenSource {
  @override
  Session? build() => ref.read(initialSessionProvider);

  SessionStorage get _storage => ref.read(sessionStorageProvider);

  @override
  String? get accessToken => state?.accessToken;
  @override
  String? get refreshToken => state?.refreshToken;
  @override
  String? get coproprieteId => state?.coproprieteId;

  Future<void> signIn(SessionTokens t, {String? coproprieteId}) async {
    state = Session(accessToken: t.accessToken, refreshToken: t.refreshToken, coproprieteId: coproprieteId);
    await _storage.write(state!);
  }

  Future<void> chooseCopropriete(String id) async {
    final s = state;
    if (s == null) return;
    state = s.copyWith(coproprieteId: id);
    await _storage.write(state!);
  }

  Future<void> signOut() async {
    state = null;
    await _storage.clear();
  }

  @override
  Future<void> onTokensRefreshed(Map<String, dynamic> tokens) async {
    final s = state;
    if (s == null) return;
    final t = SessionTokens.fromJson(tokens);
    state = s.copyWith(accessToken: t.accessToken, refreshToken: t.refreshToken);
    await _storage.write(state!);
  }

  @override
  Future<void> onSessionExpired() => signOut();
}

final sessionProvider = NotifierProvider<SessionController, Session?>(SessionController.new);

final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient(ref.read(sessionProvider.notifier));
});
