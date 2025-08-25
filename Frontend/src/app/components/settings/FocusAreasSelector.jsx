import React, { useState, useEffect, useCallback } from "react";
import {
  Card,
  Text,
  MultiSelect,
  Group,
  Badge,
  Button,
  Loader,
  Alert,
  Tooltip,
  Stack,
  Title,
  Divider,
} from "@mantine/core";
import CustomMultiSelect from "../shared/CustomMultiSelect";
import {
  IconTarget,
  IconRefresh,
  IconInfoCircle,
  IconTrophy,
} from "@tabler/icons-react";
// Note: Using Chrome messaging for all service calls to comply with extension architecture
// All database access goes through background script

export function FocusAreasSelector() {
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedFocusAreas, setSelectedFocusAreas] = useState([]);
  const [currentTier, setCurrentTier] = useState("");
  const [masteredTags, setMasteredTags] = useState([]);
  const [masteryData, setMasteryData] = useState([]);
  const [focusAvailability, setFocusAvailability] = useState({
    access: { core: "confirmed", fundamental: "none", advanced: "none" },
    caps: { core: Infinity, fundamental: 3, advanced: 3 },
    tags: [],
    starterCore: [],
    currentTier: "Unknown",
    systemSelectedTags: [],
    userOverrideTags: [],
    activeSessionTags: []
  });
  const [showCustomMode, setShowCustomMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Log when focusAvailability state changes
  useEffect(() => {
    console.log("🔍 LIFECYCLE: focusAvailability state changed to:", focusAvailability);
    console.log("🔍 LIFECYCLE: focusAvailability.starterCore after state change:", focusAvailability?.starterCore);
    console.log("🔍 LIFECYCLE: focusAvailability.tags after state change:", focusAvailability?.tags);
  }, [focusAvailability]);

  const loadData = useCallback(async () => {
    console.log("🔍 LIFECYCLE: loadData called");
    console.log("🔍 LIFECYCLE: Current focusAvailability state:", focusAvailability);
    setLoading(true);
    setError(null);
    
    try {
      // Load available tags for focus (current + preview) via new message handler
      console.log("🔍 FocusAreasSelector: Calling getAvailableTagsForFocus...");
      const focusData = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "getAvailableTagsForFocus", userId: "default" }, (response) => {
          console.log("🔍 FocusAreasSelector: Response received:", response);
          if (response?.result) {
            console.log("🔍 FocusAreasSelector: Response result:", response.result);
            resolve(response.result);
          } else {
            console.error("❌ Error from getAvailableTagsForFocus:", response?.error);
            resolve(null);
          }
        });
      });

      if (focusData) {
        console.log("✅ FocusAreasSelector: Setting focusData state:", focusData);
        console.log("🔍 LIFECYCLE: About to call setFocusAvailability with:", focusData);
        console.log("🔍 LIFECYCLE: focusData.starterCore:", focusData.starterCore);
        console.log("🔍 LIFECYCLE: focusData.tags:", focusData.tags);
        setFocusAvailability(focusData);
        setCurrentTier(focusData.currentTier || "Unknown");
        
        // Set custom mode if user has overrides, otherwise use system selection
        setShowCustomMode(focusData.userOverrideTags && focusData.userOverrideTags.length > 0);
        console.log("🔍 FocusAreasSelector: showCustomMode set to:", focusData.userOverrideTags && focusData.userOverrideTags.length > 0);
        
        // Extract available tags for backward compatibility
        const selectableTags = focusData.tags.filter(tag => tag.selectable).map(tag => tag.tagId);
        setAvailableTags(selectableTags);
        console.log("🔍 FocusAreasSelector: Available tags set:", selectableTags);
      } else {
        // Fallback to original method
        const learningState = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: "getCurrentLearningState" }, (response) => {
            resolve(response || { allTagsInCurrentTier: [], masteredTags: [], masteryData: [], currentTier: "Unknown" });
          });
        });
        
        setAvailableTags(learningState.allTagsInCurrentTier || []);
        setCurrentTier(learningState.currentTier || "Unknown");
        setMasteredTags(learningState.masteredTags || []);
        setMasteryData(learningState.masteryData || []);
      }
      
      const settings = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "getSettings" }, (response) => {
          resolve(response || { focusAreas: [] });
        });
      });

      // Load saved focus areas from settings
      const savedFocusAreas = settings.focusAreas || [];
      
      // Filter out mastered tags from saved focus areas
      const masteredTags = focusData?.masteredTags || [];
      const activeFocusAreas = savedFocusAreas.filter(
        (tag) => !masteredTags.includes(tag)
      );
      
      setSelectedFocusAreas(activeFocusAreas);
      setHasChanges(false);
    } catch (err) {
      console.error("Error loading focus areas data:", err);
      setError("Failed to load learning data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Listen for attempt updates to refresh focus area availability
  useEffect(() => {
    const handleAttemptRecorded = () => {
      chrome.runtime.sendMessage({ type: "getAvailableTagsForFocus", userId: "default" }, (response) => {
        if (response?.ok) {
          const prevAccess = focusAvailability?.access;
          setFocusAvailability(response.payload);
          
          // Show toast for tier unlocks
          if (prevAccess && prevAccess.advanced === "none" && response.payload.access.advanced !== "none") {
            // Could add toast notification here if desired
          }
          if (prevAccess && prevAccess.fundamental === "none" && response.payload.access.fundamental !== "none") {
            // Could add toast notification here if desired
          }
        }
      });
    };

    window.addEventListener("cm:attempt-recorded", handleAttemptRecorded);
    return () => window.removeEventListener("cm:attempt-recorded", handleAttemptRecorded);
  }, [focusAvailability?.access]);

  const handleFocusAreasChange = (values) => {
    // Limit to maximum 3 focus areas
    const limitedValues = values.slice(0, 3);
    setSelectedFocusAreas(limitedValues);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      // Save focus areas to settings via Chrome messaging
      const currentSettings = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "getSettings" }, (response) => {
          resolve(response || {});
        });
      });
      
      const updatedSettings = {
        ...currentSettings,
        focusAreas: selectedFocusAreas,
      };

      chrome.runtime.sendMessage(
        { type: "setSettings", message: updatedSettings },
        (response) => {
          if (response?.status === "success") {
            setHasChanges(false);
          } else {
            setError("Failed to save focus areas. Please try again.");
          }
        }
      );
    } catch (err) {
      console.error("Error saving focus areas:", err);
      setError("Failed to save focus areas. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      const currentSettings = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: "getSettings" }, (response) => {
          resolve(response || {});
        });
      });
      
      const updatedSettings = {
        ...currentSettings,
        focusAreas: [],
      };

      chrome.runtime.sendMessage(
        { type: "setSettings", message: updatedSettings },
        (response) => {
          if (response?.status === "success") {
            setSelectedFocusAreas([]);
            setHasChanges(false);
          } else {
            setError("Failed to reset focus areas. Please try again.");
          }
        }
      );
    } catch (err) {
      console.error("Error resetting focus areas:", err);
      setError("Failed to reset focus areas. Please try again.");
    }
  };

  const getTagMasteryProgress = (tagName) => {
    const tagData = masteryData.find((tag) => tag.tag === tagName);
    if (!tagData || tagData.totalAttempts === 0) return 0;
    return Math.round((tagData.successfulAttempts / tagData.totalAttempts) * 100);
  };

  const getTagOptions = () => {
    try {
      console.log("🔍 getTagOptions called, focusAvailability:", focusAvailability);
      
      // ALWAYS return a safe object, even if everything fails
      const safeReturn = { selectableOptions: [], previewTags: [] };
      
      if (!focusAvailability || !focusAvailability.tags || !Array.isArray(focusAvailability.tags)) {
        // Fallback to original logic
        console.log("🔍 FocusAreasSelector: No focusAvailability.tags, using fallback");
        
        // Ensure availableTags and masteredTags are arrays
        const safeAvailableTags = Array.isArray(availableTags) ? availableTags : [];
        const safeMasteredTags = Array.isArray(masteredTags) ? masteredTags : [];
        
        const filtered = safeAvailableTags.filter((tag) => !safeMasteredTags.includes(tag));
        const mapped = filtered.map((tag) => ({
          value: tag,
          label: tag.charAt(0).toUpperCase() + tag.slice(1).replace(/[-_]/g, " "),
        }));
        
        console.log("🔍 FocusAreasSelector: Using fallback logic, selectableOptions:", mapped);
        return { selectableOptions: Array.isArray(mapped) ? mapped : [], previewTags: [] };
      }
      
      // Separate selectable tags from preview tags for better UX
      console.log("🔍 FocusAreasSelector: focusAvailability.tags:", focusAvailability.tags);
      
      const selectableTags = focusAvailability.tags.filter(tag => tag && tag.selectable) || [];
      console.log("🔍 FocusAreasSelector: selectableTags:", selectableTags);
      
      const selectableOptions = selectableTags.map(tag => ({
          value: tag.tagId || '',
          label: tag.reason === "preview-unlocked" ? `${tag.name || 'Unknown'} (Preview)` : (tag.name || 'Unknown'),
          group: tag.tier === "core" ? "Core Concepts" : 
                 tag.tier === "fundamental" ? "Fundamental Techniques" :
                 "Advanced Techniques"
        })) || [];
      console.log("🔍 FocusAreasSelector: selectableOptions for MultiSelect:", selectableOptions);
      
      // Preview tags shown separately below
      const previewTags = focusAvailability.tags
        .filter(tag => tag && tag.reason === "preview-locked")
        .map(tag => ({
          tagId: tag.tagId || '',
          name: tag.name || 'Unknown',
          tier: tag.tier || 'unknown',
          reason: tag.reason || 'preview-locked'
        })) || [];
      
      return { 
        selectableOptions: Array.isArray(selectableOptions) ? selectableOptions : [], 
        previewTags: Array.isArray(previewTags) ? previewTags : [] 
      };
      
    } catch (error) {
      console.error("❌ Error in getTagOptions:", error);
      // Always return safe arrays even on error
      return { selectableOptions: [], previewTags: [] };
    }
  };

  const renderSelectedTagBadges = () => {
    if (selectedFocusAreas.length === 0) {
      return (
        <Text size="sm" c="dimmed">
          No focus areas selected. System will use adaptive tag selection.
        </Text>
      );
    }

    return (
      <Group gap="xs">
        {selectedFocusAreas.map((tag) => {
          const progress = getTagMasteryProgress(tag);
          const isMastered = masteredTags.includes(tag);
          
          return (
            <Tooltip 
              key={tag} 
              label={`${progress}% mastery (${isMastered ? "Mastered" : "In Progress"})`}
            >
              <Badge
                color={isMastered ? "green" : progress >= 80 ? "yellow" : progress >= 60 ? "blue" : "gray"}
                variant="light"
                leftSection={isMastered ? <IconTrophy size={12} /> : null}
              >
                {tag.charAt(0).toUpperCase() + tag.slice(1).replace(/[-_]/g, " ")}
                {!isMastered && ` (${progress}%)`}
              </Badge>
            </Tooltip>
          );
        })}
      </Group>
    );
  };

  if (loading) {
    return (
      <Card withBorder p="md">
        <Group gap="xs" mb="md">
          <IconTarget size={20} />
          <Title order={4}>Focus Areas</Title>
        </Group>
        <Group justify="center" p="xl">
          <Loader size="md" />
        </Group>
      </Card>
    );
  }

  return (
    <Card withBorder p="md">
      <Stack gap="md">
        <Group gap="xs">
          <IconTarget size={20} />
          <Title order={4}>Focus Areas</Title>
          <Tooltip label="Select 1-3 tags to focus your learning. Selected tags will appear more frequently in practice sessions.">
            <IconInfoCircle size={16} style={{ cursor: "help" }} />
          </Tooltip>
        </Group>

        <Text size="sm" c="dimmed">
          Current Learning Tier: <Text component="span" fw={500}>{currentTier}</Text>
        </Text>

        {/* System Recommendations - Always Show */}
        <div>
          <Group gap="xs" mb="xs">
            <Text size="sm" fw={500}>System Recommendations</Text>
            <Badge variant="light" color="cyan" size="xs">
              System Recommended
            </Badge>
          </Group>
          <Group gap="xs">
            {(focusAvailability?.systemSelectedTags || []).length > 0 ? (
              focusAvailability.systemSelectedTags.map((tag, index) => (
                <Badge key={index} variant="light" color="cyan" size="sm">
                  {tag.charAt(0).toUpperCase() + tag.slice(1).replace(/[-_]/g, " ")}
                </Badge>
              ))
            ) : (
              <Text size="xs" c="dimmed">No system recommendations available</Text>
            )}
          </Group>
          <Text size="xs" c="dimmed" mt="xs">
            Based on your performance and learning progress
          </Text>
        </div>

        {focusAvailability?.access && (
          <Group gap="xs">
            <Badge 
              color="green" 
              size="sm"
              variant="filled"
            >
              Core: {focusAvailability.access.core}
            </Badge>
            {focusAvailability.access.fundamental !== "none" && (
              <Badge 
                color={focusAvailability.access.fundamental === "confirmed" ? "blue" : "yellow"} 
                size="sm"
                variant="light"
              >
                Fundamental: {focusAvailability.access.fundamental}
              </Badge>
            )}
            {focusAvailability.access.advanced !== "none" && (
              <Badge 
                color={focusAvailability.access.advanced === "confirmed" ? "purple" : "yellow"} 
                size="sm"
                variant="light"
              >
                Advanced: {focusAvailability.access.advanced}
              </Badge>
            )}
          </Group>
        )}

        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}

        {/* Show Active Session Tags Preview */}
        {focusAvailability?.activeSessionTags && focusAvailability.activeSessionTags.length > 0 && (
          <Stack gap="xs">
            <Group gap="xs" align="center">
              <Text size="sm" fw={500}>Your next session will focus on:</Text>
              <Badge 
                size="sm" 
                color={showCustomMode ? "violet" : "blue"} 
                variant="light"
              >
                {showCustomMode ? "Your Preferences" : "System Recommended"}
              </Badge>
            </Group>
            <Group gap="xs">
              {focusAvailability.activeSessionTags.map((tag) => (
                <Badge
                  key={tag}
                  color={showCustomMode ? "violet" : "cyan"}
                  variant="filled"
                  size="sm"
                >
                  {tag.charAt(0).toUpperCase() + tag.slice(1).replace(/[-_]/g, " ")}
                </Badge>
              ))}
            </Group>
            <Text size="xs" c="dimmed">
              {showCustomMode 
                ? "Your preferences get priority in problem selection"
                : "Intelligently selected based on your learning progress"
              }
            </Text>
          </Stack>
        )}

        {/* Custom/System Mode Toggle */}
        {focusAvailability && (
          <Group gap="xs">
            <Button
              size="xs"
              variant={showCustomMode ? "light" : "filled"}
              onClick={() => {
                const newCustomMode = !showCustomMode;
                setShowCustomMode(newCustomMode);
                
                if (!newCustomMode) {
                  // Switching to system selection - clear user overrides
                  setSelectedFocusAreas([]);
                  setHasChanges(true);
                } else {
                  // Switching to custom mode - start with current user overrides or empty
                  setSelectedFocusAreas(focusAvailability?.userOverrideTags || []);
                }
              }}
            >
              {showCustomMode ? "Use System Selection" : "Customize Focus Areas"}
            </Button>
            {showCustomMode && (
              <Text size="xs" c="dimmed">
                Override system selection with your own choices
              </Text>
            )}
          </Group>
        )}

        {(() => {
          const tagOptionsResult = getTagOptions() || {};
          const { selectableOptions = [], previewTags = [] } = tagOptionsResult;
          console.log("🔍 Render: tagOptionsResult:", tagOptionsResult);
          console.log("🔍 Render: selectableOptions after destructuring:", selectableOptions);
          
          // Additional safety check - ensure arrays are valid
          if (!Array.isArray(selectableOptions)) {
            console.error("❌ Render guard: selectableOptions is not an array:", selectableOptions);
            return <Alert color="red">Error loading focus areas. Please reload the page.</Alert>;
          }
          
          // Always show selector when in custom mode or for brand new users
          // In system mode, show as read-only preview
          
          // Handle brand new users with starter pack
          console.log("🔍 RENDER: Checking starter pack condition");
          console.log("🔍 RENDER: focusAvailability:", focusAvailability);
          console.log("🔍 RENDER: focusAvailability?.starterCore:", focusAvailability?.starterCore);
          console.log("🔍 RENDER: typeof focusAvailability?.starterCore:", typeof focusAvailability?.starterCore);
          console.log("🔍 RENDER: Array.isArray(focusAvailability?.starterCore):", Array.isArray(focusAvailability?.starterCore));
          
          if (focusAvailability?.starterCore?.length > 0) {
            console.log("🔍 RENDER: Entering starter pack branch");
            
            // Prepare starter core data with detailed logging
            const starterCoreArray = focusAvailability?.starterCore || [];
            console.log("🔍 RENDER: starterCoreArray (after || []):", starterCoreArray);
            console.log("🔍 RENDER: starterCoreArray type:", typeof starterCoreArray);
            console.log("🔍 RENDER: starterCoreArray isArray:", Array.isArray(starterCoreArray));
            
            let starterMultiSelectData;
            try {
              starterMultiSelectData = starterCoreArray.map(tag => {
                console.log("🔍 RENDER: Mapping starter tag:", tag, "type:", typeof tag);
                return {
                  value: tag,
                  label: tag.charAt(0).toUpperCase() + tag.slice(1).replace(/[-_]/g, " ")
                };
              });
              console.log("🔍 RENDER: starterMultiSelectData result:", starterMultiSelectData);
            } catch (error) {
              console.error("❌ RENDER: Error mapping starterCore data:", error);
              starterMultiSelectData = [];
            }
            
            return (
              <Stack gap="md">
                <Alert color="blue" variant="light">
                  <Stack gap="xs">
                    <Text size="sm" fw={500}>Choose where to start</Text>
                    <Text size="sm">
                      Pick up to 2 Core Concepts to focus on. You&apos;ll unlock more as you practice.
                    </Text>
                  </Stack>
                </Alert>
                <MultiSelect
                  label="Select Starter Focus Areas (up to 2 tags)"
                  placeholder="Choose Core Concepts to start with..."
                  data={starterMultiSelectData}
                  value={selectedFocusAreas}
                  onChange={handleFocusAreasChange}
                  maxValues={2}
                  searchable
                  clearable
                  disabled={loading || saving}
                  description="These Core Concepts will have 1.2x higher weight in your first sessions"
                  styles={{
                    dropdown: {
                      zIndex: 1000,
                      backgroundColor: 'white !important',
                      border: '1px solid #ccc !important',
                      color: 'black !important',
                    },
                    item: {
                      backgroundColor: 'white !important',
                      color: 'black !important',
                      '&:hover': {
                        backgroundColor: '#f8f9fa !important',
                        color: 'black !important',
                      },
                      '&[data-hovered]': {
                        backgroundColor: '#f8f9fa !important',
                        color: 'black !important',
                      },
                      '&[data-selected]': {
                        backgroundColor: '#e7f5ff !important',
                        color: '#1c7ed6 !important',
                      },
                      '&[data-selected]:hover, &[data-selected][data-hovered]': {
                        backgroundColor: '#d0ebff !important',
                        color: '#1c7ed6 !important',
                      }
                    }
                  }}
                />
              </Stack>
            );
          }
          
          if (selectableOptions.length === 0 && previewTags.length === 0) {
            return (
              <Alert color="yellow" variant="light">
                <Text size="sm">
                  No tags available yet. Complete some coding sessions to unlock focus area selection.
                </Text>
              </Alert>
            );
          }
          
          console.log("🔍 RENDER: About to render main MultiSelect");
          console.log("🔍 RENDER: selectableOptions before main MultiSelect:", selectableOptions);
          console.log("🔍 RENDER: selectableOptions type:", typeof selectableOptions);
          console.log("🔍 RENDER: selectableOptions isArray:", Array.isArray(selectableOptions));
          console.log("🔍 RENDER: selectableOptions length:", selectableOptions?.length);
          
          console.log("🔍 RENDER: selectedFocusAreas value:", selectedFocusAreas);
          console.log("🔍 RENDER: selectedFocusAreas type:", typeof selectedFocusAreas);
          console.log("🔍 RENDER: selectedFocusAreas isArray:", Array.isArray(selectedFocusAreas));
          
          return (
            <Stack gap="md">
              {/* Custom MultiSelect with real dynamic data - only show when in custom mode */}
              {showCustomMode && (
                <CustomMultiSelect
                  label="Select Focus Areas (1-3 tags)"
                  data={selectableOptions}
                  value={selectedFocusAreas}
                  onChange={handleFocusAreasChange}
                  maxValues={3}
                  searchable
                  clearable
                  placeholder="Choose tags to focus on..."
                  description="These tags will have 1.2x higher weight in session generation"
                />
              )}
              
              {/* Show preview tags separately - only when custom mode is active */}
              {showCustomMode && previewTags.length > 0 && (
                <Stack gap="xs">
                  <Text size="sm" fw={500} c="dimmed">
                    Preview - Unlock with more attempts:
                  </Text>
                  <Group gap="xs">
                    {previewTags.map((tag) => (
                      <Badge
                        key={tag.tagId}
                        color="gray"
                        variant="light"
                        style={{ opacity: 0.6, cursor: 'not-allowed' }}
                      >
                        {tag.name} ({tag.tier === "fundamental" ? "Fund" : "Adv"})
                      </Badge>
                    ))}
                  </Group>
                  <Text size="xs" c="dimmed">
                    Complete problems with these tag types to unlock them for selection
                  </Text>
                </Stack>
              )}
            </Stack>
          );
        })()}

        <Stack gap="xs">
          <Text size="sm" fw={500}>Current Focus Areas:</Text>
          {renderSelectedTagBadges()}
        </Stack>

        {masteredTags.length > 0 && (
          <Stack gap="xs">
            <Text size="sm" fw={500} c="green">
              Recently Mastered Tags:
            </Text>
            <Group gap="xs">
              {masteredTags.slice(0, 5).map((tag) => (
                <Badge key={tag} color="green" variant="filled" leftSection={<IconTrophy size={12} />}>
                  {tag.charAt(0).toUpperCase() + tag.slice(1).replace(/[-_]/g, " ")}
                </Badge>
              ))}
              {masteredTags.length > 5 && (
                <Text size="sm" c="dimmed">+{masteredTags.length - 5} more</Text>
              )}
            </Group>
          </Stack>
        )}

        {showCustomMode && (
          <Group justify="space-between">
            <Group gap="xs">
              <Button
                onClick={handleSave}
                loading={saving}
                disabled={!hasChanges || loading}
                size="sm"
              >
                Save Changes
              </Button>
              
              <Button
                variant="light"
                onClick={handleReset}
                disabled={selectedFocusAreas.length === 0 || loading || saving}
                size="sm"
              >
                Clear All
              </Button>
            </Group>

            <Button
              variant="subtle"
              onClick={loadData}
              disabled={loading || saving}
              size="sm"
              leftSection={<IconRefresh size={16} />}
            >
              Refresh
            </Button>
          </Group>
        )}

        {showCustomMode && selectedFocusAreas.length > 0 && (
          <Alert color="blue" variant="light">
            <Text size="sm">
              <Text component="span" fw={500}>Impact:</Text> Problems with these tags will appear 
              20% more frequently in your practice sessions. The system will still ensure balanced 
              learning across all fundamental concepts.
            </Text>
          </Alert>
        )}
      </Stack>
    </Card>
  );
}