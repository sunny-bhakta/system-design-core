"""
JWT Authentication Implementation
Demonstrates JWT token generation, validation, and refresh
"""
import hmac
import hashlib
import base64
import json
import secrets
import time
from typing import Dict, Any, Optional
from dataclasses import dataclass


@dataclass
class RefreshTokenData:
    """Refresh token data"""
    user_id: str
    expires_at: float
    created_at: float


class JWTAuth:
    """JWT Authentication implementation"""
    
    def __init__(self, secret: Optional[str] = None, options: Dict[str, Any] = None):
        self.secret = secret or self._generate_secret()
        self.algorithm = (options or {}).get('algorithm', 'HS256')
        self.access_token_expiry = (options or {}).get('access_token_expiry', 3600)  # 1 hour
        self.refresh_token_expiry = (options or {}).get('refresh_token_expiry', 604800)  # 7 days
        self.refresh_tokens: Dict[str, RefreshTokenData] = {}
    
    def _generate_secret(self) -> str:
        """Generate secret key"""
        return secrets.token_hex(32)
    
    def _base64_url_encode(self, data: str) -> str:
        """Base64 URL encode"""
        return base64.urlsafe_b64encode(
            data.encode('utf-8')
        ).decode('utf-8').rstrip('=')
    
    def _base64_url_decode(self, data: str) -> str:
        """Base64 URL decode"""
        padding = 4 - len(data) % 4
        if padding != 4:
            data += '=' * padding
        return base64.urlsafe_b64decode(data).decode('utf-8')
    
    def _create_signature(self, header: str, payload: str) -> str:
        """Create HMAC signature"""
        data = f'{header}.{payload}'
        signature = hmac.new(
            self.secret.encode('utf-8'),
            data.encode('utf-8'),
            hashlib.sha256
        ).digest()
        return self._base64_url_encode(base64.b64encode(signature).decode('utf-8'))
    
    def _verify_signature(self, header: str, payload: str, signature: str) -> bool:
        """Verify signature"""
        expected_signature = self._create_signature(header, payload)
        return hmac.compare_digest(signature, expected_signature)
    
    def generate_access_token(self, payload: Dict[str, Any]) -> str:
        """Generate access token"""
        header = {
            'alg': self.algorithm,
            'typ': 'JWT'
        }
        
        now = int(time.time())
        token_payload = {
            **payload,
            'iat': now,
            'exp': now + self.access_token_expiry,
            'type': 'access'
        }
        
        encoded_header = self._base64_url_encode(json.dumps(header))
        encoded_payload = self._base64_url_encode(json.dumps(token_payload))
        signature = self._create_signature(encoded_header, encoded_payload)
        
        return f'{encoded_header}.{encoded_payload}.{signature}'
    
    def generate_refresh_token(self, user_id: str) -> str:
        """Generate refresh token"""
        token = secrets.token_hex(32)
        expires_at = time.time() + self.refresh_token_expiry
        
        self.refresh_tokens[token] = RefreshTokenData(
            user_id=user_id,
            expires_at=expires_at,
            created_at=time.time()
        )
        
        return token
    
    def verify_token(self, token: str) -> Dict[str, Any]:
        """Verify and decode token"""
        try:
            parts = token.split('.')
            if len(parts) != 3:
                raise ValueError('Invalid token format')
            
            encoded_header, encoded_payload, signature = parts
            
            # Verify signature
            if not self._verify_signature(encoded_header, encoded_payload, signature):
                raise ValueError('Invalid signature')
            
            # Decode payload
            payload = json.loads(self._base64_url_decode(encoded_payload))
            
            # Check expiration
            if payload.get('exp') and payload['exp'] < time.time():
                raise ValueError('Token expired')
            
            return payload
        except Exception as e:
            raise ValueError(f'Token verification failed: {e}')
    
    def refresh_access_token(self, refresh_token: str) -> str:
        """Refresh access token using refresh token"""
        token_data = self.refresh_tokens.get(refresh_token)
        
        if not token_data:
            raise ValueError('Invalid refresh token')
        
        if time.time() > token_data.expires_at:
            del self.refresh_tokens[refresh_token]
            raise ValueError('Refresh token expired')
        
        # Generate new access token
        new_access_token = self.generate_access_token({
            'userId': token_data.user_id
        })
        
        return new_access_token
    
    def revoke_refresh_token(self, refresh_token: str) -> bool:
        """Revoke refresh token"""
        if refresh_token in self.refresh_tokens:
            del self.refresh_tokens[refresh_token]
            return True
        return False
    
    def cleanup_expired_tokens(self):
        """Cleanup expired refresh tokens"""
        now = time.time()
        expired = [
            token for token, data in self.refresh_tokens.items()
            if now > data.expires_at
        ]
        for token in expired:
            del self.refresh_tokens[token]
    
    def authenticate(self, user_id: str, user_data: Dict[str, Any] = None) -> Dict[str, Any]:
        """Authenticate user and generate tokens"""
        access_token = self.generate_access_token({
            'userId': user_id,
            **(user_data or {})
        })
        
        refresh_token = self.generate_refresh_token(user_id)
        
        return {
            'accessToken': access_token,
            'refreshToken': refresh_token,
            'tokenType': 'Bearer',
            'expiresIn': self.access_token_expiry
        }


def demonstrate_jwt_auth():
    """Demonstrate JWT authentication"""
    print('=== JWT Authentication ===\n')
    
    jwt_auth = JWTAuth('my-secret-key', {
        'access_token_expiry': 3600,  # 1 hour
        'refresh_token_expiry': 604800  # 7 days
    })
    
    # Authenticate user
    print('1. Authenticating user...')
    tokens = jwt_auth.authenticate('user123', {'username': 'john', 'role': 'admin'})
    print('Tokens generated:', {
        'accessToken': tokens['accessToken'][:50] + '...',
        'refreshToken': tokens['refreshToken'][:20] + '...',
        'expiresIn': tokens['expiresIn']
    })
    
    # Verify access token
    print('\n2. Verifying access token...')
    try:
        payload = jwt_auth.verify_token(tokens['accessToken'])
        print('Token verified:', payload)
    except ValueError as e:
        print(f'Verification failed: {e}')
    
    # Refresh access token
    print('\n3. Refreshing access token...')
    try:
        new_access_token = jwt_auth.refresh_access_token(tokens['refreshToken'])
        print('New access token generated:', new_access_token[:50] + '...')
        
        new_payload = jwt_auth.verify_token(new_access_token)
        print('New token payload:', new_payload)
    except ValueError as e:
        print(f'Refresh failed: {e}')
    
    # Test invalid token
    print('\n4. Testing invalid token...')
    try:
        jwt_auth.verify_token('invalid.token.here')
    except ValueError as e:
        print('Correctly detected invalid token:', e)


if __name__ == '__main__':
    demonstrate_jwt_auth()

