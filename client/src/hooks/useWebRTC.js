import { useEffect, useRef, useState, useCallback } from 'react';

export function useWebRTC(socket, sessionId) {
  const peerRef = useRef(null);
  const videoRef = useRef(null);
  const [streamState, setStreamState] = useState('disconnected'); // disconnected | connecting | connected | error
  const [errorReason, setErrorReason] = useState(null);
  const [stats, setStats] = useState(null);

  const hasRemoteDescription = useRef(false);
  const pendingIceCandidates = useRef([]);

  // Join session room saja (Tanpa membuat Offer)
  const startStream = useCallback(() => {
    if (!socket || !sessionId) return;

    console.log('[webrtc] Joining session:', sessionId);
    setStreamState('connecting');
    setErrorReason(null);
    socket.emit('session:join', { sessionId });
  }, [socket, sessionId]);

  // Handle Signal Listeners
  useEffect(() => {
    if (!socket || !sessionId) return;

    // 1. Dengar Offer dari Python VPS -> Buat Answer -> Kirim ke VPS
    const handleServerOffer = async ({ sdp }) => {
      console.log('[webrtc] signal:offer received from VPS server');
      try {
        if (peerRef.current) {
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
            setErrorReason('DTLS / WebRTC Connection failed');
          }
        };

        pc.oniceconnectionstatechange = () => {
          console.log(`[webrtc] iceConnectionState: ${pc.iceConnectionState}`);
          if (pc.iceConnectionState === 'failed') {
            setStreamState('error');
            setErrorReason('ICE timeout / Connection failed');
          }
        };

        pc.ontrack = (event) => {
          console.log('[webrtc] Track received:', event.track.kind);
          if (videoRef.current && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0];
            setStreamState('connected');
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            socket.emit('signal:ice-candidate', {
              sessionId,
              candidate: event.candidate,
            });
          }
        };

        // Set Remote Description (Offer dari Python)
        console.log('[webrtc] Setting remote description (server offer)...');
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        hasRemoteDescription.current = true;

        // Flush ICE Candidates yang masuk duluan
        console.log(`[webrtc] Flushing ${pendingIceCandidates.current.length} buffered ICE candidates...`);
        for (const candidate of pendingIceCandidates.current) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (iceErr) {
            console.error('[webrtc] Failed to add buffered ICE candidate:', iceErr);
          }
        }
        pendingIceCandidates.current = [];

        // Buat Answer
        console.log('[webrtc] Creating SDP answer...');
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        // Emit Answer ke Node.js
        console.log('[webrtc] Emitting signal:answer to server');
        socket.emit('signal:answer', {
          sessionId,
          sdp: {
            type: pc.localDescription.type,
            sdp: pc.localDescription.sdp,
          },
        });
      } catch (err) {
        console.error('[webrtc] Failed to handle server offer:', err);
        setStreamState('error');
        setErrorReason(`Server offer processing failed: ${err.message}`);
      }
    };

    // 2. Dengar ICE Candidates dari Server
    const handleIceCandidate = async ({ candidate }) => {
      const pc = peerRef.current;
      if (!candidate) return;

      if (pc && hasRemoteDescription.current) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error('[webrtc] Failed to add ICE candidate:', err);
        }
      } else {
        pendingIceCandidates.current.push(candidate);
      }
    };

    socket.on('signal:offer', handleServerOffer);
    socket.on('signal:ice-candidate', handleIceCandidate);

    return () => {
      socket.off('signal:offer', handleServerOffer);
      socket.off('signal:ice-candidate', handleIceCandidate);
    };
  }, [socket, sessionId]);

  // Stop stream & clean up
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

  // Ambil statistik bitrate/fps
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
        // Ignored
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [streamState]);

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
