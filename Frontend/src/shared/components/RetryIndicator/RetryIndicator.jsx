/**
 * RetryIndicator Component
 * 
 * Provides visual feedback for retry operations including:
 * - Loading states with retry attempt count
 * - Network connectivity status
 * - Circuit breaker status
 * - Operation cancellation controls
 * - Progress indicators for bulk operations
 */

import React, { useState, useEffect } from 'react';
import { Alert, Progress, Button, Group, Text, Badge, LoadingOverlay, Stack, ActionIcon, Tooltip } from '@mantine/core';
import { IconWifi, IconWifiOff, IconAlertTriangle, IconX, IconRefresh, IconCircuitSwitchClosed, IconCircuitSwitchOpen } from '@tabler/icons-react';
import indexedDBRetry from '../../services/IndexedDBRetryService.js';
import styles from './RetryIndicator.module.css';

/**
 * Main retry indicator component
 */
export function RetryIndicator({ 
  isActive = false,
  operation = null,
  onCancel = null,
  showNetworkStatus = true,
  showCircuitBreaker = true,
  className = '',
  size = 'md'
}) {
  const [networkStatus, setNetworkStatus] = useState(indexedDBRetry.getNetworkStatus());
  const [circuitBreakerStatus, setCircuitBreakerStatus] = useState(indexedDBRetry.getCircuitBreakerStatus());
  const [activeRequests, setActiveRequests] = useState(indexedDBRetry.getActiveRequestsCount());

  // Update status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setCircuitBreakerStatus(indexedDBRetry.getCircuitBreakerStatus());
      setActiveRequests(indexedDBRetry.getActiveRequestsCount());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Listen for network changes
  useEffect(() => {
    const handleNetworkChange = (isOnline) => {
      setNetworkStatus(isOnline);
    };

    indexedDBRetry.addNetworkListener(handleNetworkChange);

    return () => {
      indexedDBRetry.removeNetworkListener(handleNetworkChange);
    };
  }, []);

  if (!isActive && networkStatus && circuitBreakerStatus.isHealthy) {
    return null; // Don't show anything if everything is working normally
  }

  return (
    <div className={`${styles.retryIndicator} ${className}`}>
      <Stack spacing="xs">
        {/* Network Status */}
        {showNetworkStatus && (
          <NetworkStatusIndicator 
            isOnline={networkStatus}
            size={size}
          />
        )}

        {/* Circuit Breaker Status */}
        {showCircuitBreaker && !circuitBreakerStatus.isHealthy && (
          <CircuitBreakerIndicator 
            status={circuitBreakerStatus}
            size={size}
          />
        )}

        {/* Active Operation */}
        {isActive && operation && (
          <OperationIndicator
            operation={operation}
            onCancel={onCancel}
            size={size}
          />
        )}

        {/* Active Requests Count */}
        {activeRequests > 0 && (
          <ActiveRequestsIndicator
            count={activeRequests}
            size={size}
          />
        )}
      </Stack>
    </div>
  );
}

/**
 * Network connectivity status indicator
 */
function NetworkStatusIndicator({ isOnline, size }) {
  if (isOnline) {
    return (
      <Alert 
        icon={<IconWifi size={16} />}
        color="green"
        variant="light"
        size={size}
      >
        <Text size="sm">Network connected</Text>
      </Alert>
    );
  }

  return (
    <Alert 
      icon={<IconWifiOff size={16} />}
      color="red"
      variant="filled"
      size={size}
    >
      <Text size="sm" color="white">
        Network offline - Some operations may fail
      </Text>
    </Alert>
  );
}

/**
 * Circuit breaker status indicator
 */
function CircuitBreakerIndicator({ status, size }) {
  const getStatusColor = () => {
    if (status.isOpen) return 'red';
    if (status.failures > 0) return 'yellow';
    return 'green';
  };

  const getStatusText = () => {
    if (status.isOpen) return 'Database operations temporarily disabled';
    if (status.failures > 0) return `${status.failures} recent database failures`;
    return 'Database operations healthy';
  };

  const getIcon = () => {
    return status.isOpen ? <IconCircuitSwitchOpen size={16} /> : <IconCircuitSwitchClosed size={16} />;
  };

  return (
    <Alert 
      icon={getIcon()}
      color={getStatusColor()}
      variant={status.isOpen ? "filled" : "light"}
      size={size}
    >
      <Group position="apart">
        <Text size="sm" color={status.isOpen ? "white" : undefined}>
          {getStatusText()}
        </Text>
        {status.isOpen && status.timeSinceLastFailure && (
          <Text size="xs" color={status.isOpen ? "white" : "dimmed"}>
            {Math.floor(status.timeSinceLastFailure / 1000)}s ago
          </Text>
        )}
      </Group>
    </Alert>
  );
}

/**
 * Active operation indicator with retry progress
 */
