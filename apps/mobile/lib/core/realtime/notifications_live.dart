import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;

import '../api/api_client.dart';
import '../api/models.dart';
import '../auth/session.dart';

/// Flux temps réel `GET /notifications/stream` (Server-Sent Events) : chaque nouvelle
/// notification arrive à l'instant (≤ 2 s) — compteur de la cloche + toast + rafraîchissement
/// ciblé. Reconnexion automatique avec repli exponentiel ; fermé à la déconnexion.
class LiveEvent {
  final String id;
  final String? titre;
  final String? corps;
  final String templateCode;
  final Map<String, dynamic>? contenuJson;
  const LiveEvent({required this.id, this.titre, this.corps, required this.templateCode, this.contenuJson});
}

class LiveState {
  final int unread;
  final bool connected;
  const LiveState({this.unread = 0, this.connected = false});
  LiveState copyWith({int? unread, bool? connected}) => LiveState(unread: unread ?? this.unread, connected: connected ?? this.connected);
}

class NotificationsLive extends Notifier<LiveState> {
  http.Client? _client;
  StreamSubscription<String>? _sub;
  int _backoff = 2;
  bool _running = false;
  final _events = StreamController<LiveEvent>.broadcast();

  Stream<LiveEvent> get events => _events.stream;

  @override
  LiveState build() {
    final session = ref.watch(sessionProvider);
    ref.onDispose(stop);
    if (session != null) {
      // Démarre hors du build (les providers ne doivent pas muter d'état pendant build).
      Future.microtask(start);
    } else {
      stop();
    }
    return const LiveState();
  }

  Future<void> start() async {
    if (_running) return;
    _running = true;
    await _connect();
  }

  void stop() {
    _running = false;
    _sub?.cancel();
    _sub = null;
    _client?.close();
    _client = null;
  }

  void setUnread(int n) => state = state.copyWith(unread: n < 0 ? 0 : n);
  void decrement() => setUnread(state.unread - 1);

  Future<void> _connect() async {
    final session = ref.read(sessionProvider);
    if (!_running || session == null) return;
    final api = ref.read(apiClientProvider);
    final client = http.Client();
    _client = client;
    try {
      final req = http.Request('GET', Uri.parse('${api.baseUrl}/notifications/stream'))
        ..headers['Authorization'] = 'Bearer ${session.accessToken}'
        ..headers['Accept'] = 'text/event-stream';
      if (session.coproprieteId != null) req.headers['X-Copropriete-Id'] = session.coproprieteId!;
      final res = await client.send(req);
      if (res.statusCode == 401) {
        // Jeton expiré : rafraîchir puis reconnecter.
        final ok = await api.refreshSession();
        client.close();
        if (ok) return _scheduleReconnect(immediate: true);
        return;
      }
      if (res.statusCode != 200) {
        client.close();
        return _scheduleReconnect();
      }
      state = state.copyWith(connected: true);
      _backoff = 2;
      String event = '';
      final data = StringBuffer();
      _sub = res.stream.transform(utf8.decoder).transform(const LineSplitter()).listen(
        (line) {
          if (line.isEmpty) {
            _dispatch(event, data.toString());
            event = '';
            data.clear();
          } else if (line.startsWith('event:')) {
            event = line.substring(6).trim();
          } else if (line.startsWith('data:')) {
            data.write(line.substring(5).trim());
          }
        },
        onDone: () {
          state = state.copyWith(connected: false);
          _scheduleReconnect(immediate: true);
        },
        onError: (_) {
          state = state.copyWith(connected: false);
          _scheduleReconnect();
        },
        cancelOnError: true,
      );
    } catch (_) {
      state = state.copyWith(connected: false);
      _scheduleReconnect();
    }
  }

  void _scheduleReconnect({bool immediate = false}) {
    if (!_running) return;
    final delay = immediate ? const Duration(milliseconds: 500) : Duration(seconds: _backoff);
    _backoff = (_backoff * 2).clamp(2, 60);
    Future.delayed(delay, () {
      if (_running) _connect();
    });
  }

  void _dispatch(String event, String raw) {
    if (raw.isEmpty) return;
    Map<String, dynamic> j;
    try {
      j = (jsonDecode(raw) as Map).cast<String, dynamic>();
    } catch (_) {
      return;
    }
    if (event == 'etat') {
      setUnread((j['unread'] as num?)?.toInt() ?? 0);
    } else if (event == 'notification') {
      setUnread((j['unread'] as num?)?.toInt() ?? state.unread + 1);
      _events.add(LiveEvent(
        id: j['id']?.toString() ?? '',
        titre: j['titre'] as String?,
        corps: j['corps'] as String?,
        templateCode: j['templateCode']?.toString() ?? '',
        contenuJson: j['contenuJson'] is Map ? (j['contenuJson'] as Map).cast<String, dynamic>() : null,
      ));
    }
  }
}

final notificationsLiveProvider = NotifierProvider<NotificationsLive, LiveState>(NotificationsLive.new);

/// Boîte de réception (liste) — invalidée à chaque événement live.
final notificationsProvider = FutureProvider.autoDispose<List<NotificationItem>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final r = await api.get<List<NotificationItem>>('/notifications', parse: (j) => parseList(j, NotificationItem.fromJson));
  final list = r.dataOrNull ?? const <NotificationItem>[];
  return list;
});
