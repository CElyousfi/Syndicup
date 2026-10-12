import ActivityKit
import Foundation

/// Attributs de la Live Activity SyndicUp — partagés entre Runner (démarrage) et l'extension
/// (affichage). `ContentState` : les clés poussées par l'API (`content-state`), toutes en chaînes
/// optionnelles pour rester tolérant aux évolutions du serveur.
@available(iOS 16.1, *)
struct SyndicUpActivityAttributes: ActivityAttributes {
  public struct ContentState: Codable, Hashable {
    var statut: String?
    var titre: String?
    var corps: String?
    // AG_SEANCE
    var ordre: String?
    var nb_resolutions: String?
    var nb_finalisees: String?
    var nb_votants: String?
    var texte: String?
    var resultat: String?
    // APPEL_DE_FONDS
    var montant_du: String?
    var montant_paye: String?
    var reste: String?
    var progression: String?
    var periode: String?
    var echeance: String?
    // INCIDENT
    var etape: String?
    var nb_etapes: String?
    var categorie: String?
    var sous_categorie: String?
    var prestataire: String?
    var sla: String?

    /// Part accomplie (0…1) — même règle que progressionActivite() côté Dart.
    func progressionPour(type: String) -> Double? {
      switch type {
      case "APPEL_DE_FONDS": return progression.flatMap(Double.init)
      case "INCIDENT":
        let e = Double(etape ?? "") ?? 0, n = Double(nb_etapes ?? "") ?? 3
        return n > 0 ? min(1, max(0, e / n)) : nil
      case "AG_SEANCE":
        let f = Double(nb_finalisees ?? "") ?? 0, n = Double(nb_resolutions ?? "") ?? 0
        return n > 0 ? min(1, max(0, f / n)) : nil
      default: return nil
      }
    }
    var terminee: Bool { statut == "CLOTUREE" || statut == "PAYE" || statut == "RESOLU" || statut == "FERME" }
  }
  var type: String
  var objetId: String
  var residence: String
  var rtl: Bool
}
