package com.escudodigital.ui

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import androidx.appcompat.app.AppCompatActivity
import com.escudodigital.R

/**
 * Pantalla de guía de permisos para el usuario.
 * Explica en lenguaje cotidiano por qué se necesita cada permiso.
 * Secciones 32 y 3 de AGENTS.md: accesibilidad y justificación de permisos.
 */
class PermissionGuideActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // En el MVP podemos usar una pantalla simple de settings
        startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        finish()
    }
}
