import WidgetKit
import SwiftUI

struct SnapshotEntry: TimelineEntry {
  let date: Date
  let snapshot: Snapshot?
  let masquer: Bool
}

/// Un seul fournisseur pour les cinq widgets : relit l'App Group, redemande une passe dans 30 min
/// (l'app pousse elle-même une mise à jour à chaque changement via `WidgetCenter`).
struct SnapshotProvider: TimelineProvider {
  func placeholder(in context: Context) -> SnapshotEntry { SnapshotEntry(date: Date(), snapshot: nil, masquer: false) }

  func getSnapshot(in context: Context, completion: @escaping (SnapshotEntry) -> Void) {
    completion(SnapshotEntry(date: Date(), snapshot: SharedStore.snapshot(), masquer: SharedStore.masquer))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<SnapshotEntry>) -> Void) {
    let entry = SnapshotEntry(date: Date(), snapshot: SharedStore.snapshot(), masquer: SharedStore.masquer)
    let next = Calendar.current.date(byAdding: .minute, value: 30, to: Date()) ?? Date().addingTimeInterval(1800)
    completion(Timeline(entries: [entry], policy: .after(next)))
  }
}
