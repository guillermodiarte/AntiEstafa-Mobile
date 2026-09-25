package com.escudodigital.ui

import android.Manifest
import android.app.role.RoleManager
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkInfo
import androidx.work.WorkManager
import com.escudodigital.R
import com.escudodigital.core.AlertManager
import com.escudodigital.core.LocalRiskEngine
import com.escudodigital.data.local.EscudoDatabase
import com.escudodigital.data.repository.ThreatRepository
import com.escudodigital.databinding.ActivityMainBinding
import com.escudodigital.sync.SyncWorker
import kotlinx.coroutines.launch

/**
 * Pantalla principal: Protección Activa.
 * Sección 3 de AGENTS.md: UX simple para adulto mayor.
 *
 * Al arrancar:
 *  1. Pide permiso POST_NOTIFICATIONS (Android 13+) para poder mostrar alertas
 *  2. Pide rol CALL_SCREENING para interceptar llamadas
 *  3. Observa el sync en tiempo real
 *  4. Muestra conteo real de amenazas en la base local
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var repository: ThreatRepository

    // Launcher para pedir POST_NOTIFICATIONS
    private val notifPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) {
            // Permiso concedido: el AlertManager ya puede mostrar alertas
            refreshStatus()
        }
    }

    // Launcher para pedir el rol de Call Screening
    private val callScreeningRoleLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) {
        // El usuario respondió al diálogo de rol — refrescar estado
        refreshStatus()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val db = EscudoDatabase.getInstance(applicationContext)
        repository = ThreatRepository.getInstance(db)

        AlertManager.createNotificationChannel(this)

        setupUI()
        observeSyncState()
        requestCriticalPermissions()
        refreshStatus()
    }

    /**
     * Pide los dos permisos críticos sin los que la protección no funciona:
     *  1. POST_NOTIFICATIONS → para mostrar alertas visibles
     *  2. ROLE_CALL_SCREENING → para interceptar llamadas entrantes
     */
    private fun requestCriticalPermissions() {
        // 1. POST_NOTIFICATIONS (requerido en Android 13 / API 33+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val status = ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
            if (status != PackageManager.PERMISSION_GRANTED) {
                notifPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        // 2. ROLE_CALL_SCREENING (requerido en Android 10 / API 29+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val roleManager = getSystemService(RoleManager::class.java)
            if (roleManager != null && !roleManager.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)) {
                val intent = roleManager.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING)
                callScreeningRoleLauncher.launch(intent)
            }
        }
    }

    private fun setupUI() {
        binding.btnSimulateAlert.setOnClickListener {
            simulateDemoAlert()
        }
        binding.btnCheckPermissions.setOnClickListener {
            openPermissionGuide()
        }
    }

    /**
     * Observa el WorkManager en tiempo real: muestra "Actualizando..." mientras
     * el sync está corriendo y refresca la UI cuando termina.
     */
    private fun observeSyncState() {
        WorkManager.getInstance(this)
            .getWorkInfosByTagLiveData(SyncWorker.TAG_IMMEDIATE)
            .observe(this) { workInfos ->
                val syncInfo = workInfos?.firstOrNull()
                when (syncInfo?.state) {
                    WorkInfo.State.RUNNING -> {
                        binding.tvDatabaseVersion.text = "⏳ Actualizando base de amenazas..."
                    }
                    WorkInfo.State.SUCCEEDED,
                    WorkInfo.State.FAILED,
                    WorkInfo.State.CANCELLED -> {
                        refreshStatus()
                    }
                    else -> { /* ENQUEUED o null */ }
                }
            }
    }

    private fun refreshStatus() {
        lifecycleScope.launch {
            val syncState = repository.getSyncState()
            val version = syncState?.localVersion ?: 0
            val threatCount = repository.getLocalThreatCount()
            val hasData = threatCount > 0

            // Estado de la base local con conteo real de amenazas
            binding.tvDatabaseVersion.text = when {
                hasData -> "v$version · $threatCount amenazas cargadas ✓"
                version > 0 -> "v$version · base sincronizada"
                else -> "Sin datos aún — verificá la conexión"
            }

            // Estado del Notification Listener
            val listenerEnabled = isNotificationListenerEnabled()
            binding.tvNotificationStatus.text =
                if (listenerEnabled) "Activo" else "⚠️ Requiere permiso"
            binding.tvNotificationStatus.setTextColor(
                getColor(if (listenerEnabled) R.color.shield_active else R.color.shield_warning)
            )

            // Estado general
            if (listenerEnabled) {
                binding.tvProtectionTitle.text = "🟢 Protección activa"
                binding.tvProtectionDesc.text =
                    "Escudo Digital está funcionando y cuidando tus llamadas y mensajes."
            } else {
                binding.tvProtectionTitle.text = "🟡 Configuración incompleta"
                binding.tvProtectionDesc.text =
                    "Algunos módulos necesitan tu autorización. Tocá 'Configurar Permisos'."
            }
        }
    }

    /**
     * Demo para la presentación del Hackathon.
     * Simula una notificación de WhatsApp sospechosa del número +5491138901234.
     */
    private fun simulateDemoAlert() {
        lifecycleScope.launch {
            val db = EscudoDatabase.getInstance(applicationContext)
            val engine = LocalRiskEngine(db.threatDao(), db.trustedNumberDao())

            val phoneResult = engine.evaluatePhone("+5491138901234")

            val result = if (phoneResult.isMediumOrHigh) {
                phoneResult
            } else {
                engine.evaluateNotificationText(
                    "Hola mamá, agendá mi nuevo número. Tuve un accidente con el auto " +
                    "y necesito una transferencia urgente de 80.000 pesos. No le cuentes a nadie todavía."
                )
            }

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
        startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
    }

    private fun isNotificationListenerEnabled(): Boolean {
        val cn = "${packageName}/com.escudodigital.notifications.ScamNotificationListener"
        val flat = Settings.Secure.getString(contentResolver, "enabled_notification_listeners")
        return flat?.contains(cn) == true
    }

    override fun onResume() {
        super.onResume()
        // Sync inmediato cada vez que el usuario abre la app
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
        refreshStatus()
    }
}
