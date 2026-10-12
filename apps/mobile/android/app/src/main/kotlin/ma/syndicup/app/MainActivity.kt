package ma.syndicup.app

import android.content.Intent
import android.net.Uri
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import java.io.File
import java.io.FileOutputStream

// FlutterFragmentActivity (et non FlutterActivity) : requis par local_auth pour la biométrie.
class MainActivity : FlutterFragmentActivity() {
  private var partage: Map<String, String>? = null
  private var canal: MethodChannel? = null

  override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
    super.configureFlutterEngine(flutterEngine)
    // Cible de partage (M26-D) : une photo partagée devient un signalement, un PDF une preuve de paiement.
    canal = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "ma.syndicup.app/share").also { c ->
      c.setMethodCallHandler { call, result ->
        when (call.method) {
          "prendre" -> { result.success(partage); partage = null }
          else -> result.notImplemented()
        }
      }
    }
    traiterPartage(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    if (traiterPartage(intent)) canal?.invokeMethod("partage", null)
  }

  /** Copie le contenu partagé dans le cache (l'URI du fournisseur n'est pas lisible plus tard) et le garde en attente. */
  private fun traiterPartage(intent: Intent?): Boolean {
    if (intent?.action != Intent.ACTION_SEND) return false
    val uri: Uri = (intent.getParcelableExtra(Intent.EXTRA_STREAM) as? Uri) ?: return false
    val mime = intent.type ?: contentResolver.getType(uri) ?: "application/octet-stream"
    return try {
      val ext = when {
        mime == "application/pdf" -> "pdf"
        mime == "image/png" -> "png"
        mime.startsWith("image/") -> "jpg"
        else -> "bin"
      }
      val dest = File(cacheDir, "partage_${System.currentTimeMillis()}.$ext")
      contentResolver.openInputStream(uri)?.use { input -> FileOutputStream(dest).use { input.copyTo(it) } } ?: return false
      partage = mapOf("path" to dest.absolutePath, "mime" to mime)
      // Évite de rejouer le partage à la rotation / au retour.
      intent.action = Intent.ACTION_MAIN
      true
    } catch (_: Exception) {
      false
    }
  }
}
