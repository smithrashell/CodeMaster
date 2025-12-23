import "../../css/main.css";
import SegmentedControl from '../../components/ui/SegmentedControl.jsx';
import AdaptiveSessionToggle from "./AdaptiveSessionToggle.js";
import Header from "../../components/navigation/header.jsx";
import { useInterviewReadiness } from "../../../shared/hooks/useInterviewReadiness";
import { useNav } from "../../../shared/provider/navprovider";
import { useAnimatedClose } from "../../../shared/hooks/useAnimatedClose";
import { system } from "../../../shared/utils/logging/logger.js";
import {
  InterviewModeControls,
  useSettingsState,
  getWorkingSettings,
  RemindersSection,
  SaveSettingsButton,
  saveSettings,
  handleInterviewSettingsUpdate,
  useAutoConstrainNewProblems,
  LoadingDebugInfo,
  SessionControls,
} from "./settingsHelpers.jsx";

const Settings = () => {
  const { isAppOpen, setIsAppOpen } = useNav();
  const { shouldRender, isClosing } = useAnimatedClose(isAppOpen);
  const { settings, setSettings, maxNewProblems, _loading, _error } = useSettingsState();
  const interviewReadiness = useInterviewReadiness(settings);

  const handleClose = () => {
    setIsAppOpen(false);
  };

  system("🔧 Content Settings state", {
    hasSettings: !!settings,
    interviewMode: settings?.interviewMode,
    interviewReadiness
  });

  const handleSave = saveSettings;
  const workingSettings = getWorkingSettings(settings);

  useAutoConstrainNewProblems(workingSettings, maxNewProblems, setSettings);

  // NOTE: We use CSS display:none instead of returning null to prevent unmounting.
  // This preserves settings state when the sidebar is closed and reopened.
  return (
    <div
      id="cm-mySidenav"
      className={`cm-sidenav problink${isClosing ? ' cm-closing' : ''}`}
      style={{ display: shouldRender ? 'flex' : 'none' }}
    >
      <Header title="Settings" onClose={handleClose} />

      <div className="cm-sidenav__content ">
        <LoadingDebugInfo settings={settings} _loading={_loading} _error={_error} />

        <AdaptiveSessionToggle
          adaptive={workingSettings.adaptive}
          onChange={(val) => setSettings({ ...workingSettings, adaptive: val })}
        />

        <SessionControls
          workingSettings={workingSettings}
          setSettings={setSettings}
          maxNewProblems={maxNewProblems}
        />

        <div className="cm-form-group">
          <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px' }}>Time Limits</div>
          <SegmentedControl
            value={workingSettings.limit}
            onChange={(value) => setSettings(prevSettings => ({ ...prevSettings, limit: value }))}
            options={[
              { label: 'Auto', value: 'auto' },
              { label: 'Off', value: 'off' },
              { label: 'Fixed', value: 'fixed' }
            ]}
            variant="gradient"
            size="sm"
          />
        </div>

        <InterviewModeControls
          settings={workingSettings}
          updateSettings={(newSettings) => {
            setSettings(newSettings);
            handleInterviewSettingsUpdate(workingSettings, newSettings, handleSave);
          }}
          interviewReadiness={interviewReadiness}
        />

        <RemindersSection
          settings={workingSettings}
          setSettings={setSettings}
        />

        <SaveSettingsButton
          workingSettings={workingSettings}
          handleSave={handleSave}
        />
      </div>
    </div>
  );
};

export default Settings;
