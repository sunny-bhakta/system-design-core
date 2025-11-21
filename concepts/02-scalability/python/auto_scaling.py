"""
Auto-scaling Implementation
Demonstrates horizontal and vertical auto-scaling strategies
"""
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import datetime
import time


@dataclass
class Instance:
    """Instance representation"""
    id: str
    created_at: float
    metrics: Dict[str, float] = field(default_factory=lambda: {'cpu': 0, 'memory': 0, 'requests': 0})


class HorizontalAutoScaler:
    """Horizontal auto-scaler implementation"""
    
    def __init__(self, config: Dict[str, Any]):
        self.min_instances = config.get('min_instances', 1)
        self.max_instances = config.get('max_instances', 10)
        self.target_cpu = config.get('target_cpu', 70)
        self.target_memory = config.get('target_memory', 80)
        self.scale_up_threshold = config.get('scale_up_threshold', 80)
        self.scale_down_threshold = config.get('scale_down_threshold', 30)
        self.cooldown_period = config.get('cooldown_period', 300.0)  # 5 minutes
        
        self.instances: List[Instance] = []
        self.last_scale_time = time.time()
        self.scaling_history: List[Dict] = []
        
        # Initialize with minimum instances
        self._initialize()
    
    def _initialize(self):
        """Initialize with minimum instances"""
        for _ in range(self.min_instances):
            self._add_instance()
    
    def _add_instance(self) -> Instance:
        """Add new instance"""
        instance = Instance(
            id=f'instance-{time.time()}-{id(self)}',
            created_at=time.time()
        )
        
        self.instances.append(instance)
        print(f"Added instance: {instance.id} (Total: {len(self.instances)})")
        
        return instance
    
    def _remove_instance(self) -> Optional[Instance]:
        """Remove instance"""
        if len(self.instances) <= self.min_instances:
            return None
        
        # Remove instance with lowest load
        sorted_instances = sorted(
            self.instances,
            key=lambda inst: (inst.metrics['cpu'] + inst.metrics['memory']) / 2
        )
        
        to_remove = sorted_instances[0]
        self.instances.remove(to_remove)
        
        print(f"Removed instance: {to_remove.id} (Total: {len(self.instances)})")
        return to_remove
    
    def update_metrics(self, instance_id: str, metrics: Dict[str, float]):
        """Update instance metrics"""
        instance = next((inst for inst in self.instances if inst.id == instance_id), None)
        if instance:
            instance.metrics.update(metrics)
    
    def get_average_metrics(self) -> Dict[str, float]:
        """Calculate average metrics"""
        if not self.instances:
            return {'cpu': 0, 'memory': 0, 'requests': 0}
        
        totals = {'cpu': 0, 'memory': 0, 'requests': 0}
        for inst in self.instances:
            totals['cpu'] += inst.metrics['cpu']
            totals['memory'] += inst.metrics['memory']
            totals['requests'] += inst.metrics['requests']
        
        count = len(self.instances)
        return {
            'cpu': totals['cpu'] / count,
            'memory': totals['memory'] / count,
            'requests': totals['requests'] / count
        }
    
    def check_scaling(self) -> Dict[str, Any]:
        """Check if scaling is needed"""
        now = time.time()
        
        # Cooldown period check
        if now - self.last_scale_time < self.cooldown_period:
            return {'action': 'none', 'reason': 'cooldown'}
        
        avg_metrics = self.get_average_metrics()
        
        # Scale up conditions
        if len(self.instances) < self.max_instances:
            if (avg_metrics['cpu'] > self.scale_up_threshold or
                avg_metrics['memory'] > self.scale_up_threshold):
                return {'action': 'scale-up', 'metrics': avg_metrics}
        
        # Scale down conditions
        if len(self.instances) > self.min_instances:
            if (avg_metrics['cpu'] < self.scale_down_threshold and
                avg_metrics['memory'] < self.scale_down_threshold):
                return {'action': 'scale-down', 'metrics': avg_metrics}
        
        return {'action': 'none', 'metrics': avg_metrics}
    
    def execute_scaling(self) -> Dict[str, Any]:
        """Execute scaling decision"""
        decision = self.check_scaling()
        
        if decision['action'] == 'scale-up':
            instance = self._add_instance()
            self.last_scale_time = time.time()
            self.scaling_history.append({
                'action': 'scale-up',
                'timestamp': time.time(),
                'instance_count': len(self.instances),
                'metrics': decision['metrics']
            })
            return {'action': 'scaled-up', 'instance': instance}
        
        if decision['action'] == 'scale-down':
            instance = self._remove_instance()
            if instance:
                self.last_scale_time = time.time()
                self.scaling_history.append({
                    'action': 'scale-down',
                    'timestamp': time.time(),
                    'instance_count': len(self.instances),
                    'metrics': decision['metrics']
                })
                return {'action': 'scaled-down', 'instance': instance}
        
        return {'action': 'no-action', 'decision': decision}
    
    def get_state(self) -> Dict[str, Any]:
        """Get current state"""
        return {
            'instance_count': len(self.instances),
            'min_instances': self.min_instances,
            'max_instances': self.max_instances,
            'average_metrics': self.get_average_metrics(),
            'scaling_history': self.scaling_history[-10:]  # Last 10 scaling events
        }


