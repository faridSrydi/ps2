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

# Use software encoder with explicit I420 format conversion (prevents 4:4:4 profile errors)
video_enc = (
    f"videoconvert ! video/x-raw,format=I420 ! "
    f"x264enc tune=zerolatency bitrate={bitrate} speed-preset=ultrafast key-int-max=30 ! "
    f"video/x-h264,profile=baseline"
)

# Use silent audio source — PulseAudio daemon is not running in headless Docker
audio_src = "audiotestsrc is-live=true wave=silence"

pipeline_str = (
    f"ximagesrc display-name={display} use-damage=false show-pointer=false "
    f"! video/x-raw,framerate={fps}/1 ! videoscale "
    f"! video/x-raw,width={width},height={height} "
    f"! {video_enc} ! rtph264pay config-interval=-1 pt=96 "
    f"! webrtc. "
    f"{audio_src} ! audioconvert ! audioresample ! opusenc bitrate=128000 frame-size=10 ! rtpopuspay pt=97 "
    f"! webrtc. "
    f"webrtcbin name=webrtc bundle-policy=max-bundle stun-server={stun_server}"
)

pipeline = Gst.parse_launch(pipeline_str)
webrtc = pipeline.get_by_name("webrtc")



# Configure NiceAgent port range dynamically as elements are added
def on_deep_element_added(pipeline, bin, element):
    try:
        if element.find_property("agent"):
            agent = element.get_property("agent")
            if agent and agent.find_property("min-rtp-port"):
                agent.set_property("min-rtp-port", 10000)
                agent.set_property("max-rtp-port", 10100)
                sys.stderr.write(f"✓ Configured port range 10000-10100 on {element.get_name()}\n")
                sys.stderr.flush()
    except Exception as e:
        sys.stderr.write(f"Err configuring element {element.get_name()}: {e}\n")
        sys.stderr.flush()

pipeline.connect("deep-element-added", on_deep_element_added)

def send_json(msg):
    sys.stdout.write(json.dumps(msg) + "\n")
    sys.stdout.flush()

def on_ice_candidate(element, mline_index, candidate):
    sys.stderr.write(f"ICE candidate gathered: {candidate}\n")
    sys.stderr.flush()
    send_json({
        "type": "ice",
        "candidate": {
            "candidate": candidate,
            "sdpMLineIndex": mline_index,
        }
    })

webrtc.connect("on-ice-candidate", on_ice_candidate)

def on_local_desc_set(promise, user_data):
    try:
        reply = promise.get_reply()
        sys.stderr.write("✓ GStreamer Local description set successfully\n")
        sys.stderr.flush()
    except Exception as e:
        sys.stderr.write(f"Err setting local description: {e}\n")
        sys.stderr.flush()

def on_remote_desc_set(promise, user_data):
    try:
        reply = promise.get_reply()
        sys.stderr.write("✓ GStreamer Remote description set successfully\n")
        sys.stderr.flush()
    except Exception as e:
        sys.stderr.write(f"Err setting remote description: {e}\n")
        sys.stderr.flush()

def on_offer_created(promise, user_data):
    try:
        reply = promise.get_reply()
        if not reply or not reply.has_field("offer"):
            sys.stderr.write("Err: No offer field in promise reply\n")
            sys.stderr.flush()
            return

        offer = reply.get_value("offer")
        promise_local = Gst.Promise.new_with_change_func(on_local_desc_set, None)
        webrtc.emit("set-local-description", offer, promise_local)

        sdp_text = offer.sdp.as_text()
        sys.stderr.write("✓ GStreamer created SDP offer successfully\n")
        sys.stderr.flush()
        send_json({
            "type": "offer",
            "sdp": {
                "type": "offer",
                "sdp": sdp_text,
            }
        })
    except Exception as e:
        sys.stderr.write(f"Err in on_offer_created: {e}\n")
        sys.stderr.flush()

