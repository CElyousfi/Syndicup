package ma.syndicup.app.widgets

import android.content.Context
import android.widget.RemoteViews
import ma.syndicup.app.R
import ma.syndicup.app.widgets.SyndicUpWidget.Companion.texte
import org.json.JSONObject

/** « Loge » (gardien) : visiteurs en attente, arrivées / départs LCD du jour, incidents ; deux actions. */
class GardienWidget : SyndicUpWidget() {
  override val bloc = "gardien"
  override val layout = R.layout.widget_gardien

  override fun bind(context: Context, views: RemoteViews, snapshot: JSONObject, data: JSONObject, masquer: Boolean) {
    views.texte(R.id.w_title, snapshot.optString("nom"))
    val visites = data.optInt("visites")
    views.texte(R.id.w_t1_value, visites.toString())
    views.texte(R.id.w_t1_label, data.optString("visites_label"))
    views.setTextColor(R.id.w_t1_value, color(context, if (visites > 0) R.color.w_danger else R.color.w_ink))
    views.texte(R.id.w_t2_value, data.optInt("arrivees").toString() + " / " + data.optInt("departs").toString())
    views.texte(R.id.w_t2_label, data.optString("arrivees_label") + " / " + data.optString("departs_label"))
    views.texte(R.id.w_t3_value, data.optInt("incidents").toString())
    views.texte(R.id.w_t3_label, data.optString("incidents_label"))
    views.texte(R.id.w_cta, data.optString("enregistrer"))
    views.texte(R.id.w_cta2, data.optString("signaler"))

    views.setOnClickPendingIntent(R.id.w_root, launch(context, data.optString("route_visites", "/visites")))
    views.setOnClickPendingIntent(R.id.w_t1_tile, launch(context, data.optString("route_visites", "/visites")))
    views.setOnClickPendingIntent(R.id.w_t2_tile, launch(context, data.optString("route_lcd", "/location-courte-duree")))
    views.setOnClickPendingIntent(R.id.w_t3_tile, launch(context, "/incidents"))
    views.setOnClickPendingIntent(R.id.w_cta, launch(context, data.optString("route_enregistrer", "/visites?enregistrer=1")))
    views.setOnClickPendingIntent(R.id.w_cta2, launch(context, data.optString("route_signaler", "/incidents/nouveau")))
  }
}
