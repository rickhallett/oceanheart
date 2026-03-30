+++
title = "Networking from the CLI - curl, openssl, dig, tcpdump, iptables"
date = "2026-03-10"
description = "Every agent operates over a network. These tools let you inspect every layer of the stack from the command line."
tags = ["networking", "curl", "dns", "tls", "tcpdump", "iptables", "bootcamp"]
step = 10
tier = 1
estimate = "4 hours"
bootcamp = 1
+++

Step 10 of 12 in the Agentic Engineering Bootcamp.

---

**Prerequisites:** Step 1 (process model, file descriptors, sockets), Step 2 (shell language), Step 8 (process observation, ss)
**You will need:** A Linux terminal (Arch, Debian, or Ubuntu), root/sudo access for tcpdump and iptables, optionally Docker for container exercises

---

## Overview

Every agent operates over a network. It calls APIs. It receives webhooks. It resolves
DNS names. It negotiates TLS. When any of these fail, the agent reports "the API is
down" or "the request failed" - a description that tells you nothing about what actually
happened. The agent cannot diagnose network problems because it operates at the
application layer and has no visibility into what happens below.

You do have that visibility. The tools in this step - curl, openssl, dig, tcpdump,
iptables - let you inspect every layer of the network stack from the command line.
They turn "the API is down" into "DNS resolution returns NXDOMAIN because the nameserver
configuration changed" or "the TLS handshake fails because the intermediate certificate
is missing" or "the connection times out because an iptables rule is dropping packets on
port 443."

This step makes network diagnostics systematic. Not guessing. Not retrying. Observing,
measuring, and isolating the failure layer.

---

## Table of Contents

