package com.escudodigital.ui

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import com.escudodigital.R
import com.escudodigital.core.AlertManager
import com.escudodigital.core.LocalRiskEngine
import com.escudodigital.core.RiskLevel
import com.escudodigital.core.RiskResult
import com.escudodigital.data.local.EscudoDatabase
import com.escudodigital.data.repository.ThreatRepository
import com.escudodigital.databinding.ActivityMainBinding
import com.escudodigital.sync.SyncWorker
import kotlinx.coroutines.launch

/**
 * Pantalla principal: Protección Activa.
 * Sección 3 de AGENTS.md: UX simple para adulto mayor.
 *
 * Diseño intencionalmente simple:
 *  - Gran ícono de estado
 *  - Texto grande y claro
 *  - Pocos botones
 *  - Sin tecnicismos
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var repository: ThreatRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val db = EscudoDatabase.getInstance(applicationContext)
        repository = ThreatRepository.getInstance(db)

        AlertManager.createNotificationChannel(this)

        setupUI()
        refreshStatus()
    }

    private fun setupUI() {
        // Botón de demo: simula recibir una notificación de WhatsApp sospechosa
        binding.btnSimulateAlert.setOnClickListener {
            simulateDemoAlert()
        }

        // Botón para configurar permisos del sistema
        binding.btnCheckPermissions.setOnClickListener {
            openPermissionGuide()
        }
    }

    private fun refreshStatus() {
        lifecycleScope.launch {
            val syncState = repository.getSyncState()
            val version = syncState?.localVersion ?: 0
            val hasData = version > 0

            // Actualizar estado de la base local
            binding.tvDatabaseVersion.text = if (hasData) "v$version (Al día)" else "Sin datos aún"

            // Verificar si el Listener de Notificaciones está activo
            val listenerEnabled = isNotificationListenerEnabled()
            binding.tvNotificationStatus.text = if (listenerEnabled) "Activo" else "⚠️ Requiere permiso"
            binding.tvNotificationStatus.setTextColor(
                getColor(if (listenerEnabled) R.color.shield_active else R.color.shield_warning)
            )

            // Estado general del escudo
            if (listenerEnabled) {
                binding.tvProtectionTitle.text = "🟢 Protección activa"
                binding.tvProtectionDesc.text = "Escudo Digital está funcionando y cuidando tus llamadas y mensajes."
            } else {
                binding.tvProtectionTitle.text = "🟡 Configuración incompleta"
                binding.tvProtectionDesc.text = "Algunos módulos necesitan tu autorización. Tocá 'Configurar Permisos'."
            }
        }
    }

    /**
     * Demo para la presentación del Hackathon:
     * Simula que llega una notificación de WhatsApp de un número sospechoso
     * y dispara la alerta como si la hubiera evaluado el NotificationListenerService.
     */
    private fun simulateDemoAlert() {
        lifecycleScope.launch {
            val db = EscudoDatabase.getInstance(applicationContext)
            val engine = LocalRiskEngine(db.threatDao(), db.trustedNumberDao())

            // Simular: número reportado en la base local (seed data del backend)
            val phoneResult = engine.evaluatePhone("+5491138901234")

            val result = if (phoneResult.isMediumOrHigh) {
                phoneResult
            } else {
                // Fallback: simular con heurística de texto sospechoso
                engine.evaluateNotificationText(
                    "Hola mamá, agendá mi nuevo número. Tuve un accidente con el auto " +
                    "y necesito una transferencia urgente de 80.000 pesos. No le cuentes a nadie todavía."
                )
            }

            // Si hay riesgo, navegar directamente a AlertDetailActivity (demo visual)
            if (result.isMediumOrHigh) {
                val intent = Intent(this@MainActivity, AlertDetailActivity::class.java).apply {
                    putExtra(AlertDetailActivity.EXTRA_RISK_LEVEL, result.level.name)
                    putExtra(AlertDetailActivity.EXTRA_DETECTED_VALUE, result.detectedValue)
                    putExtra(AlertDetailActivity.EXTRA_CATEGORY, result.category ?: "Posible Fraude")
                    putExtra(AlertDetailActivity.EXTRA_SIGNALS, result.signals.joinToString("\n• ", "• "))
                    putExtra(AlertDetailActivity.EXTRA_ADVICE, result.advice ?: "Consultá a un familiar de confianza.")
                }
                startActivity(intent)
            }
        }
    }

    private fun openPermissionGuide() {
        // Abrir directamente los ajustes de acceso a notificaciones
        startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
    }

    private fun isNotificationListenerEnabled(): Boolean {
        val cn = "${packageName}/com.escudodigital.notifications.ScamNotificationListener"
        val flat = Settings.Secure.getString(contentResolver, "enabled_notification_listeners")
        return flat?.contains(cn) == true
    }

    override fun onResume() {
        super.onResume()
        // Disparar sync incremental al abrir la app si hay internet
        WorkManager.getInstance(this)
            .enqueue(OneTimeWorkRequestBuilder<SyncWorker>().build())
        refreshStatus()
    }
}
