import AppIntents
import WidgetKit

/// Bouton « œil » (iOS 17+) : bascule le masquage des montants sans ouvrir l'app.
@available(iOS 17.0, *)
struct ToggleMasquerIntent: AppIntent {
  static var title: LocalizedStringResource = "Masquer ou afficher les montants"
  static var isDiscoverable = false
  func perform() async throws -> some IntentResult {
    SharedStore.setMasquer(!SharedStore.masquer)
    return .result()
  }
}
