      // Listen for ICE candidates from server
      socket.on('signal:ice-candidate', ({ candidate }) => {
        pc.addIceCandidate(new RTCIceCandidate(candidate))
          .catch(console.error);
      });
    };

    // Send offer immediately
    sendOffer();

    // Listen for stream:ready from server to ensure offer is sent when pipeline is active
    const handleStreamReady = () => {
      console.log('[webrtc] Stream ready event received from server');
      if (peerRef.current && peerRef.current.signalingState !== 'closed') {
        peerRef.current.close();
        peerRef.current = null;
      }
      sendOffer();
    };

    socket.off('stream:ready', handleStreamReady);
