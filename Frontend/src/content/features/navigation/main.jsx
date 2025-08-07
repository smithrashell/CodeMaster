import React, { useState, useEffect } from "react";
import "../../css/theme.css";
import { useNavigate, useLocation, Link, Outlet } from "react-router-dom";
import ThemeToggle from "../../../shared/components/ThemeToggle.jsx";
import { useNav } from "../../../shared/provider/navprovider.jsx";
import { DoubleNavbar } from "../../../shared/components/DoubleNavbar.jsx";
import Header from "../../components/navigation/header.jsx";
import { useChromeMessage } from "../../../shared/hooks/useChromeMessage";
import { ContentOnboardingTour } from "../../components/onboarding";
import { 
  checkContentOnboardingStatus, 
  completeContentOnboarding,
  getResumeStep 
} from "../../../shared/services/onboardingService";

const Menubutton = ({ isAppOpen, setIsAppOpen, currPath }) => {
  const navigate = useNavigate();

  const isMainMenu = currPath === "/";

  const handleClick = () => {
    if (isAppOpen && !isMainMenu) {
      navigate("/"); // Go home
    } else {
      setIsAppOpen(!isAppOpen); // Toggle drawer
    }
  };
  const handleLabelChange = (isAppOpen, isMainMenu) => {
    if (isAppOpen && !isMainMenu) {
      return "Go Home";
    } else if (isAppOpen && isMainMenu) {
      return "Close Menu";
    } else if (!isAppOpen && isMainMenu) {
      return "Open Menu";
    }
  };
  return (
    <button
      id="cd-menuButton"
      onClick={handleClick}
      aria-label={handleLabelChange(isAppOpen, isMainMenu)}
      title={handleLabelChange(isAppOpen, isMainMenu)}
    >
      CM
    </button>
  );
};

// Function to extract the problem slug from the URL
const getProblemSlugFromUrl = (url) => {
  const match = url.match(/problems\/([^\/]+)\/?/);
  return match ? match[1] : null; // Return the problem slug or null if no match
};

