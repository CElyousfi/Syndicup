import Foundation
import WidgetKit

/// Lecture du JSON `w_snapshot` écrit par l'app Flutter (lib/core/home_widgets/home_widgets.dart)
/// dans l'App Group. Tout est déjà traduit (FR/AR) et mis en forme : l'extension affiche.
enum SharedStore {
  static let group = "group.ma.syndicup.app"
  static let keySnapshot = "w_snapshot"
  static let keyMasquer = "w_masquer"

  static var defaults: UserDefaults? { UserDefaults(suiteName: group) }

  static func snapshot() -> Snapshot? {
    guard let raw = defaults?.string(forKey: keySnapshot), let data = raw.data(using: .utf8) else { return nil }
    return try? JSONDecoder().decode(Snapshot.self, from: data)
  }

  static var masquer: Bool { defaults?.bool(forKey: keyMasquer) ?? false }

  static func setMasquer(_ v: Bool) {
    defaults?.set(v, forKey: keyMasquer)
    WidgetCenter.shared.reloadAllTimelines()
  }
}

struct Snapshot: Decodable {
  var vide: Bool?
  var rtl: Bool?
  var langue: String?
  var nom: String?
  var maj: String?
  var labels: Labels?
  var charges: Charges?
  var ag: Ag?
  var residence: Residence?
  var affichage: Affichage?
  var gardien: Gardien?

  var titre: String { nom ?? "SyndicUp" }
  var estVide: Bool { vide ?? true }

  struct Labels: Decodable { var ouvrir: String?; var masque: String? }
  struct Charges: Decodable {
    var titre, montant, montant_brut, sous_titre, payer, route, route_detail: String?
    var a_jour: Bool?
    var taux: Double?
    var nb_lots: Int?
  }
  struct Ag: Decodable {
    var titre, etat, type, date, compte, progression, cta, route: String?
    var jours: Int?
  }
  struct Residence: Decodable {
    var titre, taux_fmt, recouvrement, impaye, impaye_label, incidents_label, sla_label, reservations_label, route, route_impayes, route_incidents, route_reservations, encaisser, route_encaisser: String?
    var taux: Double?
    var serie: [Double]?
    var incidents, sla, reservations: Int?
  }
  struct Annonce: Decodable { var id, titre, quand, route: String?; var urgent, lu: Bool? }
  struct Affichage: Decodable {
    var titre, non_lues_label, vide, route: String?
    var non_lues: Int?
    var annonces: [Annonce]?
  }
  struct Gardien: Decodable {
    var titre, visites_label, arrivees_label, departs_label, incidents_label, enregistrer, signaler, route_visites, route_enregistrer, route_lcd, route_signaler: String?
    var visites, arrivees, departs, incidents: Int?
  }
}

/// URL d'ouverture : home_widget exige le paramètre `homeWidget` pour reconnaître le lancement.
func widgetURL(_ route: String) -> URL {
  var c = URLComponents()
  c.scheme = "syndicup"
  c.host = "widget"
  c.queryItems = [URLQueryItem(name: "route", value: route), URLQueryItem(name: "homeWidget", value: nil)]
  return c.url ?? URL(string: "syndicup://widget?homeWidget")!
}
