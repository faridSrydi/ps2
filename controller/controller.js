// ============================================================
// PS2 Cloud Gaming Platform — Controller JavaScript
// Smartphone Virtual Gamepad logic with binary input stream
// ============================================================

(function () {
  let socket = null;
  let roomId = null;
  let isConnected = false;

  // DOM Elements
  const overlay = document.getElementById('pairing-overlay');
  const gamepad = document.getElementById('gamepad');
  const roomInput = document.getElementById('room-input');
  const connectBtn = document.getElementById('connect-btn');
  const statusMsg = document.getElementById('status-msg');

  // Auto-fill room ID from URL param ?room=ABCD-1234
  const urlParams = new URLSearchParams(window.location.search);
  const roomFromUrl = urlParams.get('room');
  if (roomFromUrl) {
    roomInput.value = roomFromUrl.toUpperCase();
  }

  connectBtn.addEventListener('click', () => {
    const val = roomInput.value.trim().toUpperCase();
    if (val) connectToRoom(val);
  });

  function connectToRoom(targetRoom) {
    roomId = targetRoom;
    statusMsg.textContent = 'Connecting to server...';

    socket = io({
      query: { type: 'controller', roomId: targetRoom },
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      statusMsg.textContent = 'Pairing with room...';
      socket.emit('controller:pair', {
        roomId: targetRoom,
        deviceName: navigator.userAgent.includes('iPhone') ? 'iPhone Gamepad' : 'Android Gamepad',
        playerNumber: 1,
      });
    });

    socket.on('controller:paired', (data) => {
      if (data.success) {
        isConnected = true;
        overlay.classList.add('hidden');
        gamepad.classList.remove('hidden');

        // Request fullscreen on mobile
        if (document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      }
    });

    socket.on('controller:error', (err) => {
      statusMsg.textContent = err.message || 'Pairing error';
      statusMsg.style.color = '#ef4444';
    });

    socket.on('controller:vibrate', ({ duration = 150 }) => {
      if (navigator.vibrate) navigator.vibrate(duration);
    });

    socket.on('disconnect', () => {
      isConnected = false;
      statusMsg.textContent = 'Disconnected from server';
      overlay.classList.remove('hidden');
      gamepad.classList.add('hidden');
    });
  }

  // ─── Button Touch Handlers ────────────────────────────────
  const buttons = document.querySelectorAll('.btn');

  buttons.forEach((btn) => {
    const btnName = btn.getAttribute('data-btn');

    const handlePress = (e) => {
      e.preventDefault();
      if (navigator.vibrate) navigator.vibrate(25); // Subtle click vibration
      sendButtonEvent(btnName, true);
    };

    const handleRelease = (e) => {
      e.preventDefault();
      sendButtonEvent(btnName, false);
    };

    btn.addEventListener('touchstart', handlePress, { passive: false });
    btn.addEventListener('touchend', handleRelease, { passive: false });
    btn.addEventListener('mousedown', handlePress);
    btn.addEventListener('mouseup', handleRelease);
  });

  function sendButtonEvent(buttonName, isPressed) {
    if (!socket || !isConnected) return;

    socket.emit('controller:input', {
      type: 'button',
      button: buttonName,
      value: isPressed ? 1 : 0,
    });
  }

  // ─── Analog Stick Touch Logic ──────────────────────────────
  setupAnalogStick('analog-left-box', 'analog-left-knob', 'left_x', 'left_y');
  setupAnalogStick('analog-right-box', 'analog-right-knob', 'right_x', 'right_y');

  function setupAnalogStick(boxId, knobId, axisXName, axisYName) {
    const box = document.getElementById(boxId);
    const knob = document.getElementById(knobId);

    let activeTouchId = null;
    let boxRect = null;

    const maxRadius = 35; // Maximum pixel displacement from center

    function handleTouchMove(e) {
      if (activeTouchId === null) return;

      const touch = Array.from(e.touches).find((t) => t.identifier === activeTouchId);
      if (!touch) return;

      const centerX = boxRect.left + boxRect.width / 2;
      const centerY = boxRect.top + boxRect.height / 2;

      let dx = touch.clientX - centerX;
      let dy = touch.clientY - centerY;

      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > maxRadius) {
        dx = (dx / distance) * maxRadius;
        dy = (dy / distance) * maxRadius;
      }

      // Move knob UI
      knob.style.transform = `translate(${dx}px, ${dy}px)`;

      // Normalize values to int16 (-32768 to 32767)
      const normX = Math.round((dx / maxRadius) * 32767);
      const normY = Math.round((dy / maxRadius) * 32767);

      sendAxisEvent(axisXName, normX);
      sendAxisEvent(axisYName, normY);
    }

    function handleTouchEnd(e) {
      const touch = Array.from(e.changedTouches).find((t) => t.identifier === activeTouchId);
      if (touch) {
        activeTouchId = null;
        knob.style.transform = 'translate(0px, 0px)';
        sendAxisEvent(axisXName, 0);
        sendAxisEvent(axisYName, 0);
      }
    }

    box.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (activeTouchId === null && e.touches.length > 0) {
        const touch = e.changedTouches[0];
        activeTouchId = touch.identifier;
        boxRect = box.getBoundingClientRect();
        handleTouchMove(e);
      }
    }, { passive: false });

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);
  }

  function sendAxisEvent(axisName, value) {
    if (!socket || !isConnected) return;

    socket.emit('controller:input', {
      type: 'axis',
      axis: axisName,
      value: value,
    });
  }
})();
