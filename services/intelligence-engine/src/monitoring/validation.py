"""Validation script to ensure all Grafana dashboard metrics are properly implemented."""

import json
import re
from typing import List, Dict, Set
from pathlib import Path

# Expected metrics from Grafana dashboard
DASHBOARD_METRICS = [
    "rankmybrand_http_requests_total",
    "rankmybrand_geo_score_value", 
    "rankmybrand_active_connections",
    "rankmybrand_http_request_duration_seconds",
    "rankmybrand_onboarding_funnel",
    "rankmybrand_cache_hit_rate",
    "rankmybrand_api_errors_total",
    "rankmybrand_llm_api_calls_total"
]

# Expected Prometheus queries from dashboard
DASHBOARD_QUERIES = [
    "rate(rankmybrand_http_requests_total[5m])",
    "avg(rankmybrand_geo_score_value)",
    "rankmybrand_active_connections",
    "histogram_quantile(0.95, sum(rate(rankmybrand_http_request_duration_seconds_bucket[5m])) by (le, route))",
    "sum(rankmybrand_onboarding_funnel) by (stage)",
    "avg(rankmybrand_cache_hit_rate)",
    "rate(rankmybrand_api_errors_total[5m])",
    "sum(rate(rankmybrand_llm_api_calls_total[5m])) by (provider, model)"
]


def extract_metrics_from_dashboard(dashboard_path: str) -> Set[str]:
    """Extract metric names from Grafana dashboard JSON."""
    metrics = set()
    
    try:
        with open(dashboard_path, 'r') as f:
            dashboard = json.load(f)
        
        # Extract metrics from all panels
        for panel in dashboard.get('panels', []):
            targets = panel.get('targets', [])
            for target in targets:
                expr = target.get('expr', '')
                if expr:
                    # Extract metric names using regex
                    metric_matches = re.findall(r'rankmybrand_[a-zA-Z0-9_]+', expr)
                    metrics.update(metric_matches)
    
    except Exception as e:
        print(f"Error reading dashboard: {e}")
    
    return metrics


def extract_metrics_from_code(metrics_file: str) -> Set[str]:
    """Extract metric names from metrics.py file."""
    metrics = set()
    
    try:
        with open(metrics_file, 'r') as f:
            content = f.read()
        
        # Extract metric definitions
        metric_matches = re.findall(r'rankmybrand_[a-zA-Z0-9_]+ = (?:Counter|Histogram|Gauge|Info)', content)
        for match in metric_matches:
            metric_name = match.split(' = ')[0]
            metrics.add(metric_name)
    
    except Exception as e:
        print(f"Error reading metrics file: {e}")
    
    return metrics


def validate_metric_implementation() -> Dict[str, any]:
    """Validate that all dashboard metrics are properly implemented."""
    
    # Paths
    dashboard_path = "/Users/sawai/Desktop/rankmybrand.ai/monitoring/grafana/dashboards/rankmybrand-overview.json"
    metrics_path = "/Users/sawai/Desktop/rankmybrand.ai/services/intelligence-engine/src/monitoring/metrics.py"
    
    # Extract metrics
    dashboard_metrics = extract_metrics_from_dashboard(dashboard_path)
    implemented_metrics = extract_metrics_from_code(metrics_path)
    
    # Find missing and extra metrics
    missing_metrics = dashboard_metrics - implemented_metrics
    extra_metrics = implemented_metrics - dashboard_metrics
    matching_metrics = dashboard_metrics & implemented_metrics
    
    validation_result = {
        "status": "PASS" if len(missing_metrics) == 0 else "FAIL",
        "dashboard_metrics": sorted(list(dashboard_metrics)),
        "implemented_metrics": sorted(list(implemented_metrics)),
        "matching_metrics": sorted(list(matching_metrics)),
        "missing_metrics": sorted(list(missing_metrics)),
        "extra_metrics": sorted(list(extra_metrics)),
        "summary": {
            "total_dashboard_metrics": len(dashboard_metrics),
            "total_implemented_metrics": len(implemented_metrics),
            "matching_count": len(matching_metrics),
            "missing_count": len(missing_metrics),
            "extra_count": len(extra_metrics)
        }
    }
    
    return validation_result


def validate_metric_types() -> Dict[str, str]:
    """Validate that metric types match expected dashboard usage."""
    
    # Expected metric types based on dashboard usage
    expected_types = {
        "rankmybrand_http_requests_total": "Counter",
        "rankmybrand_geo_score_value": "Gauge", 
        "rankmybrand_active_connections": "Gauge",
        "rankmybrand_http_request_duration_seconds": "Histogram",
        "rankmybrand_onboarding_funnel": "Gauge",
        "rankmybrand_cache_hit_rate": "Gauge",
        "rankmybrand_api_errors_total": "Counter",
        "rankmybrand_llm_api_calls_total": "Counter"
    }
    
    metrics_path = "/Users/sawai/Desktop/rankmybrand.ai/services/intelligence-engine/src/monitoring/metrics.py"
    
    type_validation = {}
    
    try:
        with open(metrics_path, 'r') as f:
            content = f.read()
        
        for metric_name, expected_type in expected_types.items():
            # Look for metric definition
            pattern = f"{metric_name} = {expected_type}\\("
            if re.search(pattern, content):
                type_validation[metric_name] = "CORRECT"
            else:
                # Check if metric exists with different type
                if metric_name in content:
                    type_validation[metric_name] = "WRONG_TYPE"
                else:
                    type_validation[metric_name] = "MISSING"
    
    except Exception as e:
        print(f"Error validating metric types: {e}")
    
    return type_validation


