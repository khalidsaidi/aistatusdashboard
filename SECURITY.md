# Security Policy

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |

## Reporting a Vulnerability

We take the security of AI Status Dashboard seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Please do NOT:
- Create a public GitHub issue for security vulnerabilities
- Disclose the vulnerability publicly until we've had a chance to address it

### Please DO:
1. **Email us** at [legal@aistatusdashboard.com](mailto:legal@aistatusdashboard.com)
2. **Use the subject line**: "Security Vulnerability Report"
3. **Include the following information**:
   - Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
   - Full paths of source file(s) related to the manifestation of the issue
   - The location of the affected source code (tag/branch/commit or direct URL)
   - Any special configuration required to reproduce the issue
   - Step-by-step instructions to reproduce the issue
   - Proof-of-concept or exploit code (if possible)
   - Impact of the issue, including how an attacker might exploit the issue

### What to expect:
- **Acknowledgment**: We will acknowledge receipt of your vulnerability report within 24 hours
- **Initial Assessment**: We will provide an initial assessment within 72 hours
- **Updates**: We will keep you informed of our progress throughout the process
- **Resolution**: We aim to resolve critical vulnerabilities within 90 days
- **Credit**: We will credit you in our security advisory (unless you prefer to remain anonymous)

## Security Measures

### Current Security Practices
- **No secrets in code**: All sensitive data handled via environment variables
- **Input validation**: User inputs are sanitized and validated
- **Rate limiting**: API endpoints protected against abuse
- **HTTPS enforcement**: All production traffic encrypted
- **Dependency scanning**: Automated vulnerability scanning via Dependabot
- **Code review**: All changes reviewed before merging

### Scope
This security policy applies to:
- The main AI Status Dashboard application
- All API endpoints and backend services
- Build and deployment processes
- Third-party integrations and dependencies

### Out of Scope
- Issues in third-party services we monitor (report to those providers directly)
- Social engineering attacks
- Physical security issues
- Issues requiring physical access to our infrastructure

## Security Updates

Security updates will be:
- Released as soon as possible after verification
- Announced in our GitHub releases
- Documented in our changelog
- Communicated to users via appropriate channels

## Questions

If you have questions about this security policy, please contact us at [legal@aistatusdashboard.com](mailto:legal@aistatusdashboard.com).

---

**Last Updated:** January 2025  
**Repository:** https://github.com/khalidsaidi/aistatusdashboard 