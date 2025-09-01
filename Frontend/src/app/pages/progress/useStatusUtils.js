export const useStatusUtils = () => {
  // Helper functions for status determination
  const getAccuracyStatus = (accuracy) => {
    if (accuracy >= 80) return "excellent";
    if (accuracy >= 70) return "on_track"; 
    if (accuracy >= 60) return "needs_improvement";
    return "behind";
  };

  const getProblemsStatus = (count) => {
    if (count >= 25) return "excellent";
    if (count >= 20) return "on_track";
    if (count >= 15) return "needs_improvement";
    return "behind";
  };

  const getHintEfficiencyStatus = (hintsPerProblem) => {
    if (hintsPerProblem <= 1) return "excellent";
    if (hintsPerProblem <= 2) return "on_track";
    if (hintsPerProblem <= 3) return "needs_improvement";
    return "behind";
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "excellent": return "green";
      case "on_track": return "green";
      case "needs_improvement": return "yellow";
      case "behind": return "red";
      case "adaptive": return "blue";
      case "no_data": return "gray";
      case "loading": return "gray";
      default: return "gray";
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "excellent": return "Excellent";
      case "on_track": return "On track";
      case "needs_improvement": return "Needs improvement";
      case "behind": return "Behind";
      case "adaptive": return "Adaptive";
      case "no_data": return "No data yet";
      case "loading": return "Loading...";
      default: return "Unknown";
    }
  };

  return {
    getAccuracyStatus,
    getProblemsStatus,
    getHintEfficiencyStatus,
    getStatusColor,
    getStatusText
  };
};