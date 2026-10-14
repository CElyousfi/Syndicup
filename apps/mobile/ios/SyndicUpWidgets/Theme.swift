import SwiftUI
import WidgetKit

/// Jetons SyndicUp (lib/core/theme/tokens.dart) — clair / sombre.
enum SU {
  static let brand = Color(light: 0x1E7552, dark: 0x7FC7A3)
  static let brandTint = Color(light: 0xE2EEE7, dark: 0x1F3A2E)
  static let cta = Color(hex: 0xE3EF8D)
  static let onCta = Color(hex: 0x121212)
  static let ink = Color(light: 0x121212, dark: 0xF4F3EE)
  static let soft = Color(light: 0x596269, dark: 0xA8B0AB)
  static let faint = Color(hex: 0x7D8583)
  static let tile = Color(light: 0xECEBE4, dark: 0x262826)
  static let hairline = Color(light: 0xE9E7DF, dark: 0x33362F)
  static let danger = Color(light: 0xB42318, dark: 0xF08A80)
}

extension Color {
  init(hex: UInt32) {
    self.init(.sRGB, red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255, opacity: 1)
  }
  init(light: UInt32, dark: UInt32) {
    self.init(UIColor { tc in
      let h = tc.userInterfaceStyle == .dark ? dark : light
      return UIColor(red: CGFloat((h >> 16) & 0xFF) / 255, green: CGFloat((h >> 8) & 0xFF) / 255, blue: CGFloat(h & 0xFF) / 255, alpha: 1)
    })
  }
}

/// En-tête commun : petit immeuble + nom en capitales, bouton optionnel à droite.
struct WidgetHeader<Trailing: View>: View {
  let title: String
  @ViewBuilder var trailing: () -> Trailing
  var body: some View {
    HStack(spacing: 6) {
      Image(systemName: "building.2.fill").font(.system(size: 11, weight: .bold)).foregroundStyle(SU.brand)
      Text(title.uppercased()).font(.system(size: 11, weight: .bold)).kerning(0.4).foregroundStyle(SU.soft).lineLimit(1)
      Spacer(minLength: 4)
      trailing()
    }
  }
}

struct Pill: View {
  let text: String
  var background: Color = SU.cta
  var foreground: Color = SU.onCta
  var body: some View {
    Text(text).font(.system(size: 13, weight: .bold)).foregroundStyle(foreground).lineLimit(1)
      .padding(.horizontal, 14).frame(height: 32).background(background, in: Capsule())
  }
}

struct Chip: View {
  let text: String
  var danger = false
  var body: some View {
    Text(text).font(.system(size: 10, weight: .bold)).foregroundStyle(.white).lineLimit(1)
      .padding(.horizontal, 9).frame(height: 20).background(danger ? SU.danger : SU.brand, in: Capsule())
  }
}

struct Ring: View {
  let progress: Double
  var danger = false
  var line: CGFloat = 6
  var body: some View {
    ZStack {
      Circle().stroke(SU.hairline, lineWidth: line)
      Circle().trim(from: 0, to: max(0, min(1, progress))).stroke(danger ? SU.danger : SU.brand, style: StrokeStyle(lineWidth: line, lineCap: .round)).rotationEffect(.degrees(-90))
    }
  }
}

