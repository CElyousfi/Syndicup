import AppIntents
import SwiftUI
import WidgetKit

// MARK: - Mes charges

struct ChargesView: View {
  let entry: SnapshotEntry
  @Environment(\.widgetFamily) var family

  var body: some View {
    if let s = entry.snapshot, !s.estVide, let c = s.charges {
      let aJour = c.a_jour ?? false
      let montant = entry.masquer ? "•••• MAD" : (c.montant ?? "")
      switch family {
      case .accessoryCircular:
        ZStack { Ring(progress: c.taux ?? 1, line: 4); Image(systemName: aJour ? "checkmark" : "creditcard.fill").font(.system(size: 14, weight: .bold)) }
          .widgetURL(widgetURL(c.route ?? "/payer"))
      case .accessoryRectangular:
        VStack(alignment: .leading, spacing: 2) {
          Text(c.titre ?? "").font(.system(size: 11, weight: .bold)).textCase(.uppercase)
          Text("•••• MAD").font(.system(size: 15, weight: .bold))
          Text(c.sous_titre ?? "").font(.system(size: 11)).lineLimit(1)
        }.rtl(s.rtl ?? false).widgetURL(widgetURL(c.route_detail ?? "/lots"))
      case .accessoryInline:
        Label(c.sous_titre ?? (c.titre ?? ""), systemImage: aJour ? "checkmark.seal.fill" : "creditcard.fill").widgetURL(widgetURL(c.route ?? "/payer"))
      default:
        VStack(alignment: .leading, spacing: 6) {
          WidgetHeader(title: s.titre) { eye }
          HStack(alignment: .center, spacing: 10) {
            VStack(alignment: .leading, spacing: 2) {
              Text(montant).font(.system(size: family == .systemSmall ? 20 : 26, weight: .bold)).foregroundStyle(aJour ? SU.brand : SU.ink).lineLimit(1).minimumScaleFactor(0.7).environment(\.layoutDirection, .leftToRight)
              Text(c.sous_titre ?? "").font(.system(size: 12)).foregroundStyle(SU.soft).lineLimit(2)
            }
            Spacer(minLength: 0)
            Ring(progress: c.taux ?? 1, danger: !aJour && (c.taux ?? 1) < 0.5).frame(width: family == .systemSmall ? 40 : 56, height: family == .systemSmall ? 40 : 56)
          }
          Spacer(minLength: 0)
          HStack {
            Link(destination: widgetURL(c.route ?? "/payer")) { Pill(text: aJour ? (s.labels?.ouvrir ?? "Ouvrir") : (c.payer ?? "Payer")) }
            Spacer()
            if family != .systemSmall { Text(s.maj ?? "").font(.system(size: 10)).foregroundStyle(SU.faint) }
          }
        }
        .rtl(s.rtl ?? false).widgetURL(widgetURL(c.route_detail ?? "/lots")).widgetSurface()
      }
    } else { SignedOutView().widgetSurface() }
  }

  @ViewBuilder var eye: some View {
    if #available(iOS 17.0, *) {
      Button(intent: ToggleMasquerIntent()) {
        Image(systemName: entry.masquer ? "eye.slash" : "eye").font(.system(size: 12, weight: .semibold)).foregroundStyle(SU.soft).frame(width: 26, height: 26).background(SU.tile, in: Circle())
      }.buttonStyle(.plain)
    }
  }
}

// MARK: - Assemblée

struct AgView: View {
  let entry: SnapshotEntry
  @Environment(\.widgetFamily) var family

  var body: some View {
    if let s = entry.snapshot, !s.estVide, let a = s.ag {
      let enCours = a.etat == "EN_COURS"
      let aucune = a.etat == "AUCUNE"
      switch family {
      case .accessoryCircular:
        ZStack {
          Circle().stroke(.secondary, lineWidth: 3)
          VStack(spacing: 0) {
            Image(systemName: enCours ? "dot.radiowaves.left.and.right" : "person.3.fill").font(.system(size: 12, weight: .bold))
            if let j = a.jours, !aucune, !enCours { Text("J-\(j)").font(.system(size: 11, weight: .bold)) }
          }
        }.widgetURL(widgetURL(a.route ?? "/ag"))
      case .accessoryRectangular:
        VStack(alignment: .leading, spacing: 2) {
          Text(a.titre ?? "").font(.system(size: 11, weight: .bold)).textCase(.uppercase)
          Text(aucune ? (a.compte ?? "") : "\(a.type ?? "") · \(a.date ?? "")").font(.system(size: 13, weight: .bold)).lineLimit(1)
          if !aucune { Text(a.compte ?? "").font(.system(size: 11)).lineLimit(1) }
        }.rtl(s.rtl ?? false).widgetURL(widgetURL(a.route ?? "/ag"))
      case .accessoryInline:
        Label(aucune ? (a.compte ?? "") : "\(a.compte ?? "") · \(a.type ?? "")", systemImage: "person.3.fill").widgetURL(widgetURL(a.route ?? "/ag"))
      default:
        VStack(alignment: .leading, spacing: 6) {
          WidgetHeader(title: a.titre ?? "") { if !aucune { Chip(text: a.compte ?? "", danger: enCours) } }
          Spacer(minLength: 0)
          if aucune {
            Text(a.compte ?? "").font(.system(size: 16, weight: .bold)).foregroundStyle(SU.ink)
            Text(s.titre).font(.system(size: 12)).foregroundStyle(SU.soft).lineLimit(1)
          } else {
            Text("\(a.type ?? "") · \(a.date ?? "")").font(.system(size: family == .systemSmall ? 14 : 17, weight: .bold)).foregroundStyle(SU.ink).lineLimit(2)
            Text(a.progression ?? "").font(.system(size: 12)).foregroundStyle(SU.soft).lineLimit(1)
          }
          Spacer(minLength: 0)
          HStack {
            Link(destination: widgetURL(a.route ?? "/ag")) {
              Pill(text: a.cta ?? (s.labels?.ouvrir ?? "Ouvrir"), background: enCours ? SU.danger : SU.cta, foreground: enCours ? .white : SU.onCta)
            }
            Spacer()
            if family != .systemSmall { Text(s.maj ?? "").font(.system(size: 10)).foregroundStyle(SU.faint) }
          }
        }
        .rtl(s.rtl ?? false).widgetURL(widgetURL(a.route ?? "/ag")).widgetSurface()
      }
    } else { SignedOutView().widgetSurface() }
  }
}

