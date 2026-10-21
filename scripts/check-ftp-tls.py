#!/usr/bin/env python3
"""Probe FTPS before login; never print endpoint, certificate subjects or secrets."""
import argparse
import ftplib
import json
import os
import socket
import ssl
import sys
from urllib.parse import urlsplit


def endpoint(value):
    parsed = urlsplit(value if '://' in value else '//' + value)
    if parsed.scheme and parsed.scheme not in ('ftp', 'ftps'):
        raise ValueError('invalid endpoint scheme')
    if not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError('invalid endpoint')
    if parsed.path not in ('', '/'):
        raise ValueError('unexpected endpoint path')
    return parsed.hostname, parsed.port or (990 if parsed.scheme == 'ftps' else 21)


def error_code(error):
    if isinstance(error, ssl.SSLCertVerificationError):
        return 'certificate_hostname_mismatch' if getattr(error, 'verify_code', None) == 62 else 'certificate_untrusted'
    if isinstance(error, (TimeoutError, socket.timeout)):
        return 'connection_timeout'
    if isinstance(error, socket.gaierror):
        return 'dns_failed'
    if isinstance(error, ConnectionRefusedError):
        return 'connection_refused'
    if isinstance(error, ssl.SSLError):
        return 'tls_handshake_failed'
    if isinstance(error, ftplib.error_perm):
        return 'server_rejected_tls'
    return 'connection_failed'


def probe_explicit(host, port):
    client = ftplib.FTP_TLS(context=ssl.create_default_context(), timeout=12)
    try:
        client.connect(host, port)
        client.auth()  # AUTH TLS is sent BEFORE USER/PASS; CA and hostname are verified.
        return {'mode': 'explicit', 'port': port, 'verified': True,
                'tlsVersion': client.sock.version(), 'reason': None}
    except (OSError, ftplib.Error, ValueError) as error:
        return {'mode': 'explicit', 'port': port, 'verified': False, 'reason': error_code(error)}
    finally:
        client.close()


def probe_implicit(host, port):
    try:
        with socket.create_connection((host, port), timeout=12) as raw:
            with ssl.create_default_context().wrap_socket(raw, server_hostname=host) as secured:
                secured.settimeout(12)
                if not secured.recv(1024).startswith(b'220'):
                    return {'mode': 'implicit', 'port': port, 'verified': False, 'reason': 'not_ftp_service'}
                return {'mode': 'implicit', 'port': port, 'verified': True,
                        'tlsVersion': secured.version(), 'reason': None}
    except (OSError, ValueError) as error:
        return {'mode': 'implicit', 'port': port, 'verified': False, 'reason': error_code(error)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--require-verified', action='store_true')
    parser.add_argument('--require-explicit', action='store_true')
    args = parser.parse_args()
    raw = os.environ.get('FTP_SERVER', '').strip()
    report = {'credentialsUsed': False, 'transferAttempted': False, 'results': []}
    try:
        if not raw:
            raise ValueError('missing endpoint')
        host, port = endpoint(raw)
        if port != 990:
            report['results'].append(probe_explicit(host, port))
        if not any(row['verified'] for row in report['results']):
            report['results'].append(probe_implicit(host, 990))
    except ValueError:
        report['configurationError'] = 'missing_or_invalid_endpoint'
    report['verified'] = any(row['verified'] for row in report['results'])
    print(json.dumps(report, sort_keys=True))
    acceptable = any(row['verified'] and (not args.require_explicit or row['mode'] == 'explicit') for row in report['results'])
    if args.require_verified and not acceptable:
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
