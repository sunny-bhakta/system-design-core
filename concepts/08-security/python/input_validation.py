"""
Input Validation & Sanitization
Demonstrates defensive security measures for input handling
"""
import re
import secrets
from typing import Dict, Any, Optional
from urllib.parse import urlparse
from datetime import datetime, timedelta


class InputValidator:
    """Input validator implementation"""
    
    @staticmethod
    def validate_email(email: str) -> Dict[str, Any]:
        """Validate email"""
        if not isinstance(email, str):
            return {'valid': False, 'error': 'Email must be a string'}
        
        email_regex = r'^[^\s@]+@[^\s@]+\.[^\s@]+$'
        if not re.match(email_regex, email):
            return {'valid': False, 'error': 'Invalid email format'}
        
        if len(email) > 254:
            return {'valid': False, 'error': 'Email too long'}
        
        return {'valid': True, 'sanitized': email.lower().strip()}
    
    @staticmethod
    def validate_string(input_str: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
        """Validate and sanitize string"""
        if not isinstance(input_str, str):
            return {'valid': False, 'error': 'Input must be a string'}
        
        options = options or {}
        min_length = options.get('min_length', 0)
        max_length = options.get('max_length', 1000)
        allow_empty = options.get('allow_empty', False)
        pattern = options.get('pattern')
        whitelist = options.get('whitelist')
        
        trimmed = input_str.strip()
        
        if not allow_empty and len(trimmed) == 0:
            return {'valid': False, 'error': 'Input cannot be empty'}
        
        if len(trimmed) < min_length:
            return {'valid': False, 'error': f'Input too short (min: {min_length})'}
        
        if len(trimmed) > max_length:
            return {'valid': False, 'error': f'Input too long (max: {max_length})'}
        
        if pattern and not re.match(pattern, trimmed):
            return {'valid': False, 'error': 'Input does not match required pattern'}
        
        if whitelist and trimmed not in whitelist:
            return {'valid': False, 'error': 'Input not in allowed list'}
        
        return {'valid': True, 'sanitized': trimmed}
    
    @staticmethod
    def validate_number(input_num: Any, options: Dict[str, Any] = None) -> Dict[str, Any]:
        """Validate number"""
        options = options or {}
        min_val = options.get('min', float('-inf'))
        max_val = options.get('max', float('inf'))
        integer = options.get('integer', False)
        
        try:
            num = float(input_num) if not integer else int(input_num)
        except (ValueError, TypeError):
            return {'valid': False, 'error': 'Input is not a number'}
        
        if integer and not isinstance(num, int):
            return {'valid': False, 'error': 'Input must be an integer'}
        
        if num < min_val:
            return {'valid': False, 'error': f'Number too small (min: {min_val})'}
        
        if num > max_val:
            return {'valid': False, 'error': f'Number too large (max: {max_val})'}
        
        return {'valid': True, 'sanitized': num}
    
    @staticmethod
    def validate_url(url: str) -> Dict[str, Any]:
        """Validate URL"""
        if not isinstance(url, str):
            return {'valid': False, 'error': 'URL must be a string'}
        
        try:
            parsed = urlparse(url)
            
            # Only allow http and https
            if parsed.scheme not in ['http', 'https']:
                return {'valid': False, 'error': 'Only HTTP and HTTPS URLs allowed'}
            
            return {'valid': True, 'sanitized': parsed.geturl()}
        except Exception:
            return {'valid': False, 'error': 'Invalid URL format'}


class InputSanitizer:
    """Input sanitizer implementation"""
    
    @staticmethod
    def sanitize_html(input_str: str) -> str:
        """Sanitize HTML"""
        if not isinstance(input_str, str):
            return str(input_str)
        
        # Remove HTML tags
        without_tags = re.sub(r'<[^>]*>', '', input_str)
        
        # Escape HTML entities
        entity_map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '/': '&#x2F;'
        }
        
        escaped = without_tags
        for char, entity in entity_map.items():
            escaped = escaped.replace(char, entity)
        
        return escaped
    
    @staticmethod
    def sanitize_sql(input_str: str) -> str:
        """Sanitize SQL input (use parameterized queries instead!)"""
        if not isinstance(input_str, str):
            return str(input_str)
        
        # Escape SQL special characters
        return input_str.replace("'", "''").replace('\\', '\\\\').replace(';', '')
    
    @staticmethod
    def sanitize_path(input_str: str) -> str:
        """Sanitize file path"""
        if not isinstance(input_str, str):
            return str(input_str)
        
        # Remove path traversal attempts
        sanitized = input_str.replace('..', '').replace('//', '/').lstrip('/').rstrip('/')
        
        # Remove dangerous characters
        sanitized = re.sub(r'[<>:"|?*\x00-\x1f]', '', sanitized)
        
        return sanitized
    
    @staticmethod
    def sanitize_command(input_str: str) -> str:
        """Sanitize command input"""
        if not isinstance(input_str, str):
            return str(input_str)
        
        # Remove command injection characters
        return re.sub(r'[;&|`$(){}[\]\n\r]', '', input_str)


