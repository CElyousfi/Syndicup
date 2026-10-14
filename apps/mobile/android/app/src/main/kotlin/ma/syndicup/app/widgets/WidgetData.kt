package ma.syndicup.app.widgets

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.SharedPreferences
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import androidx.core.content.ContextCompat
import es.antonborri.home_widget.HomeWidgetBackgroundIntent
import es.antonborri.home_widget.HomeWidgetLaunchIntent
import es.antonborri.home_widget.HomeWidgetProvider
import ma.syndicup.app.MainActivity
import ma.syndicup.app.R
import org.json.JSONArray
import org.json.JSONObject

/**
 * Socle commun des widgets SyndicUp. Le JSON `w_snapshot` est écrit par l'app Flutter
 * (lib/core/widget/home_widgets.dart) déjà traduit et mis en forme : ici on ne fait
 * qu'afficher, dessiner (anneau, courbe) et brancher les clics.
 */
abstract class SyndicUpWidget : HomeWidgetProvider() {
  /** Clé du bloc à afficher dans le JSON (`charges`, `ag`, …). */
  abstract val bloc: String
  abstract val layout: Int

  abstract fun bind(context: Context, views: RemoteViews, snapshot: JSONObject, data: JSONObject, masquer: Boolean)

  /** Ce widget affiche des montants : Dari ferme les yeux quand on les masque (« je ne regarde pas »). */
  open val montants: Boolean = false

