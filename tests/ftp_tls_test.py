import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import ssl
import unittest
from unittest import mock

SPEC = importlib.util.spec_from_file_location('ftp_tls_probe', Path(__file__).parents[1] / 'scripts/check-ftp-tls.py')
probe = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(probe)


class FtpTlsProbeTests(unittest.TestCase):
    def test_only_ftp_endpoints_without_credentials_are_accepted(self):
        self.assertEqual(probe.endpoint('example.test'), ('example.test', 21))
        self.assertEqual(probe.endpoint('ftps://example.test'), ('example.test', 990))
        for value in ['ftp://user:pass@example.test', 'https://example.test', 'ftp://example.test/path']:
            with self.assertRaises(ValueError):
                probe.endpoint(value)

    def test_explicit_tls_is_verified_before_any_login(self):
        with mock.patch.object(probe.ftplib, 'FTP_TLS') as ftp, mock.patch.object(probe.ssl, 'create_default_context') as context:
            context.return_value.check_hostname = True
            ftp.return_value.sock.version.return_value = 'TLSv1.3'
            result = probe.probe_explicit('example.test', 21)
            self.assertTrue(result['verified'])
            self.assertEqual(ftp.call_args.kwargs['context'], context.return_value)
            ftp.return_value.auth.assert_called_once()
            ftp.return_value.login.assert_not_called()
            ftp.return_value.close.assert_called_once()

    def test_untrusted_certificate_is_not_bypassed(self):
        with mock.patch.object(probe.ftplib, 'FTP_TLS') as ftp:
            ftp.return_value.auth.side_effect = ssl.SSLCertVerificationError('synthetic untrusted cert')
            result = probe.probe_explicit('example.test', 21)
            self.assertFalse(result['verified'])
            self.assertEqual(result['reason'], 'certificate_untrusted')
            ftp.return_value.login.assert_not_called()

    def test_report_never_discloses_endpoint_and_strict_mode_blocks_failure(self):
        output = io.StringIO()
        failure = {'verified': False, 'reason': 'certificate_untrusted', 'mode': 'explicit', 'port': 21}
        with mock.patch.dict(os.environ, {'FTP_SERVER': 'private-endpoint.example.test'}), \
             mock.patch.object(probe, 'probe_explicit', return_value=failure), \
             mock.patch.object(probe, 'probe_implicit', return_value={**failure, 'mode': 'implicit', 'port': 990}), \
             mock.patch('sys.argv', ['probe', '--require-verified']), contextlib.redirect_stdout(output):
            self.assertEqual(probe.main(), 1)
        self.assertNotIn('private-endpoint', output.getvalue())
        report = json.loads(output.getvalue())
        self.assertFalse(report['credentialsUsed'])
        self.assertFalse(report['transferAttempted'])
        self.assertFalse(report['verified'])


if __name__ == '__main__':
    unittest.main()
