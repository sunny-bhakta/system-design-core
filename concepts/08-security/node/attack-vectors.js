/**
 * Common Attack Vectors
 * Demonstrates offensive security concepts - attack detection and prevention
 */

/**
 * Attack Detector
 * Detects common attack patterns
 */
class AttackDetector {
  /**
   * Detect SQL Injection
   */
  static detectSQLInjection(input) {
    const patterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
      /(--|#|\/\*|\*\/)/,
      /(;|\||&)/,
      /(UNION\s+SELECT)/i,
      /(OR\s+1\s*=\s*1)/i,
      /('|"|`)/,
      /(\bxp_\w+)/i,
      /(WAITFOR\s+DELAY)/i
    ];
    
    for (const pattern of patterns) {
      if (pattern.test(input)) {
        return {
          detected: true,
          attackType: 'SQL Injection',
          pattern: pattern.toString(),
          severity: 'HIGH',
          input: input.substring(0, 100)
        };
      }
    }
    
    return { detected: false };
  }

  /**
   * Detect XSS
   */
  static detectXSS(input) {
    const patterns = [
      /<script[^>]*>.*?<\/script>/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<img[^>]+src[^>]*=.*javascript:/gi,
      /<svg[^>]*onload/gi,
      /<body[^>]*onload/gi,
      /<input[^>]*onfocus/gi
    ];
    
    for (const pattern of patterns) {
      if (pattern.test(input)) {
        return {
          detected: true,
          attackType: 'Cross-Site Scripting (XSS)',
          pattern: pattern.toString(),
          severity: 'HIGH',
          input: input.substring(0, 100)
        };
      }
    }
    
    return { detected: false };
  }

  /**
   * Detect Command Injection
   */
  static detectCommandInjection(input) {
    const patterns = [
      /[;&|`$(){}[\]]/,
      /(\||\|\|)/,
      /(&&|&)/,
      /(;|;)/,
      /(`|`)/,
      /(\$\(|`)/,
      /(>\s*\/dev\/null)/,
      /(<\s*\/dev\/null)/
    ];
    
    for (const pattern of patterns) {
      if (pattern.test(input)) {
        return {
          detected: true,
          attackType: 'Command Injection',
          pattern: pattern.toString(),
          severity: 'CRITICAL',
          input: input.substring(0, 100)
        };
      }
    }
    
    return { detected: false };
  }

  /**
   * Detect Path Traversal
   */
  static detectPathTraversal(input) {
    const patterns = [
      /\.\./,
      /\.\.\/\.\./,
      /\.\.\\/,
      /\/\.\./,
      /\.\.%2f/i,
      /\.\.%5c/i,
      /\.\.%252f/i,
      /\.\.%255c/i
    ];
    
    for (const pattern of patterns) {
      if (pattern.test(input)) {
        return {
          detected: true,
          attackType: 'Path Traversal',
          pattern: pattern.toString(),
          severity: 'HIGH',
          input: input.substring(0, 100)
        };
      }
    }
    
    return { detected: false };
  }

  /**
   * Detect LDAP Injection
   */
  static detectLDAPInjection(input) {
    const patterns = [
      /[()&|!]/,
      /(\*|\(|\)|&|\|)/,
      /(cn=|ou=|dc=)/i
    ];
    
    for (const pattern of patterns) {
      if (pattern.test(input)) {
        return {
          detected: true,
          attackType: 'LDAP Injection',
          pattern: pattern.toString(),
          severity: 'MEDIUM',
          input: input.substring(0, 100)
        };
      }
    }
    
    return { detected: false };
  }

  /**
   * Detect XML Injection
   */
  static detectXMLInjection(input) {
    const patterns = [
      /<!\[CDATA\[/,
      /<!ENTITY/,
      /<\!DOCTYPE/,
      /<script/gi,
      /<iframe/gi
    ];
    
    for (const pattern of patterns) {
      if (pattern.test(input)) {
        return {
          detected: true,
          attackType: 'XML Injection',
          pattern: pattern.toString(),
          severity: 'HIGH',
          input: input.substring(0, 100)
        };
      }
    }
    
    return { detected: false };
  }

  /**
   * Detect Brute Force Attempt
   */
  static detectBruteForce(attempts, timeWindow = 300000) {
    const recentAttempts = attempts.filter(
      attempt => Date.now() - attempt.timestamp < timeWindow
    );
    
    if (recentAttempts.length > 10) {
      return {
        detected: true,
        attackType: 'Brute Force',
        attempts: recentAttempts.length,
        severity: 'MEDIUM',
        recommendation: 'Implement account lockout'
      };
    }
    
    return { detected: false };
  }

  /**
   * Comprehensive attack detection
   */
  static detectAll(input) {
    const detections = [];
    
    const checks = [
      this.detectSQLInjection,
      this.detectXSS,
      this.detectCommandInjection,
      this.detectPathTraversal,
      this.detectLDAPInjection,
      this.detectXMLInjection
    ];
    
    for (const check of checks) {
      const result = check(input);
      if (result.detected) {
        detections.push(result);
      }
    }
    
    return {
      detected: detections.length > 0,
      attacks: detections,
      count: detections.length
    };
  }
}

/**
 * Security Scanner
 * Simulates vulnerability scanning
 */
class SecurityScanner {
  constructor() {
    this.vulnerabilities = [];
  }

  /**
   * Scan for SQL injection vulnerabilities
   */
  scanSQLInjection(endpoints) {
    const vulnerable = [];
    
    for (const endpoint of endpoints) {
      // Simulate testing
      const testInputs = [
        "admin' OR '1'='1",
        "'; DROP TABLE users--",
        "1' UNION SELECT * FROM users--"
      ];
      
      for (const testInput of testInputs) {
        const detection = AttackDetector.detectSQLInjection(testInput);
        if (detection.detected) {
          vulnerable.push({
            endpoint,
            vulnerability: 'SQL Injection',
            severity: 'HIGH',
            testInput: testInput.substring(0, 50)
          });
        }
      }
    }
    
    return vulnerable;
  }

  /**
   * Scan for XSS vulnerabilities
   */
  scanXSS(endpoints) {
    const vulnerable = [];
    
    for (const endpoint of endpoints) {
      const testInputs = [
        '<script>alert("XSS")</script>',
        '<img src=x onerror=alert("XSS")>',
        '<svg onload=alert("XSS")>'
      ];
      
      for (const testInput of testInputs) {
        const detection = AttackDetector.detectXSS(testInput);
        if (detection.detected) {
          vulnerable.push({
            endpoint,
            vulnerability: 'Cross-Site Scripting',
            severity: 'HIGH',
            testInput: testInput.substring(0, 50)
          });
        }
      }
    }
    
    return vulnerable;
  }

  /**
   * Comprehensive scan
   */
  scan(endpoints) {
    const results = {
      sqlInjection: this.scanSQLInjection(endpoints),
      xss: this.scanXSS(endpoints),
      timestamp: Date.now()
    };
    
    const totalVulnerabilities = results.sqlInjection.length + results.xss.length;
    
    return {
      ...results,
      totalVulnerabilities,
      riskLevel: totalVulnerabilities > 5 ? 'HIGH' : 
                 totalVulnerabilities > 2 ? 'MEDIUM' : 'LOW'
    };
  }
}

/**
 * Threat Model
 */
class ThreatModel {
  constructor() {
    this.threats = [];
  }

  /**
   * Add threat using STRIDE model
   */
  addThreat(component, threatType, description, mitigation) {
    this.threats.push({
      component,
      threatType, // Spoofing, Tampering, Repudiation, Information Disclosure, DoS, Elevation
      description,
      mitigation,
      severity: this.calculateSeverity(threatType),
      timestamp: Date.now()
    });
  }

  /**
   * Calculate severity using DREAD
   */
  calculateSeverity(threatType) {
    const severityMap = {
      'Spoofing': 'MEDIUM',
      'Tampering': 'HIGH',
      'Repudiation': 'LOW',
      'Information Disclosure': 'HIGH',
      'DoS': 'MEDIUM',
      'Elevation': 'CRITICAL'
    };
    
    return severityMap[threatType] || 'MEDIUM';
  }

  /**
   * Get threats by component
   */
  getThreatsByComponent(component) {
    return this.threats.filter(t => t.component === component);
  }

  /**
   * Get all threats
   */
  getAllThreats() {
    return this.threats;
  }
}

// Example usage
function demonstrateAttackVectors() {
  console.log('=== Attack Vector Detection ===\n');
  
  // Test various attack inputs
  const testInputs = [
    "admin' OR '1'='1",
    '<script>alert("XSS")</script>',
    '../../etc/passwd',
    '; rm -rf /',
    'normal input'
  ];
  
  for (const input of testInputs) {
    const detection = AttackDetector.detectAll(input);
    if (detection.detected) {
      console.log(`Input: ${input.substring(0, 30)}...`);
      console.log('Detected attacks:', detection.attacks);
      console.log('');
    }
  }
  
  console.log('=== Security Scanning ===\n');
  const scanner = new SecurityScanner();
  const endpoints = ['/api/users', '/api/products', '/api/orders'];
  const scanResults = scanner.scan(endpoints);
  console.log('Scan results:', scanResults);
  
  console.log('\n=== Threat Modeling ===\n');
  const threatModel = new ThreatModel();
  threatModel.addThreat(
    'Authentication Service',
    'Spoofing',
    'Attacker may impersonate users',
    'Implement MFA and strong password policies'
  );
  threatModel.addThreat(
    'Database',
    'Information Disclosure',
    'SQL injection may expose sensitive data',
    'Use parameterized queries and input validation'
  );
  threatModel.addThreat(
    'API Gateway',
    'DoS',
    'DDoS attacks may overwhelm the system',
    'Implement rate limiting and DDoS protection'
  );
  
  console.log('Threats identified:', threatModel.getAllThreats());
}

if (require.main === module) {
  demonstrateAttackVectors();
}

module.exports = { AttackDetector, SecurityScanner, ThreatModel };

