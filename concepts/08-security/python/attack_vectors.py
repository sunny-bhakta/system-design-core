"""
Common Attack Vectors
Demonstrates offensive security concepts - attack detection and prevention
"""
import re
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class AttackDetection:
    """Attack detection result"""
    detected: bool
    attack_type: Optional[str] = None
    pattern: Optional[str] = None
    severity: Optional[str] = None
    input: Optional[str] = None


class AttackDetector:
    """Attack detector implementation"""
    
    @staticmethod
    def detect_sql_injection(input_str: str) -> Dict[str, Any]:
        """Detect SQL Injection"""
        patterns = [
            re.compile(r'\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b', re.IGNORECASE),
            re.compile(r'(--|#|/\*|\*/)'),
            re.compile(r'(;|\||&)'),
            re.compile(r'UNION\s+SELECT', re.IGNORECASE),
            re.compile(r'OR\s+1\s*=\s*1', re.IGNORECASE),
            re.compile(r'[\'"`]'),
            re.compile(r'\bxp_\w+', re.IGNORECASE),
            re.compile(r'WAITFOR\s+DELAY', re.IGNORECASE)
        ]
        
        for pattern in patterns:
            if pattern.search(input_str):
                return {
                    'detected': True,
                    'attack_type': 'SQL Injection',
                    'pattern': pattern.pattern,
                    'severity': 'HIGH',
                    'input': input_str[:100]
                }
        
        return {'detected': False}
    
    @staticmethod
    def detect_xss(input_str: str) -> Dict[str, Any]:
        """Detect XSS"""
        patterns = [
            re.compile(r'<script[^>]*>.*?</script>', re.IGNORECASE | re.DOTALL),
            re.compile(r'<iframe[^>]*>.*?</iframe>', re.IGNORECASE | re.DOTALL),
            re.compile(r'javascript:', re.IGNORECASE),
            re.compile(r'on\w+\s*=', re.IGNORECASE),
            re.compile(r'<img[^>]+src[^>]*=.*javascript:', re.IGNORECASE),
            re.compile(r'<svg[^>]*onload', re.IGNORECASE),
            re.compile(r'<body[^>]*onload', re.IGNORECASE),
            re.compile(r'<input[^>]*onfocus', re.IGNORECASE)
        ]
        
        for pattern in patterns:
            if pattern.search(input_str):
                return {
                    'detected': True,
                    'attack_type': 'Cross-Site Scripting (XSS)',
                    'pattern': pattern.pattern,
                    'severity': 'HIGH',
                    'input': input_str[:100]
                }
        
        return {'detected': False}
    
    @staticmethod
    def detect_command_injection(input_str: str) -> Dict[str, Any]:
        """Detect Command Injection"""
        patterns = [
            re.compile(r'[;&|`$(){}[\]]'),
            re.compile(r'(\||\|\|)'),
            re.compile(r'(&&|&)'),
            re.compile(r'(;|;)'),
            re.compile(r'(`|`)'),
            re.compile(r'(\$\(|`)'),
            re.compile(r'>\s*/dev/null'),
            re.compile(r'<\s*/dev/null')
        ]
        
        for pattern in patterns:
            if pattern.search(input_str):
                return {
                    'detected': True,
                    'attack_type': 'Command Injection',
                    'pattern': pattern.pattern,
                    'severity': 'CRITICAL',
                    'input': input_str[:100]
                }
        
        return {'detected': False}
    
    @staticmethod
    def detect_path_traversal(input_str: str) -> Dict[str, Any]:
        """Detect Path Traversal"""
        patterns = [
            re.compile(r'\.\.'),
            re.compile(r'\.\./\.\.'),
            re.compile(r'\.\.\\'),
            re.compile(r'/\.\.'),
            re.compile(r'\.\.%2f', re.IGNORECASE),
            re.compile(r'\.\.%5c', re.IGNORECASE),
            re.compile(r'\.\.%252f', re.IGNORECASE),
            re.compile(r'\.\.%255c', re.IGNORECASE)
        ]
        
        for pattern in patterns:
            if pattern.search(input_str):
                return {
                    'detected': True,
                    'attack_type': 'Path Traversal',
                    'pattern': pattern.pattern,
                    'severity': 'HIGH',
                    'input': input_str[:100]
                }
        
        return {'detected': False}
    
    @staticmethod
    def detect_ldap_injection(input_str: str) -> Dict[str, Any]:
        """Detect LDAP Injection"""
        patterns = [
            re.compile(r'[()&|!]'),
            re.compile(r'(\*|\(|\)|&|\|)'),
            re.compile(r'(cn=|ou=|dc=)', re.IGNORECASE)
        ]
        
        for pattern in patterns:
            if pattern.search(input_str):
                return {
                    'detected': True,
                    'attack_type': 'LDAP Injection',
                    'pattern': pattern.pattern,
                    'severity': 'MEDIUM',
                    'input': input_str[:100]
                }
        
        return {'detected': False}
    
    @staticmethod
    def detect_xml_injection(input_str: str) -> Dict[str, Any]:
        """Detect XML Injection"""
        patterns = [
            re.compile(r'<!\[CDATA\['),
            re.compile(r'<!ENTITY'),
            re.compile(r'<!DOCTYPE'),
            re.compile(r'<script', re.IGNORECASE),
            re.compile(r'<iframe', re.IGNORECASE)
        ]
        
        for pattern in patterns:
            if pattern.search(input_str):
                return {
                    'detected': True,
                    'attack_type': 'XML Injection',
                    'pattern': pattern.pattern,
                    'severity': 'HIGH',
                    'input': input_str[:100]
                }
        
        return {'detected': False}
    
    @staticmethod
    def detect_brute_force(attempts: List[Dict[str, Any]], time_window: float = 300.0) -> Dict[str, Any]:
        """Detect Brute Force Attempt"""
        now = datetime.now().timestamp()
        recent_attempts = [
            attempt for attempt in attempts
            if now - attempt['timestamp'] < time_window
        ]
        
        if len(recent_attempts) > 10:
            return {
                'detected': True,
                'attack_type': 'Brute Force',
                'attempts': len(recent_attempts),
                'severity': 'MEDIUM',
                'recommendation': 'Implement account lockout'
            }
        
        return {'detected': False}
    
    @staticmethod
    def detect_all(input_str: str) -> Dict[str, Any]:
        """Comprehensive attack detection"""
        detections = []
        
        checks = [
            AttackDetector.detect_sql_injection,
            AttackDetector.detect_xss,
            AttackDetector.detect_command_injection,
            AttackDetector.detect_path_traversal,
            AttackDetector.detect_ldap_injection,
            AttackDetector.detect_xml_injection
        ]
        
        for check in checks:
            result = check(input_str)
            if result['detected']:
                detections.append(result)
        
        return {
            'detected': len(detections) > 0,
            'attacks': detections,
            'count': len(detections)
        }


