// ============================================================
// PS2 Cloud Gaming Platform — WebRTC Hook
// Manages WebRTC peer connection for game streaming
// ============================================================

import { useEffect, useRef, useState, useCallback } from 'react';

export function useWebRTC(socket, sessionId) {
  const peerRef = useRef(null);
  const videoRef = useRef(null);
  const [streamState, setStreamState] = useState('disconnected'); // disconnected | connecting | connected | error
  const [stats, setStats] = useState(null);

  // Create peer connection and handle signaling
  const startStream = useCallback(() => {
    if (!socket || !sessionId) return;

    setStreamState('connecting');

    // Join session room first
    socket.emit('session:join', { sessionId });

    // Function to create and send offer
    const sendOffer = () => {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
        iceCandidatePoolSize: 10,
      });

      peerRef.current = pc;

      // Handle incoming tracks (video + audio from server)
      pc.ontrack = (event) => {
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          setStreamState('connected');
        }
      };

      // Send ICE candidates to signaling server
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('signal:ice-candidate', {
            sessionId,
            candidate: event.candidate,
          });
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
          setStreamState('error');
        }
      };

      // Add transceivers for receiving audio and video
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });

      // Create and send offer
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          console.log('[webrtc] Sending offer to server');
          socket.emit('signal:offer', {
            sessionId,
            sdp: pc.localDescription,
          });
        })
        .catch((err) => {
          console.error('[webrtc] Offer creation failed:', err);
          setStreamState('error');
        });

      // Listen for answer from server
      socket.on('signal:answer', ({ sdp }) => {
        console.log('[webrtc] Received answer from server');
        pc.setRemoteDescription(new RTCSessionDescription(sdp))
          .catch(console.error);
      });

      // Listen for ICE candidates from server
      socket.on('signal:ice-candidate', ({ candidate }) => {
        pc.addIceCandidate(new RTCIceCandidate(candidate))
          .catch(console.error);
      });
    };

    // Wait for stream:ready from server before sending offer
    // (server emits this after GStreamer pipeline is started)
    socket.on('stream:ready', () => {
      console.log('[webrtc] Stream ready, sending offer');
      sendOffer();
    });

    // Fallback: if stream is already ready (reconnection scenario), send offer after 5s
    setTimeout(() => {
      if (!peerRef.current) {
        console.log('[webrtc] Fallback: sending offer after timeout');
        sendOffer();
      }
    }, 8000);
  }, [socket, sessionId]);

  // Stop stream and clean up
  const stopStream = useCallback(() => {
    if (peerRef.current) {
      peerRef.current.close();
      peerRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (socket) {
      socket.emit('session:leave', { sessionId });
      socket.off('signal:answer');
      socket.off('signal:ice-candidate');
    }

    setStreamState('disconnected');
  }, [socket, sessionId]);

  // Get WebRTC stats periodically
  useEffect(() => {
    if (streamState !== 'connected' || !peerRef.current) return;

    const interval = setInterval(async () => {
      try {
        const report = await peerRef.current.getStats();
        let videoStats = {};

        report.forEach((stat) => {
          if (stat.type === 'inbound-rtp' && stat.kind === 'video') {
            videoStats = {
              fps: stat.framesPerSecond || 0,
              bytesReceived: stat.bytesReceived || 0,
              packetsLost: stat.packetsLost || 0,
              jitter: stat.jitter || 0,
            };
          }
        });

        setStats(videoStats);
      } catch {
        // Stats unavailable
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [streamState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stopStream();
  }, [stopStream]);

  return {
    videoRef,
    streamState,
    stats,
    startStream,
    stopStream,
  };
}

export default useWebRTC;
