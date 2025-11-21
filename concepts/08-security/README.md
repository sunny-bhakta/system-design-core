# Security

## Implementation Status

| Sub-Concept | Documentation | Node.js | Python |
|-------------|---------------|---------|--------|
| **Defensive Security** | | | |
| Authentication | ✅ | ✅ | ✅ |
| Authorization | ✅ | ✅ | ⏳ |
| OAuth 2.0 | ✅ | ✅ | ⏳ |
| JWT | ✅ | ✅ | ✅ |
| Encryption | ✅ | ⏳ | ⏳ |
| Rate Limiting | ✅ | ✅ | ✅ |
| Input Validation | ✅ | ✅ | ✅ |
| SQL Injection Prevention | ✅ | ✅ | ✅ |
| XSS Prevention | ✅ | ✅ | ✅ |
| CSRF Protection | ✅ | ✅ | ✅ |
| **Offensive Security** | | | |
| Common Attack Vectors | ✅ | ✅ | ✅ |
| Vulnerability Scanning | ✅ | ✅ | ✅ |
| Penetration Testing | ✅ | ⏳ | ⏳ |
| Security Testing | ✅ | ⏳ | ⏳ |
| Threat Modeling | ✅ | ✅ | ✅ |

## Table of Contents

### Defensive Security
1. [Authentication](#authentication)
2. [Authorization](#authorization)
3. [Data Security](#data-security)
4. [Network Security](#network-security)
5. [API Security](#api-security)
6. [Input Validation & Sanitization](#input-validation--sanitization)
7. [Common Vulnerabilities Prevention](#common-vulnerabilities-prevention)

### Offensive Security
8. [Common Attack Vectors](#common-attack-vectors)
9. [Vulnerability Assessment](#vulnerability-assessment)
10. [Security Testing](#security-testing)
11. [Threat Modeling](#threat-modeling)

---

## Authentication

### Definition
Verifying the identity of a user or system.

### Authentication Methods

#### Password-Based
- **Hashed Passwords**: Store hashed passwords
- **Salt**: Add random salt to passwords
- **Password Policies**: Complexity requirements
- **Password Reset**: Secure reset mechanisms

#### Token-Based
- **JWT (JSON Web Tokens)**: Stateless tokens
- **OAuth 2.0**: Authorization framework
- **API Keys**: Simple authentication
- **Session Tokens**: Server-side sessions

#### Multi-Factor Authentication (MFA)
- **Something You Know**: Password
- **Something You Have**: Phone, token
- **Something You Are**: Biometrics
- **2FA**: Two-factor authentication

### OAuth 2.0
- **Authorization Code Flow**: Web applications
- **Client Credentials**: Server-to-server
- **Implicit Flow**: Mobile apps (deprecated)
- **Refresh Tokens**: Long-lived access

### JWT (JSON Web Tokens)
- **Stateless**: No server-side storage
- **Self-Contained**: Includes user info
- **Signed**: Tamper-proof
- **Expiration**: Time-limited tokens

---

## Authorization

### Definition
Determining what a user can access.

### Access Control Models

#### Role-Based Access Control (RBAC)
- **Roles**: Group permissions
- **Users**: Assigned roles
- **Permissions**: Actions allowed
- **Hierarchy**: Role inheritance

#### Attribute-Based Access Control (ABAC)
- **Attributes**: User, resource, environment
- **Policies**: Rule-based access
- **Flexible**: Fine-grained control
- **Complex**: More complex to manage

#### Discretionary Access Control (DAC)
- **Owner Control**: Resource owner decides
- **Permissions**: User/group permissions
- **Flexible**: Easy to configure
- **Less Secure**: User-controlled

### Permission Models
- **Read**: View data
- **Write**: Modify data
- **Delete**: Remove data
- **Execute**: Run operations
- **Admin**: Full access

---

## Data Security

### Encryption

#### Encryption at Rest
- **Database Encryption**: Encrypt stored data
- **File Encryption**: Encrypt files
- **Key Management**: Secure key storage
- **Transparent Encryption**: Automatic encryption

#### Encryption in Transit
- **TLS/SSL**: Transport layer security
- **HTTPS**: HTTP over TLS
- **Certificate Management**: SSL certificates
- **Perfect Forward Secrecy**: Session keys

### Data Masking
- **PII Protection**: Mask personal information
- **Tokenization**: Replace with tokens
- **Redaction**: Remove sensitive data
- **Anonymization**: Remove identifiers

### Secure Key Management
- **Key Storage**: Secure key storage
- **Key Rotation**: Regular key rotation
- **Key Escrow**: Backup key storage
- **HSM**: Hardware security modules

---

## Network Security

### Firewalls
- **Network Firewall**: Filter network traffic
- **Application Firewall**: Filter application traffic
- **Stateful Inspection**: Track connections
- **Rules**: Allow/deny rules

### DDoS Protection
- **Rate Limiting**: Limit request rate
- **Traffic Filtering**: Filter malicious traffic
- **CDN**: Distribute traffic
- **Scaling**: Handle traffic spikes

### Rate Limiting
- **API Rate Limits**: Limit API calls
- **IP-Based**: Limit per IP
- **User-Based**: Limit per user
- **Token Bucket**: Allow bursts

### Input Validation
- **Sanitization**: Clean user input
- **Validation**: Verify input format
- **Whitelist**: Allow only valid input
- **Blacklist**: Block known bad input

### SQL Injection Prevention
- **Parameterized Queries**: Use placeholders
- **ORM**: Object-relational mapping
- **Input Validation**: Validate input
- **Least Privilege**: Minimal database permissions

---

## API Security

### API Authentication
- **API Keys**: Simple authentication
- **OAuth 2.0**: Standard authorization
- **JWT**: Token-based authentication
- **Basic Auth**: Username/password (HTTPS only)

### API Authorization
- **Scopes**: Limit API access
- **Roles**: Role-based access
- **Policies**: Policy-based access
- **Resource-Level**: Per-resource permissions

### API Security Best Practices
- **HTTPS Only**: Encrypt all traffic
- **Rate Limiting**: Prevent abuse
- **Input Validation**: Validate all input
- **Error Handling**: Don't leak information
- **Logging**: Log security events
- **Monitoring**: Monitor for attacks

---

## Input Validation & Sanitization

### Definition
Validating and cleaning user input to prevent security vulnerabilities.

### Input Validation
- **Type Checking**: Verify data types
- **Range Checking**: Verify value ranges
- **Format Validation**: Verify format (email, phone, etc.)
- **Length Validation**: Verify string lengths
- **Whitelist Validation**: Allow only known good values

### Input Sanitization
- **HTML Sanitization**: Remove/escape HTML tags
- **SQL Sanitization**: Escape SQL special characters
- **Path Sanitization**: Prevent directory traversal
- **Command Injection Prevention**: Sanitize shell commands
- **Encoding**: Proper encoding of special characters

### Best Practices
- **Validate on Server**: Never trust client-side validation
- **Whitelist Approach**: Allow only known good input
- **Escape Output**: Escape data when displaying
- **Use Libraries**: Use established sanitization libraries
- **Regular Updates**: Keep validation rules updated

---

## Common Vulnerabilities Prevention

### SQL Injection Prevention
- **Parameterized Queries**: Use prepared statements
- **ORM**: Use object-relational mapping
- **Input Validation**: Validate all input
- **Least Privilege**: Minimal database permissions
- **Error Handling**: Don't expose database errors

### Cross-Site Scripting (XSS) Prevention
- **Output Encoding**: Encode output data
- **Content Security Policy (CSP)**: Restrict script sources
- **Input Validation**: Validate and sanitize input
- **HttpOnly Cookies**: Prevent JavaScript access
- **XSS Filters**: Use XSS protection libraries

### Cross-Site Request Forgery (CSRF) Prevention
- **CSRF Tokens**: Include tokens in forms
- **SameSite Cookies**: Restrict cookie scope
- **Origin Checking**: Verify request origin
- **Double Submit Cookies**: Validate cookie and token
- **Custom Headers**: Require custom headers

### Command Injection Prevention
- **Parameterized Commands**: Use command parameters
- **Input Validation**: Validate command inputs
- **Whitelist Commands**: Allow only safe commands
- **Sandboxing**: Run commands in isolated environment
- **No Shell Execution**: Avoid shell interpreters

### Path Traversal Prevention
- **Path Validation**: Validate file paths
- **Canonicalization**: Resolve path components
- **Whitelist Paths**: Allow only specific directories
- **Sandboxing**: Restrict file system access
- **No User Input in Paths**: Avoid user input in paths

---

## Common Attack Vectors

### Definition
Common methods attackers use to exploit vulnerabilities.

### Injection Attacks
- **SQL Injection**: Inject SQL commands
- **NoSQL Injection**: Inject NoSQL queries
- **Command Injection**: Inject system commands
- **LDAP Injection**: Inject LDAP queries
- **XML Injection**: Inject XML data

### Authentication Attacks
- **Brute Force**: Try many password combinations
- **Credential Stuffing**: Use leaked credentials
- **Session Hijacking**: Steal session tokens
- **Password Spraying**: Try common passwords
- **Phishing**: Trick users into revealing credentials

### Authorization Attacks
- **Privilege Escalation**: Gain higher privileges
- **Horizontal Escalation**: Access other users' data
- **Vertical Escalation**: Gain admin privileges
- **IDOR (Insecure Direct Object Reference)**: Access unauthorized resources
- **Broken Access Control**: Exploit access control flaws

### Data Exposure
- **Sensitive Data Exposure**: Expose sensitive information
- **Insecure Storage**: Store data insecurely
- **Insufficient Logging**: Lack of security logging
- **Information Disclosure**: Leak system information
- **Insecure APIs**: Expose data through APIs

### Denial of Service (DoS)
- **DDoS Attacks**: Distributed denial of service
- **Resource Exhaustion**: Exhaust system resources
- **Application DoS**: Overwhelm application logic
- **Slowloris**: Slow HTTP requests
- **Amplification Attacks**: Amplify attack traffic

---

## Vulnerability Assessment

### Definition
Systematic evaluation of security vulnerabilities.

### Vulnerability Scanning
- **Automated Scanning**: Use scanning tools
- **Manual Testing**: Manual security testing
- **Code Review**: Review code for vulnerabilities
- **Dependency Scanning**: Scan for vulnerable dependencies
- **Configuration Review**: Review security configurations

### Common Vulnerabilities
- **OWASP Top 10**: Common web vulnerabilities
- **CVE Database**: Known vulnerabilities
- **Security Advisories**: Vendor security updates
- **Penetration Testing**: Simulated attacks
- **Red Team Exercises**: Full security exercises

### Vulnerability Management
- **Risk Assessment**: Assess vulnerability risk
- **Prioritization**: Prioritize by severity
- **Remediation**: Fix vulnerabilities
- **Verification**: Verify fixes
- **Tracking**: Track vulnerability lifecycle

---

## Security Testing

### Definition
Testing systems for security vulnerabilities.

### Testing Types
- **Static Analysis**: Analyze code without execution
- **Dynamic Analysis**: Test running applications
- **Interactive Analysis**: Combine static and dynamic
- **Penetration Testing**: Simulate real attacks
- **Fuzzing**: Test with random inputs

### Security Test Cases
- **Authentication Tests**: Test authentication mechanisms
- **Authorization Tests**: Test access controls
- **Input Validation Tests**: Test input handling
- **Encryption Tests**: Test encryption implementation
- **Session Management Tests**: Test session handling

### Tools
- **OWASP ZAP**: Web application security scanner
- **Burp Suite**: Web vulnerability scanner
- **Nmap**: Network security scanner
- **Metasploit**: Penetration testing framework
- **Nessus**: Vulnerability scanner

---

## Threat Modeling

### Definition
Systematic approach to identifying and addressing security threats.

### Threat Modeling Process
1. **Identify Assets**: What needs protection
2. **Identify Threats**: What could go wrong
3. **Assess Risks**: Evaluate threat likelihood and impact
4. **Mitigate Threats**: Implement countermeasures
5. **Validate**: Verify mitigation effectiveness

### STRIDE Model
- **Spoofing**: Impersonating users or systems
- **Tampering**: Modifying data or code
- **Repudiation**: Denying actions
- **Information Disclosure**: Exposing sensitive data
- **Denial of Service**: Disrupting service availability
- **Elevation of Privilege**: Gaining unauthorized access

### DREAD Model
- **Damage**: Potential damage
- **Reproducibility**: How easy to reproduce
- **Exploitability**: How easy to exploit
- **Affected Users**: Number of affected users
- **Discoverability**: How easy to discover

---

## Code Examples

See implementation examples in:
- [Node.js Examples](./node/)
- [Python Examples](./python/)

See implementation examples in:
- [Node.js Examples](./node/)
- [Python Examples](./python/)