function OperationIndicator({ operation, onCancel, size }) {
  const {
    name = 'Database operation',
    attempt = 1,
    maxAttempts = 5,
    progress = null,
    stage = null,
    isRetrying = false,
    error = null
  } = operation;

  const progressPercentage = maxAttempts > 1 ? ((attempt - 1) / (maxAttempts - 1)) * 100 : 0;

  return (
    <Alert 
      color={error ? "red" : (isRetrying ? "yellow" : "blue")}
      variant="light"
      size={size}
    >
      <Stack spacing="xs">
        <Group position="apart">
          <div>
            <Text size="sm" weight={500}>
              {name}
              {stage && ` (${stage})`}
            </Text>
            <Text size="xs" color="dimmed">
              {isRetrying 
                ? `Retry attempt ${attempt}/${maxAttempts}`
                : `Attempt ${attempt}/${maxAttempts}`
              }
            </Text>
          </div>
          
          <Group spacing="xs">
            {isRetrying && (
              <ActionIcon size="sm" variant="subtle">
                <IconRefresh size={14} className={styles.spinning} />
              </ActionIcon>
            )}
            
            {onCancel && (
              <Tooltip label="Cancel operation">
                <ActionIcon 
                  size="sm" 
                  color="red" 
                  variant="subtle"
                  onClick={onCancel}
                >
                  <IconX size={14} />
                </ActionIcon>
              </Tooltip>
            )}
          </Group>
        </Group>

        {/* Retry Progress Bar */}
        {maxAttempts > 1 && (
          <Progress 
            value={progressPercentage}
            color={error ? "red" : (isRetrying ? "yellow" : "blue")}
            size="xs"
            striped={isRetrying}
            animate={isRetrying}
          />
        )}

        {/* Operation Progress Bar */}
        {progress && (
          <div>
            <Group position="apart" mb={4}>
              <Text size="xs" color="dimmed">Progress</Text>
              <Text size="xs" color="dimmed">{progress.percentage}%</Text>
            </Group>
            <Progress 
              value={progress.percentage}
              color="blue"
              size="xs"
            />
          </div>
        )}

        {/* Error Message */}
        {error && (
          <Text size="xs" color="red">
            {error}
          </Text>
        )}
      </Stack>
    </Alert>
  );
}

/**
 * Active requests counter
 */
function ActiveRequestsIndicator({ count, size }) {
  return (
    <Group spacing="xs">
      <Badge 
        color="blue" 
        variant="light"
        size={size}
      >
        {count} active request{count !== 1 ? 's' : ''}
      </Badge>
    </Group>
  );
}

/**
 * Compact retry status badge for use in headers/toolbars
 */
export function RetryStatusBadge({ 
  onClick = null,
  showCount = true,
  className = '' 
}) {
  const [networkStatus, setNetworkStatus] = useState(indexedDBRetry.getNetworkStatus());
  const [circuitBreakerStatus, setCircuitBreakerStatus] = useState(indexedDBRetry.getCircuitBreakerStatus());
  const [activeRequests, setActiveRequests] = useState(indexedDBRetry.getActiveRequestsCount());

  useEffect(() => {
    const interval = setInterval(() => {
      setCircuitBreakerStatus(indexedDBRetry.getCircuitBreakerStatus());
      setActiveRequests(indexedDBRetry.getActiveRequestsCount());
    }, 1000);

    const handleNetworkChange = (isOnline) => {
      setNetworkStatus(isOnline);
    };

    indexedDBRetry.addNetworkListener(handleNetworkChange);

    return () => {
      clearInterval(interval);
      indexedDBRetry.removeNetworkListener(handleNetworkChange);
    };
  }, []);

  const getStatusColor = () => {
    if (!networkStatus) return 'red';
    if (circuitBreakerStatus.isOpen) return 'red';
    if (circuitBreakerStatus.failures > 0) return 'yellow';
    if (activeRequests > 0) return 'blue';
    return 'green';
  };

  const getStatusText = () => {
    if (!networkStatus) return 'Offline';
    if (circuitBreakerStatus.isOpen) return 'DB Error';
    if (activeRequests > 0) return showCount ? `${activeRequests} Active` : 'Active';
    return 'Healthy';
  };

  const getIcon = () => {
    if (!networkStatus) return <IconWifiOff size={12} />;
    if (circuitBreakerStatus.isOpen) return <IconAlertTriangle size={12} />;
    if (activeRequests > 0) return <IconRefresh size={12} className={styles.spinning} />;
    return <IconWifi size={12} />;
  };

  return (
    <Badge
      color={getStatusColor()}
      variant="filled"
      size="sm"
      className={className}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
      leftSection={getIcon()}
    >
      {getStatusText()}
    </Badge>
  );
}

/**
 * Hook for managing retry operations with UI feedback
 */
export function useRetryOperation(operationName = 'Operation') {
  const [isActive, setIsActive] = useState(false);
  const [operation, setOperation] = useState(null);
  const [abortController, setAbortController] = useState(null);

  const startOperation = (options = {}) => {
    const controller = new AbortController();
    
    setAbortController(controller);
    setIsActive(true);
    setOperation({
      name: operationName,
      attempt: 1,
      maxAttempts: options.maxAttempts || 5,
      progress: null,
      stage: options.stage || null,
      isRetrying: false,
      error: null,
      ...options
    });

    return controller;
  };

  const updateOperation = (updates) => {
    setOperation(prev => prev ? { ...prev, ...updates } : null);
  };

  const finishOperation = (success = true, error = null) => {
    if (error) {
      updateOperation({ error: error.message, isRetrying: false });
    }
    
    setTimeout(() => {
      setIsActive(false);
      setOperation(null);
      setAbortController(null);
    }, success ? 1000 : 3000); // Show success briefly, errors longer
  };

  const cancelOperation = () => {
    if (abortController) {
      abortController.abort();
      finishOperation(false, new Error('Operation cancelled by user'));
    }
  };

  return {
    isActive,
    operation,
    abortController,
    startOperation,
    updateOperation,
    finishOperation,
    cancelOperation
  };
}

export default RetryIndicator;