
import React, { useState, useEffect } from "react";
import { Tooltip, UnstyledButton, Title, rem } from "@mantine/core";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  IconGauge,
  IconDeviceDesktopAnalytics,
  IconCards,
  IconUser,
  IconSettings,
} from "@tabler/icons-react";
import { MantineLogo } from "@mantinex/mantine-logo";
import classes from "../css/DoubleNavbar.module.css";

const mainLinksMockdata = [
  { icon: IconGauge, label: "Dashboard", path: "/" },
  { icon: IconDeviceDesktopAnalytics, label: "Analytics", path: "/analytics" },
  { icon: IconCards, label: "FlashCards", path: "/review" },
  { icon: IconUser, label: "Account", path: "/account" },
  { icon: IconSettings, label: "Settings", path: "/settings" },
];

const subLinksData = {
  "/": ["Stats", "Reports", "Goals"],
  "/review": ["Flashcards", "Practice", "Review"],
  "/analytics": ["Progress", "Conversions", "Sources"],
  "/account": ["Profile", "Settings", "Notifications"],
  "/settings": ["General", "Appearance", "Accessibility"],
};

export function DoubleNavbar() {
  const navigate = useNavigate();
  const location = useLocation();

  // Set default active page based on the initial route
  const [active, setActive] = useState("Dashboard");
  const [activeLink, setActiveLink] = useState("/");

  // Update active main link when the route changes
  useEffect(() => {
    const splitPath = location.pathname.split("/");
    const mainPath = splitPath[1] === "" ? "/" : `/${splitPath[1]}`;

    // If we're at a sub-route under the root, use "/" as the main path
    const resolvedMainPath =
      mainPath === "/stats" || mainPath === "/reports" || mainPath === "/goals"
        ? "/"
        : mainPath;

    const currentMainLink = mainLinksMockdata.find(
      (link) => link.path === resolvedMainPath
    );

    // Set active link and label if found
    if (currentMainLink) {
      setActive(currentMainLink.label);
      setActiveLink(resolvedMainPath); // Reset activeLink to main path
    }
  }, [location.pathname]);

  // Generate main links
  const mainLinks = mainLinksMockdata.map((link) => (
    <Tooltip
      label={link.label}
      position="right"
      withArrow
      transitionProps={{ duration: 0 }}
      key={link.label}
    >
      <UnstyledButton
        onClick={() => {
          setActive(link.label);
          setActiveLink(link.path); // Reset activeLink to the base main path
          navigate(link.path);
        }}
        className={classes.mainLink}
        data-active={link.label === active || undefined}
      >
        <link.icon style={{ width: rem(22), height: rem(22) }} stroke={1.5} />
      </UnstyledButton>
    </Tooltip>
  ));

  // Get the current sub-links based on the main path (resolved for root)
  const currentSubLinks = subLinksData[activeLink] || [];

  // Render sub-links with absolute paths
  const subLinks = currentSubLinks.map((subLink) => {
    const subLinkPath = `${
      activeLink === "/" ? "" : activeLink
    }/${subLink.toLowerCase()}`;
    return (
      <Link
        to={subLinkPath} // Use absolute path for sub-links
        className={classes.link}
        data-active={location.pathname === subLinkPath || undefined} // Check if the current location matches the sub-link path
        onClick={() => {
          setActiveLink(activeLink); // Maintain activeLink as main path for correct sub-link matching
        }}
        key={subLink}
      >
        {subLink}
      </Link>
    );
  });

  return (
    <nav className={classes.navbar}>
      <div className={classes.wrapper}>
        <div className={classes.aside}>
          <div className={classes.logo}>
            <MantineLogo type="mark" size={30} />
          </div>
          {mainLinks}
        </div>
        <div className={classes.main}>
          <Title order={4} className={classes.title}>
            {active}
          </Title>
          <div>{subLinks}</div> {/* Display sub-links */}
        </div>
      </div>
    </nav>
  );
}
