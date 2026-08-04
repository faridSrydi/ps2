import { useEffect, useRef, useState, useCallback } from 'react';

export function useWebRTC(socket, sessionId) {
  const peerRef = useRef(null);
  const videoRef = useRef(null);
  const [streamState, setStreamState] = useState('disconnected'); // disconnected | connecting | connected | error
  const [errorReason, setErrorReason] = useState(null);
  const [stats, setStats] = useState(null);

  const hasRemoteDescription = useRef(false);
  const pendingIceCandidates = useRef([]);

  // Create peer connection and send offer
  const createAndSendOffer = useCallback(async () => {
    if (!socket || !sessionId) return;

    try {
      console.log('[webrtc] Creating RTCPeerConnection...');
      if (peerRef.current) {
        console.log('[webrtc] Cleaning up existing PeerConnection');
        peerRef.current.close();
        peerRef.current = null;
      }

      hasRemoteDescription.current = false;
      pendingIceCandidates.current = [];
      setErrorReason(null);
      setStreamState('connecting');

      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
        iceCandidatePoolSize: 10,
      });

      peerRef.current = pc;

      pc.onconnectionstatechange = () => {
        console.log(`[webrtc] connectionState: ${pc.connectionState}`);
        if (pc.connectionState === 'connected') {
          setStreamState('connected');
        } else if (pc.connectionState === 'failed') {
          setStreamState('error');
          if (!hasRemoteDescription.current) {
            setErrorReason('RemoteDescription missing');
          } else if (pc.iceConnectionState === 'failed') {
            setErrorReason('ICE timeout / connection failed');
          } else {
            setErrorReason('DTLS failed');
          }
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log(`[webrtc] iceConnectionState: ${pc.iceConnectionState}`);
        if (pc.iceConnectionState === 'failed') {
          setStreamState('error');
          setErrorReason('ICE timeout');
        }
      };

      pc.onsignalingstatechange = () => {
        console.log(`[webrtc] signalingState: ${pc.signalingState}`);
      };

      pc.onicegatheringstatechange = () => {
        console.log(`[webrtc] iceGatheringState: ${pc.iceGatheringState}`);
      };

      pc.ontrack = (event) => {
        console.log('[webrtc] Track received:', event.track.kind);
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          setStreamState('connected');
        }
      };

      pc.onicecandidate = (event) => {
        console.log('[webrtc] ICE candidate gathered:', event.candidate ? event.candidate.candidate : 'null');
        if (event.candidate) {
          socket.emit('signal:ice-candidate', {
            sessionId,
            candidate: event.candidate,
          });
        }
      };

      // Add transceivers for receiving video and audio
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });

      // Create offer
      console.log('[webrtc] Creating SDP offer...');
      const offer = await pc.createOffer();
      console.log('[webrtc] Setting local description...');
      await pc.setLocalDescription(offer);

      console.log('[webrtc] Emitting signal:offer to server');
      socket.emit('signal:offer', {
        sessionId,
        sdp: {
          type: pc.localDescription.type,
          sdp: pc.localDescription.sdp,
        },
      });
    } catch (err) {
      console.error('[webrtc] Error creating offer:', err);
      setStreamState('error');
      setErrorReason(`Offer creation failed: ${err.message}`);
    }
  }, [socket, sessionId]);

  // Start stream
  const startStream = useCallback(() => {
    if (!socket || !sessionId) return;

    console.log('[webrtc] Starting stream for session:', sessionId);
    socket.emit('session:join', { sessionId });
    createAndSendOffer();
  }, [socket, sessionId, createAndSendOffer]);

  // Signal listeners
  useEffect(() => {
    if (!socket || !sessionId) return;

    const handleStreamReady = () => {
      console.log('[webrtc] stream:ready event received from server');
      createAndSendOffer();
    };

    const handleAnswer = async ({ sdp }) => {
      console.log('[webrtc] signal:answer received');
      const pc = peerRef.current;
      if (!pc) {
        console.warn('[webrtc] PeerConnection is null when answer received');
        setErrorReason('No Answer received');
        return;
      }
      try {
        console.log('[webrtc] Setting remote description...');
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        hasRemoteDescription.current = true;
        console.log('[webrtc] Remote description set successfully');

        // Flush pending ICE Candidates
        console.log(`[webrtc] Flushing ${pendingIceCandidates.current.length} pending ICE candidates...`);
        for (const candidate of pendingIceCandidates.current) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
            console.log('[webrtc] Added buffered ICE candidate');
          } catch (iceErr) {
            console.error('[webrtc] Failed to add buffered ICE candidate:', iceErr);
          }
        }
        pendingIceCandidates.current = [];
      } catch (err) {
        console.error('[webrtc] Failed to set remote description:', err);
        setStreamState('error');
        setErrorReason(`RemoteDescription missing: ${err.message}`);
      }
    };

    const handleIceCandidate = async ({ candidate }) => {
      console.log('[webrtc] signal:ice-candidate received');
      const pc = peerRef.current;
      if (!pc) return;

      if (hasRemoteDescription.current) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
          console.log('[webrtc] Added ICE candidate immediately');
        } catch (err) {
          console.error('[webrtc] Failed to add ICE candidate:', err);
        }
      } else {
        console.log('[webrtc] Remote description not set. Buffering candidate...');
        pendingIceCandidates.current.push(candidate);
      }
    };

    socket.on('stream:ready', handleStreamReady);
    socket.on('signal:answer', handleAnswer);
    socket.on('signal:ice-candidate', handleIceCandidate);

    return () => {
      socket.off('stream:ready', handleStreamReady);
      socket.off('signal:answer', handleAnswer);
      socket.off('signal:ice-candidate', handleIceCandidate);
    };
  }, [socket, sessionId, createAndSendOffer]);

  // Stop stream and clean up
  const stopStream = useCallback(() => {
    if (peerRef.current) {
      console.log('[webrtc] Closing PeerConnection');
      peerRef.current.close();
      peerRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (socket) {
      socket.emit('session:leave', { sessionId });
    }

    hasRemoteDescription.current = false;
    pendingIceCandidates.current = [];
    setStreamState('disconnected');
    setErrorReason(null);
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
    errorReason,
    stats,
    startStream,
    stopStream,
  };
}

export default useWebRTC;
