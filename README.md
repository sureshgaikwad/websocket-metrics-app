# WebSocket Metrics Application for OpenShift

This repository contains a Node.js WebSocket application that exposes Prometheus metrics for monitoring and can be deployed on OpenShift with Horizontal Pod Autoscaler (HPA) based on custom metrics.

## Application Overview

The application provides:

1. WebSocket server for real-time communication
2. Custom Prometheus metrics for monitoring WebSocket connections and performance
3. Simple web client for testing WebSocket functionality
4. OpenShift deployment configurations with Horizontal Pod Autoscaling

## Custom Metrics

The application exposes the following Prometheus metrics:

- `websocket_connections_total`: Gauge tracking the number of active WebSocket connections
- `websocket_messages_total`: Counter tracking the number of WebSocket messages (with "type" label)
- `websocket_message_latency_seconds`: Histogram tracking the latency of WebSocket message processing

## Deployment to OpenShift

### Prerequisites

- OpenShift CLI (`oc`) installed and configured
- Access to an OpenShift cluster
- Git repository containing this code

### Deployment Steps

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/websocket-metrics-app.git
   cd websocket-metrics-app
   ```

2. **Create a new project in OpenShift**

   ```bash
   oc new-project websocket-metrics-demo
   ```

3. **Create the ImageStream and BuildConfig**

   ```bash
   oc create -f imagestream.yaml
   oc create -f buildconfig.yaml
   ```

4. **Set the Git repository URL in the BuildConfig**

   ```bash
   oc set env bc/websocket-metrics-app GIT_REPOSITORY_URL=https://github.com/yourusername/websocket-metrics-app.git
   ```

5. **Start the build**

   ```bash
   oc start-build websocket-metrics-app
   ```

6. **Deploy the application**

   ```bash
   oc create -f deployment.yaml
   oc create -f service.yaml
   oc create -f route.yaml
   ```

7. **Configure Prometheus monitoring**

   ```bash
   oc create -f servicemonitor.yaml
   oc create -f prometheusrule.yaml
   ```

8. **Configure Horizontal Pod Autoscaler**

   ```bash
   oc create -f horizontalpodautoscaler.yaml
   ```

9. **Verify the deployment**

   ```bash
   oc get pods
   oc get svc
   oc get route
   oc get hpa
   ```

## Architecture Diagram

```
┌─────────────────────────────┐
│    OpenShift Route (TLS)    │
└───────────────┬─────────────┘
                │
┌───────────────▼─────────────┐
│        OpenShift Service    │
└───────────────┬─────────────┘
                │
┌───────────────▼─────────────┐
│     Pods (Autoscaled by HPA)│
│  ┌─────────────────────────┐│
│  │ WebSocket Server        ││
│  │                         ││
│  │ ┌─────────────────────┐ ││
│  │ │  Express Server     │ ││
│  │ └─────────────────────┘ ││
│  │                         ││
│  │ ┌─────────────────────┐ ││
│  │ │  Prometheus Metrics │ ││
│  │ └─────────────────────┘ ││
│  └─────────────────────────┘│
└─────────────────────────────┘
          │            ▲
          │            │
┌─────────▼────────────────────┐
│   OpenShift Prometheus       │
│  ┌─────────────────────────┐ │
│  │ ServiceMonitor          │ │
│  └─────────────────────────┘ │
│  ┌─────────────────────────┐ │
│  │ PrometheusRule (Alerts) │ │
│  └─────────────────────────┘ │
└─────────────────────────────┘
                │
┌───────────────▼─────────────┐
│  Horizontal Pod Autoscaler  │
│  (Based on custom metrics)  │
└─────────────────────────────┘
```

## Testing the Application

1. Access the application using the OpenShift route URL:

   ```bash
   oc get route websocket-metrics-app -o jsonpath='{.spec.host}'
   ```

2. Open the URL in a web browser to use the WebSocket test client

3. Use the "Run Load Test" button to generate WebSocket traffic

4. Check the metrics endpoint:

   ```
   https://<route-url>/metrics
   ```

5. Monitor the HPA scaling:

   ```bash
   oc get hpa websocket-metrics-app -w
   ```

## Troubleshooting

### Checking Metrics Collection

Verify that Prometheus is scraping metrics from your application:

```bash
oc exec -it $(oc get pods -l app.kubernetes.io/name=prometheus -n openshift-monitoring -o name | head -1) -n openshift-monitoring -- curl -s http://websocket-metrics-app.websocket-metrics-demo.svc:8080/metrics
```

### Checking HPA Status

```bash
oc describe hpa websocket-metrics-app
```

### Viewing Logs

```bash
oc logs -f $(oc get pods -l app=websocket-metrics-app -o name | head -1)
```

## Additional Resources

- [Prometheus Node.js Client](https://github.com/siimon/prom-client)
- [OpenShift Monitoring Documentation](https://docs.openshift.com/container-platform/4.11/monitoring/monitoring-overview.html)
- [Horizontal Pod Autoscaling](https://docs.openshift.com/container-platform/4.11/nodes/pods/nodes-pods-autoscaling.html)
