/**
 * Data Integrity Dashboard Component
 *
 * Provides a comprehensive interface for monitoring and managing data integrity,
 * including health status, integrity checks, repairs, and reconstruction operations.
 */

import React, { useState, useEffect } from "react";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Button,
  Grid,
  Alert,
  AlertTitle,
  LinearProgress,
  Chip,
  Tab,
  Tabs,
  TabPanel,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  CheckCircle,
  Warning,
  Error,
  Refresh,
  Settings,
  Build,
  History,
  ExpandMore,
  Info,
  PlayArrow,
  Stop,
  GetApp,
} from "@mui/icons-material";

// Import integrity services
import DataIntegrityCheckService from "../services/dataIntegrity/DataIntegrityCheckService.js";
import ReferentialIntegrityService from "../services/dataIntegrity/ReferentialIntegrityService.js";
import DataCorruptionRepair from "../services/dataIntegrity/DataCorruptionRepair.js";
import DataReconstructionService from "../services/dataIntegrity/DataReconstructionService.js";

const DataIntegrityDashboard = () => {
  // State management
  const [activeTab, setActiveTab] = useState(0);
  const [dashboardSummary, setDashboardSummary] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningCheck, setIsRunningCheck] = useState(false);
  const [isRunningRepair, setIsRunningRepair] = useState(false);
  const [isRunningReconstruction, setIsRunningReconstruction] = useState(false);
  const [checkResults, setCheckResults] = useState(null);
  const [repairResults, setRepairResults] = useState(null);
  const [reconstructionResults, setReconstructionResults] = useState(null);
  const [monitoringEnabled, setMonitoringEnabled] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [detailDialogData, setDetailDialogData] = useState(null);

  // Load dashboard data on mount
  useEffect(() => {
    loadDashboardData();
    checkMonitoringStatus();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      const summary =
        await DataIntegrityCheckService.getIntegrityDashboardSummary();
      setDashboardSummary(summary);
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkMonitoringStatus = async () => {
    try {
      const status = DataIntegrityCheckService.getMonitoringStatus();
      setMonitoringEnabled(status.active);
    } catch (error) {
      console.error("Failed to check monitoring status:", error);
    }
  };

  const runIntegrityCheck = async (checkType = "full") => {
    try {
      setIsRunningCheck(true);
      const result = await DataIntegrityCheckService.performIntegrityCheck({
        checkType,
        priority: "high",
        saveToHistory: true,
      });
      setCheckResults(result);
      await loadDashboardData(); // Refresh summary
    } catch (error) {
      console.error("Integrity check failed:", error);
    } finally {
      setIsRunningCheck(false);
    }
  };

  const runCorruptionRepair = async (options = {}) => {
    try {
      setIsRunningRepair(true);
      const result = await DataCorruptionRepair.detectAndRepairCorruption({
        dryRun: false,
        autoRepairSafe: true,
        createBackup: true,
        maxRepairs: 50,
        ...options,
      });
      setRepairResults(result);
      await loadDashboardData(); // Refresh summary
    } catch (error) {
      console.error("Corruption repair failed:", error);
    } finally {
      setIsRunningRepair(false);
    }
  };

  const runDataReconstruction = async (
    types = ["tag_mastery", "problem_stats"]
  ) => {
    try {
      setIsRunningReconstruction(true);
      const result = await DataReconstructionService.reconstructData({
        types,
        strategy: "hybrid_approach",
        dryRun: false,
        createBackup: true,
        preserveExisting: true,
      });
      setReconstructionResults(result);
      await loadDashboardData(); // Refresh summary
    } catch (error) {
      console.error("Data reconstruction failed:", error);
    } finally {
      setIsRunningReconstruction(false);
    }
  };

  const toggleMonitoring = async () => {
    try {
      if (monitoringEnabled) {
        DataIntegrityCheckService.stopPeriodicMonitoring();
      } else {
        DataIntegrityCheckService.startPeriodicMonitoring({
          quickCheckInterval: 5 * 60 * 1000, // 5 minutes
          fullCheckInterval: 24 * 60 * 60 * 1000, // 24 hours
          autoRepair: false,
        });
      }
      setMonitoringEnabled(!monitoringEnabled);
    } catch (error) {
      console.error("Failed to toggle monitoring:", error);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "excellent":
        return "success";
      case "good":
        return "success";
      case "warning":
        return "warning";
      case "critical":
        return "error";
      default:
        return "info";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "excellent":
        return <CheckCircle color="success" />;
      case "good":
        return <CheckCircle color="success" />;
      case "warning":
        return <Warning color="warning" />;
      case "critical":
        return <Error color="error" />;
      default:
        return <Info color="info" />;
    }
  };

  const showDetails = (title, data) => {
    setDetailDialogData({ title, data });
    setShowDetailDialog(true);
  };

  if (isLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Typography variant="h4" component="h1">
          Data Integrity Dashboard
        </Typography>
        <Box>
          <FormControlLabel
            control={
              <Switch checked={monitoringEnabled} onChange={toggleMonitoring} />
            }
            label="Auto Monitoring"
          />
          <IconButton onClick={loadDashboardData} sx={{ ml: 1 }}>
            <Refresh />
          </IconButton>
          <IconButton
            onClick={() => setShowSettingsDialog(true)}
            sx={{ ml: 1 }}
          >
            <Settings />
          </IconButton>
        </Box>
      </Box>

      {/* Status Overview Cards */}
      <Grid container spacing={3} mb={4}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                {getStatusIcon(dashboardSummary?.status)}
                <Typography variant="h6" sx={{ ml: 1 }}>
                  Overall Status
                </Typography>
              </Box>
              <Typography
                variant="h3"
                color={getStatusColor(dashboardSummary?.status)}
              >
                {dashboardSummary?.overallScore || "N/A"}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {dashboardSummary?.status || "Unknown"}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Issues
              </Typography>
              <Typography
                variant="h3"
                color={dashboardSummary?.recentIssues > 0 ? "error" : "success"}
              >
                {dashboardSummary?.recentIssues || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Last check:{" "}
                {dashboardSummary?.lastCheck
                  ? new Date(dashboardSummary.lastCheck).toLocaleString()
                  : "Never"}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Total Checks
              </Typography>
              <Typography variant="h3" color="primary">
                {dashboardSummary?.totalChecks || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Today: {dashboardSummary?.quickStats?.checksToday || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Trend
              </Typography>
              <Chip
                label={dashboardSummary?.trends?.trend || "Unknown"}
                color={
                  dashboardSummary?.trends?.trend === "improving"
                    ? "success"
                    : dashboardSummary?.trends?.trend === "declining"
                    ? "error"
                    : "default"
                }
                icon={
                  dashboardSummary?.trends?.trend === "improving" ? (
                    <CheckCircle />
                  ) : dashboardSummary?.trends?.trend === "declining" ? (
                    <Warning />
                  ) : (
                    <Info />
                  )
                }
              />
              <Typography variant="body2" color="text.secondary" mt={1}>
                {dashboardSummary?.trends?.difference
                  ? `${dashboardSummary.trends.difference > 0 ? "+" : ""}${
                      dashboardSummary.trends.difference
                    }%`
                  : "No change"}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Main Content Tabs */}
      <Card>
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
        >
          <Tab label="Integrity Checks" />
          <Tab label="Corruption Repair" />
          <Tab label="Data Reconstruction" />
          <Tab label="History" />
        </Tabs>

        {/* Integrity Checks Tab */}
        {activeTab === 0 && (
          <Box p={3}>
            <Box display="flex" gap={2} mb={3}>
              <Button
                variant="contained"
                startIcon={<PlayArrow />}
                onClick={() => runIntegrityCheck("full")}
                disabled={isRunningCheck}
              >
                {isRunningCheck ? "Running Full Check..." : "Run Full Check"}
              </Button>
              <Button
                variant="outlined"
                startIcon={<PlayArrow />}
                onClick={() => runIntegrityCheck("quick")}
                disabled={isRunningCheck}
              >
                {isRunningCheck ? "Running..." : "Quick Check"}
              </Button>
              <Button
                variant="outlined"
                startIcon={<PlayArrow />}
                onClick={() => runIntegrityCheck("referential")}
                disabled={isRunningCheck}
              >
                Referential Only
              </Button>
            </Box>

            {isRunningCheck && (
              <Box mb={3}>
                <Typography variant="body2" gutterBottom>
                  Running integrity check...
                </Typography>
                <LinearProgress />
              </Box>
            )}

            {checkResults && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="h6">
                    Latest Check Results ({checkResults.checkType})
                  </Typography>
                  <Chip
                    label={checkResults.overall.valid ? "PASSED" : "FAILED"}
                    color={checkResults.overall.valid ? "success" : "error"}
                    sx={{ ml: 2 }}
                  />
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2">
                        Overall Score: {checkResults.overall.score}%
                      </Typography>
                      <Typography variant="body2">
                        Errors: {checkResults.overall.errors}
                      </Typography>
                      <Typography variant="body2">
                        Warnings: {checkResults.overall.warnings}
                      </Typography>
                      <Typography variant="body2">
                        Check Time:{" "}
                        {checkResults.performanceMetrics.totalTime.toFixed(2)}ms
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      {checkResults.recommendations &&
                        checkResults.recommendations.length > 0 && (
                          <>
                            <Typography variant="subtitle2" gutterBottom>
                              Recommendations:
                            </Typography>
                            {checkResults.recommendations
                              .slice(0, 3)
                              .map((rec, index) => (
                                <Alert
                                  key={index}
                                  severity={
                                    rec.priority === "high"
                                      ? "error"
                                      : "warning"
                                  }
                                  sx={{ mb: 1 }}
                                >
                                  <AlertTitle>{rec.title}</AlertTitle>
                                  {rec.description}
                                </Alert>
                              ))}
                          </>
                        )}
                    </Grid>
                  </Grid>

                  <Button
                    variant="outlined"
                    startIcon={<Info />}
                    onClick={() => showDetails("Check Results", checkResults)}
                    sx={{ mt: 2 }}
                  >
                    View Full Details
                  </Button>
                </AccordionDetails>
              </Accordion>
            )}
          </Box>
        )}

        {/* Corruption Repair Tab */}
        {activeTab === 1 && (
          <Box p={3}>
            <Box display="flex" gap={2} mb={3}>
              <Button
                variant="contained"
                startIcon={<Build />}
                onClick={() => runCorruptionRepair()}
                disabled={isRunningRepair}
                color="warning"
              >
                {isRunningRepair ? "Running Repair..." : "Detect & Repair"}
              </Button>
              <Button
                variant="outlined"
                startIcon={<Build />}
                onClick={() => runCorruptionRepair({ dryRun: true })}
                disabled={isRunningRepair}
              >
                Dry Run
              </Button>
            </Box>

            {isRunningRepair && (
              <Box mb={3}>
                <Typography variant="body2" gutterBottom>
                  Detecting and repairing corruption...
                </Typography>
                <LinearProgress />
              </Box>
            )}

            {repairResults && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="h6">Latest Repair Results</Typography>
                  <Chip
                    label={repairResults.overall.success ? "SUCCESS" : "FAILED"}
                    color={repairResults.overall.success ? "success" : "error"}
                    sx={{ ml: 2 }}
                  />
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2">
                        Corruption Detected:{" "}
                        {repairResults.overall.corruptionDetected
                          ? "Yes"
                          : "No"}
                      </Typography>
                      <Typography variant="body2">
                        Total Issues: {repairResults.overall.totalIssues}
                      </Typography>
                      <Typography variant="body2">
                        Repairs Successful:{" "}
                        {repairResults.overall.repairsSuccessful}
                      </Typography>
                      <Typography variant="body2">
                        Repairs Failed: {repairResults.overall.repairsFailed}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2">Performance:</Typography>
                      <Typography variant="body2">
                        Detection Time:{" "}
                        {repairResults.performanceMetrics.detectionTime?.toFixed(
                          2
                        )}
                        ms
                      </Typography>
                      <Typography variant="body2">
                        Repair Time:{" "}
                        {repairResults.performanceMetrics.repairTime?.toFixed(
                          2
                        )}
                        ms
                      </Typography>
                      <Typography variant="body2">
                        Total Time:{" "}
                        {repairResults.performanceMetrics.totalTime?.toFixed(2)}
                        ms
                      </Typography>
                    </Grid>
                  </Grid>

                  <Button
                    variant="outlined"
                    startIcon={<Info />}
                    onClick={() => showDetails("Repair Results", repairResults)}
                    sx={{ mt: 2 }}
                  >
                    View Full Details
                  </Button>
                </AccordionDetails>
              </Accordion>
            )}
          </Box>
        )}

        {/* Data Reconstruction Tab */}
        {activeTab === 2 && (
          <Box p={3}>
            <Box display="flex" gap={2} mb={3}>
              <Button
                variant="contained"
                startIcon={<GetApp />}
                onClick={() => runDataReconstruction()}
                disabled={isRunningReconstruction}
                color="secondary"
              >
                {isRunningReconstruction
                  ? "Reconstructing..."
                  : "Reconstruct Data"}
              </Button>
              <Button
                variant="outlined"
                startIcon={<GetApp />}
                onClick={() => runDataReconstruction(["tag_mastery"])}
                disabled={isRunningReconstruction}
              >
                Tag Mastery Only
              </Button>
              <Button
                variant="outlined"
                startIcon={<GetApp />}
                onClick={() => runDataReconstruction(["problem_stats"])}
                disabled={isRunningReconstruction}
              >
                Problem Stats Only
              </Button>
            </Box>

            {isRunningReconstruction && (
              <Box mb={3}>
                <Typography variant="body2" gutterBottom>
                  Reconstructing data from available sources...
                </Typography>
                <LinearProgress />
              </Box>
            )}

            {reconstructionResults && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="h6">
                    Latest Reconstruction Results
                  </Typography>
                  <Chip
                    label={
                      reconstructionResults.overall.success
                        ? "SUCCESS"
                        : "FAILED"
                    }
                    color={
                      reconstructionResults.overall.success
                        ? "success"
                        : "error"
                    }
                    sx={{ ml: 2 }}
                  />
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2">
                        Types Processed:{" "}
                        {reconstructionResults.overall.typesProcessed}
                      </Typography>
                      <Typography variant="body2">
                        Records Reconstructed:{" "}
                        {reconstructionResults.overall.recordsReconstructed}
                      </Typography>
                      <Typography variant="body2">
                        Records Skipped:{" "}
                        {reconstructionResults.overall.recordsSkipped}
                      </Typography>
                      <Typography variant="body2">
                        Errors: {reconstructionResults.overall.errors}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2">Performance:</Typography>
                      <Typography variant="body2">
                        Total Time:{" "}
                        {reconstructionResults.performanceMetrics.totalTime?.toFixed(
                          2
                        )}
                        ms
                      </Typography>
                      <Typography variant="body2">
                        Strategy: {reconstructionResults.strategy}
                      </Typography>
                      <Typography variant="body2">
                        Dry Run: {reconstructionResults.dryRun ? "Yes" : "No"}
                      </Typography>
                    </Grid>
                  </Grid>

                  <Button
                    variant="outlined"
                    startIcon={<Info />}
                    onClick={() =>
                      showDetails(
                        "Reconstruction Results",
                        reconstructionResults
                      )
                    }
                    sx={{ mt: 2 }}
                  >
                    View Full Details
                  </Button>
                </AccordionDetails>
              </Accordion>
            )}
          </Box>
        )}

        {/* History Tab */}
        {activeTab === 3 && (
          <Box p={3}>
            <HistoryView />
          </Box>
        )}
      </Card>

      {/* Detail Dialog */}
      <Dialog
        open={showDetailDialog}
        onClose={() => setShowDetailDialog(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>{detailDialogData?.title}</DialogTitle>
        <DialogContent>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: "12px" }}>
            {JSON.stringify(detailDialogData?.data, null, 2)}
          </pre>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDetailDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog
        open={showSettingsDialog}
        onClose={() => setShowSettingsDialog(false)}
      >
        <DialogTitle>Integrity Monitoring Settings</DialogTitle>
        <DialogContent>
          <Typography variant="body2" gutterBottom>
            Configure automatic data integrity monitoring intervals and options.
          </Typography>
          {/* Add settings form here */}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowSettingsDialog(false)}>Cancel</Button>
          <Button
            onClick={() => setShowSettingsDialog(false)}
            variant="contained"
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

// History View Component
const HistoryView = () => {
  const [checkHistory, setCheckHistory] = useState([]);
  const [repairHistory, setRepairHistory] = useState([]);
  const [reconstructionHistory, setReconstructionHistory] = useState([]);

  useEffect(() => {
    loadHistoryData();
  }, []);

  const loadHistoryData = async () => {
    try {
      const checks = DataIntegrityCheckService.getCheckHistory(10);
      const repairs = DataCorruptionRepair.getRepairHistory(10);
      const reconstructions =
        DataReconstructionService.getReconstructionHistory(10);

      setCheckHistory(checks);
      setRepairHistory(repairs);
      setReconstructionHistory(reconstructions);
    } catch (error) {
      console.error("Failed to load history:", error);
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Operation History
      </Typography>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography>Integrity Checks ({checkHistory.length})</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Score</TableCell>
                  <TableCell>Issues</TableCell>
                  <TableCell>Duration</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {checkHistory.map((check) => (
                  <TableRow key={check.checkId}>
                    <TableCell>
                      {new Date(check.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>{check.checkType}</TableCell>
                    <TableCell>
                      <Chip
                        label={`${check.overall.score}%`}
                        size="small"
                        color={
                          check.overall.score >= 90
                            ? "success"
                            : check.overall.score >= 70
                            ? "warning"
                            : "error"
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {check.overall.errors + check.overall.warnings}
                    </TableCell>
                    <TableCell>
                      {check.performanceMetrics.totalTime?.toFixed(0)}ms
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography>Repairs ({repairHistory.length})</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Issues Found</TableCell>
                  <TableCell>Repairs</TableCell>
                  <TableCell>Duration</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {repairHistory.map((repair) => (
                  <TableRow key={repair.repairId}>
                    <TableCell>
                      {new Date(repair.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={repair.overall.success ? "Success" : "Failed"}
                        size="small"
                        color={repair.overall.success ? "success" : "error"}
                      />
                    </TableCell>
                    <TableCell>{repair.overall.totalIssues}</TableCell>
                    <TableCell>
                      {repair.overall.repairsSuccessful}/
                      {repair.overall.repairsAttempted}
                    </TableCell>
                    <TableCell>
                      {repair.performanceMetrics.totalTime?.toFixed(0)}ms
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography>
            Reconstructions ({reconstructionHistory.length})
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Types</TableCell>
                  <TableCell>Records</TableCell>
                  <TableCell>Duration</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {reconstructionHistory.map((reconstruction) => (
                  <TableRow key={reconstruction.reconstructionId}>
                    <TableCell>
                      {new Date(reconstruction.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={
                          reconstruction.overall.success ? "Success" : "Failed"
                        }
                        size="small"
                        color={
                          reconstruction.overall.success ? "success" : "error"
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {reconstruction.overall.typesProcessed}
                    </TableCell>
                    <TableCell>
                      {reconstruction.overall.recordsReconstructed}
                    </TableCell>
                    <TableCell>
                      {reconstruction.performanceMetrics.totalTime?.toFixed(0)}
                      ms
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
};

export default DataIntegrityDashboard;
