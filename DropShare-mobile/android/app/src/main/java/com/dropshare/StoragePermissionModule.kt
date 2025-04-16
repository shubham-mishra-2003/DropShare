package com.dropshare

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.Settings
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class StoragePermissionModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName(): String = "StoragePermission"

    @ReactMethod
    fun checkAllFilesAccess(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val hasPermission = Environment.isExternalStorageManager()
            promise.resolve(hasPermission)
        } else {
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun requestAllFilesAccess(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            try {
                val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                    data = Uri.parse("package:${reactApplicationContext.packageName}")
                }
                currentActivity?.startActivity(intent)
                promise.resolve("Navigated to settings")
            } catch (e: Exception) {
                promise.reject("ERROR", "Failed to open settings: ${e.message}")
            }
        } else {
            promise.resolve("Not required on this Android version")
        }
    }
}