class SecurityScanner:
    """Security scanner implementation"""
    
    def __init__(self):
        self.vulnerabilities: List[Dict[str, Any]] = []
    
    def scan_sql_injection(self, endpoints: List[str]) -> List[Dict[str, Any]]:
        """Scan for SQL injection vulnerabilities"""
        vulnerable = []
        
        for endpoint in endpoints:
            test_inputs = [
                "admin' OR '1'='1",
                "'; DROP TABLE users--",
                "1' UNION SELECT * FROM users--"
            ]
            
            for test_input in test_inputs:
                detection = AttackDetector.detect_sql_injection(test_input)
                if detection['detected']:
                    vulnerable.append({
                        'endpoint': endpoint,
                        'vulnerability': 'SQL Injection',
                        'severity': 'HIGH',
                        'test_input': test_input[:50]
                    })
        
        return vulnerable
    
    def scan_xss(self, endpoints: List[str]) -> List[Dict[str, Any]]:
        """Scan for XSS vulnerabilities"""
        vulnerable = []
        
        for endpoint in endpoints:
            test_inputs = [
                '<script>alert("XSS")</script>',
                '<img src=x onerror=alert("XSS")>',
                '<svg onload=alert("XSS")>'
            ]
            
            for test_input in test_inputs:
                detection = AttackDetector.detect_xss(test_input)
                if detection['detected']:
                    vulnerable.append({
                        'endpoint': endpoint,
                        'vulnerability': 'Cross-Site Scripting',
                        'severity': 'HIGH',
                        'test_input': test_input[:50]
                    })
        
        return vulnerable
    
    def scan(self, endpoints: List[str]) -> Dict[str, Any]:
        """Comprehensive scan"""
        results = {
            'sql_injection': self.scan_sql_injection(endpoints),
            'xss': self.scan_xss(endpoints),
            'timestamp': datetime.now().timestamp()
        }
        
        total_vulnerabilities = len(results['sql_injection']) + len(results['xss'])
        
        return {
            **results,
            'total_vulnerabilities': total_vulnerabilities,
            'risk_level': 'HIGH' if total_vulnerabilities > 5 else
                          'MEDIUM' if total_vulnerabilities > 2 else 'LOW'
        }