1. [The Network Stack in 5 Minutes](#1-the-network-stack-in-5-minutes) (~15 min)
2. [curl - The HTTP Swiss Army Knife](#2-curl---the-http-swiss-army-knife) (~60 min)
3. [openssl - TLS/SSL Diagnostics](#3-openssl---tlsssl-diagnostics) (~30 min)
4. [dig and DNS Resolution](#4-dig-and-dns-resolution) (~30 min)
5. [tcpdump - Packet Capture](#5-tcpdump---packet-capture) (~30 min)
6. [iptables/nftables - Firewall and Packet Filtering](#6-iptablesnftables---firewall-and-packet-filtering) (~30 min)
7. [Diagnostic Workflows](#7-diagnostic-workflows) (~15 min)
8. [Challenges](#8-challenges) (~60-90 min)
9. [What to Read Next](#9-what-to-read-next)

---

## 1. The Network Stack in 5 Minutes

*Estimated time: 15 minutes*

The network is a stack of layers. Each layer wraps the one below it. When you type a URL
into curl, you invoke every layer. When something fails, it fails at one specific layer.
Diagnosis means identifying which layer.

```
Layer 5  APPLICATION    HTTP, DNS, TLS, SMTP, SSH
Layer 4  TRANSPORT      TCP, UDP
Layer 3  NETWORK        IP (IPv4, IPv6), ICMP
Layer 2  LINK           Ethernet, WiFi (802.11), ARP
Layer 1  PHYSICAL       Copper, fiber, radio
```

This is a simplification of the OSI model (which has 7 layers) into the practical
TCP/IP model. You do not need the OSI model to diagnose problems. You need this one.

### Sockets are File Descriptors

From Step 1: everything in Unix is a file descriptor. A network connection is no
exception. When a process opens a TCP connection, the kernel returns an fd. The process
reads and writes to that fd using the same `read()` and `write()` syscalls it uses for
files. The kernel handles the TCP state machine, segmentation, retransmission, and
flow control behind the fd abstraction.

```bash
# Start a Python HTTP server and inspect its fds
python3 -m http.server 8765 &
SERVER_PID=$!
sleep 1

# The listening socket is an fd
ls -la /proc/$SERVER_PID/fd/
# You'll see socket:[NNNNN] entries

# ss shows what those sockets are
ss -tlnp | grep 8765

kill $SERVER_PID
```

The socket fd is the bridge between the process model (Step 1) and the network. Every
tool in this step is either creating sockets, inspecting sockets, or capturing what
flows through them.

### TCP: Reliable, Ordered, Connection-Oriented

TCP is the transport behind HTTP, HTTPS, SSH, SMTP, and most application protocols. It
provides:

- **Reliability** - lost packets are retransmitted
- **Ordering** - data arrives in the order it was sent
- **Flow control** - the sender slows down if the receiver cannot keep up
- **Connection state** - both sides maintain state about the connection

A TCP connection begins with a three-way handshake:

```
Client              Server
  |                   |
  |--- SYN ---------->|    "I want to connect"
  |                   |
  |<-- SYN-ACK -------|    "Acknowledged, I also want to connect"
  |                   |
  |--- ACK ---------->|    "Acknowledged, connection established"
  |                   |
  |   (data flows)    |
```

When you see `curl -v` output showing "Connected to host:port", the three-way handshake
has completed. When you see "Connection timed out", the SYN got no response. When you
see "Connection refused", the server sent RST (reset) instead of SYN-ACK, meaning
nothing is listening on that port.

### UDP: Unreliable, Unordered, Connectionless

UDP is fire and forget. Send a packet, hope it arrives. No handshake, no retransmission,
no ordering guarantee. DNS queries use UDP by default (port 53) because the entire
query-response fits in a single packet and the overhead of TCP's three-way handshake is
not worth it for a single question-answer exchange.

### Ports

A port is a 16-bit number (0-65535) that identifies a specific service on a host. The
IP address gets the packet to the machine. The port gets it to the right process.

Well-known ports (0-1023) require root to bind:

| Port | Protocol |
|------|----------|
| 22   | SSH      |
| 53   | DNS      |
| 80   | HTTP     |
| 443  | HTTPS    |
| 5432 | PostgreSQL |
| 6379 | Redis    |

### Addresses

- `127.0.0.1` - loopback. Traffic never leaves the machine. Only processes on this host
  can connect.
- `0.0.0.0` - all IPv4 interfaces. A server listening on `0.0.0.0:8080` accepts
  connections from any network interface: loopback, Ethernet, WiFi, Docker bridge, all
  of them.
- `::` - all IPv6 interfaces. The IPv6 equivalent of `0.0.0.0`.
- `::1` - IPv6 loopback.

When a server listens on `127.0.0.1:8080`, it is reachable only from the same machine.
When it listens on `0.0.0.0:8080`, it is reachable from the network. This distinction
matters when containers are involved: a server inside a container listening on
`127.0.0.1` is unreachable from outside the container, even with port mapping.

> **AGENTIC GROUNDING:** The steer/listen architecture has the agent sandbox making HTTP
> requests to an orchestration server. When the orchestration server binds to
> `127.0.0.1`, agents in separate containers cannot reach it. When it binds to
> `0.0.0.0`, they can. This is a Layer 3/4 issue that manifests as "connection refused"
> at Layer 5. The agent reports "API error." You diagnose with `ss -tlnp` to check the
> listening address.

---

## 2. curl - The HTTP Swiss Army Knife

*Estimated time: 60 minutes*

curl is the single most useful networking tool for an agent-native engineer. It lets you
construct and send arbitrary HTTP requests and inspect the full request-response cycle.
When an agent says "the API returned an error," you reproduce the request with curl to
see what actually happened.

### Basic Requests

```bash
# GET request (the default)
curl https://httpbin.org/get

# POST with JSON body
curl -X POST \
  -H 'Content-Type: application/json' \
  -d '{"username": "test", "action": "login"}' \
  https://httpbin.org/post

# PUT
curl -X PUT \
  -d '{"status": "active"}' \
  -H 'Content-Type: application/json' \
  https://httpbin.org/put

# DELETE
curl -X DELETE https://httpbin.org/delete

# POST form data (application/x-www-form-urlencoded)
curl -X POST -d 'username=test&password=secret' https://httpbin.org/post

# POST multipart file upload
curl -X POST -F 'file=@/tmp/test.txt' -F 'description=test file' \
  https://httpbin.org/post
```

### Essential Flags

These are the flags you will use daily. Learn them by name.

```bash
# -v: verbose - shows DNS resolution, TCP connect, TLS handshake,
# request headers, response headers. This is your primary diagnostic flag.
curl -v https://httpbin.org/get

# -s: silent - suppress progress bar and error messages
curl -s https://httpbin.org/get

# -S: show errors even when silent (combine with -s)
curl -sS https://httpbin.org/get

# -I: HEAD request - fetch headers only, no body
curl -I https://httpbin.org/get

# -o: write output to a file instead of stdout
curl -o response.json https://httpbin.org/get

# -O: write output to a file named after the remote file
curl -O https://example.com/file.tar.gz

# -L: follow redirects (curl does not follow by default)
curl -L http://github.com
# Without -L, you get a 301 response. With -L, you get the final page.

# -H: add a header
curl -H 'Authorization: Bearer TOKEN' \
     -H 'Accept: application/json' \
     https://httpbin.org/headers

# -d: send data in the request body (implies POST)
curl -d '{"key": "value"}' https://httpbin.org/post

# -b: send cookies / -c: save cookies
curl -c cookies.txt https://httpbin.org/cookies/set/session/abc123
curl -b cookies.txt https://httpbin.org/cookies

# -u: basic authentication
curl -u username:password https://httpbin.org/basic-auth/username/password

# -k: skip TLS certificate verification
# DANGEROUS in production. Useful for debugging self-signed certs.
curl -k https://self-signed.badssl.com/
```

### Timeouts

Without timeouts, curl will wait indefinitely for a connection or response. In
automation and agent workflows, this means a hung process.

```bash
# --connect-timeout: max time for TCP connection (seconds)
# --max-time: max total time for the entire operation (seconds)
curl --connect-timeout 5 --max-time 10 https://httpbin.org/delay/3

# A practical combination for automation:
curl --connect-timeout 5 --max-time 30 -sS https://api.example.com/data
```

Exit codes from timeouts:
- `7` - connection refused (nothing listening on that port)
- `28` - operation timed out
- `6` - DNS resolution failed

### The -w Format String: Performance Diagnostics

The `-w` (write-out) flag prints metadata about the request using format variables.
This is how you measure where time is being spent.

```bash
# Just the HTTP status code
curl -w '%{http_code}\n' -o /dev/null -s https://httpbin.org/get

# Full timing breakdown
curl -w '\n---\nDNS:        %{time_namelookup}s\nConnect:    %{time_connect}s\nTLS:        %{time_appconnect}s\nFirst byte: %{time_starttransfer}s\nTotal:      %{time_total}s\nSize:       %{size_download} bytes\nStatus:     %{http_code}\n' \
  -o /dev/null -s https://httpbin.org/get
```

What each timing variable measures:

```
|-- DNS lookup --|-- TCP connect --|-- TLS handshake --|-- server processing --|-- transfer --|
0            namelookup         connect            appconnect           starttransfer       total
```

- `time_namelookup` - DNS resolution complete
- `time_connect` - TCP three-way handshake complete
- `time_appconnect` - TLS handshake complete (0 for plain HTTP)
- `time_starttransfer` - first byte of response received (includes server processing)
- `time_total` - entire operation complete

When latency is high, these timings tell you where:
- High `namelookup`? DNS problem.
- High `connect - namelookup`? Network latency or routing problem.
- High `appconnect - connect`? TLS handshake problem (slow cert validation, large cert chain).
- High `starttransfer - appconnect`? Server processing time.
- High `total - starttransfer`? Large response body or slow transfer.

### DNS Override with --resolve

Test a server before DNS changes propagate, or force a specific IP for a hostname:

```bash
# Force example.com to resolve to 93.184.216.34 on port 443
curl --resolve example.com:443:93.184.216.34 https://example.com/

# This is invaluable for:
# - testing a new server before switching DNS
# - bypassing CDN to hit origin
# - verifying that an IP serves the expected certificate
```

### curl with jq: The Canonical API Interaction

```bash
# Fetch JSON and extract a field
curl -s https://httpbin.org/get | jq '.origin'

# Fetch, filter, and format
curl -s https://api.github.com/repos/curl/curl | \
  jq '{name: .name, stars: .stargazers_count, language: .language}'

# POST JSON from a file, process the response
curl -s -X POST \
  -H 'Content-Type: application/json' \
  -d @request.json \
  https://httpbin.org/post | jq '.json'

# Construct JSON with jq, pipe to curl
jq -n '{name: "test", value: 42}' | \
  curl -s -X POST -H 'Content-Type: application/json' -d @- https://httpbin.org/post
```

The `@-` in `-d @-` means "read the request body from stdin." This lets you pipe the
output of jq (or any other command) directly into curl's body.

> **AGENTIC GROUNDING:** Agents frequently interact with external APIs. When an agent
> claims "the API returned an error," `curl -v` to the same endpoint with the same
> headers shows the actual response. The agent sees the HTTP library's interpretation.
> You see the raw request and response. Common discrepancies: the agent's HTTP library
> silently followed a redirect to an error page, or the API returned a 200 with an error
> in the JSON body (which the agent did not check), or the agent sent the wrong
> Content-Type header.

> **AGENTIC GROUNDING:** Webhook handlers (Stripe, GitHub) receive HTTP POST requests
> with specific headers and payloads. `curl -X POST -d @payload.json -H 'Content-Type:
> application/json' http://localhost:3000/api/webhook` is how you test them manually.
> The agent writes the handler; you verify with curl that it actually works with
> realistic payloads before exposing it to the internet.

> **HISTORY:** curl was written by Daniel Stenberg starting in 1998. The name originally
> stood for "see URL" (client for URLs). It now supports over 25 protocols including
> HTTP, HTTPS, FTP, SFTP, SMTP, IMAP, LDAP, and more. Stenberg has maintained it as an
> open source project for over 25 years. curl is installed on virtually every Unix system
> and is one of the most widely deployed pieces of software in existence - it runs in
> cars, televisions, routers, and approximately 10 billion installations worldwide.

---

## 3. openssl - TLS/SSL Diagnostics

*Estimated time: 30 minutes*

TLS (Transport Layer Security) encrypts the connection between client and server. When
TLS fails, the connection is dead before any HTTP data flows. The error messages from
HTTP libraries are often unhelpful: "SSL certificate problem," "certificate verify
failed," "unable to get local issuer certificate." openssl shows you exactly what
certificate the server presents, who issued it, when it expires, and why verification
fails.

### Connecting and Inspecting Certificates

```bash
# Connect to an HTTPS server and display the certificate chain
openssl s_client -connect httpbin.org:443 </dev/null

# With SNI (Server Name Indication) - required when multiple sites
# share an IP address (which is the common case behind CDNs)
openssl s_client -connect httpbin.org:443 -servername httpbin.org </dev/null

# The output shows:
# - Certificate chain (depth 0 is the server cert, higher depths are CAs)
# - Server certificate in PEM format
# - TLS version and cipher negotiated
# - Verification result (OK or error)
```

The `</dev/null` redirects stdin to prevent openssl from waiting for input after
connecting. Without it, the command hangs waiting for you to type HTTP requests.

### Reading Certificate Details

```bash
# Save the server certificate to a file
openssl s_client -connect httpbin.org:443 -servername httpbin.org </dev/null 2>/dev/null | \
  openssl x509 -outform PEM > /tmp/cert.pem

# Read full certificate details
openssl x509 -text -noout -in /tmp/cert.pem

# Check just the expiry date
openssl x509 -enddate -noout -in /tmp/cert.pem

# Check the subject (who the cert is for) and issuer (who signed it)
openssl x509 -subject -issuer -noout -in /tmp/cert.pem

# Check Subject Alternative Names (SANs) - the actual hostnames the cert covers
openssl x509 -text -noout -in /tmp/cert.pem | grep -A1 'Subject Alternative Name'
```

### Common TLS Failures

**Expired certificate:**

```bash
# Check if a certificate has expired
openssl s_client -connect expired.badssl.com:443 </dev/null 2>/dev/null | \
  openssl x509 -enddate -noout
# Shows: notAfter=<date in the past>
```

**Wrong hostname:**

```bash
# Certificate is valid but issued for a different hostname
openssl s_client -connect wrong.host.badssl.com:443 </dev/null 2>&1 | \
  grep -i verify
# Shows: verify error - hostname mismatch
```

**Self-signed certificate:**

```bash
# Certificate is not signed by a trusted CA
openssl s_client -connect self-signed.badssl.com:443 </dev/null 2>&1 | \
  grep -i verify
# Shows: verify error:num=18:self-signed certificate
```

**Missing intermediate certificate:**

The most insidious TLS failure. The server presents its own certificate but not the
intermediate CA certificate that chains it to the root CA. Some clients (browsers)
can work around this by fetching intermediates from a cache or AIA extension. Other
clients (curl, Python's requests library, Node's https module) fail.

```bash
# Check the certificate chain depth
openssl s_client -connect incomplete-chain.badssl.com:443 </dev/null 2>&1 | \
  grep -E '(depth|verify)'
# A healthy chain has depth 0 (server) + depth 1 (intermediate) + depth 2 (root)
# A missing intermediate shows verify error at depth 0
```

### Generating Self-Signed Certificates (for local development)

```bash
# Generate a self-signed certificate and private key
openssl req -new -x509 -nodes \
  -days 365 \
  -out /tmp/cert.pem \
  -keyout /tmp/key.pem \
  -subj '/CN=localhost'

# Verify a certificate against a CA file
openssl verify -CAfile ca.pem /tmp/cert.pem
```

### Verifying a Certificate Chain

```bash
# Download the full chain and verify it
openssl s_client -connect httpbin.org:443 -servername httpbin.org \
  -showcerts </dev/null 2>/dev/null > /tmp/fullchain.pem

# Verify against system CA bundle
openssl verify /tmp/fullchain.pem
```

> **AGENTIC GROUNDING:** Certificate expiry is a common production issue. Agents do not
> check certificates; the Operator ensures they are valid. A quick health check:
> `openssl s_client -connect yoursite.com:443 </dev/null 2>/dev/null | openssl x509
> -enddate -noout` tells you the expiry date in one line. Automate this in a cron job
> or monitoring script. When an agent's HTTPS request fails with a vague SSL error, the
> first diagnostic is always `openssl s_client` to see the actual certificate state.

> **HISTORY:** SSL (Secure Sockets Layer) was created by Netscape in 1995. SSL 2.0 and
> 3.0 are both deprecated due to security vulnerabilities. TLS (Transport Layer
> Security) 1.0 (1999) was the successor, followed by TLS 1.1 (2006), 1.2 (2008), and
> 1.3 (2018). Despite the name change, people still say "SSL" colloquially. The openssl
> tool dates back to 1998, forked from SSLeay (written by Eric Andrew Young and Tim
> Hudson in 1995). OpenSSL's code quality became a focus of attention after the
> Heartbleed vulnerability (CVE-2014-0160), which led to the creation of LibreSSL
> (OpenBSD) and BoringSSL (Google) as forks.

---

## 4. dig and DNS Resolution

*Estimated time: 30 minutes*

DNS (Domain Name System) translates hostnames to IP addresses. It is the first thing
that happens when you connect to any server by name. When DNS fails or returns the wrong
answer, everything above it fails. "The API is down" is frequently "DNS resolution
changed."

### Basic Queries

```bash
# Query the A record (IPv4 address) for a domain
dig example.com

# Query a specific record type
dig example.com MX       # mail servers
dig example.com AAAA     # IPv6 addresses
dig example.com TXT      # text records (SPF, DKIM, domain verification)
dig example.com CNAME    # canonical name (alias)
dig example.com NS       # nameservers
dig example.com SOA      # start of authority

# Just the answer, nothing else
dig +short example.com

# Query a specific DNS server (bypass system resolver)
dig @8.8.8.8 example.com           # Google's public DNS
dig @1.1.1.1 example.com           # Cloudflare's public DNS
dig @9.9.9.9 example.com           # Quad9
```

### DNS Record Types

| Type  | Purpose                | Example                              |
|-------|------------------------|--------------------------------------|
| A     | IPv4 address           | `example.com -> 93.184.216.34`       |
| AAAA  | IPv6 address           | `example.com -> 2606:2800:...`       |
| CNAME | Alias to another name  | `www.example.com -> example.com`     |
| MX    | Mail server            | `example.com -> mail.example.com`    |
| TXT   | Arbitrary text         | SPF records, domain verification     |
| NS    | Authoritative nameserver | `example.com -> ns1.example.com`   |
| SOA   | Zone authority info    | Serial number, refresh timers        |
| PTR   | Reverse DNS (IP to name) | `34.216.184.93 -> example.com`     |

### Tracing the Delegation Chain

```bash
# Trace DNS resolution from root servers to authoritative answer
dig +trace example.com
```

This shows the full delegation chain:

1. Root servers (`.`) - "I don't know example.com, but here are the .com servers"
2. TLD servers (`.com`) - "I don't know example.com, but here are its nameservers"
3. Authoritative nameservers (`ns1.example.com`) - "Here's the A record"

This is invaluable when DNS propagation seems slow or inconsistent. You can see exactly
which nameserver is returning which answer.

### Reverse DNS

```bash
# Look up the hostname for an IP address
dig -x 8.8.8.8
# Returns: dns.google

dig -x 1.1.1.1
# Returns: one.one.one.one
```

### System DNS Configuration

```bash
# What DNS server does your system use?
cat /etc/resolv.conf

# What local overrides exist?
cat /etc/hosts

# The resolution order: /etc/hosts is checked BEFORE DNS
# Adding an entry to /etc/hosts overrides DNS for that hostname
```

To test with a local override:

```bash
# Add a temporary override (requires root)
sudo sh -c 'printf "127.0.0.1 fake.example.com\n" >> /etc/hosts'

# Verify it works
curl http://fake.example.com:8080/
# This connects to 127.0.0.1 regardless of what DNS says

# Remove the override when done
sudo sed -i '/fake.example.com/d' /etc/hosts
```

### Quick Lookup Alternatives

```bash
# host - simpler output than dig, good for quick checks
host example.com
host -t MX example.com

# nslookup - older, less featureful than dig, still widely installed
nslookup example.com
```

`dig` is strictly more capable than both. Use `host` for quick checks when you just
want the IP. Use `dig` for any real diagnosis.

> **AGENTIC GROUNDING:** `dig` diagnoses DNS issues before they become application
> errors. When an agent's API call fails with "could not resolve hostname," `dig` tells
> you whether the problem is the DNS record, the DNS server, or the local resolver
> configuration. `dig @8.8.8.8 hostname` bypasses your local resolver entirely - if
> Google's DNS returns the right answer but your system does not, the problem is your
> `/etc/resolv.conf` or local DNS cache.

> **HISTORY:** dig was written as part of BIND (Berkeley Internet Name Domain), the most
> widely used DNS server software. BIND was originally written in the 1980s by students
> at UC Berkeley and later developed by Paul Vixie and the Internet Systems Consortium
> (ISC). The DNS system itself was designed by Paul Mockapetris in 1983 (RFCs 882 and
> 883, later superseded by RFCs 1034 and 1035). Before DNS, hostname-to-IP mappings were
> maintained in a single file (`HOSTS.TXT`) distributed from a single server at SRI
> International. As the internet grew, this became untenable, and DNS replaced it with a
> distributed hierarchical database.

---

## 5. tcpdump - Packet Capture

*Estimated time: 30 minutes*

tcpdump captures packets as they flow through a network interface. It shows you what is
actually on the wire, not what an application claims is on the wire. This is the tool of
last resort: when every other diagnostic says "everything looks fine" but something is
clearly broken, tcpdump shows the truth.

tcpdump requires root (or `CAP_NET_RAW` capability) because raw packet capture bypasses
the normal socket API.

### Basic Capture

```bash
# Capture all traffic on any interface (very noisy - use filters)
sudo tcpdump -i any

# Capture traffic on a specific port
sudo tcpdump -i any port 80

# Capture traffic to/from a specific host
sudo tcpdump -i any host 10.0.0.1

# Combine filters
sudo tcpdump -i any host 10.0.0.1 and port 443

# Capture only TCP traffic
sudo tcpdump -i any tcp port 8080

# Capture only UDP traffic (useful for DNS)
sudo tcpdump -i any udp port 53

# Capture traffic on the loopback interface
sudo tcpdump -i lo port 8080

# Limit capture to N packets
sudo tcpdump -i any -c 10 port 80
```

### Output Formats

```bash
# Print packet content as ASCII (readable for HTTP, not for HTTPS)
sudo tcpdump -i any -A port 80

# Print packet content as hex + ASCII
sudo tcpdump -i any -X port 80

# Write to a file for later analysis (pcap format)
sudo tcpdump -i any -w /tmp/capture.pcap port 443

# Read from a capture file
sudo tcpdump -r /tmp/capture.pcap

# Read with filters applied
sudo tcpdump -r /tmp/capture.pcap 'tcp port 80'
```

### Reading tcpdump Output

A typical TCP packet summary looks like:

```
14:23:01.123456 IP 192.168.1.100.54321 > 93.184.216.34.443: Flags [S], seq 1234567890, win 65535, length 0
```

Breaking it down:

- `14:23:01.123456` - timestamp
- `IP` - IPv4 packet
- `192.168.1.100.54321` - source IP and port
- `93.184.216.34.443` - destination IP and port
- `Flags [S]` - TCP flags: S=SYN, S.=SYN-ACK, .=ACK, P.=PSH-ACK, F.=FIN-ACK, R=RST
- `seq` - sequence number
- `win` - TCP window size
- `length` - payload length (0 for handshake packets)

Watching a complete TCP connection:

```
[S]     Client -> Server  (SYN - "I want to connect")
[S.]    Server -> Client  (SYN-ACK - "OK, let's connect")
[.]     Client -> Server  (ACK - "Connection established")
[P.]    Client -> Server  (PSH-ACK - data: HTTP GET request)
[.]     Server -> Client  (ACK - "Got your data")
[P.]    Server -> Client  (PSH-ACK - data: HTTP response)
[.]     Client -> Server  (ACK - "Got your data")
[F.]    Client -> Server  (FIN-ACK - "I'm done")
[F.]    Server -> Client  (FIN-ACK - "I'm done too")
[.]     Client -> Server  (ACK - "Connection closed")
```

### HTTPS and Encryption

tcpdump sees everything on the wire, but HTTPS traffic is encrypted. You will see:

1. The TCP three-way handshake (unencrypted - it is below TLS)
2. The TLS ClientHello and ServerHello (partially visible - contains the SNI hostname)
3. Encrypted application data (opaque bytes)

You will NOT see the HTTP method, URL, headers, or body inside HTTPS traffic.

For encrypted traffic, use:
- Application-level logging (the application itself logs requests/responses)
- A MITM proxy like `mitmproxy` (intercepts TLS, requires installing its CA cert)
- `curl -v` to the same endpoint (the most practical approach)

### tshark - Wireshark's CLI

tshark provides more sophisticated protocol decoding than tcpdump:

```bash
# Capture with a display filter (Wireshark filter syntax)
tshark -i any -Y 'http.request.method == "POST"'

# Show only HTTP requests
tshark -i any -Y 'http.request' -T fields -e http.host -e http.request.uri

# Read a pcap file with filters
tshark -r /tmp/capture.pcap -Y 'tcp.port == 8080'
```

tshark is not installed by default on most systems. Install it with
`pacman -S wireshark-cli` (Arch) or `apt install tshark` (Debian/Ubuntu).

> **AGENTIC GROUNDING:** tcpdump on the Docker bridge network shows what traffic flows
> between containers. When the agent sandbox cannot reach the orchestration server, run
> `sudo tcpdump -i docker0 port 8080` and attempt the connection. If you see SYN packets
> leaving but no SYN-ACK returning, the problem is routing or firewall rules, not the
> application. If you see no packets at all, the problem is DNS resolution (the container
> is resolving the hostname to the wrong IP) or the application is not even attempting
> the connection.

> **HISTORY:** tcpdump was originally written in 1988 by Van Jacobson, Craig Leres, and
> Steven McCanne at the Lawrence Berkeley National Laboratory. It uses libpcap, the
> packet capture library that also underlies Wireshark (originally Ethereal, first
> released in 1998). McCanne's work on the BSD Packet Filter (BPF, 1993) provided the
> kernel-level filtering mechanism that makes tcpdump efficient - filters are compiled
> into a bytecode that runs in the kernel, so only matching packets are copied to
> userspace. BPF was later extended into eBPF, which is now used for far more than
> packet filtering (tracing, security policies, networking).

---

## 6. iptables/nftables - Firewall and Packet Filtering

*Estimated time: 30 minutes*

iptables controls the Linux kernel's packet filtering. It decides which packets are
allowed in, allowed out, and forwarded. When a connection is silently dropped or
mysteriously refused, iptables rules are a common cause, especially in Docker
environments where Docker heavily manipulates iptables for port mapping and container
networking.

### Viewing Current Rules

```bash
# List all rules in all chains (requires root)
sudo iptables -L -n

# Verbose output with packet/byte counters
sudo iptables -L -n -v

# List NAT rules (Docker uses these heavily)
sudo iptables -t nat -L -n

# List rules with line numbers (useful for inserting/deleting)
sudo iptables -L -n --line-numbers
```

The `-n` flag prevents DNS lookups on IP addresses in the output. Without it, iptables
tries to resolve every IP to a hostname, which is slow and often fails.

### The Chain Model

iptables processes packets through chains of rules. Each rule matches a condition and
specifies an action (called a "target").

```
                        Incoming packet
                              |
                              v
                    +-------------------+
                    |    PREROUTING     |  (NAT table - DNAT, port mapping)
                    +-------------------+
                              |
                   Is it for this host?
                      /              \
                    yes               no
                    /                   \
           +----------+          +-----------+
           |  INPUT   |          |  FORWARD  |  (routing between interfaces)
           +----------+          +-----------+
                |                       |
                v                       v
          Local process           +------------+
                |                 | POSTROUTING |  (NAT table - SNAT, masquerade)
                v                 +------------+
           +----------+                 |
           |  OUTPUT  |                 v
           +----------+          Out to network
                |
                v
          +-----------+
          | POSTROUTING|
          +-----------+
                |
                v
          Out to network
```

- **INPUT** - packets destined for processes on this machine
- **OUTPUT** - packets originating from processes on this machine
- **FORWARD** - packets being routed through this machine (containers, VMs)
- **PREROUTING** - packets before routing decision (DNAT - destination NAT)
- **POSTROUTING** - packets after routing decision (SNAT - source NAT, masquerade)

### Adding and Removing Rules

```bash
# Allow incoming TCP connections on port 8080
sudo iptables -A INPUT -p tcp --dport 8080 -j ACCEPT

# Drop incoming TCP connections on port 8080 (silently - client sees timeout)
sudo iptables -A INPUT -p tcp --dport 8080 -j DROP

# Reject incoming TCP connections on port 8080 (sends ICMP error - client
# sees "connection refused" immediately instead of waiting for timeout)
sudo iptables -A INPUT -p tcp --dport 8080 -j REJECT

# Allow traffic from a specific IP
sudo iptables -A INPUT -s 10.0.0.5 -p tcp --dport 8080 -j ACCEPT

# Delete a rule by specification
sudo iptables -D INPUT -p tcp --dport 8080 -j DROP

# Delete a rule by line number
sudo iptables -D INPUT 3

# Insert a rule at a specific position (rules are evaluated in order)
sudo iptables -I INPUT 1 -p tcp --dport 22 -j ACCEPT
```

**Rule order matters.** Rules are evaluated top to bottom. The first matching rule wins.
If rule 1 says DROP all traffic and rule 2 says ACCEPT port 8080, port 8080 traffic is
dropped because rule 1 matches first.

### DROP vs REJECT

- **DROP** silently discards the packet. The client sees no response and waits until
  its connection timeout expires. This makes the server appear to not exist.
- **REJECT** sends an ICMP "destination unreachable" or TCP RST back to the client.
  The client immediately sees "connection refused." This is more polite and makes
  debugging easier.

For security: DROP is preferred externally (gives attackers less information). REJECT is
preferred internally (makes debugging faster).

### NAT Rules

Network Address Translation changes the source or destination address of packets.
Docker uses NAT extensively.

```bash
# Port forwarding: redirect traffic arriving on port 80 to port 8080
sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 8080

# View Docker's NAT rules (these implement port mapping with -p flag)
sudo iptables -t nat -L -n

# Masquerade: allow containers to access the internet through the host
sudo iptables -t nat -A POSTROUTING -s 172.17.0.0/16 -j MASQUERADE
```

### nftables: The Modern Replacement

nftables replaces iptables with cleaner syntax and better performance. On modern
distributions, iptables commands may actually be wrappers around nftables
(`iptables-nft`).

```bash
# List all nftables rules
sudo nft list ruleset

# Add a table and chain
sudo nft add table inet filter
sudo nft add chain inet filter input { type filter hook input priority 0 \; }

# Add a rule
sudo nft add rule inet filter input tcp dport 8080 accept

# nftables syntax is more consistent than iptables:
# - One tool instead of iptables/ip6tables/ebtables/arptables
# - Rules can match on multiple protocols in one statement
# - Sets and maps are first-class objects
```

For most diagnostic work, `iptables -L -n` is sufficient. You need nftables knowledge
primarily when working with modern firewall configurations or container networking
internals.

### Docker and iptables

Docker manipulates iptables heavily. When you run `docker run -p 8080:80 nginx`:

1. Docker creates a DNAT rule in PREROUTING: traffic arriving on host port 8080 is
   redirected to the container's IP on port 80
2. Docker creates a FORWARD rule: traffic to the container's IP on port 80 is allowed
3. Docker creates a MASQUERADE rule: container traffic going to the internet appears to
   come from the host's IP

```bash
# See Docker's iptables rules
sudo iptables -t nat -L -n | grep -i docker
sudo iptables -L DOCKER -n

# Common Docker networking problem: rules conflict with manual iptables rules
# Docker inserts rules at the top of chains, potentially overriding your rules
```

> **AGENTIC GROUNDING:** "Why can't the container reach the internet?" is a question
> that requires checking multiple layers: DNS resolution inside the container
> (`docker exec container cat /etc/resolv.conf`), routing (`docker exec container ip
> route`), and iptables rules on the host (`sudo iptables -t nat -L -n`). Agents
> cannot diagnose this because they operate inside the container and cannot see the
> host's iptables rules. You diagnose from outside.

---

## 7. Diagnostic Workflows

*Estimated time: 15 minutes*

When a network connection fails, diagnose systematically from the bottom of the stack
up. Each step either passes (move up) or fails (you found the layer).

### Diagnostic Flowchart

```
CONNECTION PROBLEM?
|
|-- Can you resolve the hostname?
|   $ dig hostname
|   $ dig @8.8.8.8 hostname
|   |
|   |-- NO (NXDOMAIN, SERVFAIL, timeout)
|   |   -> DNS problem
|   |   -> Check /etc/resolv.conf
|   |   -> Check /etc/hosts
|   |   -> Try dig @8.8.8.8 to bypass local resolver
|   |   -> If in container: check container DNS config
|   |
|   |-- YES (got an IP)
|       |
|       |-- Can you reach the IP?
|       |   $ ping -c 3 IP
|       |   $ traceroute IP
|       |   |
|       |   |-- NO (100% packet loss, no route)
|       |   |   -> Network/routing problem
|       |   |   -> Check iptables: sudo iptables -L -n
|       |   |   -> Check route: ip route
|       |   |   -> If in container: check docker network
|       |   |
|       |   |-- YES (pings succeed)
|       |       |
|       |       |-- Is the port open?
|       |       |   LOCAL:  ss -tlnp | grep :PORT
|       |       |   REMOTE: nc -zv host port
|       |       |   |
|       |       |   |-- NO (connection refused or timeout)
|       |       |   |   -> Service not running or wrong port
|       |       |   |   -> Check: ss -tlnp on the server
|       |       |   |   -> Check: is it bound to 127.0.0.1 vs 0.0.0.0?
|       |       |   |   -> Check: iptables DROP rule?
|       |       |   |
|       |       |   |-- YES (port is open)
|       |       |       |
|       |       |       |-- Is TLS working? (if HTTPS)
|       |       |       |   $ openssl s_client -connect host:443
|       |       |       |   |
|       |       |       |   |-- NO (handshake failure, cert error)
|       |       |       |   |   -> Certificate problem
|       |       |       |   |   -> Check expiry, hostname, chain
|       |       |       |   |   -> openssl x509 -text -noout
|       |       |       |   |
|       |       |       |   |-- YES (TLS handshake succeeds)
|       |       |       |       |
|       |       |       |       |-- What does the HTTP response say?
|       |       |       |           $ curl -v https://host/path
|       |       |       |           |
|       |       |       |           |-- 4xx/5xx error
|       |       |       |           |   -> Application-level problem
|       |       |       |           |   -> Check headers, body, auth
|       |       |       |           |
|       |       |       |           |-- 2xx but wrong data
|       |       |       |           |   -> API contract issue
|       |       |       |           |   -> Check response body with jq
|       |       |       |           |
|       |       |       |           |-- Slow response
|       |       |       |               -> Use curl -w timing
|       |       |       |               -> Identify slow layer
```

### Quick Diagnostic Commands

```bash
# "Can I reach the server?"
curl -v https://api.example.com/health

# "Is the port open?" (local)
ss -tlnp | grep :8080

# "Is the port open?" (remote)
nc -zv api.example.com 443

# "Is TLS working?"
openssl s_client -connect api.example.com:443 </dev/null

# "What's the latency?"
curl -w 'DNS: %{time_namelookup}s\nTCP: %{time_connect}s\nTLS: %{time_appconnect}s\nTotal: %{time_total}s\n' \
  -o /dev/null -s https://api.example.com/health

# "What's actually on the wire?"
sudo tcpdump -i any -A port 8080

# "Why can't the container reach the internet?"
# 1. Check DNS inside container
docker exec container cat /etc/resolv.conf
# 2. Check routing
docker exec container ip route
# 3. Check iptables on host
sudo iptables -t nat -L -n
sudo iptables -L FORWARD -n
```

---

## 8. Challenges

*Estimated time: 60-90 minutes total*

---

### Challenge: HTTP Anatomy

*Estimated time: 15 minutes*

Use `curl -v` to make an HTTPS request to `https://httpbin.org/get` and annotate every
line of the verbose output.

```bash
curl -v https://httpbin.org/get 2>&1
```

For each section of output, identify:

1. **DNS resolution** - which line shows the resolved IP address?
2. **TCP connect** - which line confirms the three-way handshake completed?
3. **TLS handshake** - which lines show the TLS version, cipher, and certificate info?
4. **HTTP request** - identify the request line (`GET /get HTTP/2`), Host header, and
   other request headers
5. **HTTP response** - identify the status line, response headers (especially
   Content-Type, Content-Length), and the response body

Draw a sequence diagram showing the full exchange: DNS query, TCP SYN/SYN-ACK/ACK, TLS
ClientHello/ServerHello/Certificate/Finished, HTTP request, HTTP response, connection
close.

**Expected learning:** You should be able to read `curl -v` output and immediately
identify which phase of the connection is represented by each line.

---

### Challenge: TLS Certificate Chain

*Estimated time: 15 minutes*

Connect to three different HTTPS sites and compare their certificates:

```bash
# Site 1: A Let's Encrypt site
openssl s_client -connect letsencrypt.org:443 -servername letsencrypt.org </dev/null 2>/dev/null | \
  openssl x509 -text -noout

# Site 2: A site with a commercial CA (try github.com or google.com)
openssl s_client -connect github.com:443 -servername github.com </dev/null 2>/dev/null | \
  openssl x509 -text -noout

# Site 3: A site with known TLS issues (try expired.badssl.com or
# self-signed.badssl.com)
openssl s_client -connect expired.badssl.com:443 </dev/null 2>&1
```

For each site, extract and compare:

1. **Issuer** - who signed the certificate?
2. **Subject** - who is the certificate for?
3. **Validity period** - when was it issued, when does it expire?
4. **Signature algorithm** - RSA, ECDSA? What hash?
5. **Certificate chain depth** - how many certificates are in the chain?
6. **Subject Alternative Names (SANs)** - what hostnames does the cert cover?

Write a shell one-liner that checks the expiry date of any site's certificate:

```bash
check_cert_expiry() {
  openssl s_client -connect "$1:443" -servername "$1" </dev/null 2>/dev/null | \
    openssl x509 -enddate -noout
}
check_cert_expiry github.com
check_cert_expiry letsencrypt.org
```

---

### Challenge: DNS Trace

*Estimated time: 15 minutes*

Trace the full DNS delegation chain for a domain:

```bash
dig +trace example.com
```

**Part A:** Follow the delegation step by step. For each step, identify:

1. Which servers are being queried?
2. What record type is returned (NS, A, etc.)?
3. What is the server saying? ("I don't know, but ask these servers instead" vs
   "Here is the answer")

**Part B:** Add a local DNS override and verify it works:

```bash
# Add an override
sudo sh -c 'printf "127.0.0.1 fake.example.com\n" >> /etc/hosts'

# Verify with dig (dig does NOT use /etc/hosts - it queries DNS directly)
dig +short fake.example.com
# Expected: no result (or NXDOMAIN)

# Verify with curl (curl DOES use /etc/hosts via the system resolver)
curl -s -o /dev/null -w '%{http_code}' http://fake.example.com/ 2>/dev/null
# Expected: connects to 127.0.0.1

# Verify with getent (uses the system resolver, including /etc/hosts)
getent hosts fake.example.com
# Expected: 127.0.0.1 fake.example.com

# Clean up
sudo sed -i '/fake.example.com/d' /etc/hosts
```

**Part C:** Explain why `dig` and `curl` give different results for the overridden
hostname. (Hint: dig queries DNS servers directly; curl uses the system resolver which
consults `/etc/hosts` first, per the order specified in `/etc/nsswitch.conf`.)

---

### Challenge: Build an API Test Harness

*Estimated time: 20 minutes*

Write a shell script `api-diag.sh` that takes a URL and produces a comprehensive
diagnostic report. The output should be valid JSON (constructed with jq).

```bash
#!/usr/bin/env bash
set -euo pipefail

url="${1:?Usage: api-diag.sh <url>}"

# Run curl with timing and capture all diagnostics
response=$(curl -sS \
  -o /tmp/api-diag-body.$$ \
  -w '{
    "dns_time": %{time_namelookup},
    "connect_time": %{time_connect},
    "tls_time": %{time_appconnect},
    "first_byte_time": %{time_starttransfer},
    "total_time": %{time_total},
    "http_code": %{http_code},
    "size_bytes": %{size_download},
    "num_redirects": %{num_redirects},
    "remote_ip": "%{remote_ip}",
    "remote_port": %{remote_port}
  }' \
  "$url" 2>/tmp/api-diag-err.$$) || true

# Build the final report
jq -n \
  --arg url "$url" \
  --arg timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --argjson timings "$response" \
  --arg body_preview "$(head -c 200 /tmp/api-diag-body.$$)" \
  '{
    url: $url,
    timestamp: $timestamp,
    timings: $timings,
    body_preview: $body_preview
  }'

# Cleanup
rm -f /tmp/api-diag-body.$$ /tmp/api-diag-err.$$
```

**Tasks:**

1. Make the script executable and test it against several URLs:
   - `https://httpbin.org/get` (should work)
   - `https://httpbin.org/status/500` (server error)
   - `https://httpbin.org/delay/3` (slow response)
   - `http://nonexistent.invalid/` (DNS failure)

2. Add a TLS certificate check: if the URL is HTTPS, include the certificate expiry
   date in the output.

3. Add a DNS diagnostic: include the resolved IP addresses from `dig +short`.

4. Add a comparison mode: run the diagnostic N times and report min/max/avg for each
   timing metric.

---

### Challenge: Packet Capture Exercise

*Estimated time: 15 minutes*

**Part A: Capture plain HTTP traffic**

```bash
# Terminal 1: Start a simple HTTP server
python3 -m http.server 8765

# Terminal 2: Start capturing on loopback
sudo tcpdump -i lo -w /tmp/http-capture.pcap port 8765

# Terminal 3: Make a request
curl http://localhost:8765/

# Stop the capture (Ctrl-C in terminal 2)
```

Read back the capture and identify:

```bash
# Read the capture
sudo tcpdump -r /tmp/http-capture.pcap -A

# Find the TCP three-way handshake
sudo tcpdump -r /tmp/http-capture.pcap 'tcp[tcpflags] & (tcp-syn|tcp-fin) != 0'

# Find the HTTP GET request (visible because plain HTTP is unencrypted)
sudo tcpdump -r /tmp/http-capture.pcap -A | grep -A 5 'GET / HTTP'

# Find the HTTP response
sudo tcpdump -r /tmp/http-capture.pcap -A | grep -A 5 'HTTP/1'
```

Identify these phases in the capture:
1. TCP SYN (client to server)
2. TCP SYN-ACK (server to client)
3. TCP ACK (client to server)
4. HTTP GET request (with headers)
5. HTTP response (with headers and body)
6. TCP FIN sequence (connection teardown)

**Part B: Compare with HTTPS**

Start an HTTPS server (you will need a certificate):

```bash
# Generate a self-signed cert
openssl req -new -x509 -nodes -days 1 \
  -out /tmp/cert.pem -keyout /tmp/key.pem \
  -subj '/CN=localhost'

# Start HTTPS server (Python 3)
python3 -c "
import ssl, http.server
context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
context.load_cert_chain('/tmp/cert.pem', '/tmp/key.pem')
server = http.server.HTTPServer(('localhost', 8766), http.server.SimpleHTTPRequestHandler)
server.socket = context.wrap_socket(server.socket, server_side=True)
server.serve_forever()
" &
HTTPS_PID=$!

# Capture
sudo tcpdump -i lo -w /tmp/https-capture.pcap port 8766 &
TCPDUMP_PID=$!
sleep 1

# Make a request (-k to accept self-signed cert)
curl -k https://localhost:8766/

sleep 1
sudo kill $TCPDUMP_PID
kill $HTTPS_PID

# Read the capture
sudo tcpdump -r /tmp/https-capture.pcap -A
```

Observe that:
- The TCP handshake is still visible (SYN, SYN-ACK, ACK)
- The TLS ClientHello is partially visible (you can see the SNI hostname)
- The HTTP request and response are encrypted (you see binary data, not ASCII)
- The TLS ServerHello and Certificate messages are visible

This is why `curl -v` is usually more useful than tcpdump for HTTPS diagnostics - curl
sees the decrypted content because it is the TLS endpoint.

---

### Challenge: Container Network Debugging

*Estimated time: 20 minutes*

This challenge requires Docker. It exercises the full diagnostic toolkit on container
networking.

**Setup:**

```bash
# Create a custom network
docker network create debug-net

# Start two containers
docker run -d --name server --network debug-net \
  python:3-slim python3 -m http.server 8080
docker run -d --name client --network debug-net \
  python:3-slim sleep 3600
```

**Part A: Verify connectivity**

```bash
# From the client container, reach the server
docker exec client curl -s http://server:8080/
# This works because Docker's embedded DNS resolves container names on custom networks
```

**Part B: Observe traffic from the host**

```bash
# Find the Docker bridge interface for the custom network
BRIDGE=$(docker network inspect debug-net -f '{{.Id}}' | cut -c1-12)
IFACE="br-$BRIDGE"

# Capture traffic between the containers
sudo tcpdump -i "$IFACE" port 8080 -c 20

# In another terminal, make a request
docker exec client curl -s http://server:8080/
```

**Part C: Inspect Docker's iptables rules**

```bash
# See the NAT rules Docker created
sudo iptables -t nat -L -n | grep -A 5 DOCKER

# See the FORWARD rules
sudo iptables -L FORWARD -n
```

**Part D: Block and unblock traffic**

```bash
# Get the server container's IP
SERVER_IP=$(docker inspect server -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}')

# Block traffic to the server
sudo iptables -I FORWARD -d "$SERVER_IP" -j DROP

# Try to connect (should fail/timeout)
docker exec client curl --connect-timeout 3 -s http://server:8080/ || printf 'Connection failed\n'

# Remove the block
sudo iptables -D FORWARD -d "$SERVER_IP" -j DROP

# Verify connectivity is restored
docker exec client curl -s http://server:8080/
```

**Cleanup:**

```bash
docker rm -f server client
docker network rm debug-net
```

**Expected learning:** You should understand how Docker networking uses iptables NAT
rules, how container DNS resolution works on custom networks, and how to observe
inter-container traffic from the host using tcpdump on the bridge interface.

---

## Key Takeaways

Before moving on, you should be able to answer these without looking anything up:

1. What is the difference between TCP and UDP? When is each used?

2. What do the TCP flags SYN, ACK, FIN, and RST mean? What sequence do they appear
   in for a normal connection?

3. What is the difference between `0.0.0.0` and `127.0.0.1` as a listening address?
   Why does this matter for containers?

4. Given `curl -v` output, which lines show DNS resolution, TCP connect, TLS
   handshake, and HTTP exchange?

5. How do you check a server's TLS certificate expiry from the command line?

6. What is the difference between `dig example.com` and `curl example.com` in terms
   of DNS resolution? Which uses `/etc/hosts`?

7. Why can't tcpdump show the contents of HTTPS traffic?

8. What is the difference between iptables DROP and REJECT? When would you use each?

9. How does Docker implement port mapping? (Hint: DNAT rules in the PREROUTING chain)

10. Given a failing API connection, what is the diagnostic sequence? (DNS, ping, port
    check, TLS, HTTP)

---

## Recommended Reading

These are not required for the bootcamp but provide depth on specific topics.

- **curl - Everything curl** - Daniel Stenberg. The definitive guide to curl by its
  author. Free online at https://everything.curl.dev/. Covers every flag, every protocol,
  and the design decisions behind them.

- **TCP/IP Illustrated, Volume 1** - W. Richard Stevens (2nd edition, 2011, updated by
  Kevin Fall). The definitive reference for TCP/IP protocols. Chapter 12 (TCP) and
  Chapter 13 (TCP Connection Management) are directly relevant to what you see in
  tcpdump output.

- **DNS and BIND** - Cricket Liu and Paul Albitz (5th edition, 2006). Comprehensive DNS
  reference. Older but the fundamentals have not changed.

- **`man curl`**, **`man openssl-s_client`**, **`man dig`**, **`man tcpdump`**,
  **`man iptables`** - the actual manuals. tcpdump's man page includes the full filter
  syntax. curl's man page documents every flag and every `-w` format variable.

- **Beej's Guide to Network Programming** - Brian "Beej Jorgensen" Hall. Free online.
  If you want to understand sockets at the C level (what is actually happening when curl
  connects), this is the most accessible introduction.

---

## 9. What to Read Next

**[Step 11: Process Supervision](/bootcamp/11-process-supervision/)** - systemd, supervisord, and keeping things running. You
now know how to diagnose network problems from the outside. Step 11 covers what happens
when a process crashes and needs to be restarted automatically: systemd units, process
supervisors, health checks, and the relationship between init systems and the process
tree from Step 1. The connection: once you have diagnosed and fixed a network issue, you
need the service to restart cleanly. Process supervision is the mechanism that makes
services self-healing. The tools from this step (curl for health checks, openssl for
certificate monitoring) become inputs to the supervision system's liveness probes.
