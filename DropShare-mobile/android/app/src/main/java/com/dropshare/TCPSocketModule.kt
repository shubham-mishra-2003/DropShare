package com.dropshare

import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlinx.coroutines.*
import java.io.BufferedInputStream
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream // Added import
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.util.UUID
import kotlin.coroutines.CoroutineContext

class TCPSocketModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext), CoroutineScope {
    private val TAG = "TCPSocketModule"
    private val job = SupervisorJob()
    override val coroutineContext: CoroutineContext
        get() = Dispatchers.IO + job
    private val servers = mutableMapOf<String, TcpServer>()
    private val sockets = mutableMapOf<String, TcpSocket>()
    private var chunkBufferSize = 512 * 1024 // 512KB default
    private val maxConnectionRetries = 5
    private var minFragmentSize = 512 * 1024 // 512KB for aggregation
    private val maxWaitMs = 50L // 50ms timeout for aggregation

    override fun getName(): String = "DropShareTCPSocket" // Match react-native-tcp-socket

    @ReactMethod
    fun createServer(promise: Promise) {
        try {
            val serverId = UUID.randomUUID().toString()
            val server = TcpServer(serverId)
            servers[serverId] = server
            promise.resolve(serverId)
        } catch (e: Exception) {
            Log.e(TAG, "Error creating server", e)
            promise.reject("SERVER_CREATE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun createSocket(promise: Promise) {
        try {
            val socketId = UUID.randomUUID().toString()
            val socket = TcpSocket(socketId)
            sockets[socketId] = socket
            promise.resolve(socketId)
        } catch (e: Exception) {
            Log.e(TAG, "Error creating socket", e)
            promise.reject("SOCKET_CREATE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun setBufferSize(size: Int, promise: Promise) {
        try {
            if (size <= 0) {
                promise.reject("CONFIG_ERROR", "Buffer size must be positive")
                return
            }
            if (size > 10 * 1024 * 1024) {
                promise.reject("CONFIG_ERROR", "Buffer size too large")
                return
            }
            chunkBufferSize = size
            minFragmentSize = size
            Log.d(TAG, "Chunk buffer size set to $size bytes")
            promise.resolve("Buffer size updated")
        } catch (e: Exception) {
            Log.e(TAG, "Error setting buffer size", e)
            promise.reject("CONFIG_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun serverListen(serverId: String, options: ReadableMap, promise: Promise) {
        val server = servers[serverId] ?: run {
            promise.reject("SERVER_ERROR", "Server not found")
            return
        }
        launch {
            try {
                val port = options.getInt("port")
                val host = options.getString("host") ?: "0.0.0.0"
                val reuseAddress = options.getBoolean("reuseAddress") ?: true
                server.listen(port, host, reuseAddress)
                withContext(Dispatchers.Main) {
                    promise.resolve(serverId)
                }
            } catch (e: IOException) {
                Log.e(TAG, "Failed to listen on server $serverId", e)
                withContext(Dispatchers.Main) {
                    promise.reject("SERVER_ERROR", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun connect(socketId: String, host: String, port: Int, options: ReadableMap, promise: Promise) {
        val socket = sockets[socketId] ?: run {
            promise.reject("SOCKET_ERROR", "Socket not found")
            return
        }
        launch {
            try {
                val localAddress = options.getString("localAddress")
                val localPort = options.getInt("localPort") ?: 0
                socket.connect(host, port, localAddress, localPort)
                withContext(Dispatchers.Main) {
                    promise.resolve(socketId)
                }
            } catch (e: IOException) {
                Log.e(TAG, "Failed to connect socket $socketId", e)
                withContext(Dispatchers.Main) {
                    promise.reject("CONNECT_ERROR", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun write(socketId: String, base64Data: String, msgId: Int, promise: Promise) {
        val socket = sockets[socketId] ?: run {
            promise.reject("SOCKET_ERROR", "Socket not found or closed")
            return
        }
        launch {
            try {
                val data = android.util.Base64.decode(base64Data, android.util.Base64.DEFAULT)
                val needsDrain = socket.write(data)
                withContext(Dispatchers.Main) {
                    val params = Arguments.createMap().apply {
                        putString("id", socketId)
                        putInt("msgId", msgId)
                    }
                    sendEvent("written", params)
                    if (!needsDrain) {
                        sendEvent("drain", Arguments.createMap().apply { putString("id", socketId) })
                    }
                    promise.resolve("Data written")
                }
            } catch (e: IOException) {
                Log.e(TAG, "Error writing to socket $socketId", e)
                withContext(Dispatchers.Main) {
                    promise.reject("WRITE_ERROR", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun end(socketId: String, promise: Promise) {
        val socket = sockets[socketId] ?: run {
            promise.reject("SOCKET_ERROR", "Socket not found or closed")
            return
        }
        launch {
            try {
                socket.end()
                withContext(Dispatchers.Main) {
                    promise.resolve("Socket ended")
                }
            } catch (e: IOException) {
                Log.e(TAG, "Error ending socket $socketId", e)
                withContext(Dispatchers.Main) {
                    promise.reject("CLOSE_ERROR", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun destroy(socketId: String, promise: Promise) {
        val socket = sockets[socketId] ?: run {
            promise.resolve("Socket already closed")
            return
        }
        launch {
            try {
                socket.destroy()
                sockets.remove(socketId)
                withContext(Dispatchers.Main) {
                    promise.resolve("Socket destroyed")
                }
            } catch (e: IOException) {
                Log.e(TAG, "Error destroying socket $socketId", e)
                withContext(Dispatchers.Main) {
                    promise.reject("DESTROY_ERROR", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun serverClose(serverId: String, promise: Promise) {
        val server = servers[serverId] ?: run {
            promise.resolve("Server already closed")
            return
        }
        launch {
            try {
                server.close()
                servers.remove(serverId)
                withContext(Dispatchers.Main) {
                    promise.resolve("Server closed")
                }
            } catch (e: IOException) {
                Log.e(TAG, "Error closing server $serverId", e)
                withContext(Dispatchers.Main) {
                    promise.reject("SERVER_ERROR", e.message, e)
                }
            }
        }
    }

    @ReactMethod
    fun pause(socketId: String, promise: Promise) {
        val socket = sockets[socketId] ?: run {
            promise.reject("SOCKET_ERROR", "Socket not found")
            return
        }
        socket.pause()
        promise.resolve("Socket paused")
    }

    @ReactMethod
    fun resume(socketId: String, promise: Promise) {
        val socket = sockets[socketId] ?: run {
            promise.reject("SOCKET_ERROR", "Socket not found")
            return
        }
        socket.resume()
        promise.resolve("Socket resumed")
    }

    @ReactMethod
    fun setNoDelay(socketId: String, noDelay: Boolean, promise: Promise) {
        configureSocket(socketId, Arguments.createMap().apply { putBoolean("noDelay", noDelay) }, promise)
    }

    @ReactMethod
    fun setKeepAlive(socketId: String, enable: Boolean, initialDelay: Int, promise: Promise) {
        configureSocket(socketId, Arguments.createMap().apply {
            putBoolean("keepAlive", enable)
            putInt("initialDelay", initialDelay)
        }, promise)
    }

    @ReactMethod
    fun configureSocket(socketId: String, options: ReadableMap, promise: Promise) {
        val socket = sockets[socketId] ?: run {
            promise.reject("SOCKET_ERROR", "Socket not found")
            return
        }
        launch {
            try {
                if (options.hasKey("timeout")) {
                    socket.setTimeout(options.getInt("timeout"))
                }
                if (options.hasKey("keepAlive")) {
                    socket.setKeepAlive(options.getBoolean("keepAlive"))
                }
                if (options.hasKey("noDelay")) {
                    socket.setNoDelay(options.getBoolean("noDelay"))
                }
                withContext(Dispatchers.Main) {
                    promise.resolve("Socket configured")
                }
            } catch (e: IOException) {
                Log.e(TAG, "Error configuring socket $socketId", e)
                withContext(Dispatchers.Main) {
                    promise.reject("CONFIG_ERROR", e.message, e)
                }
            }
        }
    }

    private fun sendEvent(eventName: String, params: WritableMap) {
        if (reactApplicationContext.hasActiveCatalystInstance()) {
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit(eventName, params)
                ?: Log.w(TAG, "Emitter is null for event $eventName")
        } else {
            Log.w(TAG, "Cannot emit event $eventName: React context not available")
        }
    }

    override fun onCatalystInstanceDestroy() {
        runBlocking {
            servers.values.forEach { it.close() }
            sockets.values.forEach { it.destroy() }
            servers.clear()
            sockets.clear()
            job.cancelAndJoin()
            Log.d(TAG, "Cleaned up TCPSocketModule resources")
        }
    }

    private inner class TcpServer(val id: String) {
        private var serverSocket: ServerSocket? = null
        private var isRunning = false

        fun listen(port: Int, host: String, reuseAddress: Boolean) {
            serverSocket = ServerSocket(port, 50, InetAddress.getByName(host))
            serverSocket?.reuseAddress = reuseAddress
            serverSocket?.receiveBufferSize = chunkBufferSize
            isRunning = true
            val params = Arguments.createMap().apply {
                putString("id", id)
                putMap("connection", Arguments.createMap().apply {
                    putString("localAddress", serverSocket!!.inetAddress.hostAddress)
                    putInt("localPort", serverSocket!!.localPort)
                    putString("localFamily", if (serverSocket!!.inetAddress is java.net.Inet6Address) "IPv6" else "IPv4")
                })
            }
            sendEvent("listening", params)
            launch { acceptConnections() }
        }

        private suspend fun acceptConnections() {
            var retryCount = 0
            while (isRunning && serverSocket != null && !serverSocket!!.isClosed && retryCount < maxConnectionRetries) {
                try {
                    val clientSocket = serverSocket!!.accept()
                    clientSocket.receiveBufferSize = chunkBufferSize
                    retryCount = 0
                    val socketId = UUID.randomUUID().toString()
                    val client = TcpSocket(socketId, clientSocket)
                    sockets[socketId] = client
                    val params = Arguments.createMap().apply {
                        putString("id", id)
                        putMap("info", Arguments.createMap().apply {
                            putString("id", socketId)
                            putMap("connection", Arguments.createMap().apply {
                                putString("localAddress", clientSocket.localAddress.hostAddress)
                                putInt("localPort", clientSocket.localPort)
                                putString("remoteAddress", clientSocket.inetAddress.hostAddress)
                                putInt("remotePort", clientSocket.port)
                                putString("remoteFamily", if (clientSocket.inetAddress is java.net.Inet6Address) "IPv6" else "IPv4")
                            })
                        })
                    }
                    withContext(Dispatchers.Main) {
                        sendEvent("connection", params)
                    }
                    client.startReading()
                } catch (e: IOException) {
                    if (isRunning) {
                        retryCount++
                        Log.e(TAG, "Error accepting connection (retry $retryCount/$maxConnectionRetries)", e)
                        if (retryCount >= maxConnectionRetries) {
                            close()
                            break
                        }
                        delay(1000)
                    }
                }
            }
        }

        fun close() {
            isRunning = false
            try {
                serverSocket?.close()
                serverSocket = null
                val params = Arguments.createMap().apply {
                    putString("id", id)
                }
                sendEvent("close", params)
            } catch (e: IOException) {
                Log.e(TAG, "Error closing server $id", e)
                sendEvent("error", Arguments.createMap().apply {
                    putString("id", id)
                    putString("error", e.message)
                })
            }
        }
    }

    private inner class TcpSocket(val id: String, private var socket: Socket? = null) {
        private var isPaused = false
        private var outputStream: OutputStream? = null
        private var isEnded = false
        private val writeBuffer = ByteArrayOutputStream()
        private var writeBufferSize = 0

        fun connect(host: String, port: Int, localAddress: String?, localPort: Int) {
            socket = Socket()
            socket?.receiveBufferSize = chunkBufferSize
            if (localAddress != null) {
                socket!!.bind(java.net.InetSocketAddress(localAddress, localPort))
            }
            socket!!.connect(java.net.InetSocketAddress(host, port))
            outputStream = socket!!.getOutputStream()
            val params = Arguments.createMap().apply {
                putString("id", id)
                putMap("connection", Arguments.createMap().apply {
                    putString("localAddress", socket!!.localAddress.hostAddress)
                    putInt("localPort", socket!!.localPort)
                    putString("remoteAddress", socket!!.inetAddress.hostAddress)
                    putInt("remotePort", socket!!.port)
                    putString("remoteFamily", if (socket!!.inetAddress is java.net.Inet6Address) "IPv6" else "IPv4")
                })
            }
            sendEvent("connect", params)
            startReading()
        }

        fun write(data: ByteArray): Boolean {
            if (socket?.isClosed == true || outputStream == null) {
                throw IOException("Socket is closed")
            }
            synchronized(writeBuffer) {
                writeBuffer.write(data)
                writeBufferSize += data.size
                if (writeBufferSize >= chunkBufferSize) {
                    val bufferData = writeBuffer.toByteArray()
                    outputStream?.write(bufferData)
                    outputStream?.flush()
                    writeBuffer.reset()
                    writeBufferSize = 0
                    Log.d(TAG, "Wrote ${bufferData.size} bytes to socket $id")
                    return true
                }
                return false
            }
        }

        fun flushWriteBuffer() {
            synchronized(writeBuffer) {
                if (writeBufferSize > 0) {
                    val bufferData = writeBuffer.toByteArray()
                    outputStream?.write(bufferData)
                    outputStream?.flush()
                    writeBuffer.reset()
                    writeBufferSize = 0
                    Log.d(TAG, "Flushed ${bufferData.size} bytes to socket $id")
                }
            }
        }

        fun end() {
            if (isEnded) return
            isEnded = true
            try {
                flushWriteBuffer()
                socket?.shutdownOutput()
            } catch (e: IOException) {
                Log.e(TAG, "Error shutting down output for socket $id", e)
            }
        }

        fun destroy() {
            try {
                flushWriteBuffer()
                socket?.close()
                socket = null
                outputStream = null
                val params = Arguments.createMap().apply {
                    putString("id", id)
                    putBoolean("hadError", false)
                }
                sendEvent("close", params)
            } catch (e: IOException) {
                Log.e(TAG, "Error destroying socket $id", e)
                sendEvent("error", Arguments.createMap().apply {
                    putString("id", id)
                    putString("error", e.message)
                })
            }
        }

        fun pause() {
            isPaused = true
        }

        fun resume() {
            isPaused = false
        }

        fun setTimeout(timeout: Int) {
            socket?.soTimeout = timeout
        }

        fun setKeepAlive(keepAlive: Boolean) {
            socket?.keepAlive = keepAlive
        }

        fun setNoDelay(noDelay: Boolean) {
            socket?.tcpNoDelay = noDelay
        }

        fun startReading() {
            launch {
                try {
                    socket?.getInputStream()?.let { inputStream ->
                        BufferedInputStream(inputStream, chunkBufferSize).use { bufferedInput ->
                            val buffer = ByteArray(chunkBufferSize)
                            val aggregatedBuffer = ByteArrayOutputStream()
                            while (socket != null && socket!!.isClosed.not()) {
                                val startTime = System.currentTimeMillis()
                                val bytesRead = bufferedInput.read(buffer)
                                if (bytesRead == -1) break
                                aggregatedBuffer.write(buffer, 0, bytesRead)
                                while (aggregatedBuffer.size() >= minFragmentSize ||
                                       (aggregatedBuffer.size() > 0 && System.currentTimeMillis() - startTime >= maxWaitMs)) {
                                    val data = aggregatedBuffer.toByteArray()
                                    aggregatedBuffer.reset()
                                    while (isPaused) delay(100)
                                    val base64Data = android.util.Base64.encodeToString(data, android.util.Base64.DEFAULT)
                                    val params = Arguments.createMap().apply {
                                        putString("id", id)
                                        putString("data", base64Data)
                                    }
                                    withContext(Dispatchers.Main) {
                                        sendEvent("data", params)
                                    }
                                }
                            }
                            if (aggregatedBuffer.size() > 0) {
                                val data = aggregatedBuffer.toByteArray()
                                val base64Data = android.util.Base64.encodeToString(data, android.util.Base64.DEFAULT)
                                val params = Arguments.createMap().apply {
                                    putString("id", id)
                                    putString("data", base64Data)
                                }
                                withContext(Dispatchers.Main) {
                                    sendEvent("data", params)
                                }
                            }
                        }
                    }
                } catch (e: IOException) {
                    if (socket?.isClosed == false) {
                        Log.e(TAG, "Error reading from socket $id", e)
                        val params = Arguments.createMap().apply {
                            putString("id", id)
                            putString("error", e.message)
                        }
                        withContext(Dispatchers.Main) {
                            sendEvent("error", params)
                        }
                    }
                } finally {
                    if (!isEnded) {
                        destroy()
                    }
                }
            }
        }
    }
}