class ThreatModel:
    """Threat model implementation"""
    
    def __init__(self):
        self.threats: List[Dict[str, Any]] = []
    
    def add_threat(self, component: str, threat_type: str, description: str, mitigation: str):
        """Add threat using STRIDE model"""
        self.threats.append({
            'component': component,
            'threat_type': threat_type,  # Spoofing, Tampering, Repudiation, Information Disclosure, DoS, Elevation
            'description': description,
            'mitigation': mitigation,
            'severity': self._calculate_severity(threat_type),
            'timestamp': datetime.now().timestamp()
        })
    
    def _calculate_severity(self, threat_type: str) -> str:
        """Calculate severity using DREAD"""
        severity_map = {
            'Spoofing': 'MEDIUM',
            'Tampering': 'HIGH',
            'Repudiation': 'LOW',
            'Information Disclosure': 'HIGH',
            'DoS': 'MEDIUM',
            'Elevation': 'CRITICAL'
        }
        
        return severity_map.get(threat_type, 'MEDIUM')
    
    def get_threats_by_component(self, component: str) -> List[Dict[str, Any]]:
        """Get threats by component"""
        return [t for t in self.threats if t['component'] == component]
    
    def get_all_threats(self) -> List[Dict[str, Any]]:
        """Get all threats"""
        return self.threats


def demonstrate_attack_vectors():
    """Demonstrate attack vectors"""
    print('=== Attack Vector Detection ===\n')
    
    # Test various attack inputs
    test_inputs = [
        "admin' OR '1'='1",
        '<script>alert("XSS")</script>',
        '../../etc/passwd',
        '; rm -rf /',
        'normal input'
    ]
    
    for input_str in test_inputs:
        detection = AttackDetector.detect_all(input_str)
        if detection['detected']:
            print(f"Input: {input_str[:30]}...")
            print('Detected attacks:', detection['attacks'])
            print()
    
    print('=== Security Scanning ===\n')
    scanner = SecurityScanner()
    endpoints = ['/api/users', '/api/products', '/api/orders']
    scan_results = scanner.scan(endpoints)
    print('Scan results:', scan_results)
    
    print('\n=== Threat Modeling ===\n')
    threat_model = ThreatModel()
    threat_model.add_threat(
        'Authentication Service',
        'Spoofing',
        'Attacker may impersonate users',
        'Implement MFA and strong password policies'
    )
    threat_model.add_threat(
        'Database',
        'Information Disclosure',
        'SQL injection may expose sensitive data',
        'Use parameterized queries and input validation'
    )
    threat_model.add_threat(
        'API Gateway',
        'DoS',
        'DDoS attacks may overwhelm the system',
        'Implement rate limiting and DDoS protection'
    )
    
    print('Threats identified:', threat_model.get_all_threats())


if __name__ == '__main__':
    demonstrate_attack_vectors()

