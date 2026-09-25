package com.escudodigital.services

import android.accessibilityservice.AccessibilityService
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.escudodigital.core.AlertManager
import com.escudodigital.core.LocalRiskEngine
import com.escudodigital.data.local.EscudoDatabase
import com.escudodigital.ui.ThreatInterceptActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Servicio de accesibilidad para la protección de navegación en tiempo real.
 * Secciones 14 y 15 de AGENTS.md: Detección y bloqueo de dominios peligrosos en navegadores (Chrome, etc.).
 *
 * Supervisa la barra de direcciones de los navegadores instalados (Google Chrome, Firefox, Brave, etc.)
 * y evalúa inmediatamente el dominio contra la base de datos local Room.
 * Si el dominio está reportado como peligroso (Phishing, Suplantación, Estafa),
 * despliega instantáneamente la ventana modal ThreatInterceptActivity.
 */
class ScamBrowserProtectionService : AccessibilityService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var riskEngine: LocalRiskEngine
    private var lastCheckedDomain: String = ""
    private var lastCheckTimestamp: Long = 0L

    companion object {
        private const val TAG = "BrowserProtection"
        // Dominios temporalmente permitidos si el usuario elige "Continuar de todas formas" (por 5 minutos)
        val temporarilyAllowedDomains = java.util.concurrent.ConcurrentHashMap<String, Long>()

        fun allowDomainTemporarily(domain: String) {
            val clean = domain.trim().lowercase().removePrefix("https://").removePrefix("http://").removePrefix("www.").split("/")[0]
            temporarilyAllowedDomains[clean] = System.currentTimeMillis() + 5 * 60 * 1000L
        }
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.d(TAG, "ScamBrowserProtectionService conectado y activo")
        val db = EscudoDatabase.getInstance(applicationContext)
        riskEngine = LocalRiskEngine(db.threatDao(), db.trustedNumberDao())
    }

    data class BrowserUrlInfo(
        val url: String,
        val isFocused: Boolean
    )

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        event ?: return

        // 1. Ignorar tecleo directo o autocompletado mientras el usuario escribe en el campo de texto
        if (event.eventType == AccessibilityEvent.TYPE_VIEW_TEXT_CHANGED) {
            return
        }

        // 2. Solo procesar cambios de ventana o contenido en navegadores
        val packageName = event.packageName?.toString() ?: return
        if (!isBrowserPackage(packageName)) return

        val rootNode = rootInActiveWindow ?: event.source ?: return
        val urlInfo = findUrlInBrowser(rootNode, packageName)
            ?: (if (rootInActiveWindow != null) event.source?.let { findUrlInBrowser(it, packageName) } else null)
            ?: return

        // 3. Si la barra de direcciones está enfocada (el usuario está tipeando o hay sugerencias en pantalla),
        // NO bloquear. Solo interceptar cuando se presione Enter / inicie la navegación (la barra pierde el foco).
        if (urlInfo.isFocused) {
            return
        }

        val rawUrl = urlInfo.url
        val domain = riskEngine.normalizeDomain(rawUrl)
        if (domain.isBlank() || domain.length < 4 || !domain.contains(".") || domain.substringAfterLast(".").length < 2) return

        val now = System.currentTimeMillis()
        if (domain == lastCheckedDomain && (now - lastCheckTimestamp) < 4000L) {
            return
        }
        lastCheckedDomain = domain
        lastCheckTimestamp = now

        // Verificar si el usuario ya eligió continuar en los últimos 5 minutos
        val allowExpiry = temporarilyAllowedDomains[domain]
        if (allowExpiry != null && now < allowExpiry) {
            Log.d(TAG, "Dominio $domain en excepción temporal del usuario")
            return
        }

        scope.launch {
            evaluateAndIntercept(domain, rawUrl)
        }
    }

    private suspend fun evaluateAndIntercept(domain: String, rawUrl: String) {
        val result = riskEngine.evaluateDomain(domain)
        Log.d(TAG, "Evaluación de dominio '$domain': nivel=${result.level}")

        if (result.isMediumOrHigh) {
            Log.d(TAG, "🚨 BLOQUEO PREVENTIVO: Se detectó sitio web peligroso en el navegador: $domain")
            AlertManager.sendAlert(
                context = applicationContext,
                result = result.copy(detectedValue = domain),
                notificationId = 4000,
                threatType = ThreatInterceptActivity.TYPE_URL,
                messageText = null
            )
        }
    }

    private fun isBrowserPackage(packageName: String): Boolean {
        return packageName.contains("chrome", ignoreCase = true) ||
                packageName.contains("browser", ignoreCase = true) ||
                packageName.contains("firefox", ignoreCase = true) ||
                packageName.contains("opera", ignoreCase = true) ||
                packageName.contains("brave", ignoreCase = true) ||
                packageName.contains("duckduckgo", ignoreCase = true) ||
                packageName.contains("msedge", ignoreCase = true) ||
                packageName.contains("webview", ignoreCase = true)
    }

    /**
     * Busca el texto de la barra de direcciones según los IDs de vista de Chrome y navegadores habituales,
     * o busca un nodo de entrada de URL en la jerarquía.
     */
    private fun findUrlInBrowser(rootNode: AccessibilityNodeInfo, packageName: String): BrowserUrlInfo? {
        val browserUrlIds = listOf(
            "$packageName:id/url_bar",
            "com.android.chrome:id/url_bar",
            "org.chromium.chrome:id/url_bar",
            "$packageName:id/search_box_text",
            "$packageName:id/location_bar_edit_text",
            "$packageName:id/toolbar_url",
            "$packageName:id/mozac_browser_toolbar_url_view",
            "$packageName:id/address_bar",
            "$packageName:id/display_url"
        )

        for (id in browserUrlIds) {
            try {
                val nodes = rootNode.findAccessibilityNodeInfosByViewId(id)
                for (node in nodes) {
                    val text = node.text?.toString() ?: node.contentDescription?.toString()
                    if (!text.isNullOrBlank() && (text.contains(".") || text.startsWith("http"))) {
                        return BrowserUrlInfo(url = text, isFocused = node.isFocused)
                    }
                }
            } catch (e: Exception) {
                // ignorar errores de consulta por id
            }
        }

        // Búsqueda recursiva alternativa restringida a elementos editables/inputs
        return searchUrlRecursive(rootNode, depth = 0)
    }

    private fun searchUrlRecursive(node: AccessibilityNodeInfo?, depth: Int): BrowserUrlInfo? {
        if (node == null || depth > 8) return null

        val isInput = node.isEditable || node.className?.contains("EditText", ignoreCase = true) == true
        if (isInput) {
            val text = node.text?.toString() ?: node.contentDescription?.toString() ?: ""
            if (text.isNotBlank() && (text.startsWith("http://") || text.startsWith("https://") ||
                        (text.contains(".") && !text.contains(" ") && text.length > 3))) {
                return BrowserUrlInfo(url = text, isFocused = node.isFocused)
            }
        }

        for (i in 0 until node.childCount) {
            val child = node.getChild(i)
            val found = searchUrlRecursive(child, depth + 1)
            if (found != null) return found
        }
        return null
    }

    override fun onInterrupt() {
        Log.w(TAG, "ScamBrowserProtectionService interrumpido")
    }

    override fun onDestroy() {
        super.onDestroy()
        scope.cancel()
    }
}