def on_negotiation_needed(element):
    sys.stderr.write("✓ GStreamer on-negotiation-needed: Creating offer...\n")
    sys.stderr.flush()
    promise = Gst.Promise.new_with_change_func(on_offer_created, None)
    webrtc.emit("create-offer", None, promise)

webrtc.connect("on-negotiation-needed", on_negotiation_needed)

def handle_answer(sdp_info):
    try:
        sys.stderr.write("Handling WebRTC answer from client...\n")
        sys.stderr.flush()
        sdp_text = sdp_info.get("sdp", "")
        res, sdp_msg = GstSdp.SDPMessage.new()
        GstSdp.sdp_message_parse_buffer(bytes(sdp_text, 'utf-8'), sdp_msg)
        
        answer = GstWebRTC.WebRTCSessionDescription.new(
            GstWebRTC.WebRTCSDPType.ANSWER, sdp_msg
        )

        promise_remote = Gst.Promise.new_with_change_func(on_remote_desc_set, None)
        webrtc.emit("set-remote-description", answer, promise_remote)
    except Exception as e:
        sys.stderr.write(f"Err handling answer: {e}\n")
        sys.stderr.flush()
    return False

def on_answer_created(promise, user_data):
    try:
        sys.stderr.write("Creating SDP answer...\n")
        sys.stderr.flush()
        reply = promise.get_reply()
        if not reply or not reply.has_field("answer"):
            sys.stderr.write("Err: No answer field in promise reply\n")
            sys.stderr.flush()
            return

        answer = reply.get_value("answer")

        promise_local = Gst.Promise.new_with_change_func(on_local_desc_set, None)
        webrtc.emit("set-local-description", answer, promise_local)

        sdp_text = answer.sdp.as_text()
        sys.stderr.write("✓ SDP answer created successfully\n")
        sys.stderr.flush()
        send_json({
            "type": "answer",
            "sdp": {
                "type": "answer",
                "sdp": sdp_text,
            }
        })
    except Exception as e:
        sys.stderr.write(f"Err in on_answer_created: {e}\n")
        sys.stderr.flush()

def handle_offer(sdp_info):
    try:
        sys.stderr.write("Handling WebRTC offer in GLib main loop...\n")
        sys.stderr.flush()
        sdp_text = sdp_info.get("sdp", "")
        res, sdp_msg = GstSdp.SDPMessage.new()
        GstSdp.sdp_message_parse_buffer(bytes(sdp_text, 'utf-8'), sdp_msg)
        
        offer = GstWebRTC.WebRTCSessionDescription.new(
            GstWebRTC.WebRTCSDPType.OFFER, sdp_msg
        )

        promise_remote = Gst.Promise.new_with_change_func(on_remote_desc_set, None)
        webrtc.emit("set-remote-description", offer, promise_remote)

        promise_answer = Gst.Promise.new_with_change_func(on_answer_created, None)
        webrtc.emit("create-answer", None, promise_answer)
    except Exception as e:
        sys.stderr.write(f"Err handling offer: {e}\n")
        sys.stderr.flush()
    return False

def handle_ice(candidate_info):
    try:
        c_str = candidate_info.get("candidate", "")
        mline = candidate_info.get("sdpMLineIndex", 0)
        if c_str:
            webrtc.emit("add-ice-candidate", mline, c_str)
    except Exception as e:
        sys.stderr.write(f"Err handling ICE: {e}\n")
        sys.stderr.flush()
    return False

def read_stdin():
    while True:
        line = sys.stdin.readline()
        if not line:
            break
        try:
            msg = json.loads(line)
            msg_type = msg.get("type")
            if msg_type == "offer":
                GLib.idle_add(handle_offer, msg.get("sdp", {}))
            elif msg_type == "answer":
                GLib.idle_add(handle_answer, msg.get("sdp", {}))
            elif msg_type == "ice":
                GLib.idle_add(handle_ice, msg.get("candidate", {}))
        except Exception as e:
            sys.stderr.write(f"Err parsing stdin json: {e}\n")
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
