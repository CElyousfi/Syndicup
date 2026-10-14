package ma.syndicup.app.widgets

import android.content.Context
import android.widget.RemoteViews
import ma.syndicup.app.R
import ma.syndicup.app.widgets.SyndicUpWidget.Companion.texte
import ma.syndicup.app.widgets.SyndicUpWidget.Companion.visible
import org.json.JSONArray
import org.json.JSONObject

/** « Ma résidence » (syndic / conseil) : recouvrement + courbe 6 appels, impayés, incidents (hors délai), à valider. */
class ResidenceWidget : SyndicUpWidget() {
  override val bloc = "residence"
  override val layout = R.layout.widget_residence
  override val montants = true

  override fun bind(context: Context, views: RemoteViews, snapshot: JSONObject, data: JSONObject, masquer: Boolean) {
    views.texte(R.id.w_title, snapshot.optString("nom"))
    views.texte(R.id.w_rate, data.optString("taux_fmt"))
    views.texte(R.id.w_rate_label, data.optString("recouvrement"))
    views.setImageViewBitmap(R.id.w_spark, sparkline(context, data.optJSONArray("serie") ?: JSONArray()))
    views.setImageViewResource(R.id.w_eye, if (masquer) R.drawable.w_ic_eye_off else R.drawable.w_ic_eye)

    views.texte(R.id.w_t1_value, if (masquer) "••••" else data.optString("impaye"))
    views.texte(R.id.w_t1_label, data.optString("impaye_label"))
    views.texte(R.id.w_t2_value, data.optInt("incidents").toString())
    views.texte(R.id.w_t2_label, data.optString("incidents_label"))
    val sla = data.optString("sla_label")
    views.visible(R.id.w_t2_extra, sla.isNotEmpty())
    views.texte(R.id.w_t2_extra, sla)
    views.texte(R.id.w_t3_value, data.optInt("reservations").toString())
    views.texte(R.id.w_t3_label, data.optString("reservations_label"))
    views.texte(R.id.w_cta, data.optString("encaisser"))
    views.texte(R.id.w_updated, snapshot.optString("maj"))

    views.setOnClickPendingIntent(R.id.w_root, launch(context, data.optString("route", "/tableau-de-bord")))
    views.setOnClickPendingIntent(R.id.w_t1_tile, launch(context, data.optString("route_impayes", "/finances/appels-de-fonds")))
    views.setOnClickPendingIntent(R.id.w_t2_tile, launch(context, data.optString("route_incidents", "/incidents")))
    views.setOnClickPendingIntent(R.id.w_t3_tile, launch(context, data.optString("route_reservations", "/reservations")))
    views.setOnClickPendingIntent(R.id.w_cta, launch(context, data.optString("route_encaisser", "/finances/appels-de-fonds")))
    views.setOnClickPendingIntent(R.id.w_eye, toggleMasquer(context))
  }
}
