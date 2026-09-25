package com.escudodigital.ui

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.escudodigital.R
import com.escudodigital.data.local.EscudoDatabase
import com.escudodigital.data.repository.ThreatRepository
import com.escudodigital.sync.SyncWorker
import com.google.android.material.switchmaterial.SwitchMaterial
import kotlinx.coroutines.launch

/**
 * Pantalla de configuración de Escudo Digital.
 * Permite ajustar sensibilidad de alertas, ver estado de permisos,
 * forzar sincronización de la base de amenazas y consultar el historial.
 */
class SettingsActivity : AppCompatActivity() {

    companion object {
        const val PREF_NAME = "escudo_settings"
        const val KEY_HIGH_SENSITIVITY = "high_sensitivity"
        const val KEY_WEB_PROTECTION = "web_protection"
    }

    private lateinit var repository: ThreatRepository
    private val prefs by lazy { getSharedPreferences(PREF_NAME, MODE_PRIVATE) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        val db = EscudoDatabase.getInstance(applicationContext)
        repository = ThreatRepository.getInstance(db)

        setupButtons()
        refreshPermissionsStatus()
        refreshVersionInfo()
    }

    private fun setupButtons() {
        // Botón volver
        findViewById<android.widget.ImageButton>(R.id.btnBack).setOnClickListener {
            finish()
        }

        // Switch: Sensibilidad alta de alertas
        val switchSensitivity = findViewById<SwitchMaterial>(R.id.switchHighSensitivity)
        switchSensitivity.isChecked = prefs.getBoolean(KEY_HIGH_SENSITIVITY, true)
        switchSensitivity.setOnCheckedChangeListener { _, isChecked ->
            prefs.edit().putBoolean(KEY_HIGH_SENSITIVITY, isChecked).apply()
            val tvDesc = findViewById<TextView>(R.id.tvSensitivityDesc)
            tvDesc.text = if (isChecked)
                "Alta — Avisar ante cualquier señal de riesgo"
            else
                "Media — Solo amenazas confirmadas en la base"
        }

        // Switch: Protección web
        val switchWeb = findViewById<SwitchMaterial>(R.id.switchWebProtection)
        switchWeb.isChecked = prefs.getBoolean(KEY_WEB_PROTECTION, true)
        switchWeb.setOnCheckedChangeListener { _, isChecked ->
            prefs.edit().putBoolean(KEY_WEB_PROTECTION, isChecked).apply()
            if (!isChecked) {
                Toast.makeText(this,
                    "Para desactivar la protección web, deshabilitá Escudo Digital en Accesibilidad",
                    Toast.LENGTH_LONG
                ).show()
                startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
            }
        }

        // Forzar sincronización
        findViewById<LinearLayout>(R.id.rowForceSync).setOnClickListener {
            forceSync()
        }

        // Historial de alertas (próximamente — placeholder)
        findViewById<LinearLayout>(R.id.rowAlertHistory).setOnClickListener {
            Toast.makeText(this, "Historial de alertas — próximamente", Toast.LENGTH_SHORT).show()
        }

        // Ir a configurar Accesibilidad
        findViewById<LinearLayout>(R.id.rowAccessibility).setOnClickListener {
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        }

        // Ir a configurar Notificaciones
        findViewById<LinearLayout>(R.id.rowNotifications).setOnClickListener {
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }
    }

    private fun refreshPermissionsStatus() {
        // Accesibilidad
        val a11yEnabled = isAccessibilityServiceEnabled()
        findViewById<TextView>(R.id.tvA11yStatus).text =
            if (a11yEnabled) "Activo — protección web habilitada"
            else "⚠️ Inactivo — tocá para activar"
        findViewById<TextView>(R.id.tvA11yBadge).apply {
            text = if (a11yEnabled) "✓ Activo" else "Inactivo"
            setTextColor(getColor(if (a11yEnabled) R.color.shield_active else R.color.shield_warning))
        }

        // Notification Listener
        val notifEnabled = isNotificationListenerEnabled()
        findViewById<TextView>(R.id.tvNotifBadge).apply {
            text = if (notifEnabled) "✓ Activo" else "Inactivo"
            setTextColor(getColor(if (notifEnabled) R.color.shield_active else R.color.shield_warning))
        }
    }

    private fun refreshVersionInfo() {
        lifecycleScope.launch {
            val syncState = repository.getSyncState()
            val version = syncState?.localVersion ?: 0
            val count = repository.getLocalThreatCount()
            val tvVersion = findViewById<TextView>(R.id.tvVersion)
            tvVersion.text = "Versión 1.0 · Base de amenazas v$version ($count entradas)"

            val tvLastSync = findViewById<TextView>(R.id.tvLastSync)
            tvLastSync.text = if (count > 0)
                "$count amenazas cargadas · v$version"
            else
                "Sin datos — verificá la conexión"
        }
    }

    private fun forceSync() {
        Toast.makeText(this, "Actualizando base de amenazas...", Toast.LENGTH_SHORT).show()
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()
        val syncRequest = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(constraints)
            .addTag(SyncWorker.TAG_IMMEDIATE)
            .build()
        WorkManager.getInstance(this).enqueueUniqueWork(
            SyncWorker.WORK_NAME_IMMEDIATE,
            ExistingWorkPolicy.REPLACE,
            syncRequest
        )

        WorkManager.getInstance(this)
            .getWorkInfosByTagLiveData(SyncWorker.TAG_IMMEDIATE)
            .observe(this) { workInfos ->
                val info = workInfos?.firstOrNull()
                when (info?.state) {
                    androidx.work.WorkInfo.State.SUCCEEDED -> {
                        Toast.makeText(this, "✅ Base actualizada correctamente", Toast.LENGTH_SHORT).show()
                        refreshVersionInfo()
                    }
                    androidx.work.WorkInfo.State.FAILED -> {
                        Toast.makeText(this, "❌ Error al sincronizar — revisá la conexión", Toast.LENGTH_SHORT).show()
                    }
                    else -> {}
                }
            }
    }

    private fun isAccessibilityServiceEnabled(): Boolean {
        val expectedService = "${packageName}/com.escudodigital.services.ScamBrowserProtectionService"
        val enabledServices = Settings.Secure.getString(
            contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: return false
        return enabledServices.contains(expectedService, ignoreCase = true) ||
               enabledServices.contains("ScamBrowserProtectionService", ignoreCase = true)
    }

    private fun isNotificationListenerEnabled(): Boolean {
        val cn = "${packageName}/com.escudodigital.notifications.ScamNotificationListener"
        val flat = Settings.Secure.getString(contentResolver, "enabled_notification_listeners")
        return flat?.contains(cn) == true
    }

    override fun onResume() {
        super.onResume()
        refreshPermissionsStatus()
    }
}
