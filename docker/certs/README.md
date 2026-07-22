# TLS certificates

For local Nginx TLS termination, place the certificate chain at `tls.crt` and
the private key at `tls.key`. Never commit either file.

Production deployments may instead terminate HTTPS at a trusted load balancer
or ingress and forward traffic to port 80.
