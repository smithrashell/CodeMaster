import React, { useState, useEffect } from "react";
import { Tooltip, UnstyledButton, Title, rem } from "@mantine/core";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  IconGauge,
  IconDeviceDesktopAnalytics,
  IconCards,
  IconUser,
  IconClock,
  IconSettings,
} from "@tabler/icons-react";
import { MantineLogo } from "@mantinex/mantine-logo";
import classes from "./css/DoubleNavbar.module.css";

const mainLinksMockdata = [
  { icon: IconGauge, label: "Dashboard", path: "/" },
  { icon: IconDeviceDesktopAnalytics, label: "Analytics", path: "/analytics" },
  { icon: IconClock, label: "Sessions", path: "/sessions" },
  { icon: IconCards, label: "Flashcards", path: "/review" },
  { icon: IconUser, label: "Account", path: "/account" },
];

const subLinksData = {
  "/": ["Stats", "Progress", "Goals"],
  "/analytics": ["Trends", "Mistake Analysis", "Tag Mastery"],
  "/sessions": ["Session Metrics", "Productivity Insights"],
  "/review": ["Flashcards", "Practice", "Review"],
  "/account": ["Profile", "Notifications", "Settings"],
  "/account/settings": ["General", "Appearance", "Accessibility"],
};

export function DoubleNavbar() {
  const navigate = useNavigate();
  const location = useLocation();

  const [active, setActive] = useState("Dashboard");
  const [activeLink, setActiveLink] = useState("/");
  const [showSettingsSubmenu, setShowSettingsSubmenu] = useState(false);

  useEffect(() => {
    const splitPath = location.pathname.split("/");
    const mainPath = splitPath[1] === "" ? "/" : `/${splitPath[1]}`;

    const resolvedMainPath = ["/stats", "/progress", "/goals"].includes(
      mainPath
    )
      ? "/"
      : mainPath;

    const currentMainLink = mainLinksMockdata.find(
      (link) => link.path === resolvedMainPath
    );

    if (currentMainLink) {
      setActive(currentMainLink.label);
      setActiveLink(resolvedMainPath);
    }

    // Auto-expand settings if inside any settings sub-tab
    if (
      resolvedMainPath === "/account" &&
      location.pathname.includes("/account/settings")
    ) {
      setShowSettingsSubmenu(true);
    } else {
      setShowSettingsSubmenu(false);
    }
  }, [location.pathname]);

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
          setActiveLink(link.path);
          navigate(link.path);
        }}
        className={classes.mainLink}
        data-active={link.label === active || undefined}
      >
        <link.icon style={{ width: rem(22), height: rem(22) }} stroke={1.5} />
      </UnstyledButton>
    </Tooltip>
  ));

  const currentSubLinks = subLinksData[activeLink] || [];

  const subLinks = currentSubLinks.map((subLink) => {
    if (subLink === "Settings") {
      return (
        <div
          key={subLink}
          className={`${classes.settingsDropdownContainer} ${
            showSettingsSubmenu ? classes.settingsOpen : ""
          }`}
        >
          <div
            className={classes.link}
            onClick={() => setShowSettingsSubmenu(!showSettingsSubmenu)}
          >
            {subLink}
          </div>
          {showSettingsSubmenu && (
            <div className={classes.settingsDropdown}>
              {subLinksData["/account/settings"].map((setting) => (
                <Link
                  key={setting}
                  to={`/account/settings/${setting.toLowerCase()}`}
                  className={`${classes.subLink} ${
                    location.pathname.includes(setting.toLowerCase())
                      ? classes.activeSubLink
                      : ""
                  }`}
                >
                  {setting}
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }

    const subLinkPath = `${activeLink === "/" ? "" : activeLink}/${subLink
      .toLowerCase()
      .replace(/\s+/g, "-")}`;

    return (
      <Link
        to={subLinkPath}
        className={classes.link}
        data-active={location.pathname === subLinkPath || undefined}
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
          <div>{subLinks}</div>
        </div>
      </div>
    </nav>
  );
}
