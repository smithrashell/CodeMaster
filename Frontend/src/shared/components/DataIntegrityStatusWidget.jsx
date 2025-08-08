/**
 * Data Integrity Status Widget
 * 
 * A compact widget that displays current data integrity status and provides
 * quick access to integrity operations. Can be embedded in the main dashboard.
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Button,
  IconButton,
  CircularProgress,
  Tooltip,
  Alert,
  LinearProgress,
  Menu,
  MenuItem
} from '@mui/material';
import {
  CheckCircle,
  Warning,
  Error,
  Refresh,
  Settings,
  MoreVert,
  PlayArrow,
  Build,
  Visibility
} from '@mui/icons-material';

import DataIntegrityCheckService from '../services/dataIntegrity/DataIntegrityCheckService.js';
import DataCorruptionRepair from '../services/dataIntegrity/DataCorruptionRepair.js';

const DataIntegrityStatusWidget = ({ 
  onViewDashboard = null,
  compact = false,
  autoRefresh = true,
  refreshInterval = 300000 // 5 minutes
}) => {
  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [lastCheck, setLastCheck] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadStatus();
    
    // Set up auto-refresh
    let refreshTimer;
    if (autoRefresh) {
      refreshTimer = setInterval(loadStatus, refreshInterval);
    }

    return () => {
      if (refreshTimer) {
        clearInterval(refreshTimer);
      }
    };
  }, [autoRefresh, refreshInterval]);

  const loadStatus = async () => {
    try {
      setError(null);
      setIsLoading(true);
      
      const [summary, monitoringStatus, checkHistory] = await Promise.all([
        DataIntegrityCheckService.getIntegrityDashboardSummary(),
        DataIntegrityCheckService.getMonitoringStatus(),
        DataIntegrityCheckService.getCheckHistory(1)
      ]);

      setStatus({
        ...summary,
        monitoring: monitoringStatus,
        lastCheckResult: checkHistory[0] || null
      });

      if (checkHistory[0]) {
        setLastCheck(new Date(checkHistory[0].timestamp));
      }
    } catch (err) {
      console.error('Failed to load integrity status:', err);
      setError('Failed to load status');
    } finally {
      setIsLoading(false);
    }
  };

  const runQuickCheck = async () => {
    try {
      setIsRunning(true);
      setError(null);
      
      await DataIntegrityCheckService.performIntegrityCheck({
        checkType: 'quick',
        priority: 'medium',
        saveToHistory: true
      });
      
      // Refresh status after check
      await loadStatus();
    } catch (err) {
      console.error('Quick check failed:', err);
      setError('Quick check failed');
    } finally {
      setIsRunning(false);
    }
  };

  const runQuickRepair = async () => {
    try {
      setIsRunning(true);
      setError(null);
      
      await DataCorruptionRepair.detectAndRepairCorruption({
        dryRun: false,
        autoRepairSafe: true,
        maxRepairs: 10
      });
      
      // Refresh status after repair
      await loadStatus();
      setMenuAnchor(null);
    } catch (err) {
      console.error('Quick repair failed:', err);
      setError('Quick repair failed');
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusInfo = () => {
    if (!status) return { color: 'default', icon: <Warning />, text: 'Unknown' };

    const score = status.overallScore;
    
    if (score >= 95) {
      return { 
        color: 'success', 
        icon: <CheckCircle />, 
        text: 'Excellent',
        description: 'Data integrity is excellent'
      };
    } else if (score >= 85) {
      return { 
        color: 'success', 
        icon: <CheckCircle />, 
        text: 'Good',
        description: 'Data integrity is good'
      };
    } else if (score >= 70) {
      return { 
        color: 'warning', 
        icon: <Warning />, 
        text: 'Warning',
        description: 'Some data integrity issues detected'
      };
    } else {
      return { 
        color: 'error', 
        icon: <Error />, 
        text: 'Critical',
        description: 'Critical data integrity issues need attention'
      };
    }
  };

  const getTrendIndicator = () => {
    if (!status?.trends) return null;
    
    const { trend, difference } = status.trends;
    
    switch (trend) {
      case 'improving':
        return (
          <Chip 
            size="small" 
            label={`+${difference}%`} 
            color="success" 
            variant="outlined"
          />
        );
      case 'declining':
        return (
          <Chip 
            size="small" 
            label={`${difference}%`} 
            color="error" 
            variant="outlined"
          />
        );
      case 'stable':
        return (
          <Chip 
            size="small" 
            label="Stable" 
            color="default" 
            variant="outlined"
          />
        );
      default:
        return null;
    }
  };

  const handleMenuClick = (event) => {
    setMenuAnchor(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
  };

  const statusInfo = getStatusInfo();

  if (compact) {
    return (
      <Card elevation={2}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box display="flex" alignItems="center">
              {isLoading ? (
                <CircularProgress size={20} />
              ) : (
                <Tooltip title={statusInfo.description}>
                  <Box color={statusInfo.color === 'success' ? 'success.main' : 
                              statusInfo.color === 'warning' ? 'warning.main' : 
                              statusInfo.color === 'error' ? 'error.main' : 'text.secondary'}>
                    {statusInfo.icon}
                  </Box>
                </Tooltip>
              )}
              <Typography variant="body2" sx={{ ml: 1 }}>
                {isLoading ? 'Loading...' : `${status?.overallScore || 'N/A'}%`}
              </Typography>
            </Box>
            
            <Box display="flex" alignItems="center">
              {getTrendIndicator()}
              <IconButton size="small" onClick={loadStatus} disabled={isLoading || isRunning}>
                <Refresh fontSize="small" />
              </IconButton>
              {onViewDashboard && (
                <IconButton size="small" onClick={onViewDashboard}>
                  <Visibility fontSize="small" />
                </IconButton>
              )}
            </Box>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mt: 1, py: 0 }}>
              <Typography variant="caption">{error}</Typography>
            </Alert>
          )}

          {isRunning && (
            <Box mt={1}>
              <LinearProgress size="small" />
            </Box>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card elevation={2}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
          <Typography variant="h6" component="div">
            Data Integrity
          </Typography>
          <Box>
            <IconButton 
              size="small" 
              onClick={handleMenuClick}
              disabled={isLoading || isRunning}
            >
              <MoreVert />
            </IconButton>
          </Box>
        </Box>

        {isLoading ? (
          <Box display="flex" justifyContent="center" py={2}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Box display="flex" alignItems="center" mb={2}>
              <Box color={statusInfo.color === 'success' ? 'success.main' : 
                          statusInfo.color === 'warning' ? 'warning.main' : 
                          statusInfo.color === 'error' ? 'error.main' : 'text.secondary'}>
                {statusInfo.icon}
              </Box>
              <Box ml={2}>
                <Typography variant="h4" component="div">
                  {status?.overallScore || 'N/A'}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {statusInfo.text}
                </Typography>
              </Box>
            </Box>

            <Box display="flex" justifyContent="between" alignItems="center" mb={2}>
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Issues: {status?.recentIssues || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Monitoring: {status?.monitoring?.active ? 'Active' : 'Inactive'}
                </Typography>
              </Box>
              {getTrendIndicator()}
            </Box>

            {lastCheck && (
              <Typography variant="caption" color="text.secondary" display="block">
                Last check: {lastCheck.toLocaleString()}
              </Typography>
            )}

            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}

            {isRunning && (
              <Box mt={2}>
                <Typography variant="body2" gutterBottom>
                  Running operation...
                </Typography>
                <LinearProgress />
              </Box>
            )}

            <Box mt={2} display="flex" gap={1}>
              <Button
                size="small"
                startIcon={<PlayArrow />}
                onClick={runQuickCheck}
                disabled={isLoading || isRunning}
                variant="outlined"
              >
                Quick Check
              </Button>
              {onViewDashboard && (
                <Button
                  size="small"
                  startIcon={<Visibility />}
                  onClick={onViewDashboard}
                  variant="text"
                >
                  View Details
                </Button>
              )}
            </Box>
          </>
        )}
      </CardContent>

      {/* Action Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => { runQuickCheck(); handleMenuClose(); }} disabled={isRunning}>
          <PlayArrow fontSize="small" sx={{ mr: 1 }} />
          Quick Check
        </MenuItem>
        <MenuItem onClick={runQuickRepair} disabled={isRunning}>
          <Build fontSize="small" sx={{ mr: 1 }} />
          Quick Repair
        </MenuItem>
        <MenuItem onClick={() => { loadStatus(); handleMenuClose(); }}>
          <Refresh fontSize="small" sx={{ mr: 1 }} />
          Refresh Status
        </MenuItem>
        {onViewDashboard && (
          <MenuItem onClick={() => { onViewDashboard(); handleMenuClose(); }}>
            <Visibility fontSize="small" sx={{ mr: 1 }} />
            Full Dashboard
          </MenuItem>
        )}
      </Menu>
    </Card>
  );
};

export default DataIntegrityStatusWidget;