struct Sparkline: View {
  let values: [Double]
  var body: some View {
    GeometryReader { g in
      let n = values.count
      let pts: [CGPoint] = n == 0 ? [] : values.enumerated().map { i, v in
        CGPoint(x: n == 1 ? g.size.width / 2 : 3 + (g.size.width - 6) * CGFloat(i) / CGFloat(n - 1), y: 3 + (g.size.height - 6) * CGFloat(1 - max(0, min(1, v))))
      }
      ZStack {
        if let first = pts.first, let last = pts.last {
          Path { p in p.move(to: CGPoint(x: first.x, y: g.size.height)); pts.forEach { p.addLine(to: $0) }; p.addLine(to: CGPoint(x: last.x, y: g.size.height)); p.closeSubpath() }.fill(SU.brand.opacity(0.14))
          Path { p in p.move(to: first); pts.dropFirst().forEach { p.addLine(to: $0) } }.stroke(SU.brand, style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
          Circle().fill(SU.brand).frame(width: 6, height: 6).position(last)
        }
      }
    }
  }
}

struct Tile: View {
  let value: String
  let label: String
  var extra: String? = nil
  var valueColor: Color = SU.ink
  var body: some View {
    VStack(alignment: .leading, spacing: 1) {
      Text(value).font(.system(size: 15, weight: .bold)).foregroundStyle(valueColor).lineLimit(1).minimumScaleFactor(0.7)
      Text(label).font(.system(size: 10)).foregroundStyle(SU.soft).lineLimit(1)
      if let e = extra, !e.isEmpty { Text(e).font(.system(size: 10, weight: .bold)).foregroundStyle(SU.danger).lineLimit(1) }
    }
    .frame(maxWidth: .infinity, alignment: .leading).padding(8).background(SU.tile, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
  }
}

/// Fond : iOS 17 fournit le conteneur ; avant, on peint nous-mêmes.
extension View {
  @ViewBuilder func widgetSurface() -> some View {
    if #available(iOS 17.0, *) { self.containerBackground(for: .widget) { Color(UIColor.systemBackground) } }
    else { self.padding(14).background(Color(UIColor.systemBackground)) }
  }
  @ViewBuilder func rtl(_ on: Bool) -> some View { self.environment(\.layoutDirection, on ? .rightToLeft : .leftToRight) }
}

/// Dari, la mascotte (Assets.xcassets de l'extension : `dari-<pose>` et `dari-<pose>-blink`).
///
/// WidgetKit ne joue pas d'animation en boucle : ce qui bouge, c'est le passage d'un état à
/// l'autre. Chaque pose porte sa propre identité (`.id`), donc quand l'app pousse un nouvel
/// état (paiement reçu → Dari passe de « montre » à « rit »), iOS 17+ anime l'ancienne pose qui
/// sort et la nouvelle qui entre, avec un petit rebond. Montants masqués → yeux fermés.
struct DariView: View {
  var pose: String?
  var yeuxFermes = false
  var size: CGFloat = 40

  static let poses: Set<String> = ["wave", "laugh", "point", "think", "type"]

  var body: some View {
    let p = pose.flatMap { DariView.poses.contains($0) ? $0 : nil } ?? "wave"
    let nom = yeuxFermes ? "dari-\(p)-blink" : "dari-\(p)"
    image(nom)
      .resizable()
      .scaledToFit()
      .frame(width: size, height: size)
      .accessibilityHidden(true)
      .id(nom)
      .modifier(DariTransition())
  }

  /// Dans les modes teinté / accentué (iOS 18), Dari reste en couleurs.
  private func image(_ nom: String) -> Image {
    if #available(iOS 18.0, *) { return Image(nom).widgetAccentedRenderingMode(.fullColor) }
    return Image(nom)
  }
}

private struct DariTransition: ViewModifier {
  func body(content: Content) -> some View {
    if #available(iOS 17.0, *) {
      content.transition(.asymmetric(insertion: .scale(scale: 0.6, anchor: .bottom).combined(with: .opacity), removal: .opacity))
    } else {
      content
    }
  }
}

/// État « non connecté » / pas encore de données : Dari salue et invite à se connecter.
struct SignedOutView: View {
  var body: some View {
    VStack(spacing: 6) {
      DariView(pose: "wave", size: 52)
      Text(NSLocalizedString("w_sign_in", comment: "")).font(.system(size: 12)).foregroundStyle(SU.soft).multilineTextAlignment(.center)
    }.frame(maxWidth: .infinity, maxHeight: .infinity).widgetURL(widgetURL("/tableau-de-bord"))
  }
}