class PredictiveAutoScaler(HorizontalAutoScaler):
    """Predictive auto-scaler implementation"""
    
    def __init__(self, config: Dict[str, Any]):
        super().__init__(config)
        self.history: List[Dict] = []
        self.prediction_window = config.get('prediction_window', 300.0)  # 5 minutes
    
    def record_metrics(self):
        """Record metrics history"""
        avg_metrics = self.get_average_metrics()
        self.history.append({
            'timestamp': time.time(),
            **avg_metrics,
            'instance_count': len(self.instances)
        })
        
        # Keep only last hour of history
        one_hour_ago = time.time() - 3600
        self.history = [h for h in self.history if h['timestamp'] > one_hour_ago]
    
    def predict_load(self) -> Optional[Dict[str, float]]:
        """Predict future load"""
        if len(self.history) < 10:
            return None  # Not enough data
        
        # Simple linear regression for prediction
        recent = self.history[-10:]
        cpu_trend = self._calculate_trend([h['cpu'] for h in recent])
        memory_trend = self._calculate_trend([h['memory'] for h in recent])
        
        predicted_cpu = recent[-1]['cpu'] + cpu_trend * (self.prediction_window / 60)
        predicted_memory = recent[-1]['memory'] + memory_trend * (self.prediction_window / 60)
        
        return {
            'predicted_cpu': max(0, min(100, predicted_cpu)),
            'predicted_memory': max(0, min(100, predicted_memory)),
            'cpu_trend': cpu_trend,
            'memory_trend': memory_trend
        }
    
    def _calculate_trend(self, values: List[float]) -> float:
        """Calculate trend (simple linear regression slope)"""
        n = len(values)
        sum_x = (n * (n - 1)) / 2
        sum_y = sum(values)
        sum_xy = sum(x * y for x, y in enumerate(values))
        sum_x2 = (n * (n - 1) * (2 * n - 1)) / 6
        
        slope = (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x * sum_x)
        return slope
    
    def predictive_scaling(self) -> Dict[str, Any]:
        """Predictive scaling check"""
        self.record_metrics()
        prediction = self.predict_load()
        
        if not prediction:
            return self.check_scaling()
        
        # Scale up if predicted load is high
        if len(self.instances) < self.max_instances:
            if (prediction['predicted_cpu'] > self.scale_up_threshold or
                prediction['predicted_memory'] > self.scale_up_threshold):
                return {
                    'action': 'predictive-scale-up',
                    'prediction': prediction,
                    'reason': 'predicted high load'
                }
        
        return self.check_scaling()


def demonstrate_auto_scaling():
    """Demonstrate auto-scaling"""
    print('=== Horizontal Auto-scaling ===\n')
    
    scaler = HorizontalAutoScaler({
        'min_instances': 2,
        'max_instances': 5,
        'target_cpu': 70,
        'scale_up_threshold': 80,
        'scale_down_threshold': 30,
        'cooldown_period': 60.0  # 1 minute for demo
    })
    
    print('Initial state:', scaler.get_state())
    
    # Simulate high load
    print('\nSimulating high load...')
    for inst in scaler.instances:
        scaler.update_metrics(inst.id, {'cpu': 85, 'memory': 90, 'requests': 1000})
    
    scale_up = scaler.execute_scaling()
    print('Scaling decision:', scale_up)
    print('State after scaling:', scaler.get_state())
    
    # Simulate low load
    print('\nSimulating low load...')
    for inst in scaler.instances:
        scaler.update_metrics(inst.id, {'cpu': 20, 'memory': 25, 'requests': 100})
    
    scale_down = scaler.execute_scaling()
    print('Scaling decision:', scale_down)
    print('State after scaling:', scaler.get_state())
    
    print('\n=== Predictive Auto-scaling ===\n')
    predictive_scaler = PredictiveAutoScaler({
        'min_instances': 2,
        'max_instances': 5,
        'scale_up_threshold': 80,
        'prediction_window': 300.0
    })
    
    # Record some history
    for i in range(15):
        for inst in predictive_scaler.instances:
            predictive_scaler.update_metrics(inst.id, {
                'cpu': 50 + i * 3,
                'memory': 60 + i * 2,
                'requests': 500 + i * 50
            })
        predictive_scaler.record_metrics()
    
    prediction = predictive_scaler.predict_load()
    print('Load prediction:', prediction)


if __name__ == '__main__':
    demonstrate_auto_scaling()

