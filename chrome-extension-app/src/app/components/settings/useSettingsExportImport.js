import { useState } from "react";
import logger from "../../../shared/utils/logging/logger.js";
import { settingsMessaging } from "./settingsMessaging.js";
import { validateSettings } from "./settingsValidation.js";
import { DEFAULT_SETTINGS } from "./defaultSettings.js";

export function useSettingsExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState(null);

  const handleExport = async () => {
    setIsExporting(true);
    setExportStatus(null);
    
    try {
      const allSettings = await settingsMessaging.getAllSettings();
      
      // Create export object with metadata
      const exportData = {
        metadata: {
          exportedAt: new Date().toISOString(),
          version: "1.0",
          source: "CodeMaster Settings"
        },
        settings: allSettings
      };
      
      // Create and download file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
        type: "application/json" 
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `codemaster-settings-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setExportStatus({ type: "success", message: "Settings exported successfully!" });
    } catch (error) {
      logger.error("Export error:", error);
      setExportStatus({ type: "error", message: "Failed to export settings." });
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportStatus(null), 3000);
    }
  };

  return { isExporting, exportStatus, handleExport };
}

export function useSettingsImport() {
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const [validationModal, setValidationModal] = useState({ 
    isOpen: false, 
    result: null, 
    settings: null, 
    fileName: "" 
  });

  const handleFileSelect = (file) => {
    if (!file) return;
    
    setIsImporting(true);
    setImportStatus(null);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const fileContent = JSON.parse(e.target.result);
        const settings = fileContent.settings || fileContent; // Handle both new and old formats
        
        const validationResult = validateSettings(settings);
        
        setValidationModal({
          isOpen: true,
          result: validationResult,
          settings: settings,
          fileName: file.name
        });
        
      } catch (error) {
        setImportStatus({ 
          type: "error", 
          message: "Invalid JSON file. Please check the file format." 
        });
        setTimeout(() => setImportStatus(null), 3000);
      } finally {
        setIsImporting(false);
      }
    };
    
    reader.readAsText(file);
  };

  const handleImportConfirm = async () => {
    try {
      const { settings } = validationModal;
      const response = await settingsMessaging.saveSettings(settings);
      
      if (response?.status === "success") {
        setImportStatus({ 
          type: "success", 
          message: "Settings imported successfully! Please refresh to see changes." 
        });
      } else {
        setImportStatus({ 
          type: "error", 
          message: "Failed to save imported settings." 
        });
      }
      
      setValidationModal({ isOpen: false, result: null, settings: null, fileName: "" });
      
    } catch (error) {
      logger.error("Import error:", error);
      setImportStatus({ type: "error", message: "Failed to import settings." });
    }
    
    setTimeout(() => setImportStatus(null), 5000);
  };

  const handleGlobalReset = async () => {
    try {
      const response = await settingsMessaging.saveSettings(DEFAULT_SETTINGS);
      
      if (response?.status === "success") {
        setImportStatus({ 
          type: "success", 
          message: "All settings reset to defaults! Please refresh to see changes." 
        });
      }
    } catch (error) {
      logger.error("Global reset error:", error);
      setImportStatus({ type: "error", message: "Failed to reset settings." });
    }
    
    setTimeout(() => setImportStatus(null), 5000);
  };

  return {
    isImporting,
    importStatus,
    validationModal,
    setValidationModal,
    handleFileSelect,
    handleImportConfirm,
    handleGlobalReset
  };
}