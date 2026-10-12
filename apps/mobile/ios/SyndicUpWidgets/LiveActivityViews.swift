import ActivityKit
import SwiftUI
import WidgetKit

/// Live Activity SyndicUp — écran verrouillé + île dynamique. Trois objets : séance d'AG
/// (résolution en cours, votes, progression de l'ordre du jour), appel de fonds (dû → payé),
/// incident (ouvert → en cours → résolu). L'état arrive par APNs (content-state).
@available(iOS 16.1, *)
struct SyndicUpLiveActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: SyndicUpActivityAttributes.self) { context in
      LockScreenLiveView(context: context)
        .activityBackgroundTint(Color(UIColor.systemBackground))
        .activitySystemActionForegroundColor(SU.ink)
    } dynamicIsland: { context in
      let st = context.state
      let p = st.progressionPour(type: context.attributes.type)
      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          HStack(spacing: 6) {
            Image(systemName: icone(context.attributes.type)).foregroundStyle(SU.brand)
            Text(context.attributes.residence).font(.caption.bold()).lineLimit(1)
          }
        }
        DynamicIslandExpandedRegion(.trailing) {
          if let p = p { Ring(progress: p, danger: false, line: 4).frame(width: 26, height: 26) }
        }
        DynamicIslandExpandedRegion(.center) {
          Text(st.titre ?? "").font(.headline).lineLimit(1)
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(alignment: .leading, spacing: 4) {
            Text(st.corps ?? "").font(.caption).foregroundStyle(.secondary).lineLimit(2)
            if let p = p { ProgressView(value: p).tint(st.terminee ? SU.brand : SU.cta) }
          }
        }
      } compactLeading: {
        Image(systemName: icone(context.attributes.type)).foregroundStyle(SU.brand)
      } compactTrailing: {
        if let p = p { Ring(progress: p, danger: false, line: 3).frame(width: 18, height: 18) } else { Text(st.nb_votants ?? "").font(.caption2.bold()) }
      } minimal: {
        Image(systemName: icone(context.attributes.type)).foregroundStyle(SU.brand)
      }
      .widgetURL(widgetURL(route(context.attributes)))
      .keylineTint(SU.brand)
    }
  }
}

@available(iOS 16.1, *)
struct LockScreenLiveView: View {
  let context: ActivityViewContext<SyndicUpActivityAttributes>
  var body: some View {
    let st = context.state
    let p = st.progressionPour(type: context.attributes.type)
    VStack(alignment: .leading, spacing: 8) {
      HStack(spacing: 6) {
        Image(systemName: icone(context.attributes.type)).font(.system(size: 12, weight: .bold)).foregroundStyle(SU.brand)
        Text(context.attributes.residence.uppercased()).font(.system(size: 11, weight: .bold)).kerning(0.4).foregroundStyle(SU.soft).lineLimit(1)
        Spacer()
        if context.attributes.type == "AG_SEANCE" && !st.terminee { Chip(text: "EN DIRECT", danger: true) }
        if st.terminee { Image(systemName: "checkmark.seal.fill").foregroundStyle(SU.brand) }
      }
      Text(st.titre ?? "").font(.system(size: 17, weight: .bold)).foregroundStyle(SU.ink).lineLimit(2)
      Text(st.corps ?? "").font(.system(size: 13)).foregroundStyle(SU.soft).lineLimit(2)
      if let p = p {
        ProgressView(value: p).tint(st.terminee ? SU.brand : SU.cta)
      }
      if context.attributes.type == "AG_SEANCE", let n = st.nb_votants, !st.terminee {
        Text("\(n) · \(st.ordre ?? "")/\(st.nb_resolutions ?? "")").font(.system(size: 11)).foregroundStyle(SU.faint)
      }
    }
    .padding(14)
    .environment(\.layoutDirection, context.attributes.rtl ? .rightToLeft : .leftToRight)
    .widgetURL(widgetURL(route(context.attributes)))
  }
}

@available(iOS 16.1, *)
func icone(_ type: String) -> String {
  switch type {
  case "AG_SEANCE": return "person.3.fill"
  case "APPEL_DE_FONDS": return "creditcard.fill"
  default: return "wrench.and.screwdriver.fill"
  }
}

@available(iOS 16.1, *)
func route(_ a: SyndicUpActivityAttributes) -> String {
  switch a.type {
  case "AG_SEANCE": return "/ag/\(a.objetId)/seance"
  case "INCIDENT": return "/incidents/\(a.objetId)"
  default: return "/finances/appels-de-fonds"
  }
}
