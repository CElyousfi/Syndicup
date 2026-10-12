import AppIntents
import UIKit

/// Siri / Raccourcis (iOS 16+) : « Payer mes charges avec SyndicUp », « Signaler un incident… ».
/// Chaque intention ouvre l'app sur la bonne route (schéma syndicup:///…, routeur Flutter).
@available(iOS 16.0, *)
enum SyndicUpFonction: String, AppEnum {
  case payer, signaler, assemblees, affichage, visiteur
  static var typeDisplayRepresentation = TypeDisplayRepresentation(name: "Fonction SyndicUp")
  static var caseDisplayRepresentations: [SyndicUpFonction: DisplayRepresentation] = [
    .payer: "Payer mes charges", .signaler: "Signaler un incident", .assemblees: "Assemblées", .affichage: "Tableau d'affichage", .visiteur: "Enregistrer un visiteur",
  ]
  var route: String {
    switch self {
    case .payer: return "/payer"
    case .signaler: return "/incidents/nouveau"
    case .assemblees: return "/ag"
    case .affichage: return "/affichage"
    case .visiteur: return "/visites?enregistrer=1"
    }
  }
}

@available(iOS 16.0, *)
struct OuvrirSyndicUpIntent: AppIntent {
  static var title: LocalizedStringResource = "Ouvrir SyndicUp"
  static var description = IntentDescription("Ouvre une fonction de SyndicUp.")
  static var openAppWhenRun = true

  @Parameter(title: "Fonction") var fonction: SyndicUpFonction

  init() {}
  init(fonction: SyndicUpFonction) { self.fonction = fonction }

  @MainActor
  func perform() async throws -> some IntentResult {
    SpotlightBridge.shared.emettre(route: fonction.route)
    return .result()
  }
}

@available(iOS 16.0, *)
struct SyndicUpShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(intent: OuvrirSyndicUpIntent(fonction: .payer), phrases: ["Payer mes charges avec \(.applicationName)", "Régler mes charges dans \(.applicationName)"], shortTitle: "Payer mes charges", systemImageName: "creditcard.fill")
    AppShortcut(intent: OuvrirSyndicUpIntent(fonction: .signaler), phrases: ["Signaler un incident avec \(.applicationName)", "Signaler une panne dans \(.applicationName)"], shortTitle: "Signaler un incident", systemImageName: "wrench.and.screwdriver.fill")
    AppShortcut(intent: OuvrirSyndicUpIntent(fonction: .assemblees), phrases: ["Ouvrir les assemblées dans \(.applicationName)", "Voir l'assemblée générale dans \(.applicationName)"], shortTitle: "Assemblées", systemImageName: "person.3.fill")
    AppShortcut(intent: OuvrirSyndicUpIntent(fonction: .affichage), phrases: ["Ouvrir le tableau d'affichage dans \(.applicationName)", "Voir les annonces dans \(.applicationName)"], shortTitle: "Affichage", systemImageName: "megaphone.fill")
    AppShortcut(intent: OuvrirSyndicUpIntent(fonction: .visiteur), phrases: ["Enregistrer un visiteur avec \(.applicationName)"], shortTitle: "Visiteur", systemImageName: "person.badge.plus")
  }
}