class SQLInjectionPrevention:
    """SQL injection prevention"""
    
    @staticmethod
    def build_parameterized_query(query: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Parameterized query builder"""
        parameterized_query = query
        param_list = []
        param_index = 1
        
        for key, value in params.items():
            placeholder = f'${param_index}'
            parameterized_query = parameterized_query.replace(f':{key}', placeholder)
            param_list.append(value)
            param_index += 1
        
        return {
            'query': parameterized_query,
            'params': param_list,
            'safe': True
        }
    
    @staticmethod
    def detect_sql_injection(input_str: str) -> Dict[str, Any]:
        """Detect SQL injection attempts"""
        if not isinstance(input_str, str):
            return {'detected': False}
        
        sql_patterns = [
            re.compile(r'\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b', re.IGNORECASE),
            re.compile(r'(--|#|/\*|\*/)'),
            re.compile(r'(;|\||&)'),
            re.compile(r'UNION\s+SELECT', re.IGNORECASE),
            re.compile(r'OR\s+1\s*=\s*1', re.IGNORECASE),
            re.compile(r'[\'"`]'),
            re.compile(r'\bxp_\w+', re.IGNORECASE)
        ]
        
        for pattern in sql_patterns:
            if pattern.search(input_str):
                return {
                    'detected': True,
                    'pattern': pattern.pattern,
                    'input': input_str[:100]
                }
        
        return {'detected': False}


class XSSPrevention:
    """XSS prevention"""
    
    @staticmethod
    def escape_html(input_str: str) -> str:
        """Escape HTML"""
        if not isinstance(input_str, str):
            return str(input_str)
        
        entity_map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            '/': '&#x2F;'
        }
        
        escaped = input_str
        for char, entity in entity_map.items():
            escaped = escaped.replace(char, entity)
        
        return escaped
    
    @staticmethod
    def detect_xss(input_str: str) -> Dict[str, Any]:
        """Detect XSS attempts"""
        if not isinstance(input_str, str):
            return {'detected': False}
        
        xss_patterns = [
            re.compile(r'<script[^>]*>.*?</script>', re.IGNORECASE | re.DOTALL),
            re.compile(r'<iframe[^>]*>.*?</iframe>', re.IGNORECASE | re.DOTALL),
            re.compile(r'javascript:', re.IGNORECASE),
            re.compile(r'on\w+\s*=', re.IGNORECASE),
            re.compile(r'<img[^>]+src[^>]*=.*javascript:', re.IGNORECASE),
            re.compile(r'<svg[^>]*onload', re.IGNORECASE)
        ]
        
        for pattern in xss_patterns:
            if pattern.search(input_str):
                return {
                    'detected': True,
                    'pattern': pattern.pattern,
                    'input': input_str[:100]
                }
        
        return {'detected': False}


class CSRFProtection:
    """CSRF protection"""
    
    def __init__(self):
        self.tokens: Dict[str, Dict[str, Any]] = {}
    
    def generate_token(self, session_id: str) -> str:
        """Generate CSRF token"""
        token = secrets.token_hex(32)
        self.tokens[session_id] = {
            'token': token,
            'expires_at': datetime.now() + timedelta(hours=1)
        }
        return token
    
    def validate_token(self, session_id: str, token: str) -> Dict[str, Any]:
        """Validate CSRF token"""
        stored = self.tokens.get(session_id)
        
        if not stored:
            return {'valid': False, 'error': 'No token found for session'}
        
        if datetime.now() > stored['expires_at']:
            del self.tokens[session_id]
            return {'valid': False, 'error': 'Token expired'}
        
        if stored['token'] != token:
            return {'valid': False, 'error': 'Invalid token'}
        
        return {'valid': True}
    
    def cleanup(self):
        """Cleanup expired tokens"""
        now = datetime.now()
        expired = [
            session_id for session_id, data in self.tokens.items()
            if now > data['expires_at']
        ]
        for session_id in expired:
            del self.tokens[session_id]


def demonstrate_security():
    """Demonstrate security measures"""
    print('=== Input Validation ===\n')
    
    # Email validation
    print('Email validation:')
    print(InputValidator.validate_email('user@example.com'))
    print(InputValidator.validate_email('invalid-email'))
    
    # String validation
    print('\nString validation:')
    print(InputValidator.validate_string('hello', {'min_length': 3, 'max_length': 10}))
    print(InputValidator.validate_string('x', {'min_length': 3}))
    
    # SQL Injection detection
    print('\n=== SQL Injection Prevention ===\n')
    sql_check = SQLInjectionPrevention.detect_sql_injection("admin' OR '1'='1")
    print('SQL Injection detected:', sql_check)
    
    # Parameterized query
    safe_query = SQLInjectionPrevention.build_parameterized_query(
        'SELECT * FROM users WHERE username = :username AND password = :password',
        {'username': 'admin', 'password': 'pass123'}
    )
    print('Safe query:', safe_query)
    
    # XSS detection
    print('\n=== XSS Prevention ===\n')
    xss_check = XSSPrevention.detect_xss('<script>alert("XSS")</script>')
    print('XSS detected:', xss_check)
    
    escaped = XSSPrevention.escape_html('<script>alert("XSS")</script>')
    print('Escaped HTML:', escaped)
    
    # CSRF protection
    print('\n=== CSRF Protection ===\n')
    csrf = CSRFProtection()
    session_id = 'session123'
    token = csrf.generate_token(session_id)
    print('CSRF token generated:', token[:20] + '...')
    
    validation = csrf.validate_token(session_id, token)
    print('Token validation:', validation)


if __name__ == '__main__':
    demonstrate_security()

