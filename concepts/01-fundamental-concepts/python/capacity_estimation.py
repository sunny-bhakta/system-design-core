"""
Capacity Estimation
Demonstrates how to estimate system capacity requirements
"""
from typing import Dict, Any


class CapacityEstimator:
    """Capacity estimation utilities"""
    
    @staticmethod
    def estimate_traffic(daily_active_users: int, requests_per_user_per_day: int, 
                        peak_multiplier: float = 2) -> Dict[str, Any]:
        """Estimate traffic capacity"""
        total_requests_per_day = daily_active_users * requests_per_user_per_day
        peak_requests_per_day = total_requests_per_day * peak_multiplier
        peak_qps = peak_requests_per_day / (24 * 3600)
        
        return {
            'daily_active_users': daily_active_users,
            'requests_per_user_per_day': requests_per_user_per_day,
            'total_requests_per_day': total_requests_per_day,
            'peak_requests_per_day': peak_requests_per_day,
            'peak_qps': int(peak_qps),
            'average_qps': int(total_requests_per_day / (24 * 3600))
        }
    
    @staticmethod
    def estimate_storage(num_users: int, data_per_user_mb: float, 
                         retention_years: int, replication_factor: int = 3) -> Dict[str, Any]:
        """Estimate storage capacity"""
        total_storage_gb = (num_users * data_per_user_mb) / 1024
        storage_with_retention = total_storage_gb * retention_years
        storage_with_replication = storage_with_retention * replication_factor
        
        return {
            'num_users': num_users,
            'data_per_user_mb': data_per_user_mb,
            'total_storage_gb': round(total_storage_gb, 2),
            'retention_years': retention_years,
            'storage_with_retention_gb': round(storage_with_retention, 2),
            'replication_factor': replication_factor,
            'total_storage_with_replication_gb': round(storage_with_replication, 2),
            'total_storage_with_replication_tb': round(storage_with_replication / 1024, 2)
        }
    
    @staticmethod
    def estimate_bandwidth(requests_per_second: int, avg_response_size_kb: float) -> Dict[str, Any]:
        """Estimate bandwidth requirements"""
        bandwidth_mbps = (requests_per_second * avg_response_size_kb) / 1024
        bandwidth_gbps = bandwidth_mbps / 1024
        
        return {
            'requests_per_second': requests_per_second,
            'avg_response_size_kb': avg_response_size_kb,
            'bandwidth_mbps': round(bandwidth_mbps, 2),
            'bandwidth_gbps': round(bandwidth_gbps, 4),
            'bandwidth_per_day_gb': round(bandwidth_mbps * 86400 / 1024, 2)
        }
    
    @staticmethod
    def estimate_cache(requests_per_second: int, cache_hit_rate: float, 
                      avg_object_size_kb: float, ttl_seconds: int = 3600) -> Dict[str, Any]:
        """Estimate cache requirements"""
        cache_requests_per_second = requests_per_second * cache_hit_rate
        objects_in_cache = cache_requests_per_second * ttl_seconds
        cache_size_gb = (objects_in_cache * avg_object_size_kb) / (1024 * 1024)
        
        return {
            'requests_per_second': requests_per_second,
            'cache_hit_rate': f'{cache_hit_rate * 100:.2f}%',
            'avg_object_size_kb': avg_object_size_kb,
            'ttl_seconds': ttl_seconds,
            'objects_in_cache': int(objects_in_cache),
            'cache_size_gb': round(cache_size_gb, 2),
            'cache_size_mb': round(cache_size_gb * 1024, 2)
        }
    
    @staticmethod
    def estimate_database_connections(peak_qps: int, avg_query_time_ms: float, 
                                     connection_pool_size: int = 10) -> Dict[str, Any]:
        """Estimate database connection requirements"""
        concurrent_queries = (peak_qps * avg_query_time_ms) / 1000
        required_connections = int(concurrent_queries) + 1
        recommended_pool_size = max(int(required_connections * 1.5), connection_pool_size)
        
        return {
            'peak_qps': peak_qps,
            'avg_query_time_ms': avg_query_time_ms,
            'concurrent_queries': round(concurrent_queries, 2),
            'required_connections': required_connections,
            'recommended_pool_size': recommended_pool_size
        }
    
    @staticmethod
    def comprehensive_estimation(config: Dict[str, Any]) -> Dict[str, Any]:
        """Comprehensive capacity estimation"""
        traffic = CapacityEstimator.estimate_traffic(
            config['daily_active_users'],
            config['requests_per_user_per_day'],
            config.get('peak_multiplier', 2)
        )
        
        storage = CapacityEstimator.estimate_storage(
            config['num_users'],
            config['data_per_user_mb'],
            config['retention_years'],
            config.get('replication_factor', 3)
        )
        
        bandwidth = CapacityEstimator.estimate_bandwidth(
            traffic['peak_qps'],
            config['avg_response_size_kb']
        )
        
        cache = CapacityEstimator.estimate_cache(
            traffic['peak_qps'],
            config['cache_hit_rate'],
            config['avg_object_size_kb'],
            config.get('cache_ttl_seconds', 3600)
        )
        
        database = CapacityEstimator.estimate_database_connections(
            traffic['peak_qps'],
            config['avg_query_time_ms'],
            config.get('connection_pool_size', 10)
        )
        
        return {
            'traffic': traffic,
            'storage': storage,
            'bandwidth': bandwidth,
            'cache': cache,
            'database': database,
            'summary': {
                'peak_qps': traffic['peak_qps'],
                'total_storage_tb': storage['total_storage_with_replication_tb'],
                'bandwidth_gbps': bandwidth['bandwidth_gbps'],
                'cache_size_gb': cache['cache_size_gb'],
                'db_connections': database['recommended_pool_size']
            }
        }


if __name__ == '__main__':
    config = {
        'daily_active_users': 1000000,
        'requests_per_user_per_day': 10,
        'peak_multiplier': 2,
        'num_users': 1000000,
        'data_per_user_mb': 1,
        'retention_years': 5,
        'replication_factor': 3,
        'avg_response_size_kb': 50,
        'cache_hit_rate': 0.8,
        'avg_object_size_kb': 10,
        'cache_ttl_seconds': 3600,
        'avg_query_time_ms': 50,
        'connection_pool_size': 10
    }
    
    print('=== Capacity Estimation ===\n')
    import json
    estimation = CapacityEstimator.comprehensive_estimation(config)
    print(json.dumps(estimation, indent=2))