  override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray, widgetData: SharedPreferences) {
    val snapshot = snapshot(widgetData)
    val data = snapshot?.optJSONObject(bloc)
    val masquer = widgetData.getBoolean(KEY_MASQUER, false)
    appWidgetIds.forEach { id ->
      val views: RemoteViews
      if (snapshot == null || snapshot.optBoolean("vide", true) || data == null) {
        views = RemoteViews(context.packageName, R.layout.widget_loading)
        views.setOnClickPendingIntent(R.id.w_loading_text, launch(context, "/tableau-de-bord"))
      } else {
        views = RemoteViews(context.packageName, layout)
        // Direction : l'app décide (langue de l'app, pas du système).
        views.setInt(R.id.w_root, "setLayoutDirection", if (snapshot.optBoolean("rtl")) View.LAYOUT_DIRECTION_RTL else View.LAYOUT_DIRECTION_LTR)
        bind(context, views, snapshot, data, masquer)
        views.dari(data.optString("dari"), yeuxFermes = montants && masquer)
      }
      appWidgetManager.updateAppWidget(id, views)
    }
  }

  companion object {
    const val KEY_SNAPSHOT = "w_snapshot"
    const val KEY_MASQUER = "w_masquer"

    fun snapshot(prefs: SharedPreferences): JSONObject? =
        try { prefs.getString(KEY_SNAPSHOT, null)?.let { JSONObject(it) } } catch (_: Exception) { null }

    /** Ouvre l'app sur une route go_router (syndicup://widget?route=/payer). */
    fun launch(context: Context, route: String): PendingIntent =
        HomeWidgetLaunchIntent.getActivity(context, MainActivity::class.java, Uri.parse("syndicup://widget?route=" + Uri.encode(route)))

    /** Bascule « masquer les montants » sans ouvrir l'app (callback Dart en arrière-plan). */
    fun toggleMasquer(context: Context): PendingIntent =
        HomeWidgetBackgroundIntent.getBroadcast(context, Uri.parse("syndicup://masquer"))

    /** Images du ViewFlipper de layout/w_dari.xml, dans l'ordre (la dernière = clignement). */
    private val DARI_FRAMES = intArrayOf(
        R.id.w_dari_f0, R.id.w_dari_f1, R.id.w_dari_f2, R.id.w_dari_f3, R.id.w_dari_f4, R.id.w_dari_f5, R.id.w_dari_f6, R.id.w_dari_f7,
        R.id.w_dari_f8, R.id.w_dari_f9, R.id.w_dari_f10, R.id.w_dari_f11, R.id.w_dari_f12, R.id.w_dari_f13, R.id.w_dari_f14, R.id.w_dari_f15,
    )

    /** Pose de Dari choisie par l'app selon l'état du bloc (`wave`, `laugh`, `think`, `point`, `type`). */
    private fun dariPose(pose: String?): Pair<Int, Int> = when (pose) {
      "laugh" -> R.drawable.dari_w_laugh to R.drawable.dari_w_laugh_blink
      "think" -> R.drawable.dari_w_think to R.drawable.dari_w_think_blink
      "point" -> R.drawable.dari_w_point to R.drawable.dari_w_point_blink
      "type" -> R.drawable.dari_w_type to R.drawable.dari_w_type_blink
      else -> R.drawable.dari_w_wave to R.drawable.dari_w_wave_blink
    }

    /** Pose Dari dans le widget : 15 images yeux ouverts + 1 clignement, ou yeux fermés partout. */
    fun RemoteViews.dari(pose: String?, yeuxFermes: Boolean = false) {
      val (ouvert, cligne) = dariPose(pose)
      DARI_FRAMES.forEachIndexed { i, id ->
        setImageViewResource(id, if (yeuxFermes || i == DARI_FRAMES.lastIndex) cligne else ouvert)
      }
    }

    fun RemoteViews.texte(id: Int, s: String?) = setTextViewText(id, s ?: "")
    fun RemoteViews.visible(id: Int, v: Boolean) = setViewVisibility(id, if (v) View.VISIBLE else View.GONE)

    fun color(context: Context, res: Int) = ContextCompat.getColor(context, res)

    private fun dp(context: Context, v: Float) = v * context.resources.displayMetrics.density

    /** Anneau de progression (part payée) : piste pâle + arc de marque, trait arrondi. */
    fun ring(context: Context, progress: Double, sizeDp: Float = 56f, danger: Boolean = false): Bitmap {
      val size = dp(context, sizeDp).toInt().coerceAtLeast(8)
      val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
      val c = Canvas(bmp)
      val stroke = dp(context, 6f)
      val rect = RectF(stroke / 2, stroke / 2, size - stroke / 2, size - stroke / 2)
      val track = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = stroke; color = color(context, R.color.w_hairline) }
      val arc = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE; strokeWidth = stroke; strokeCap = Paint.Cap.ROUND
        color = color(context, if (danger) R.color.w_danger else R.color.w_brand)
      }
      c.drawOval(rect, track)
      val sweep = (progress.coerceIn(0.0, 1.0) * 360).toFloat()
      if (sweep > 0f) c.drawArc(rect, -90f, sweep, false, arc)
      return bmp
    }

    /** Courbe de recouvrement des 6 derniers appels (0..1), aire teintée sous la ligne. */
    fun sparkline(context: Context, values: JSONArray, wDp: Float = 96f, hDp: Float = 40f): Bitmap {
      val w = dp(context, wDp).toInt().coerceAtLeast(8)
      val h = dp(context, hDp).toInt().coerceAtLeast(8)
      val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
      val n = values.length()
      if (n == 0) return bmp
      val c = Canvas(bmp)
      val pad = dp(context, 3f)
      val line = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = dp(context, 2f); strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND; color = color(context, R.color.w_brand) }
      val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL; color = color(context, R.color.w_brand); alpha = 36 }
      val dot = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL; color = color(context, R.color.w_brand) }
      val path = Path()
      val area = Path()
      val xs = FloatArray(n); val ys = FloatArray(n)
      for (i in 0 until n) {
        val v = values.optDouble(i, 1.0).coerceIn(0.0, 1.0).toFloat()
        xs[i] = if (n == 1) w / 2f else pad + (w - 2 * pad) * i / (n - 1)
        ys[i] = pad + (h - 2 * pad) * (1f - v)
        if (i == 0) { path.moveTo(xs[i], ys[i]); area.moveTo(xs[i], h.toFloat()); area.lineTo(xs[i], ys[i]) } else { path.lineTo(xs[i], ys[i]); area.lineTo(xs[i], ys[i]) }
      }
      area.lineTo(xs[n - 1], h.toFloat()); area.close()
      c.drawPath(area, fill)
      c.drawPath(path, line)
      c.drawCircle(xs[n - 1], ys[n - 1], dp(context, 3f), dot)
      return bmp
    }
  }
}
