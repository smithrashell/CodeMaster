import { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { mainLinksMockdata } from "../components/navigationConstants";

export function useNavigation() {
  const location = useLocation();
  const [active, setActive] = useState("Overview");
  const [activeLink, setActiveLink] = useState("/");
  const [showSettingsSubmenu, setShowSettingsSubmenu] = useState(false);

  useEffect(() => {
    const currentPath = location.pathname;
    const splitPath = currentPath.split("/");
    const mainPath = splitPath[1] === "" ? "/" : `/${splitPath[1]}`;

    // Map current path to main navigation path
    const resolvedMainPath = mainPath;

    const currentMainLink = mainLinksMockdata.find(
      (link) => link.path === resolvedMainPath
    );

    if (currentMainLink) {
      setActive(currentMainLink.label);
      setActiveLink(resolvedMainPath);
    }

    // Auto-expand settings if inside any settings sub-tab
    if (resolvedMainPath === "/settings") {
      setShowSettingsSubmenu(false); // No longer using settings submenu since routes are flattened
    } else {
      setShowSettingsSubmenu(false);
    }
  }, [location.pathname]);

  return {
    active,
    activeLink,
    showSettingsSubmenu,
    setActive,
    setActiveLink,
    setShowSettingsSubmenu,
  };
}