package ma.syndicup.app.widgets

import android.content.Context
import android.widget.RemoteViews
import ma.syndicup.app.R
import ma.syndicup.app.widgets.SyndicUpWidget.Companion.texte
import ma.syndicup.app.widgets.SyndicUpWidget.Companion.visible
import org.json.JSONObject

/** « Assemblée » : trois états — aucune, à venir (compte à rebours), en cours (EN DIRECT → Voter). */
class AgWidget : SyndicUpWidget() {
  override val bloc = "ag"
  override val layout = R.layout.widget_ag

  override fun bind(context: Context, views: RemoteViews, snapshot: JSONObject, data: JSONObject, masquer: Boolean) {
    val etat = data.optString("etat")
    views.texte(R.id.w_title, data.optString("titre"))
    views.texte(R.id.w_updated, snapshot.optString("maj"))
    when (etat) {
      "AUCUNE" -> {
        views.visible(R.id.w_chip, false)
        views.texte(R.id.w_line1, data.optString("compte"))
        views.texte(R.id.w_line2, snapshot.optString("nom"))
        views.texte(R.id.w_cta, snapshot.optJSONObject("labels")?.optString("ouvrir"))
      }
      else -> {
        val enCours = etat == "EN_COURS"
        views.visible(R.id.w_chip, true)
        views.texte(R.id.w_chip, data.optString("compte"))
        views.setInt(R.id.w_chip, "setBackgroundResource", if (enCours) R.drawable.w_bg_danger else R.drawable.w_bg_brand)
        views.texte(R.id.w_line1, data.optString("type") + " · " + data.optString("date"))
        views.texte(R.id.w_line2, data.optString("progression"))
        views.texte(R.id.w_cta, data.optString("cta"))
        views.setInt(R.id.w_cta, "setBackgroundResource", if (enCours) R.drawable.w_bg_danger else R.drawable.w_bg_cta)
        views.setTextColor(R.id.w_cta, color(context, if (enCours) android.R.color.white else R.color.w_on_cta))
      }
    }
    val route = data.optString("route", "/ag")
    views.setOnClickPendingIntent(R.id.w_root, launch(context, route))
    views.setOnClickPendingIntent(R.id.w_cta, launch(context, route))
  }
}
