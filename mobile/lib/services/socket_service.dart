import 'package:socket_io_client/socket_io_client.dart' as IO;
import 'api_service.dart';

class SocketService {
  static IO.Socket? _socket;
  
  static Function(Map<String, dynamic>)? onCheckInPrompt;
  static Function(Map<String, dynamic>)? onCheckInAlert;
  static Function(Map<String, dynamic>)? onEmergencyEscalated;
  static Function(Map<String, dynamic>)? onNearbySosAlert;
  static Function(Map<String, dynamic>)? onResponderUpdated;
  static Function(Map<String, dynamic>)? onSosResolved;

  static IO.Socket? get socket => _socket;

  static void connect(String userId) {
    if (_socket != null && _socket!.connected) return;

    // Dynamically connect socket to the active ApiService server host IP
    final String socketUrl = ApiService.serverHost;
    print('Connecting socket client to: $socketUrl');

    _socket = IO.io(socketUrl, IO.OptionBuilder()
      .setTransports(['websocket'])
      .disableAutoConnect()
      .build()
    );

    _socket?.connect();

    _socket?.onConnect((_) {
      print('Mobile WebSocket Connected. Registering user room: $userId');
      _socket?.emit('join_user', userId);
    });

    // Listen for safety timer notifications
    
    // Server says user must enter MPIN
    _socket?.on('trigger_mpin_prompt', (data) {
      print('SocketEvent: trigger_mpin_prompt received: $data');
      if (onCheckInPrompt != null) {
        onCheckInPrompt!(Map<String, dynamic>.from(data));
      }
    });

    // Server says user is in grace period
    _socket?.on('notify_check_in_alert', (data) {
      print('SocketEvent: notify_check_in_alert received: $data');
      if (onCheckInAlert != null) {
        onCheckInAlert!(Map<String, dynamic>.from(data));
      }
    });

    // Server has auto-escalated user to SOS because of timeout
    _socket?.on('emergency_escalated', (data) {
      print('SocketEvent: emergency_escalated received: $data');
      if (onEmergencyEscalated != null) {
        onEmergencyEscalated!(Map<String, dynamic>.from(data));
      }
    });

    // Nearby SOS alert received
    _socket?.on('nearby_sos_alert', (data) {
      print('SocketEvent: nearby_sos_alert received: $data');
      if (onNearbySosAlert != null) {
        onNearbySosAlert!(Map<String, dynamic>.from(data));
      }
    });

    // Responder status updated (for user in danger)
    _socket?.on('responder_updated', (data) {
      print('SocketEvent: responder_updated received: $data');
      if (onResponderUpdated != null) {
        onResponderUpdated!(Map<String, dynamic>.from(data));
      }
    });

    // SOS alert resolved by user
    _socket?.on('sos_resolved', (data) {
      print('SocketEvent: sos_resolved received: $data');
      if (onSosResolved != null) {
        onSosResolved!(Map<String, dynamic>.from(data));
      }
    });

    _socket?.onDisconnect((_) {
      print('Mobile WebSocket Disconnected');
    });
  }

  static void disconnect() {
    _socket?.disconnect();
    _socket = null;
  }
}
