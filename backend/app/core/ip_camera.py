import ipaddress
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit, urlunsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

import cv2
import numpy as np

MAX_SNAPSHOT_BYTES = 8 * 1024 * 1024
SHARED_OVERLAY_NETWORK = ipaddress.ip_network("100.64.0.0/10")


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, new_url):
        return None


def read_snapshot(url: str) -> bytes:
    url = url.strip()
    if not url:
        raise RuntimeError("Enter an IP Webcam snapshot URL")

    try:
        parsed = urlsplit(url)
        address = ipaddress.ip_address(parsed.hostname or "")
        parsed.port
    except ValueError as exc:
        raise RuntimeError("Use the private LAN IP address shown by IP Webcam") from exc

    if parsed.path in {"", "/"}:
        parsed = parsed._replace(path="/shot.jpg")
        url = urlunsplit(parsed)

    private_lan_address = (
        address.is_private
        and not address.is_loopback
        and not address.is_link_local
        and not address.is_multicast
        and not address.is_unspecified
        and not address.is_reserved
    )
    shared_overlay_address = address in SHARED_OVERLAY_NETWORK
    if (
        parsed.scheme not in {"http", "https"}
        or not (private_lan_address or shared_overlay_address)
    ):
        raise RuntimeError("Use an HTTP(S) snapshot URL on the local Wi-Fi or trusted VPN network")

    request = Request(url, headers={"User-Agent": "Attendify/1.0"})
    try:
        with build_opener(_NoRedirect).open(request, timeout=4) as response:
            content = response.read(MAX_SNAPSHOT_BYTES + 1)
    except (HTTPError, URLError, TimeoutError, OSError) as exc:
        raise RuntimeError("Could not read a frame from the IP Webcam") from exc

    if len(content) > MAX_SNAPSHOT_BYTES:
        raise RuntimeError("IP Webcam snapshot exceeds the 8 MB limit")

    frame = cv2.imdecode(np.frombuffer(content, dtype=np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        raise RuntimeError("IP Webcam did not return a decodable image")

    encoded, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
    if not encoded:
        raise RuntimeError("Could not encode the IP Webcam frame")
    return jpeg.tobytes()