export default function Main() {
  console.log("🚀 CONTENT SCRIPT MAIN COMPONENT LOADED");
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isAppOpen, setIsAppOpen } = useNav();
  const [problemTitle, setProblemTitle] = useState("");
  const [problemFound, setProblemFound] = useState(false);
  const [loading, setLoading] = useState(false);
  const [problemData, setProblemData] = useState(null);
  const [theme, setTheme] = useState("light");
  const [currentProblem, setCurrentProblem] = useState(
    getProblemSlugFromUrl(window.location.href)
  ); // Initialize with the current URL slug
  const [settings, setSettings] = useState(null);
  const [showContentOnboarding, setShowContentOnboarding] = useState(false);
  const [contentOnboardingStatus, setContentOnboardingStatus] = useState(null);

  // Function to fetch problem data based on the problem slug
  const fetchProblemData = (problemSlug) => {
    if (!problemSlug) {
      return; // No valid problem slug, do nothing
    }

    const problemTitleFormatted = problemSlug.replace(/-/g, " ");
    const title =
      problemTitleFormatted.charAt(0).toUpperCase() +
      problemTitleFormatted.slice(1);
    // console.log("Slug", problemSlug);
    // console.log("Problem Title:", title);
    setProblemTitle(title);

    setLoading(true);

    chrome.runtime.sendMessage(
      {
        type: "getProblemByDescription",
        description: title,
        slug: problemSlug,
      },
      (response) => {
        if (response.error) {
          console.error("❌ Error in getProblemByDescription", response.error);
          setProblemData(null);
          setProblemFound(false);
          setLoading(false);
        }
        if (response.problem) {
          console.log("✅ Problem found: ", response.problem);
          setProblemFound(response.found);
          setProblemData(response.problem);
        } else {
          console.warn("⚠️ No problem found");
          setProblemData(null);
          setProblemFound(false);
        }
        setLoading(false);
      }
    );
  };
  // New approach using custom hook
  const {
    data: onboardingData,
    loading: onboardingLoading,
    error: onboardingError,
  } = useChromeMessage({ type: "onboardingUserIfNeeded" }, [], {
    onSuccess: (response) => {
      if (response) {
        console.log("onboardingUserIfNeeded", response);
      }
    },
  });

  // // UseEffect to handle initial data fetch on component mount

  useEffect(() => {
    // Run the initial data fetch once when the component mounts
    console.log("Current problem slug:", currentProblem);
    fetchProblemData(currentProblem);
  }, []); // Empty dependency array ensures it only runs once on mount

  // Check content onboarding status with resume capability
  useEffect(() => {
    const checkContentOnboarding = async () => {
      try {
        console.log("🔍 Checking content onboarding status...");
        const status = await checkContentOnboardingStatus();
        console.log("📊 Content onboarding status:", status);
        setContentOnboardingStatus(status);
        
        // Show onboarding tour if not completed - independent of data onboarding
        if (!status.isCompleted) {
          console.log("✅ Content onboarding not completed, showing tour");
          // Small delay to ensure the DOM is ready
          const delayTime = status.lastActiveStep ? 500 : 1000; // Shorter delay for resume
          setTimeout(() => {
            console.log("🚀 Setting showContentOnboarding to true");
            setShowContentOnboarding(true);
          }, delayTime);
        } else {
          console.log("⏭️ Content onboarding already completed");
        }
      } catch (error) {
        console.error("❌ Error checking content onboarding status:", error);
        // Fallback: show onboarding anyway for new users
        console.log("🔄 Fallback: showing onboarding due to error");
        setTimeout(() => {
          setShowContentOnboarding(true);
        }, 1000);
      }
    };

    // Run immediately - no longer dependent on data onboarding
    checkContentOnboarding();
  }, []); // Empty dependency array - run once on mount

  // Function to handle URL changes after initial load
  const handleUrlChange = () => {
    const newProblemSlug = getProblemSlugFromUrl(window.location.href);
    console.log("New problem slug:", newProblemSlug);
    console.log("Current problem slug:", currentProblem); // Added log for debugging

    // Only trigger updates if the problem slug changes
    if (newProblemSlug && newProblemSlug !== currentProblem) {
      console.log("Problem changed. Reloading...");
      setCurrentProblem(newProblemSlug); // Update the current problem slug
      fetchProblemData(newProblemSlug); // Fetch new problem data

      // If the user is not on the main route ("/"), navigate them back to "/"
      if (pathname !== "/") {
        console.log("Navigating back to main route due to problem change...");
        navigate("/", { replace: true }); // Navigate to the main route
      }
    }
  };
  const backupIndexedDB = async () => {
    try {
      console.log("📌 Sending backup request to background script...");
      chrome.runtime.sendMessage({ type: "getBackupFile" }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("❌ Runtime Error:", chrome.runtime.lastError.message);
          return;
        }
        if (!response || response.error) {
          console.error("❌ Backup Error:", response?.error || "No response");
          return;
        }

        console.log(
          "✅ Backup data retrieved:",
          response.backup,
          Object.keys(response.backup)
        );
        // response.backup.forEach((property) => { console.log(property); });
        console.log("✅ Backup data retrieved:", Object.keys(response.backup));

        if (!response.backup) {
          alert("❌ Backup file is empty.");
          return;
        }

        const backupBlob = new Blob(
          [
            JSON.stringify(
              response.backup.stores.standard_problems.data,
              null,
              2
            ),
          ],
          {
            type: "application/json",
          }
        );

        const a = document.createElement("a");
        a.href = URL.createObjectURL(backupBlob);
        a.download = `IndexedDB_Backup_${new Date().toISOString()}.json`;
        document.body.appendChild(a);
        a.click(() => {
          console.log("✅ Backup file downloaded.");
        });
        document.body.removeChild(a);

        console.log("✅ Backup file downloaded.");
      });
    } catch (error) {
      console.error("❌ Error downloading backup:", error);
    }
  };

  // Use browser events to detect URL changes
  useEffect(() => {
    // Monkey-patch pushState and replaceState to detect changes
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.history.pushState = function (...args) {
      originalPushState.apply(window.history, args);
      window.dispatchEvent(new Event("locationchange"));
    };

    window.history.replaceState = function (...args) {
      originalReplaceState.apply(window.history, args);
      window.dispatchEvent(new Event("locationchange"));
    };

    // Listen for popstate and locationchange events
    window.addEventListener("popstate", handleUrlChange);
    window.addEventListener("locationchange", handleUrlChange);

    // Cleanup on component unmount
    return () => {
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      window.removeEventListener("popstate", handleUrlChange);
      window.removeEventListener("locationchange", handleUrlChange);
    };
  }, [currentProblem, pathname, navigate]);

  // Content onboarding handlers
  const handleCompleteContentOnboarding = async () => {
    try {
      await completeContentOnboarding();
      setShowContentOnboarding(false);
      setContentOnboardingStatus((prev) => ({ ...prev, isCompleted: true }));
    } catch (error) {
      console.error("Error completing content onboarding:", error);
    }
  };

  const handleCloseContentOnboarding = () => {
    setShowContentOnboarding(false);
  };

  const shouldShowNav = pathname === "/";
  const hideBackup = true;
  return (
    <div>
      {pathname !== "/Timer" && (
        <div style={{ display: "flex", flexDirection: "row" }}>
          <Menubutton
            setIsAppOpen={setIsAppOpen}
            isAppOpen={isAppOpen}
            currPath={pathname}
          />

          {/* <Homebutton currPath={pathname} toggle={toggle} /> */}
        </div>
      )}
      <div style={{ display: isAppOpen ? "block" : "none" }}>
        <Outlet />
        {shouldShowNav && (
          <div
            id="cd-mySidenav"
            className={isAppOpen ? "cd-sidenav" : "cd-sidenav cd-hidden"}
          >
            <Header title="CodeMaster" />
            <div className="cd-sidenav__content">
              <nav id="nav">
                {/* <Link to="/Strategy">Strategy Map</Link> */}
                <Link to="/ProbGen">Generator</Link>
                <Link to="/ProbStat">Statistics</Link>
                <Link to="/Settings">Settings</Link>
{/* Problem Link - Only show when on a valid LeetCode problem page */}
                {currentProblem && (
                  <Link
                    to="/ProbTime"
                    state={{ problemData, problemFound }}
                    onClick={(e) => {
                      if (!problemData || loading) {
                        e.preventDefault(); // Prevent navigation if problemData is not ready
                      }
                    }}
                    className={`${
                      !problemData || loading
                        ? "link-disabled"
                        : loading
                        ? "nav-link-loading"
                        : ""
                    }`}
                    title={
                      loading
                        ? "Loading problem data..."
                        : !problemData
                        ? "Problem data not available"
                        : problemData && problemFound
                        ? "Start a new attempt on this problem"
                        : "Add this problem to your collection"
                    }
                  >
                    {loading ? (
                      "Loading..."
                    ) : problemData && problemFound ? (
                      <>
                        <span className="cd-nav-icon cd-retry-icon"></span>New
                        Attempt
                      </>
                    ) : problemData && !problemFound ? (
                      <>
                        <span className="cd-nav-icon cd-plus-icon"></span>New
                        Problem
                      </>
                    ) : (
                      <>
                        <span className="cd-nav-icon cd-problem-icon"></span>
                        {problemTitle || currentProblem}
                      </>
                    )}
                  </Link>
                )}

                {/* <div style={{ display: "flex", flexDirection: "column" }}>
                <button
                  style={{
                    marginTop: "10px",
                    backgroundColor: "green",
                    color: "white",
                  }}
                  onClick={backupIndexedDB}
                >
                  Restore
                </button>
              </div> */}
              </nav>

              <ThemeToggle />
            </div>
          </div>
        )}
      </div>
      
      {/* Content Script Onboarding Tour */}
      <ContentOnboardingTour
        isVisible={showContentOnboarding}
        onComplete={handleCompleteContentOnboarding}
        onClose={handleCloseContentOnboarding}
      />
    </div>
  );
}