// MARK: - Ma résidence (syndic / conseil)

struct ResidenceView: View {
  let entry: SnapshotEntry
  @Environment(\.widgetFamily) var family

  var body: some View {
    if let s = entry.snapshot, !s.estVide, let r = s.residence {
      VStack(alignment: .leading, spacing: 8) {
        WidgetHeader(title: s.titre) { eye }
        HStack(alignment: .center, spacing: 8) {
          VStack(alignment: .leading, spacing: 0) {
            Text(r.taux_fmt ?? "").font(.system(size: 26, weight: .bold)).foregroundStyle(SU.ink).lineLimit(1).environment(\.layoutDirection, .leftToRight)
            Text(r.recouvrement ?? "").font(.system(size: 12)).foregroundStyle(SU.soft).lineLimit(1)
          }
          Spacer(minLength: 0)
          Sparkline(values: r.serie ?? []).frame(width: 96, height: 40)
        }
        if family != .systemSmall {
          HStack(spacing: 6) {
            Link(destination: widgetURL(r.route_impayes ?? "/finances/appels-de-fonds")) { Tile(value: entry.masquer ? "••••" : (r.impaye ?? ""), label: r.impaye_label ?? "") }
            Link(destination: widgetURL(r.route_incidents ?? "/incidents")) { Tile(value: "\(r.incidents ?? 0)", label: r.incidents_label ?? "", extra: r.sla_label) }
            Link(destination: widgetURL(r.route_reservations ?? "/reservations")) { Tile(value: "\(r.reservations ?? 0)", label: r.reservations_label ?? "") }
          }
          HStack {
            Link(destination: widgetURL(r.route_encaisser ?? "/finances/appels-de-fonds")) { Pill(text: r.encaisser ?? "") }
            Spacer()
            Text(s.maj ?? "").font(.system(size: 10)).foregroundStyle(SU.faint)
          }
        }
      }
      .rtl(s.rtl ?? false).widgetURL(widgetURL(r.route ?? "/tableau-de-bord")).widgetSurface()
    } else { SignedOutView().widgetSurface() }
  }

  @ViewBuilder var eye: some View {
    if #available(iOS 17.0, *) {
      Button(intent: ToggleMasquerIntent()) {
        Image(systemName: entry.masquer ? "eye.slash" : "eye").font(.system(size: 12, weight: .semibold)).foregroundStyle(SU.soft).frame(width: 26, height: 26).background(SU.tile, in: Circle())
      }.buttonStyle(.plain)
    }
  }
}

// MARK: - Affichage

struct AffichageView: View {
  let entry: SnapshotEntry
  @Environment(\.widgetFamily) var family

  var body: some View {
    if let s = entry.snapshot, !s.estVide, let f = s.affichage {
      let annonces = Array((f.annonces ?? []).prefix(family == .systemLarge ? 3 : (family == .systemMedium ? 2 : 1)))
      VStack(alignment: .leading, spacing: 6) {
        WidgetHeader(title: f.titre ?? "") {
          Text(f.non_lues_label ?? "").font(.system(size: 10, weight: .bold)).foregroundStyle((f.non_lues ?? 0) > 0 ? .white : SU.soft).lineLimit(1)
            .padding(.horizontal, 9).frame(height: 20).background((f.non_lues ?? 0) > 0 ? SU.brand : SU.tile, in: Capsule())
        }
        if annonces.isEmpty {
          Spacer(minLength: 0)
          Text(f.vide ?? "").font(.system(size: 13)).foregroundStyle(SU.soft)
          Spacer(minLength: 0)
        } else {
          ForEach(Array(annonces.enumerated()), id: \.offset) { _, a in
            Link(destination: widgetURL(a.route ?? "/affichage")) {
              HStack(spacing: 10) {
                RoundedRectangle(cornerRadius: 2).fill(a.urgent == true ? SU.danger : .clear).frame(width: 4, height: 30)
                VStack(alignment: .leading, spacing: 1) {
                  Text(a.titre ?? "").font(.system(size: 13, weight: .bold)).foregroundStyle(SU.ink).lineLimit(1)
                  Text(a.quand ?? "").font(.system(size: 11)).foregroundStyle(SU.faint).lineLimit(1)
                }
                Spacer(minLength: 0)
                Circle().fill(a.lu == true ? .clear : SU.brand).frame(width: 8, height: 8)
              }
            }
          }
          Spacer(minLength: 0)
        }
      }
      .rtl(s.rtl ?? false).widgetURL(widgetURL(f.route ?? "/affichage")).widgetSurface()
    } else { SignedOutView().widgetSurface() }
  }
}

