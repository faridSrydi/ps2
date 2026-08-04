#!/usr/bin/env python3
# ============================================================
# PS2 Cloud Gaming Platform — GStreamer WebRTC Streamer
# Bridges GStreamer webrtcbin with Node.js via stdin/stdout JSON
# ============================================================

import sys
import json
import os
import threading
import gi

gi.require_version('Gst', '1.0')
gi.require_version('GstWebRTC', '1.0')
gi.require_version('GstSdp', '1.0')
from gi.repository import Gst, GstWebRTC, GstSdp, GLib

Gst.init(None)

display = sys.argv[1] if len(sys.argv) > 1 else ":10"
resolution = sys.argv[2] if len(sys.argv) > 2 else "1280x720"
fps = sys.argv[3] if len(sys.argv) > 3 else "60"
bitrate = sys.argv[4] if len(sys.argv) > 4 else "3000"
stun_server = sys.argv[5] if len(sys.argv) > 5 else "stun://stun.l.google.com:19302"
if stun_server.startswith("stun:") and not stun_server.startswith("stun://"):
    stun_server = stun_server.replace("stun:", "stun://")

width, height = resolution.split('x')

# Use software eancoder — nvh264enc plugin is found but NVENC runtime
# fails inside Docker ("Could not configure supporting library")
video_enc = f"x264enc tune=zerolatency bitrate={bitrate} speed-preset=ultrafast key-int-max=30"

# Use silent audio source — PulseAudio daemon is not running in headless Docker
audio_src = "audiotestsrc is-live=true wave=silence"

pipeline_str = (
    f"ximagesrc display-name={display} use-damage=false show-pointer=false "
    f"! video/x-raw,framerate={fps}/1 ! videoconvert ! videoscale "
    f"! video/x-raw,width={width},height={height} "
    f"! {video_enc} ! rtph264pay config-interval=-1 pt=96 "
    f"! webrtc. "
    f"{audio_src} ! audioconvert ! audioresample ! opusenc bitrate=128000 frame-size=10 ! rtpopuspay pt=97 "
    f"! webrtc. "
    f"webrtcbin name=webrtc bundle-policy=max-bundle stun-server={stun_server}"
)

pipeline = Gst.parse_launch(pipeline_str)
webrtc = pipeline.get_by_name("webrtc")

def send_json(msg):
    sys.stdout.write(json.dumps(msg) + "\n")
    sys.stdout.flush()

def on_ice_candidate(element, mline_index, candidate):
    send_json({
        "type": "ice",
        "candidate": {
            "candidate": candidate,
            "sdpMLineIndex": mline_index,
        }
    })

webrtc.connect("on-ice-candidate", on_ice_candidate)

def on_answer_created(promise, user_data):
    promise.wait()
    reply = promise.get_reply()
    answer = reply.get_value("answer")

    promise_local = Gst.Promise.new()
    webrtc.emit("set-local-description", answer, promise_local)
    promise_local.wait()

    sdp_text = answer.as_text()
    send_json({
        "type": "answer",
        "sdp": {
            "type": "answer",
            "sdp": sdp_text,
        }
    })

def handle_offer(sdp_info):
    sdp_text = sdp_info.get("sdp", "")
    res, sdp_msg = GstSdp.SDPMessage.new()
    GstSdp.sdp_message_parse_buffer(bytes(sdp_text, 'utf-8'), sdp_msg)
    
    offer = GstWebRTC.WebRTCSessionDescription.new(
        GstWebRTC.WebRTCSDPType.OFFER, sdp_msg
    )

    promise_remote = Gst.Promise.new()
    webrtc.emit("set-remote-description", offer, promise_remote)
    promise_remote.wait()

    promise_answer = Gst.Promise.new_with_change_func(on_answer_created, None)
    webrtc.emit("create-answer", None, promise_answer)

def handle_ice(candidate_info):
    cand = candidate_info.get("candidate", {})
    c_str = cand.get("candidate", "")
    mline = cand.get("sdpMLineIndex", 0)
    if c_str:
        webrtc.emit("add-ice-candidate", mline, c_str)

def read_stdin():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
            mtype = msg.get("type")
            if mtype == "offer":
                handle_offer(msg.get("sdp", {}))
            elif mtype == "ice":
                handle_ice(msg)
        except Exception as e:
            sys.stderr.write(f"Err processing stdin: {e}\n")
            sys.stderr.flush()

# Log pipeline errors
bus = pipeline.get_bus()
bus.add_signal_watch()
def on_bus_message(bus, msg):
    t = msg.type
    if t == Gst.MessageType.ERROR:
        err, dbg = msg.parse_error()
        sys.stderr.write(f"GST ERROR: {err.message}\n")
        if dbg:
            sys.stderr.write(f"GST DEBUG: {dbg}\n")
        sys.stderr.flush()
    elif t == Gst.MessageType.WARNING:
        err, dbg = msg.parse_warning()
        sys.stderr.write(f"GST WARN: {err.message}\n")
        sys.stderr.flush()
    elif t == Gst.MessageType.STATE_CHANGED:
        if msg.src == pipeline:
            old, new, pending = msg.parse_state_changed()
            sys.stderr.write(f"Pipeline state: {old.value_nick} -> {new.value_nick}\n")
            sys.stderr.flush()
bus.connect('message', on_bus_message)

sys.stderr.write(f"Starting pipeline: {pipeline_str}\n")
sys.stderr.flush()

pipeline.set_state(Gst.State.PLAYING)

stdin_thread = threading.Thread(target=read_stdin, daemon=True)
stdin_thread.start()

loop = GLib.MainLoop()
try:
    loop.run()
except KeyboardInterrupt:
    pass
finally:
    pipeline.set_state(Gst.State.NULL)
