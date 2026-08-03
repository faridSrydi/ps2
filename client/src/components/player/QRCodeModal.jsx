// ============================================================
// PS2 Cloud Gaming Platform — QRCodeModal Component
// Displays QR code and Room ID for pairing smartphone gamepad
// ============================================================

import { QRCodeSVG } from 'qrcode.react';
import { HiDeviceMobile, HiCheckCircle, HiX } from 'react-icons/hi';

export default function QRCodeModal({ isOpen, onClose, roomId, controllerUrl, isControllerConnected }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-sm glass-card p-6 text-center border border-ps2-accent/30 shadow-2xl shadow-ps2-accent/20">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <HiX className="w-6 h-6" />
        </button>

        {/* Header */}
        <div className="w-12 h-12 rounded-2xl bg-ps2-accent/20 text-ps2-glow flex items-center justify-center mx-auto mb-3">
          <HiDeviceMobile className="w-6 h-6" />
        </div>
        <h3 className="font-display font-bold text-xl text-white">Pair Your Phone</h3>
        <p className="text-xs text-gray-400 mt-1 mb-4">
          Scan this QR Code with your smartphone camera to turn it into a virtual PS2 gamepad.
        </p>

        {/* QR Code Container */}
        <div className="bg-white p-4 rounded-2xl inline-block shadow-inner mb-4">
          {controllerUrl ? (
            <QRCodeSVG value={controllerUrl} size={180} level="M" />
          ) : (
            <div className="w-[180px] h-[180px] bg-gray-200 animate-pulse rounded-lg" />
          )}
        </div>

        {/* Room ID */}
        <div className="bg-ps2-darker/80 border border-ps2-border/60 rounded-xl p-3 mb-4">
          <span className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Room ID</span>
          <span className="font-mono text-2xl font-bold tracking-widest text-ps2-glow">
            {roomId || '----'}
          </span>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center justify-center gap-2 text-sm font-medium">
          {isControllerConnected ? (
            <span className="text-green-400 flex items-center gap-1.5">
              <HiCheckCircle className="w-5 h-5" /> Phone Connected! Ready to play.
            </span>
          ) : (
            <span className="text-yellow-400 animate-pulse flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-yellow-400" /> Waiting for controller pairing...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