// MARK: - Loge (gardien)

struct GardienView: View {
  let entry: SnapshotEntry
  @Environment(\.widgetFamily) var family

  var body: some View {
    if let s = entry.snapshot, !s.estVide, let g = s.gardien {
      VStack(alignment: .leading, spacing: 8) {
        WidgetHeader(title: s.titre) { EmptyView() }
        HStack(spacing: 6) {
          Link(destination: widgetURL(g.route_visites ?? "/visites")) { Tile(value: "\(g.visites ?? 0)", label: g.visites_label ?? "", valueColor: (g.visites ?? 0) > 0 ? SU.danger : SU.ink) }
          if family != .systemSmall {
            Link(destination: widgetURL(g.route_lcd ?? "/location-courte-duree")) { Tile(value: "\(g.arrivees ?? 0) / \(g.departs ?? 0)", label: "\(g.arrivees_label ?? "") / \(g.departs_label ?? "")") }
            Link(destination: widgetURL("/incidents")) { Tile(value: "\(g.incidents ?? 0)", label: g.incidents_label ?? "") }
          }
        }
        Spacer(minLength: 0)
        HStack(spacing: 8) {
          Link(destination: widgetURL(g.route_enregistrer ?? "/visites?enregistrer=1")) { Pill(text: g.enregistrer ?? "") }
          if family != .systemSmall { Link(destination: widgetURL(g.route_signaler ?? "/incidents/nouveau")) { Pill(text: g.signaler ?? "", background: SU.tile, foreground: SU.ink) } }
        }
      }
      .rtl(s.rtl ?? false).widgetURL(widgetURL(g.route_visites ?? "/visites")).widgetSurface()
    } else { SignedOutView().widgetSurface() }
  }
}

// MARK: - Déclarations

struct SyndicUpCharges: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "SyndicUpCharges", provider: SnapshotProvider()) { ChargesView(entry: $0) }
      .configurationDisplayName(LocalizedStringKey("w_charges_label")).description(LocalizedStringKey("w_charges_desc"))
      .supportedFamilies(familiesWithAccessories([.systemSmall, .systemMedium]))
  }
}
struct SyndicUpAg: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "SyndicUpAg", provider: SnapshotProvider()) { AgView(entry: $0) }
      .configurationDisplayName(LocalizedStringKey("w_ag_label")).description(LocalizedStringKey("w_ag_desc"))
      .supportedFamilies(familiesWithAccessories([.systemSmall, .systemMedium]))
  }
}
struct SyndicUpResidence: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "SyndicUpResidence", provider: SnapshotProvider()) { ResidenceView(entry: $0) }
      .configurationDisplayName(LocalizedStringKey("w_residence_label")).description(LocalizedStringKey("w_residence_desc"))
      .supportedFamilies([.systemMedium, .systemLarge])
  }
}
struct SyndicUpAffichage: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "SyndicUpAffichage", provider: SnapshotProvider()) { AffichageView(entry: $0) }
      .configurationDisplayName(LocalizedStringKey("w_affichage_label")).description(LocalizedStringKey("w_affichage_desc"))
      .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}
struct SyndicUpGardien: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: "SyndicUpGardien", provider: SnapshotProvider()) { GardienView(entry: $0) }
      .configurationDisplayName(LocalizedStringKey("w_gardien_label")).description(LocalizedStringKey("w_gardien_desc"))
      .supportedFamilies([.systemSmall, .systemMedium])
  }
}

/// Familles d'écran verrouillé (iOS 16+) ajoutées quand disponibles.
func familiesWithAccessories(_ base: [WidgetFamily]) -> [WidgetFamily] {
  if #available(iOS 16.0, *) { return base + [.accessoryCircular, .accessoryRectangular, .accessoryInline] }
  return base
}

@main
struct SyndicUpWidgetsBundle: WidgetBundle {
  var body: some Widget {
    SyndicUpCharges()
    SyndicUpAg()
    SyndicUpResidence()
    SyndicUpAffichage()
    SyndicUpGardien()
    if #available(iOS 16.1, *) { SyndicUpLiveActivity() }
  }
}
