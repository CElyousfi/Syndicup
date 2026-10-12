import 'package:flutter_test/flutter_test.dart';
import 'package:syndicup/core/api/swr.dart';

void main() {
  test('cache de lectures en mémoire : écriture, relecture, vidage', () async {
    final c = ReadCache.instance;
    await c.write('copro|/finances/synthese|{}', '{"appels":[]}', disque: false);
    expect(await c.read('copro|/finances/synthese|{}', disque: false), '{"appels":[]}');
    expect(await c.read('autre', disque: false), isNull);
    await c.clear();
    expect(await c.read('copro|/finances/synthese|{}', disque: false), isNull);
  });
}
