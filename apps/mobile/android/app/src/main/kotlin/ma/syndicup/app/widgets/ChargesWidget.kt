package ma.syndicup.app.widgets

import android.content.Context
import android.widget.RemoteViews
import ma.syndicup.app.R
import ma.syndicup.app.widgets.SyndicUpWidget.Companion.texte
import org.json.JSONObject

/** « Mes charges » : solde, échéance relative, anneau de la part payée, bouton Payer, œil. */
class ChargesWidget : SyndicUpWidget() {
  override val bloc = "charges"
  override val layout = R.layout.widget_charges
  override val montants = true

  override fun bind(context: Context, views: RemoteViews, snapshot: JSONObject, data: JSONObject, masquer: Boolean) {
    val aJour = data.optBoolean("a_jour")
    views.texte(R.id.w_title, snapshot.optString("nom"))
    views.texte(R.id.w_amount, if (masquer) "•••• MAD" else data.optString("montant"))
    views.setTextColor(R.id.w_amount, color(context, if (aJour) R.color.w_brand else R.color.w_ink))
    views.texte(R.id.w_subtitle, data.optString("sous_titre"))
    views.setImageViewBitmap(R.id.w_ring, ring(context, data.optDouble("taux", 1.0), danger = !aJour && data.optDouble("taux", 1.0) < 0.5))
    views.texte(R.id.w_cta, if (aJour) snapshot.optJSONObject("labels")?.optString("ouvrir") else data.optString("payer"))
    views.texte(R.id.w_updated, snapshot.optString("maj"))
    views.setImageViewResource(R.id.w_eye, if (masquer) R.drawable.w_ic_eye_off else R.drawable.w_ic_eye)

    views.setOnClickPendingIntent(R.id.w_root, launch(context, data.optString("route_detail", "/lots")))
    views.setOnClickPendingIntent(R.id.w_cta, launch(context, data.optString("route", "/payer")))
    views.setOnClickPendingIntent(R.id.w_eye, toggleMasquer(context))
  }
}
