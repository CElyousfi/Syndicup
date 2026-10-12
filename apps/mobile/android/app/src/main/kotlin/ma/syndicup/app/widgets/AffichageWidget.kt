package ma.syndicup.app.widgets

import android.content.Context
import android.widget.RemoteViews
import ma.syndicup.app.R
import ma.syndicup.app.widgets.SyndicUpWidget.Companion.texte
import ma.syndicup.app.widgets.SyndicUpWidget.Companion.visible
import org.json.JSONObject

/** « Affichage » : les 3 dernières annonces, bande rouge si urgente, point si non lue. */
class AffichageWidget : SyndicUpWidget() {
  override val bloc = "affichage"
  override val layout = R.layout.widget_affichage

  private val rows = intArrayOf(R.id.w_row1, R.id.w_row2, R.id.w_row3)
  private val titles = intArrayOf(R.id.w_row1_title, R.id.w_row2_title, R.id.w_row3_title)
  private val whens = intArrayOf(R.id.w_row1_when, R.id.w_row2_when, R.id.w_row3_when)
  private val stripes = intArrayOf(R.id.w_row1_stripe, R.id.w_row2_stripe, R.id.w_row3_stripe)
  private val dots = intArrayOf(R.id.w_row1_dot, R.id.w_row2_dot, R.id.w_row3_dot)

  override fun bind(context: Context, views: RemoteViews, snapshot: JSONObject, data: JSONObject, masquer: Boolean) {
    views.texte(R.id.w_title, data.optString("titre"))
    val nonLues = data.optInt("non_lues")
    views.texte(R.id.w_badge, data.optString("non_lues_label"))
    views.setInt(R.id.w_badge, "setBackgroundResource", if (nonLues > 0) R.drawable.w_bg_brand else R.drawable.w_bg_tile)
    views.setTextColor(R.id.w_badge, color(context, if (nonLues > 0) android.R.color.white else R.color.w_soft))
    val annonces = data.optJSONArray("annonces")
    val n = annonces?.length() ?: 0
    views.visible(R.id.w_empty, n == 0)
    views.texte(R.id.w_empty, data.optString("vide"))
    for (i in 0 until 3) {
      val a = if (i < n) annonces!!.optJSONObject(i) else null
      views.visible(rows[i], a != null)
      if (a == null) continue
      views.texte(titles[i], a.optString("titre"))
      views.texte(whens[i], a.optString("quand"))
      views.setInt(stripes[i], "setImageAlpha", if (a.optBoolean("urgent")) 255 else 0)
      views.setInt(dots[i], "setImageAlpha", if (a.optBoolean("lu")) 0 else 255)
      views.setOnClickPendingIntent(rows[i], launch(context, a.optString("route", "/affichage")))
    }
    views.setOnClickPendingIntent(R.id.w_root, launch(context, data.optString("route", "/affichage")))
    views.setOnClickPendingIntent(R.id.w_badge, launch(context, data.optString("route", "/affichage")))
  }
}
