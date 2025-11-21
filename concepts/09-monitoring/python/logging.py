"""
Structured Logging Implementation
Demonstrates structured logging with different log levels
"""
from enum import IntEnum
from typing import Dict, Any, List, Optional
from datetime import datetime
import json
import secrets


class LogLevel(IntEnum):
    """Log levels"""
    DEBUG = 0
    INFO = 1
    WARN = 2
    ERROR = 3
    FATAL = 4


class StructuredLogger:
    """Structured logger implementation"""
    
    def __init__(self, config: Dict[str, Any] = None):
        config = config or {}
        self.service_name = config.get('service_name', 'app')
        self.environment = config.get('environment', 'development')
        self.min_level = config.get('min_level', LogLevel.INFO)
        self.logs: List[Dict[str, Any]] = []
        self.max_logs = config.get('max_logs', 1000)
    
    def _create_log_entry(self, level: LogLevel, message: str, metadata: Dict[str, Any] = None) -> Dict[str, Any]:
        """Create log entry"""
        metadata = metadata or {}
        return {
            'timestamp': datetime.now().isoformat(),
            'level': level.name,
            'levelNum': level.value,
            'service': self.service_name,
            'environment': self.environment,
            'message': message,
            **metadata,
            'traceId': metadata.get('traceId') or self._generate_trace_id(),
            'spanId': metadata.get('spanId') or self._generate_span_id()
        }
    
    def _generate_trace_id(self) -> str:
        """Generate trace ID"""
        return f'trace-{int(datetime.now().timestamp() * 1000)}-{secrets.token_hex(4)}'
    
    def _generate_span_id(self) -> str:
        """Generate span ID"""
        return f'span-{secrets.token_hex(4)}'
    
    def log(self, level: LogLevel, message: str, metadata: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
        """Log message"""
        if level < self.min_level:
            return None
        
        metadata = metadata or {}
        log_entry = self._create_log_entry(level, message, metadata)
        
        # Store log
        self.logs.append(log_entry)
        if len(self.logs) > self.max_logs:
            self.logs.pop(0)
        
        # Output log
        self._output_log(log_entry)
        
        return log_entry
    
    def _output_log(self, log_entry: Dict[str, Any]):
        """Output log (can be overridden for different outputs)"""
        level = log_entry['level']
        timestamp = log_entry['timestamp']
        message = log_entry['message']
        
        # Color codes for console
        colors = {
            'DEBUG': '\033[36m',  # Cyan
            'INFO': '\033[32m',   # Green
            'WARN': '\033[33m',   # Yellow
            'ERROR': '\033[31m',  # Red
            'FATAL': '\033[35m'   # Magenta
        }
        reset = '\033[0m'
        
        color = colors.get(level, '')
        print(f'{color}[{timestamp}] [{level}] {message}{reset}')
        print(json.dumps(log_entry, indent=2))
    
    def debug(self, message: str, metadata: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
        """Debug log"""
        return self.log(LogLevel.DEBUG, message, metadata)
    
    def info(self, message: str, metadata: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
        """Info log"""
        return self.log(LogLevel.INFO, message, metadata)
    
    def warn(self, message: str, metadata: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
        """Warn log"""
        return self.log(LogLevel.WARN, message, metadata)
    
    def error(self, message: str, error: Exception = None, metadata: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
        """Error log"""
        error_metadata = {
            **(metadata or {}),
            'error': {
                'name': type(error).__name__,
                'message': str(error),
                'traceback': str(error.__traceback__) if error else None
            } if error else None
        }
        return self.log(LogLevel.ERROR, message, error_metadata)
    
    def fatal(self, message: str, error: Exception = None, metadata: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
        """Fatal log"""
        error_metadata = {
            **(metadata or {}),
            'error': {
                'name': type(error).__name__,
                'message': str(error),
                'traceback': str(error.__traceback__) if error else None
            } if error else None
        }
        return self.log(LogLevel.FATAL, message, error_metadata)
    
    def get_logs(self, level: Optional[LogLevel] = None, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """Get logs"""
        filtered = self.logs
        
        if level is not None:
            filtered = [log for log in filtered if log['levelNum'] >= level.value]
        
        if limit is not None:
            filtered = filtered[-limit:]
        
        return filtered
    
    def get_logs_json(self, level: Optional[LogLevel] = None, limit: Optional[int] = None) -> str:
        """Get logs as JSON"""
        return json.dumps(self.get_logs(level, limit), indent=2)
    
    def clear_logs(self):
        """Clear logs"""
        self.logs = []


def demonstrate_logging():
    """Demonstrate structured logging"""
    print('=== Structured Logging ===\n')
    
    logger = StructuredLogger({
        'service_name': 'api-service',
        'environment': 'production',
        'min_level': LogLevel.DEBUG
    })
    
    # Different log levels
    logger.debug('Debug message', {'component': 'auth', 'userId': 'user123'})
    logger.info('User logged in', {'userId': 'user123', 'ip': '192.168.1.1'})
    logger.warn('High memory usage', {'memoryUsage': '85%', 'threshold': '80%'})
    
    try:
        raise Exception('Database connection failed')
    except Exception as e:
        logger.error('Database error', e, {'database': 'users-db', 'query': 'SELECT * FROM users'})
    
    logger.fatal('System crash', Exception('Out of memory'), {'component': 'server'})
    
    # Get logs
    print('\n=== Recent Logs ===')
    recent_logs = logger.get_logs(limit=5)
    print(json.dumps(recent_logs, indent=2))
    
    # Get error logs only
    print('\n=== Error Logs ===')
    error_logs = logger.get_logs(LogLevel.ERROR)
    print(json.dumps(error_logs, indent=2))


if __name__ == '__main__':
    demonstrate_logging()

