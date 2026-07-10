import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Socket.IO connects to the same backend as the REST API client (just
// without the /api suffix) — derived from EXPO_PUBLIC_API_BASE_URL so it
// always matches whatever host the app is actually configured to talk to
// (iOS simulator, Android emulator's 10.0.2.2 alias, a physical device's LAN
// IP, or the real production API). This used to be a second, independently
// hardcoded URL that silently drifted out of sync with the REST API host —
// it pointed at an old Railway deployment while EXPO_PUBLIC_API_BASE_URL
// (see eas.json) had already moved to Azure, so real-time socket events
// (and the "you've been invited" in-app refresh they trigger) never
// connected at all in production, and only worked in local dev if you
// happened to be on an Android emulator.
const SOCKET_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/api\/?$/, '');

let socket: Socket | null = null;
let isConnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

/**
 * Initialize Socket.IO connection
 */
export async function initializeSocket(): Promise<Socket | null> {
  if (socket?.connected) {
    console.log('[Socket] Already connected');
    return socket;
  }

  if (isConnecting) {
    console.log('[Socket] Connection already in progress');
    return null;
  }

  try {
    isConnecting = true;
    const accessToken = await AsyncStorage.getItem('accessToken');

    if (!accessToken) {
      console.log('[Socket] No access token found, skipping Socket.IO connection');
      isConnecting = false;
      return null;
    }

    console.log('[Socket] Connecting to Socket.IO server...');

    socket = io(SOCKET_URL, {
      auth: {
        token: accessToken
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS
    });

    // Connection events
    socket.on('connect', () => {
      console.log('[Socket] ✅ Connected to server with ID:', socket?.id);
      reconnectAttempts = 0;
      isConnecting = false;
    });

    socket.on('disconnect', (reason) => {
      console.log('[Socket] ❌ Disconnected:', reason);
      isConnecting = false;
    });

    socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      reconnectAttempts++;
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('[Socket] Max reconnection attempts reached');
        isConnecting = false;
      }
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log('[Socket] ✅ Reconnected after', attemptNumber, 'attempts');
      reconnectAttempts = 0;
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log('[Socket] 🔄 Reconnection attempt', attemptNumber);
    });

    socket.on('reconnect_failed', () => {
      console.error('[Socket] ❌ Reconnection failed');
      isConnecting = false;
    });

    // Ping/pong for connection health
    socket.on('pong', (data) => {
      console.log('[Socket] Pong received:', data);
    });

    return socket;
  } catch (error) {
    console.error('[Socket] Failed to initialize:', error);
    isConnecting = false;
    return null;
  }
}

/**
 * Disconnect Socket.IO
 */
export function disconnectSocket(): void {
  if (socket) {
    console.log('[Socket] Disconnecting...');
    socket.disconnect();
    socket = null;
  }
}

/**
 * Get current socket instance
 */
export function getSocket(): Socket | null {
  return socket;
}

/**
 * Setup event listeners for moment-related events
 */
export function setupSocketEventListeners(callbacks: {
  onMomentRequest?: (data: any) => void; // Meeting created → receiver
  onMomentResponse?: (data: any) => void; // Meeting accepted/rejected → sender
  onMomentCanceled?: (data: any) => void; // Meeting canceled → receiver
}): () => void {
  if (!socket) {
    console.warn('[Socket] Cannot setup listeners: Socket not initialized');
    return () => {};
  }

  // Meeting created → receiver gets update
  const momentRequestHandler = (data: any) => {
    console.log('[Socket] 📬 Moment request received (meeting created):', data);
    callbacks.onMomentRequest?.(data);
  };

  // Meeting accepted/rejected → sender gets update
  const momentResponseHandler = (data: any) => {
    console.log('[Socket] ✅ Moment response received (meeting accepted/rejected):', {
      eventType: data.eventType,
      momentRequestId: data.momentRequestId,
      senderId: data.senderId,
      receiverId: data.receiverId,
      fullData: data,
      socketConnected: socket?.connected,
      socketId: socket?.id
    });
    callbacks.onMomentResponse?.(data);
  };

  // Meeting canceled → receiver gets update
  const momentCanceledHandler = (data: any) => {
    console.log('[Socket] ❌ Moment canceled received (meeting canceled):', data);
    callbacks.onMomentCanceled?.(data);
  };

  // Register only the 3 required listeners
  socket.on('moment:request', momentRequestHandler);
  socket.on('moment:response', momentResponseHandler);
  socket.on('moment:canceled', momentCanceledHandler);

  // Return cleanup function
  return () => {
    if (socket) {
      socket.off('moment:request', momentRequestHandler);
      socket.off('moment:response', momentResponseHandler);
      socket.off('moment:canceled', momentCanceledHandler);
    }
  };
}

