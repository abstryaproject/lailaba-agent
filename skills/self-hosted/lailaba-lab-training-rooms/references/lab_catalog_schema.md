# Lab catalog item schema (CHALLENGES in app/api/routes/lab.py)

Each module key in `CHALLENGES` has:
```python
"platforms": {
    "name": "Training Rooms",
    "icon": "🧪",
    "description": "module-level blurb",
    "items": [ ... ]
}
```
Each item in `items[]`:
```python
{
  "id": "room-6",          # unique, stable
  "room": 6,               # int, the visible room number
  "title": "OWASP Juice Shop",
  "icon": "🧃",
  "description": "what it is + what you learn",
  "url": "https://github.com/juice-shop/juice-shop",   # official repo/site
  "tags": ["Web", "XSS", "SQLi", "JWT", "OWASP"],
  "deploy": "multi-line real commands\\nwith \\n line breaks",  # shown in <pre>
  "requirements": "exact deps / why it can/can't run here",
  "compatible": "server" | "this-device" | "vm-only"
}
```

`_public_catalog()` strips `expected/answer/defending_prompt/secret` but
PASSES THROUGH `url, deploy, compatible, room, tags, description`.
So all above fields reach the frontend safely.

## `compatible` flag — set honestly for THIS host
Observed device constraints (Termux/Android, 2026-07-12):
- arch: armv7l (32-bit ARM)  -> most Docker images are amd64, need qemu (absent)
- RAM: 1.8 GB total, ~450 MB free -> cannot host multiple containers
- docker CLI present (v24) but DAEMON NOT running (no dockerd, no compose)
- no qemu binfmt emulation
- no PHP, no Java, no MySQL/MariaDB
- Node v26 + Python 3.13 PRESENT

Mapping used for rooms 1-14:
- "this-device" -> only if runtime truly present. Here: Juice Shop (Node, pure-JS).
- "server"      -> needs x86_64 Docker / PHP+MySQL / Java. Deploy on a real server.
                   (CTFd, RootTheBox, FBCTF, Mellivora, Vulhub, DVWA, WebGoat,
                    Security Shepherd, Caldera)
- "vm-only"     -> needs VirtualBox/VMware/KVM or Windows host. Cannot run in Termux.
                   (Metasploitable, DetectionLab, PurpleSharp, CyberRange)

## URL corrections discovered (404 in user list -> live):
- RootTheBox  -> https://github.com/moloch--/RootTheBox
- PurpleSharp  -> https://github.com/mvelazco/PurpleSharp
- Mellivora    -> https://github.com/Nakiami/mellivora
- (CTFd, Vulhub, juice-shop, DVWA, WebGoat, SecurityShepherd, DetectionLab,
   Caldera, CyberRange, FBCTF, Metasploitable all resolved 200 as given)