def validate_metric_labels() -> Dict[str, List[str]]:
    """Validate that metrics have expected labels for dashboard queries."""
    
    expected_labels = {
        "rankmybrand_http_requests_total": ["method", "route", "status_code"],
        "rankmybrand_geo_score_value": ["brand", "platform"],
        "rankmybrand_active_connections": [],
        "rankmybrand_http_request_duration_seconds": ["method", "route"],
        "rankmybrand_onboarding_funnel": ["stage"],
        "rankmybrand_cache_hit_rate": [],
        "rankmybrand_api_errors_total": ["endpoint", "error_type", "status_code"],
        "rankmybrand_llm_api_calls_total": ["provider", "model", "status"]
    }
    
    metrics_path = "/Users/sawai/Desktop/rankmybrand.ai/services/intelligence-engine/src/monitoring/metrics.py"
    
    label_validation = {}
    
    try:
        with open(metrics_path, 'r') as f:
            content = f.read()
        
        for metric_name, expected_labels_list in expected_labels.items():
            # Extract labels from metric definition
            pattern = f"{metric_name} = [^\\n]*\\[([^\\]]+)\\]"
            match = re.search(pattern, content)
            
            if match:
                labels_str = match.group(1)
                # Extract label names from string
                labels = re.findall(r"'([^']+)'", labels_str)
                
                missing_labels = set(expected_labels_list) - set(labels)
                extra_labels = set(labels) - set(expected_labels_list)
                
                if not missing_labels and not extra_labels:
                    label_validation[metric_name] = "CORRECT"
                else:
                    label_validation[metric_name] = {
                        "status": "MISMATCH",
                        "expected": expected_labels_list,
                        "actual": labels,
                        "missing": list(missing_labels),
                        "extra": list(extra_labels)
                    }
            else:
                label_validation[metric_name] = "NOT_FOUND"
    
    except Exception as e:
        print(f"Error validating metric labels: {e}")
    
    return label_validation


def run_full_validation() -> Dict[str, any]:
    """Run complete validation of metrics implementation."""
    
    print("🔍 Running RankMyBrand Metrics Validation...")
    print("=" * 50)
    
    # Validate metric implementation
    print("1. Validating metric implementation...")
    implementation_result = validate_metric_implementation()
    
    if implementation_result["status"] == "PASS":
        print("✅ All dashboard metrics are implemented!")
    else:
        print("❌ Some dashboard metrics are missing!")
        if implementation_result["missing_metrics"]:
            print(f"   Missing: {', '.join(implementation_result['missing_metrics'])}")
    
    print(f"   Metrics matched: {implementation_result['summary']['matching_count']}")
    print(f"   Extra metrics: {implementation_result['summary']['extra_count']}")
    
    # Validate metric types
    print("\n2. Validating metric types...")
    type_result = validate_metric_types()
    
    correct_types = sum(1 for status in type_result.values() if status == "CORRECT")
    total_types = len(type_result)
    
    if correct_types == total_types:
        print("✅ All metric types are correct!")
    else:
        print(f"⚠️  {total_types - correct_types} metrics have incorrect types")
        for metric, status in type_result.items():
            if status != "CORRECT":
                print(f"   {metric}: {status}")
    
    # Validate metric labels
    print("\n3. Validating metric labels...")
    label_result = validate_metric_labels()
    
    correct_labels = sum(1 for status in label_result.values() if status == "CORRECT")
    total_labels = len(label_result)
    
    if correct_labels == total_labels:
        print("✅ All metric labels are correct!")
    else:
        print(f"⚠️  {total_labels - correct_labels} metrics have incorrect labels")
        for metric, status in label_result.items():
            if status != "CORRECT":
                print(f"   {metric}: {status}")
    
    print("\n" + "=" * 50)
    print("📊 Validation Summary")
    print("=" * 50)
    
    overall_status = "PASS"
    if (implementation_result["status"] != "PASS" or 
        correct_types != total_types or 
        correct_labels != total_labels):
        overall_status = "NEEDS_ATTENTION"
    
    summary = {
        "overall_status": overall_status,
        "implementation": implementation_result,
        "types": type_result,
        "labels": label_result,
        "recommendations": []
    }
    
    # Generate recommendations
    if implementation_result["missing_metrics"]:
        summary["recommendations"].append(
            f"Implement missing metrics: {', '.join(implementation_result['missing_metrics'])}"
        )
    
    if correct_types != total_types:
        summary["recommendations"].append(
            "Fix metric types to match dashboard expectations"
        )
    
    if correct_labels != total_labels:
        summary["recommendations"].append(
            "Update metric labels to match dashboard queries"
        )
    
    if not summary["recommendations"]:
        summary["recommendations"].append("All metrics are properly configured! 🎉")
    
    print(f"Status: {overall_status}")
    print("\nRecommendations:")
    for rec in summary["recommendations"]:
        print(f"  • {rec}")
    
    return summary


if __name__ == "__main__":
    validation_result = run_full_validation()
    
    # Export validation result
    with open("metrics_validation_report.json", "w") as f:
        json.dump(validation_result, f, indent=2)
    
    print(f"\n📋 Full validation report saved to metrics_validation_report.json")