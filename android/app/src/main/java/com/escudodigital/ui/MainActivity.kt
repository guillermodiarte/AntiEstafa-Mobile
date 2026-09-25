package com.escudodigital.ui

import android.Manifest
import android.app.role.RoleManager
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.widget.Toast
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

    // Launcher para permisos adicionales (cortar llamadas, leer/eliminar SMS fraudulentos)
    private val extraPermissionsLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) {
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
     * Pide los permisos críticos para proteger llamadas y mensajes:
     *  1. POST_NOTIFICATIONS (Android 13+)
     *  2. ROLE_CALL_SCREENING → para interceptar llamadas entrantes
     *  3. ANSWER_PHONE_CALLS → para cortar llamadas sospechosas desde el modal
     *  4. READ_SMS / RECEIVE_SMS → para analizar y eliminar mensajes fraudulentos
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

        // 3. Permisos para colgar llamadas y procesar SMS
        val neededPermissions = mutableListOf<String>()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ANSWER_PHONE_CALLS) != PackageManager.PERMISSION_GRANTED) {
            neededPermissions.add(Manifest.permission.ANSWER_PHONE_CALLS)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
            neededPermissions.add(Manifest.permission.READ_SMS)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS) != PackageManager.PERMISSION_GRANTED) {
            neededPermissions.add(Manifest.permission.RECEIVE_SMS)
        }
        if (neededPermissions.isNotEmpty()) {
            extraPermissionsLauncher.launch(neededPermissions.toTypedArray())
        }
    }

    private fun setupUI() {
        // Ruedita de configuración
        binding.btnSettings.setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }

        // Botón de permisos: lleva directamente a la configuración pendiente
        binding.btnCheckPermissions.setOnClickListener {
            openPermissionGuide()
        }

        // Tocar la fila de protección web lleva a accesibilidad
        binding.rowBrowserProtection.setOnClickListener {
            Toast.makeText(this, "Activá 'Escudo Digital' para proteger la navegación en Chrome", Toast.LENGTH_LONG).show()
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
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

            // Estado de Protección Web (Accesibilidad)
            val a11yEnabled = isAccessibilityServiceEnabled()
            binding.tvBrowserStatus.text =
                if (a11yEnabled) "Activo" else "⚠️ Inactivo (Tocar)"
            binding.tvBrowserStatus.setTextColor(
                getColor(if (a11yEnabled) R.color.shield_active else R.color.shield_warning)
            )
            // Botón de permisos: visible solo si falta algún permiso
            val allPermissionsOk = listenerEnabled && a11yEnabled
            binding.btnCheckPermissions.visibility =
                if (allPermissionsOk) android.view.View.GONE else android.view.View.VISIBLE

            // Estado general
            if (listenerEnabled && a11yEnabled) {
                binding.tvProtectionTitle.text = "🟢 Protección activa"
                binding.tvProtectionDesc.text =
                    "Escudo Digital está funcionando y cuidando tus llamadas, mensajes y navegación web."
            } else {
                binding.tvProtectionTitle.text = "🟡 Configuración incompleta"
                binding.tvProtectionDesc.text =
                    "Algunos módulos necesitan tu autorización. Tocá 'Configurar Permisos'."
            }
        }
    }


    private fun openPermissionGuide() {
        if (!isAccessibilityServiceEnabled()) {
            Toast.makeText(this, "Activá 'Escudo Digital' en Accesibilidad para proteger la navegación", Toast.LENGTH_LONG).show()
            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
        } else if (!isNotificationListenerEnabled()) {
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        } else {
            startActivity(Intent(Settings.ACTION_SETTINGS))
        }
    }

    private fun isNotificationListenerEnabled(): Boolean {
        val cn = "${packageName}/com.escudodigital.notifications.ScamNotificationListener"
        val flat = Settings.Secure.getString(contentResolver, "enabled_notification_listeners")
        return flat?.contains(cn) == true
    }

    private fun isAccessibilityServiceEnabled(): Boolean {
        val expectedService = "${packageName}/com.escudodigital.services.ScamBrowserProtectionService"
        val enabledServices = Settings.Secure.getString(
            contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: return false
        val splitter = android.text.TextUtils.SimpleStringSplitter(':')
        splitter.setString(enabledServices)
        while (splitter.hasNext()) {
            val service = splitter.next()
            if (service.equals(expectedService, ignoreCase = true) || service.contains("ScamBrowserProtectionService", ignoreCase = true)) {
                return true
            }
        }
        return false
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
